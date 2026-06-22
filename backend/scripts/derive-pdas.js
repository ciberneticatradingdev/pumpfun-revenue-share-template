const { PublicKey } = require('@solana/web3.js');

const TOKEN_MINT = new PublicKey('BpohMg7TFASqaa7tFZFQuUiPSMcvE7AYiy3AdgrApump');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
const PUMPSWAP_PROGRAM = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_AMM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const CREATOR = new PublicKey('E6a8GByqZC6goTWJJQPSHWcUNV6yaHPP17Ld3p2CgvJo');

const FEE_ACCOUNT = 'CzCama39YPFvbJp8hDR2dL9XQ6g7zKwuxrzgTx6bqQtW';
const AMM_POOL = 'ECWefEgFVe5JCuYdVaYX95RuscQgP5AGGjugVJc2refh';

console.log('=== PumpSwap fee account PDA derivation ===');
console.log('Target:', FEE_ACCOUNT);

const pumpswapSeeds = [
  ['pool', TOKEN_MINT.toBuffer(), WSOL_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer(), USDC_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer()],
  ['pool', CREATOR.toBuffer(), TOKEN_MINT.toBuffer(), WSOL_MINT.toBuffer()],
  ['pool', CREATOR.toBuffer(), TOKEN_MINT.toBuffer(), USDC_MINT.toBuffer()],
  ['pool', CREATOR.toBuffer(), TOKEN_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer(), CREATOR.toBuffer()],
  ['fee', TOKEN_MINT.toBuffer()],
  ['creator_fee', TOKEN_MINT.toBuffer()],
  ['fee_account', TOKEN_MINT.toBuffer()],
  ['fee_accumulator', TOKEN_MINT.toBuffer()],
  [TOKEN_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer(), WSOL_MINT.toBuffer(), USDC_MINT.toBuffer()],
];

for (const seeds of pumpswapSeeds) {
  const seedBuffers = seeds.map(s => typeof s === 'string' ? Buffer.from(s) : s);
  try {
    const [pda] = PublicKey.findProgramAddressSync(seedBuffers, PUMPSWAP_PROGRAM);
    const seedDesc = seeds.map(s => typeof s === 'string' ? '"' + s + '"' : 'pubkey').join(', ');
    const match = pda.toBase58() === FEE_ACCOUNT ? ' ✅ MATCH!' : '';
    console.log('  [' + seedDesc + '] => ' + pda.toBase58() + match);
  } catch (e) {}
}

console.log('\n=== Pump.fun AMM pool PDA derivation ===');
console.log('Target:', AMM_POOL);

const ammSeeds = [
  ['pool', TOKEN_MINT.toBuffer(), WSOL_MINT.toBuffer()],
  ['pool', WSOL_MINT.toBuffer(), TOKEN_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer(), USDC_MINT.toBuffer()],
  ['pool', USDC_MINT.toBuffer(), TOKEN_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer()],
  ['pool', CREATOR.toBuffer(), TOKEN_MINT.toBuffer(), WSOL_MINT.toBuffer()],
  ['pool', CREATOR.toBuffer(), TOKEN_MINT.toBuffer()],
  ['pool', TOKEN_MINT.toBuffer(), CREATOR.toBuffer()],
  [TOKEN_MINT.toBuffer()],
];

for (const seeds of ammSeeds) {
  const seedBuffers = seeds.map(s => typeof s === 'string' ? Buffer.from(s) : s);
  try {
    const [pda] = PublicKey.findProgramAddressSync(seedBuffers, PUMP_AMM);
    const seedDesc = seeds.map(s => typeof s === 'string' ? '"' + s + '"' : 'pubkey').join(', ');
    const match = pda.toBase58() === AMM_POOL ? ' ✅ MATCH!' : '';
    console.log('  [' + seedDesc + '] => ' + pda.toBase58() + match);
  } catch (e) {}
}

// Event authority
const [eventAuth] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMPSWAP_PROGRAM);
console.log('\nEvent Authority:', eventAuth.toBase58(), eventAuth.toBase58() === 'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1' ? '✅' : '❌');

const [ammEventAuth] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_AMM);
console.log('AMM Event Authority:', ammEventAuth.toBase58(), ammEventAuth.toBase58() === 'GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR' ? '✅' : '❌');
