import {
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  SystemProgram,
  ComputeBudgetProgram,
} from '@solana/web3.js';
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
} from '@solana/spl-token';
import { config } from '../config';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { getConnection } from '../utils/solana';

export interface ClaimResult {
  claimed: boolean;
  amountUsdc: string;
  amountSol: string;
  txSignature: string;
  claimRoundId: number;
}

// Discriminators
const COLLECT_CREATOR_FEE_V2_DISC = Buffer.from('cf118af204221338', 'hex');
const COLLECT_COIN_CREATOR_FEE_DISC = Buffer.from('a039592ab58b2b42', 'hex');

// Derive creator vault PDA on Pump program: seeds ["creator-vault", creator]
const [CREATOR_VAULT] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator-vault'), config.walletPublicKey.toBuffer()],
  config.pumpswapProgram
);

// Derive event authority PDA on Pump program
const [PUMP_EVENT_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from('__event_authority')],
  config.pumpswapProgram
);

// Derive coin creator vault authority PDA on Pump AMM: seeds ["creator_vault", coin_creator]
const [AMM_VAULT_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator_vault'), config.walletPublicKey.toBuffer()],
  config.pumpAmm
);

// Derive AMM event authority
const [AMM_EVENT_AUTHORITY] = PublicKey.findProgramAddressSync(
  [Buffer.from('__event_authority')],
  config.pumpAmm
);

async function logEvent(type: string, message: string, data?: Record<string, unknown>): Promise<void> {
  await pool.query(
    'INSERT INTO events (type, message, data) VALUES ($1, $2, $3)',
    [type, message, data ? JSON.stringify(data) : null]
  );
}

async function getTokenAccountBalance(
  connection: ReturnType<typeof getConnection>,
  ata: PublicKey
): Promise<bigint> {
  try {
    const info = await connection.getTokenAccountBalance(ata);
    return BigInt(info.value.amount);
  } catch {
    return BigInt(0);
  }
}

async function accountExists(
  connection: ReturnType<typeof getConnection>,
  pubkey: PublicKey
): Promise<boolean> {
  try {
    const info = await connection.getAccountInfo(pubkey);
    return info !== null;
  } catch {
    return false;
  }
}

/**
 * Build collect_creator_fee_v2 instruction for a given quote mint.
 *
 * Accounts:
 *  [0] creator (signer, writable)
 *  [1] creator_token_account — ATA(creator, quote_mint)
 *  [2] creator_vault — PDA ["creator-vault", creator] on Pump program
 *  [3] creator_vault_token_account — ATA(creator_vault, quote_mint)
 *  [4] quote_mint
 *  [5] token_program
 *  [6] associated_token_program
 *  [7] system_program
 *  [8] event_authority — PDA ["__event_authority"]
 *  [9] program — Pump program
 */
function buildCollectCreatorFeeV2(quoteMint: PublicKey): TransactionInstruction {
  const creatorTokenAccount = getAssociatedTokenAddressSync(quoteMint, config.walletPublicKey);
  const vaultTokenAccount = getAssociatedTokenAddressSync(quoteMint, CREATOR_VAULT, true);

  return new TransactionInstruction({
    programId: config.pumpswapProgram,
    keys: [
      { pubkey: config.walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: CREATOR_VAULT, isSigner: false, isWritable: true },
      { pubkey: vaultTokenAccount, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: PUMP_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: config.pumpswapProgram, isSigner: false, isWritable: false },
    ],
    data: COLLECT_CREATOR_FEE_V2_DISC,
  });
}

/**
 * Build collect_coin_creator_fee instruction for Pump AMM.
 *
 * Accounts:
 *  [0] quote_mint
 *  [1] token_program
 *  [2] coin_creator (signer, writable)
 *  [3] coin_creator_vault_authority — PDA ["creator_vault", coin_creator] on Pump AMM
 *  [4] coin_creator_vault_ata — ATA(vault_authority, quote_mint)
 *  [5] coin_creator_token_account — ATA(coin_creator, quote_mint)
 *  [6] event_authority — PDA ["__event_authority"] on Pump AMM
 *  [7] program — Pump AMM program
 */
function buildCollectCoinCreatorFee(quoteMint: PublicKey): TransactionInstruction {
  const vaultAta = getAssociatedTokenAddressSync(quoteMint, AMM_VAULT_AUTHORITY, true);
  const creatorTokenAccount = getAssociatedTokenAddressSync(quoteMint, config.walletPublicKey);

  return new TransactionInstruction({
    programId: config.pumpAmm,
    keys: [
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: config.walletPublicKey, isSigner: true, isWritable: true },
      { pubkey: AMM_VAULT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: creatorTokenAccount, isSigner: false, isWritable: true },
      { pubkey: AMM_EVENT_AUTHORITY, isSigner: false, isWritable: false },
      { pubkey: config.pumpAmm, isSigner: false, isWritable: false },
    ],
    data: COLLECT_COIN_CREATOR_FEE_DISC,
  });
}

function formatUsdcAmount(rawAmount: bigint): string {
  const whole = rawAmount / BigInt(1_000_000);
  const fraction = rawAmount % BigInt(1_000_000);
  const fractionStr = fraction.toString().padStart(6, '0');
  return `${whole}.${fractionStr}`;
}

function formatSolAmount(rawLamports: bigint): string {
  const whole = rawLamports / BigInt(1_000_000_000);
  const fraction = rawLamports % BigInt(1_000_000_000);
  const fractionStr = fraction.toString().padStart(9, '0');
  return `${whole}.${fractionStr}`;
}

export async function claimCreatorFees(): Promise<ClaimResult | null> {
  const connection = getConnection();

  await logEvent('claim_started', 'Starting fee claim cycle');
  logger.info('Starting fee claim...');

  try {
    // --- Check balances BEFORE claim ---
    const creatorUsdcAta = getAssociatedTokenAddressSync(config.usdcMint, config.walletPublicKey);
    const creatorWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, config.walletPublicKey);
    const solBalanceBefore = await connection.getBalance(config.walletPublicKey);

    const usdcBalanceBefore = await getTokenAccountBalance(connection, creatorUsdcAta);
    logger.info('Balances before claim', {
      usdc: usdcBalanceBefore.toString(),
      sol: solBalanceBefore,
    });

    // --- Build instructions ---
    const instructions: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ];

    // 1. Create creator USDC ATA (idempotent, in case it doesn't exist)
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        config.walletPublicKey,
        creatorUsdcAta,
        config.walletPublicKey,
        config.usdcMint
      )
    );

    // 2. Create creator WSOL ATA (idempotent)
    instructions.push(
      createAssociatedTokenAccountIdempotentInstruction(
        config.walletPublicKey,
        creatorWsolAta,
        config.walletPublicKey,
        NATIVE_MINT
      )
    );

    // 3. Collect USDC creator fees from bonding curve
    instructions.push(buildCollectCreatorFeeV2(config.usdcMint));

    // 4. Collect WSOL creator fees from bonding curve
    instructions.push(buildCollectCreatorFeeV2(NATIVE_MINT));

    // 5. Collect WSOL creator fees from Pump AMM (if vault ATA exists)
    const ammVaultWsolAta = getAssociatedTokenAddressSync(NATIVE_MINT, AMM_VAULT_AUTHORITY, true);
    const ammVaultUsdcAta = getAssociatedTokenAddressSync(config.usdcMint, AMM_VAULT_AUTHORITY, true);

    const ammWsolExists = await accountExists(connection, ammVaultWsolAta);
    const ammUsdcExists = await accountExists(connection, ammVaultUsdcAta);

    if (ammWsolExists) {
      logger.info('AMM WSOL vault ATA exists, adding AMM WSOL collection');
      instructions.push(buildCollectCoinCreatorFee(NATIVE_MINT));
    } else {
      logger.info('AMM WSOL vault ATA does not exist, skipping AMM WSOL collection');
    }

    if (ammUsdcExists) {
      logger.info('AMM USDC vault ATA exists, adding AMM USDC collection');
      instructions.push(buildCollectCoinCreatorFee(config.usdcMint));
    }

    // 6. Close WSOL ATA to reclaim SOL rent (optional, keeps things clean)
    instructions.push(
      createCloseAccountInstruction(
        creatorWsolAta,
        config.walletPublicKey,
        config.walletPublicKey
      )
    );

    // --- Build and sign versioned transaction ---
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const messageV0 = new TransactionMessage({
      payerKey: config.walletPublicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();

    const tx = new VersionedTransaction(messageV0);
    tx.sign([config.walletKeypair]);

    // --- Simulate first ---
    const sim = await connection.simulateTransaction(tx);
    if (sim.value.err) {
      const logs = sim.value.logs || [];
      const noFeeLog = logs.some((l: string) =>
        l.includes('No creator fee to collect') ||
        l.includes('no fees') ||
        l.includes('InsufficientFunds')
      );

      logger.error('Simulation failed', {
        err: JSON.stringify(sim.value.err),
        logs: logs.slice(-10),
      });

      if (noFeeLog) {
        logger.info('No creator fees to collect');
        await logEvent('claim_completed', 'No fees available to claim', { reason: 'no_fees' });
        return null;
      }

      // Try without AMM instructions (they might fail if pool not graduated)
      logger.info('Retrying simulation without AMM instructions...');
      const instructionsNoAmm = instructions.slice(0, -1); // remove closeAccount
      // Remove AMM instructions (the last few before closeAccount)
      const filteredInstructions = [
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 100_000 }),
        ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
        createAssociatedTokenAccountIdempotentInstruction(
          config.walletPublicKey,
          creatorUsdcAta,
          config.walletPublicKey,
          config.usdcMint
        ),
        createAssociatedTokenAccountIdempotentInstruction(
          config.walletPublicKey,
          creatorWsolAta,
          config.walletPublicKey,
          NATIVE_MINT
        ),
        buildCollectCreatorFeeV2(config.usdcMint),
        buildCollectCreatorFeeV2(NATIVE_MINT),
        createCloseAccountInstruction(
          creatorWsolAta,
          config.walletPublicKey,
          config.walletPublicKey
        ),
      ];

      const msgNoAmm = new TransactionMessage({
        payerKey: config.walletPublicKey,
        recentBlockhash: blockhash,
        instructions: filteredInstructions,
      }).compileToV0Message();

      const txNoAmm = new VersionedTransaction(msgNoAmm);
      txNoAmm.sign([config.walletKeypair]);

      const simNoAmm = await connection.simulateTransaction(txNoAmm);
      if (simNoAmm.value.err) {
        const noFeeLog2 = (simNoAmm.value.logs || []).some((l: string) =>
          l.includes('No creator fee to collect')
        );
        if (noFeeLog2) {
          logger.info('No creator fees to collect (no AMM sim)');
          await logEvent('claim_completed', 'No fees available to claim', { reason: 'no_fees' });
          return null;
        }
        throw new Error(`Simulation failed (no AMM): ${JSON.stringify(simNoAmm.value.err)} logs: ${(simNoAmm.value.logs || []).slice(-10)}`);
      }

      // Use the no-AMM transaction
      const txSignature = await connection.sendTransaction(txNoAmm, {
        skipPreflight: true,
        maxRetries: 3,
      });
      logger.info('Claim transaction sent (no AMM)', { signature: txSignature });

      await connection.confirmTransaction({
        signature: txSignature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');
      logger.info('Claim transaction confirmed', { signature: txSignature });

      return await processClaimResult(txSignature, connection, creatorUsdcAta, usdcBalanceBefore, solBalanceBefore);
    }

    // --- Send the full transaction ---
    const txSignature = await connection.sendTransaction(tx, {
      skipPreflight: true,
      maxRetries: 3,
    });
    logger.info('Claim transaction sent', { signature: txSignature });

    await connection.confirmTransaction({
      signature: txSignature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');
    logger.info('Claim transaction confirmed', { signature: txSignature });

    return await processClaimResult(txSignature, connection, creatorUsdcAta, usdcBalanceBefore, solBalanceBefore);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Fee claim failed', { error: errorMessage });
    await logEvent('claim_failed', `Fee claim failed: ${errorMessage}`, {
      error: errorMessage,
    });
    return null;
  }
}

async function processClaimResult(
  txSignature: string,
  connection: ReturnType<typeof getConnection>,
  creatorUsdcAta: PublicKey,
  usdcBalanceBefore: bigint,
  solBalanceBefore: number
): Promise<ClaimResult | null> {
  // Wait for balance to update
  await new Promise(resolve => setTimeout(resolve, 2000));

  const usdcBalanceAfter = await getTokenAccountBalance(connection, creatorUsdcAta);
  const solBalanceAfter = await connection.getBalance(config.walletPublicKey);

  const usdcDelta = usdcBalanceAfter - usdcBalanceBefore;
  const solDelta = BigInt(solBalanceAfter - solBalanceBefore);

  logger.info('Balances after claim', {
    usdc: usdcBalanceAfter.toString(),
    sol: solBalanceAfter,
    usdcDelta: usdcDelta.toString(),
    solDelta: solDelta.toString(),
  });

  const amountUsdc = formatUsdcAmount(usdcDelta > BigInt(0) ? usdcDelta : BigInt(0));
  const amountSol = formatSolAmount(solDelta > BigInt(0) ? solDelta : BigInt(0));

  // If no USDC was claimed, check if there's any SOL
  if (usdcDelta <= BigInt(0) && solDelta <= BigInt(0)) {
    logger.info('No fees to claim (both deltas = 0)');
    await logEvent('claim_completed', 'No fees available to claim', {
      txSignature,
      usdcDelta: '0',
      solDelta: '0',
    });
    return null;
  }

  if (parseFloat(amountUsdc) < config.minClaimUsdc && parseFloat(amountSol) <= 0) {
    logger.info('Fees below threshold', { amountUsdc, amountSol, threshold: config.minClaimUsdc });
    await logEvent('claim_completed', 'Fees below distribution threshold', {
      txSignature,
      amountUsdc,
      amountSol,
    });
    return null;
  }

  logger.info('Fees claimed successfully', { amountUsdc, amountSol, txSignature });

  // Record in database
  const insertResult = await pool.query<{ id: number }>(
    `INSERT INTO claim_rounds (tx_signature, amount_usdc, fee_account, status)
     VALUES ($1, $2, $3, 'completed') RETURNING id`,
    [txSignature, amountUsdc, CREATOR_VAULT.toBase58()]
  );

  const claimRoundId = insertResult.rows[0].id;

  await logEvent('claim_completed', `Claimed ${amountUsdc} USDC + ${amountSol} SOL`, {
    txSignature,
    amountUsdc,
    amountSol,
    claimRoundId,
  });

  return {
    claimed: true,
    amountUsdc,
    amountSol,
    txSignature,
    claimRoundId,
  };
}
