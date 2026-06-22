import { config } from '../src/config';
import { swapUsdcToSol } from '../src/services/swapper';
import { logger } from '../src/utils/logger';

async function main() {
  // Test with 1 USDC (1_000_000 raw)
  const testAmount = BigInt(1_000_000);
  logger.info('Testing real swap: 1 USDC → SOL');

  const result = await swapUsdcToSol(testAmount);

  if (result.success) {
    logger.info('SWAP SUCCESS!', {
      input: result.inputAmountUsdc,
      output: result.outputAmountSol,
      tx: result.txSignature,
    });
  } else {
    logger.error('SWAP FAILED', { error: result.error });
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
