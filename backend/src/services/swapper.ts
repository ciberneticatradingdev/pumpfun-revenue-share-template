import {
  VersionedTransaction,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
} from '@solana/web3.js';
import {
  createCloseAccountInstruction,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  NATIVE_MINT,
} from '@solana/spl-token';
import { config } from '../config';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { getConnection } from '../utils/solana';

// Jupiter Ultra API (no API key required for basic usage)
const JUPITER_ORDER_URL = 'https://api.jup.ag/ultra/v1/order';
const JUPITER_EXECUTE_URL = 'https://api.jup.ag/ultra/v1/execute';

// Known mints we want to keep
const KEEP_MINTS = new Set([
  config.usdcMint.toBase58(),
  config.wsolMint.toBase58(),
  config.tokenMint.toBase58(),
  NATIVE_MINT.toBase58(),
]);

export interface SwapResult {
  success: boolean;
  inputAmountUsdc: string;
  outputAmountSol: string;
  txSignature: string;
  cleanupTxSignature?: string;
  accountsClosed?: number;
  solReclaimed?: string;
  error?: string;
}

async function logEvent(type: string, message: string, data?: Record<string, unknown>): Promise<void> {
  await pool.query(
    'INSERT INTO events (type, message, data) VALUES ($1, $2, $3)',
    [type, message, data ? JSON.stringify(data) : null]
  );
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

/**
 * Close all empty token accounts that aren't USDC, WSOL, or our token.
 * This reclaims SOL rent from intermediate swap accounts.
 */
export async function cleanupDustTokenAccounts(): Promise<{ closed: number; solReclaimed: bigint; txSignature: string } | null> {
  const connection = getConnection();

  try {
    // Get all token accounts (both Token and Token-2022 programs)
    const [tokenAccounts, token2022Accounts] = await Promise.all([
      connection.getParsedTokenAccountsByOwner(config.walletPublicKey, { programId: TOKEN_PROGRAM_ID }),
      connection.getParsedTokenAccountsByOwner(config.walletPublicKey, { programId: TOKEN_2022_PROGRAM_ID }),
    ]);

    const allAccounts = [...tokenAccounts.value, ...token2022Accounts.value];

    // Find accounts to close: not in KEEP_MINTS, balance is 0, and it's not WSOL (handled separately)
    const accountsToClose: { pubkey: PublicKey; programId: PublicKey }[] = [];

    for (const acc of allAccounts) {
      const info = acc.account.data.parsed.info;
      const mint = info.mint as string;
      const amount = BigInt(info.tokenAmount.amount);

      if (KEEP_MINTS.has(mint)) continue;
      if (amount > BigInt(0)) continue;

      accountsToClose.push({
        pubkey: acc.pubkey,
        programId: acc.account.owner,
      });
    }

    if (accountsToClose.length === 0) {
      logger.info('No dust token accounts to clean up');
      return null;
    }

    logger.info(`Found ${accountsToClose.length} dust token accounts to close`);

    // Close in batches (max ~15 closeAccount instructions per tx to stay under size limit)
    const BATCH = 15;
    let totalClosed = 0;
    let totalReclaimed = BigInt(0);
    let lastTxSig = '';

    for (let i = 0; i < accountsToClose.length; i += BATCH) {
      const batch = accountsToClose.slice(i, i + BATCH);

      const instructions: TransactionInstruction[] = batch.map(acc =>
        createCloseAccountInstruction(
          acc.pubkey,
          config.walletPublicKey,
          config.walletPublicKey,
          [],
          acc.programId
        )
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      const messageV0 = new TransactionMessage({
        payerKey: config.walletPublicKey,
        recentBlockhash: blockhash,
        instructions,
      }).compileToV0Message();

      const { VersionedTransaction } = await import('@solana/web3.js');
      const tx = new VersionedTransaction(messageV0);
      tx.sign([config.walletKeypair]);

      const txSig = await connection.sendTransaction(tx, { skipPreflight: true, maxRetries: 3 });
      await connection.confirmTransaction({ signature: txSig, blockhash, lastValidBlockHeight }, 'confirmed');

      // Each closed account reclaims ~0.002039 SOL (2039280 lamports) of rent
      totalReclaimed += BigInt(2_039_280) * BigInt(batch.length);
      totalClosed += batch.length;
      lastTxSig = txSig;

      logger.info(`Closed batch of ${batch.length} accounts`, { txSignature: txSig, totalClosed });
    }

    logger.info('Dust cleanup complete', { accountsClosed: totalClosed, solReclaimed: formatSolAmount(totalReclaimed) });

    await logEvent('dust_cleanup', `Closed ${totalClosed} dust token accounts, reclaimed ~${formatSolAmount(totalReclaimed)} SOL`, {
      accountsClosed: totalClosed,
      solReclaimed: formatSolAmount(totalReclaimed),
      txSignature: lastTxSig,
    });

    return { closed: totalClosed, solReclaimed: totalReclaimed, txSignature: lastTxSig };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('Dust cleanup failed', { error: errorMessage });
    return null;
  }
}

/**
 * Swap USDC → SOL via Jupiter Ultra API.
 * Uses onlyDirectRoutes to minimize intermediate hops.
 * Closes any dust token accounts created by the swap.
 *
 * @param usdcAmountRaw - USDC amount in raw units (6 decimals)
 * @returns SwapResult with tx signature and amounts
 */
export async function swapUsdcToSol(usdcAmountRaw: bigint): Promise<SwapResult> {
  const inputAmountUsdc = formatUsdcAmount(usdcAmountRaw);
  logger.info('Starting USDC→SOL swap via Jupiter Ultra', { inputAmountUsdc, raw: usdcAmountRaw.toString() });

  try {
    // 1. Get order (quote + unsigned transaction) with onlyDirectRoutes to minimize hops
    const orderParams = new URLSearchParams({
      inputMint: config.usdcMint.toBase58(),
      outputMint: config.wsolMint.toBase58(),
      amount: usdcAmountRaw.toString(),
      taker: config.walletPublicKey.toBase58(),
      onlyDirectRoutes: 'true',
    });

    const orderResponse = await fetch(`${JUPITER_ORDER_URL}?${orderParams}`);

    if (!orderResponse.ok) {
      const errorText = await orderResponse.text();
      throw new Error(`Jupiter order failed: ${orderResponse.status} ${errorText}`);
    }

    const order = await orderResponse.json() as Record<string, unknown>;

    if (!order || !order['transaction']) {
      const errorMsg = order['errorMessage'] || order['error'] || JSON.stringify(order);
      throw new Error(`Jupiter order error: ${errorMsg}`);
    }

    const expectedOutRaw = BigInt(order['outAmount'] as string);
    const expectedOutputSol = formatSolAmount(expectedOutRaw);
    const requestId = order['requestId'] as string;

    // Log the route for transparency
    const routePlan = order['routePlan'] as Array<Record<string, unknown>>;
    const routeHops = routePlan?.length || 0;
    const routeLabels = routePlan?.map((h: Record<string, unknown>) => {
      const si = h['swapInfo'] as Record<string, unknown>;
      return `${si['label']}: ${String(si['inputMint']).slice(0, 8)}→${String(si['outputMint']).slice(0, 8)}`;
    }) || [];

    logger.info('Jupiter order received', {
      inputAmountUsdc,
      expectedOutputSol,
      router: order['router'],
      routeHops,
      route: routeLabels,
      requestId,
    });

    // 2. Deserialize and sign the transaction
    const txBase64 = order['transaction'] as string;
    const txBuf = Buffer.from(txBase64, 'base64');
    const transaction = VersionedTransaction.deserialize(txBuf);
    transaction.sign([config.walletKeypair]);

    const signedTxBase64 = Buffer.from(transaction.serialize()).toString('base64');

    // 3. Execute the swap via Jupiter
    const executeResponse = await fetch(JUPITER_EXECUTE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signedTransaction: signedTxBase64,
        requestId: requestId,
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      throw new Error(`Jupiter execute failed: ${executeResponse.status} ${errorText}`);
    }

    const executeResult = await executeResponse.json() as Record<string, unknown>;

    const txSignature = executeResult['signature'] as string;
    if (!txSignature) {
      throw new Error(`No signature in execute response: ${JSON.stringify(executeResult)}`);
    }

    // Confirm via our own RPC
    const connection = getConnection();
    try {
      await connection.confirmTransaction(txSignature, 'confirmed');
    } catch {
      logger.warn('Could not confirm via RPC, Jupiter likely already landed', { txSignature });
    }

    logger.info('USDC→SOL swap confirmed', {
      txSignature,
      inputAmountUsdc,
      expectedOutputSol,
    });

    // 4. Clean up any dust token accounts created by intermediate hops
    await new Promise(resolve => setTimeout(resolve, 1000));
    const cleanupResult = await cleanupDustTokenAccounts();

    await logEvent('reserve_swap', `Swapped ${inputAmountUsdc} USDC → ${expectedOutputSol} SOL for gas reserve`, {
      txSignature,
      inputAmountUsdc,
      expectedOutputSol,
      requestId,
      router: order['router'],
      routeHops,
      route: routeLabels,
      cleanup: cleanupResult ? {
        accountsClosed: cleanupResult.closed,
        solReclaimed: formatSolAmount(cleanupResult.solReclaimed),
        txSignature: cleanupResult.txSignature,
      } : null,
    });

    return {
      success: true,
      inputAmountUsdc,
      outputAmountSol: expectedOutputSol,
      txSignature,
      cleanupTxSignature: cleanupResult?.txSignature,
      accountsClosed: cleanupResult?.closed,
      solReclaimed: cleanupResult ? formatSolAmount(cleanupResult.solReclaimed) : undefined,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    logger.error('USDC→SOL swap failed', { error: errorMessage });
    await logEvent('reserve_swap_failed', `Swap failed: ${errorMessage}`, {
      inputAmountUsdc,
      error: errorMessage,
    });

    return {
      success: false,
      inputAmountUsdc,
      outputAmountSol: '0',
      txSignature: '',
      error: errorMessage,
    };
  }
}
