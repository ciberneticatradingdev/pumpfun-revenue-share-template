import { config } from '../config';
import { logger } from '../utils/logger';
import { sleep } from '../utils/solana';
import { claimCreatorFees } from './claimer';
import { takeSnapshot } from './snapshot';
import { distributeUsdc } from './distributor';
import { swapUsdcToSol } from './swapper';

interface SchedulerState {
  running: boolean;
  lastCycleAt: string | null;
  cycleCount: number;
}

const state: SchedulerState = {
  running: false,
  lastCycleAt: null,
  cycleCount: 0,
};

export function getSchedulerState(): SchedulerState {
  return { ...state };
}

export function startScheduler(): void {
  if (state.running) {
    logger.warn('Scheduler already running');
    return;
  }

  state.running = true;
  logger.info('Scheduler started', {
    cycleMs: config.cycleMs,
    reservePercent: config.reservePercent,
  });
  runLoop();
}

function parseUsdcToRaw(amount: string): bigint {
  const parts = amount.split('.');
  const whole = BigInt(parts[0]) * BigInt(1_000_000);
  const fraction = parts[1] ? BigInt(parts[1].padEnd(6, '0').slice(0, 6)) : BigInt(0);
  return whole + fraction;
}

function formatUsdcAmount(rawAmount: bigint): string {
  const whole = rawAmount / BigInt(1_000_000);
  const fraction = rawAmount % BigInt(1_000_000);
  const fractionStr = fraction.toString().padStart(6, '0');
  return `${whole}.${fractionStr}`;
}

async function runLoop(): Promise<void> {
  while (state.running) {
    state.cycleCount++;
    state.lastCycleAt = new Date().toISOString();
    logger.info(`=== Cycle #${state.cycleCount} started ===`);

    try {
      // Step 1: Claim fees
      const claimResult = await claimCreatorFees();

      if (!claimResult || (parseFloat(claimResult.amountUsdc) < config.minClaimUsdc && parseFloat(claimResult.amountSol) <= 0)) {
        logger.info('Nothing to distribute (below threshold or no claim)', {
          amountUsdc: claimResult?.amountUsdc,
          amountSol: claimResult?.amountSol,
        });
      } else {
        const totalUsdcRaw = parseUsdcToRaw(claimResult.amountUsdc);

        // Step 2: Swap reserve percentage (10%) USDC → SOL for gas
        let distributeUsdcRaw = totalUsdcRaw;

        if (config.reservePercent > 0 && config.reservePercent <= 100) {
          const reserveUsdcRaw = (totalUsdcRaw * BigInt(Math.round(config.reservePercent * 100))) / BigInt(10_000);

          // Only swap if reserve is at least 0.01 USDC (10000 raw)
          if (reserveUsdcRaw >= BigInt(10_000)) {
            logger.info('Swapping reserve to SOL', {
              reservePercent: config.reservePercent,
              reserveUsdc: formatUsdcAmount(reserveUsdcRaw),
              totalUsdc: claimResult.amountUsdc,
            });

            const swapResult = await swapUsdcToSol(reserveUsdcRaw);

            if (swapResult.success) {
              distributeUsdcRaw = totalUsdcRaw - reserveUsdcRaw;
              logger.info('Reserve swap completed, distributing remaining USDC', {
                swapped: swapResult.inputAmountUsdc,
                solReceived: swapResult.outputAmountSol,
                distributeAmount: formatUsdcAmount(distributeUsdcRaw),
                txSignature: swapResult.txSignature,
              });
            } else {
              // If swap fails, distribute full amount (don't block holders)
              logger.warn('Reserve swap failed, distributing full amount to holders', {
                error: swapResult.error,
              });
            }
          } else {
            logger.info('Reserve amount too small to swap, distributing full amount', {
              reserveUsdc: formatUsdcAmount(reserveUsdcRaw),
            });
          }
        }

        const distributeAmountStr = formatUsdcAmount(distributeUsdcRaw);

        // Skip if nothing left to distribute after reserve
        if (parseFloat(distributeAmountStr) < config.minClaimUsdc) {
          logger.info('Nothing left to distribute after reserve swap', {
            distributeAmount: distributeAmountStr,
          });
        } else {
          // Step 3: Take snapshot
          const snapshot = await takeSnapshot();

          if (snapshot.holderCount === 0) {
            logger.info('No qualified holders found, skipping distribution');
          } else {
            // Step 4: Distribute remaining USDC
            const distResult = await distributeUsdc(
              claimResult.claimRoundId,
              snapshot.snapshotId,
              snapshot.holders,
              distributeAmountStr,
              snapshot.totalSupply
            );
            logger.info(`Cycle #${state.cycleCount} complete`, {
              claimed: claimResult.amountUsdc,
              reserveSwapped: config.reservePercent > 0 ? formatUsdcAmount(totalUsdcRaw - distributeUsdcRaw) : '0',
              distributed: distResult.totalDistributed,
              holders: distResult.successCount,
              failed: distResult.failCount,
            });
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logger.error(`Cycle #${state.cycleCount} failed`, { error: errorMessage });
    }

    logger.info(`=== Cycle #${state.cycleCount} ended, waiting ${config.cycleMs}ms ===`);
    await sleep(config.cycleMs);
  }
}
