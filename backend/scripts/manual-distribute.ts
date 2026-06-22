import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync } from '@solana/spl-token';
import { config } from '../src/config';
import { pool } from '../src/db/pool';
import { runMigrations } from '../src/db/migrate';
import { takeSnapshot } from '../src/services/snapshot';
import { distributeUsdc } from '../src/services/distributor';
import { logger } from '../src/utils/logger';

async function main() {
  await runMigrations();

  const connection = new Connection(config.solanaRpcUrl, { commitment: 'confirmed' });
  const usdcAta = getAssociatedTokenAddressSync(config.usdcMint, config.walletPublicKey);

  // Check current USDC balance
  const balanceInfo = await connection.getTokenAccountBalance(usdcAta);
  const rawBalance = BigInt(balanceInfo.value.amount);
  const usdcBalance = Number(rawBalance) / 1_000_000;

  logger.info('Current deployer USDC balance', { raw: rawBalance.toString(), ui: usdcBalance });

  // Reserve 1 USDC for gas/rent margins
  const amountToDistribute = usdcBalance - 1;
  if (amountToDistribute <= 0) {
    logger.error('Insufficient USDC balance to distribute', { balance: usdcBalance });
    process.exit(1);
  }

  // Format to 6 decimals
  const rawToDistribute = BigInt(Math.floor(amountToDistribute * 1_000_000));
  const amountUsdc = (Number(rawToDistribute) / 1_000_000).toFixed(6);

  logger.info('Distributing manually', { amountUsdc, reservedForGas: '1.000000' });

  // Create a manual claim round record
  const claimResult = await pool.query<{ id: number }>(
    `INSERT INTO claim_rounds (tx_signature, amount_usdc, fee_account, status)
     VALUES ($1, $2, $3, 'completed') RETURNING id`,
    ['manual_distribution', amountUsdc, 'manual_creator_vault']
  );
  const claimRoundId = claimResult.rows[0].id;

  await pool.query(
    `INSERT INTO events (type, message, data) VALUES ($1, $2, $3)`,
    ['manual_claim', `Manual distribution of ${amountUsdc} USDC`, { amountUsdc, claimRoundId }]
  );

  // Take snapshot
  const snapshot = await takeSnapshot();
  logger.info('Snapshot taken', { snapshotId: snapshot.snapshotId, holders: snapshot.holderCount });

  if (snapshot.holderCount === 0) {
    logger.error('No qualified holders found');
    process.exit(1);
  }

  // Distribute
  const distResult = await distributeUsdc(
    claimRoundId,
    snapshot.snapshotId,
    snapshot.holders,
    amountUsdc,
    snapshot.totalSupply
  );

  logger.info('Manual distribution complete!', {
    distributionId: distResult.distributionId,
    totalDistributed: distResult.totalDistributed,
    successCount: distResult.successCount,
    failCount: distResult.failCount,
    status: distResult.status,
  });

  await pool.query(
    `INSERT INTO events (type, message, data) VALUES ($1, $2, $3)`,
    ['manual_distribution_complete', `Manual distribution ${distResult.status}`, {
      distributionId: distResult.distributionId,
      totalDistributed: distResult.totalDistributed,
      successCount: distResult.successCount,
      failCount: distResult.failCount,
      status: distResult.status,
    }]
  );

  await pool.end();
  process.exit(0);
}

main().catch(err => {
  logger.error('Manual distribution failed', { error: err.message, stack: err.stack });
  process.exit(1);
});
