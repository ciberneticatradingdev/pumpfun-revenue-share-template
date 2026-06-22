const { PublicKey, Connection } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');

const conn = new Connection('https://api.mainnet-beta.solana.com', { commitment: 'confirmed' });

const TOKEN_MINT = new PublicKey('BpohMg7TFASqaa7tFZFQuUiPSMcvE7AYiy3AdgrApump');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const PUMPSWAP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_AMM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const FEE_ACCOUNT = new PublicKey('CzCama39YPFvbJp8hDR2dL9XQ6g7zKwuxrzgTx6bqQtW');
const AMM_POOL = new PublicKey('ECWefEgFVe5JCuYdVaYX95RuscQgP5AGGjugVJc2refh');

async function main() {
  // 1. Check fee account info
  console.log('=== Fee Account Info ===');
  const feeInfo = await conn.getAccountInfo(FEE_ACCOUNT);
  if (feeInfo) {
    console.log('Owner:', feeInfo.owner.toBase58());
    console.log('Lamports:', feeInfo.lamports);
    console.log('Data length:', feeInfo.data.length);
    console.log('Data (hex):', Buffer.from(feeInfo.data).toString('hex').substring(0, 200));
    console.log('Executable:', feeInfo.executable);
    
    // Check if token mint is in the data
    const tokenMintBytes = TOKEN_MINT.toBuffer();
    const dataStr = Buffer.from(feeInfo.data).toString('hex');
    const tokenMintHex = tokenMintBytes.toString('hex');
    console.log('Token mint in data:', dataStr.includes(tokenMintHex) ? 'YES' : 'NO');
    
    // Check for WSOL and USDC mints in data
    const wsolHex = WSOL_MINT.toBuffer().toString('hex');
    const usdcHex = USDC_MINT.toBuffer().toString('hex');
    console.log('WSOL mint in data:', dataStr.includes(wsolHex) ? 'YES' : 'NO');
    console.log('USDC mint in data:', dataStr.includes(usdcHex) ? 'YES' : 'NO');
  }

  // 2. Check AMM pool info
  console.log('\n=== AMM Pool Info ===');
  const ammInfo = await conn.getAccountInfo(AMM_POOL);
  if (ammInfo) {
    console.log('Owner:', ammInfo.owner.toBase58());
    console.log('Lamports:', ammInfo.lamports);
    console.log('Data length:', ammInfo.data.length);
    console.log('Data (hex):', Buffer.from(ammInfo.data).toString('hex').substring(0, 200));
    
    const dataStr = Buffer.from(ammInfo.data).toString('hex');
    const tokenMintHex = TOKEN_MINT.toBuffer().toString('hex');
    console.log('Token mint in data:', dataStr.includes(tokenMintHex) ? 'YES' : 'NO');
    
    const wsolHex = WSOL_MINT.toBuffer().toString('hex');
    console.log('WSOL mint in data:', dataStr.includes(wsolHex) ? 'YES' : 'NO');
  }

  // 3. Get token accounts owned by the fee account
  console.log('\n=== Token accounts of Fee Account ===');
  const feeTokenAccounts = await conn.getParsedTokenAccountsByOwner(FEE_ACCOUNT, { programId: new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') });
  for (const ta of feeTokenAccounts.value) {
    const info = ta.account.data.parsed.info;
    console.log(`  Mint: ${info.mint}, Amount: ${info.tokenAmount.amount} (${info.tokenAmount.uiAmount})`);
  }

  // 4. Try to find PumpSwap pools for this token using getProgramAccounts
  console.log('\n=== Searching PumpSwap pools for this token ===');
  // The pool data likely contains the token mint at some offset
  // Let's try filtering by the token mint bytes
  const tokenMintBase58 = TOKEN_MINT.toBase58();
  const tokenMintBytes = TOKEN_MINT.toBuffer();
  
  // Try common offsets for pool mint
  for (const offset of [0, 8, 16, 32, 40, 48]) {
    try {
      const accounts = await conn.getProgramAccounts(PUMPSWAP, {
        filters: [
          { memcmp: { offset: offset, bytes: tokenMintBase58 } },
          { dataSize: 264 } // typical pool size
        ],
      });
      if (accounts.length > 0) {
        console.log(`  Found ${accounts.length} accounts at offset ${offset} (size 264):`);
        for (const acc of accounts) {
          console.log(`    ${acc.pubkey.toBase58()}`);
        }
      }
    } catch (e) {
      // skip
    }
  }

  // 5. Also try without size filter
  console.log('\n=== PumpSwap accounts containing token mint (no size filter) ===');
  for (const offset of [0, 8, 16, 32, 40, 48]) {
    try {
      const accounts = await conn.getProgramAccounts(PUMPSWAP, {
        filters: [
          { memcmp: { offset: offset, bytes: tokenMintBase58 } },
        ],
      });
      if (accounts.length > 0 && accounts.length < 20) {
        console.log(`  Offset ${offset}: ${accounts.length} accounts`);
        for (const acc of accounts.slice(0, 5)) {
          console.log(`    ${acc.pubkey.toBase58()} (size: ${acc.account.data.length})`);
        }
      }
    } catch (e) {
      // skip
    }
  }

  // 6. Search AMM pools
  console.log('\n=== Pump.fun AMM pools for this token ===');
  for (const offset of [0, 8, 16, 32, 40, 48]) {
    try {
      const accounts = await conn.getProgramAccounts(PUMP_AMM, {
        filters: [
          { memcmp: { offset: offset, bytes: tokenMintBase58 } },
        ],
      });
      if (accounts.length > 0 && accounts.length < 20) {
        console.log(`  Offset ${offset}: ${accounts.length} accounts`);
        for (const acc of accounts.slice(0, 5)) {
          console.log(`    ${acc.pubkey.toBase58()} (size: ${acc.account.data.length})`);
        }
      }
    } catch (e) {
      // skip
    }
  }
}

main().catch(console.error);
