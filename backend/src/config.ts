import dotenv from 'dotenv';
import { PublicKey, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[FATAL] Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  walletPrivateKey: Uint8Array;
  walletKeypair: Keypair;
  walletPublicKey: PublicKey;
  tokenMint: PublicKey;
  databaseUrl: string;
  solanaRpcUrl: string;
  usdcMint: PublicKey;
  wsolMint: PublicKey;
  pumpswapProgram: PublicKey;
  pumpAmm: PublicKey;
  cycleMs: number;
  minHolding: number;
  batchSize: number;
  port: number;
  minClaimUsdc: number;
  reservePercent: number;
}

function loadConfig(): Config {
  const walletKeyStr = requireEnv('WALLET_PRIVATE_KEY');
  const walletPrivateKey = bs58.decode(walletKeyStr);
  const walletKeypair = Keypair.fromSecretKey(walletPrivateKey);

  return {
    walletPrivateKey,
    walletKeypair,
    walletPublicKey: walletKeypair.publicKey,
    tokenMint: new PublicKey(requireEnv('TOKEN_MINT')),
    databaseUrl: requireEnv('DATABASE_URL'),
    solanaRpcUrl: requireEnv('SOLANA_RPC_URL'),
    usdcMint: new PublicKey(optionalEnv('USDC_MINT', 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')),
    wsolMint: new PublicKey(optionalEnv('WSOL_MINT', 'So11111111111111111111111111111111111111112')),
    pumpswapProgram: new PublicKey(optionalEnv('PUMPSWAP_PROGRAM', '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P')),
    pumpAmm: new PublicKey(optionalEnv('PUMP_AMM', 'pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA')),
    cycleMs: parseInt(optionalEnv('CYCLE_MS', '90000'), 10),
    minHolding: parseInt(optionalEnv('MIN_HOLDING', '10000'), 10),
    batchSize: parseInt(optionalEnv('BATCH_SIZE', '10'), 10),
    port: parseInt(optionalEnv('PORT', '4000'), 10),
    minClaimUsdc: parseFloat(optionalEnv('MIN_CLAIM_USDC', '0.001')),
    reservePercent: parseFloat(optionalEnv('RESERVE_PERCENT', '10')),
  };
}

export const config = loadConfig();
