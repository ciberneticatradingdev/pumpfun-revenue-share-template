import { VersionedTransaction } from '@solana/web3.js';
import { config } from '../config';
import { pool } from '../db/pool';
import { logger } from '../utils/logger';
import { getConnection } from '../utils/solana';

// Jupiter Ultra API (no API key required for basic usage)
const JUPITER_ORDER_URL = 'https://api.jup.ag/ultra/v1/order';
const JUPITER_EXECUTE_URL = 'https://api.jup.ag/ultra/v1/execute';

export interface SwapResult {
  success: boolean;
  inputAmountUsdc: string;
  outputAmountSol: string;
  txSignature: string;
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
 * Swap USDC → SOL via Jupiter Ultra API.
 * The SOL stays in the deployer wallet as gas reserve.
 *
 * Flow:
 * 1. GET /order — get unsigned transaction + quote
 * 2. Sign the transaction locally
 * 3. POST /execute — submit signed transaction
 *
 * @param usdcAmountRaw - USDC amount in raw units (6 decimals)
 * @returns SwapResult with tx signature and amounts
 */
export async function swapUsdcToSol(usdcAmountRaw: bigint): Promise<SwapResult> {
  const inputAmountUsdc = formatUsdcAmount(usdcAmountRaw);
  logger.info('Starting USDC→SOL swap via Jupiter Ultra', { inputAmountUsdc, raw: usdcAmountRaw.toString() });

  try {
    // 1. Get order (quote + unsigned transaction)
    const orderParams = new URLSearchParams({
      inputMint: config.usdcMint.toBase58(),
      outputMint: config.wsolMint.toBase58(),
      amount: usdcAmountRaw.toString(),
      taker: config.walletPublicKey.toBase58(),
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

    logger.info('Jupiter order received', {
      inputAmountUsdc,
      expectedOutputSol,
      router: order['router'],
      priceImpact: order['priceImpact'],
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
      // Jupiter may have already confirmed it, just log
      logger.warn('Could not confirm via RPC, Jupiter likely already landed', { txSignature });
    }

    logger.info('USDC→SOL swap confirmed', {
      txSignature,
      inputAmountUsdc,
      expectedOutputSol,
    });

    // 4. Log the swap
    await logEvent('reserve_swap', `Swapped ${inputAmountUsdc} USDC → ${expectedOutputSol} SOL for gas reserve`, {
      txSignature,
      inputAmountUsdc,
      expectedOutputSol,
      requestId,
      router: order['router'],
    });

    return {
      success: true,
      inputAmountUsdc,
      outputAmountSol: expectedOutputSol,
      txSignature,
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
