const { PublicKey } = require('@solana/web3.js');
const { getAssociatedTokenAddressSync } = require('@solana/spl-token');

const CREATOR = new PublicKey('E6a8GByqZC6goTWJJQPSHWcUNV6yaHPP17Ld3p2CgvJo');
const PUMPSWAP = new PublicKey('6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P');
const PUMP_AMM = new PublicKey('pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA');
const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');

const EXPECTED_FEE_ACCOUNT = 'CzCama39YPFvbJp8hDR2dL9XQ6g7zKwuxrzgTx6bqQtW';
const EXPECTED_AMM_VAULT = 'ECWefEgFVe5JCuYdVaYX95RuscQgP5AGGjugVJc2refh';

console.log('=== Creator Vault PDA (Pump Program) ===');
console.log('Seeds: ["creator-vault", creator]');
console.log('Creator:', CREATOR.toBase58());

const [creatorVault] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator-vault'), CREATOR.toBuffer()],
  PUMPSWAP
);
console.log('Derived:', creatorVault.toBase58());
console.log('Expected:', EXPECTED_FEE_ACCOUNT);
console.log('Match:', creatorVault.toBase58() === EXPECTED_FEE_ACCOUNT ? 'YES YES YES ✅✅✅' : 'NO ❌');

// Derive vault token accounts
const vaultWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, creatorVault, true);
const vaultUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, creatorVault, true);
console.log('\nVault WSOL ATA:', vaultWsolAta.toBase58());
console.log('Expected:      GJLhFesktfxWfhtS9Gae7yQaQ71HLqBhpV9c4wNPi4GT');
console.log('Match:', vaultWsolAta.toBase58() === 'GJLhFesktfxWfhtS9Gae7yQaQ71HLqBhpV9c4wNPi4GT' ? '✅' : '❌');

console.log('\nVault USDC ATA:', vaultUsdcAta.toBase58());
console.log('Expected:       H5MKDMtpNVeGa6RqnjgwRScLB4wuWq6YBzByA39N65XS');
console.log('Match:', vaultUsdcAta.toBase58() === 'H5MKDMtpNVeGa6RqnjgwRScLB4wuWq6YBzByA39N65XS' ? '✅' : '❌');

console.log('\n=== Coin Creator Vault Authority PDA (Pump AMM) ===');
console.log('Seeds: ["creator_vault", coin_creator]');

const [ammVault] = PublicKey.findProgramAddressSync(
  [Buffer.from('creator_vault'), CREATOR.toBuffer()],
  PUMP_AMM
);
console.log('Derived:', ammVault.toBase58());
console.log('Expected:', EXPECTED_AMM_VAULT);
console.log('Match:', ammVault.toBase58() === EXPECTED_AMM_VAULT ? 'YES YES YES ✅✅✅' : 'NO ❌');

// Derive AMM vault WSOL ATA
const ammVaultWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, ammVault, true);
console.log('\nAMM Vault WSOL ATA:', ammVaultWsolAta.toBase58());
console.log('Expected:           5Lx9wQ4S7P22GWC39mqQrqn1rWWP9JrWMHhqywDy7yWJ');
console.log('Match:', ammVaultWsolAta.toBase58() === '5Lx9wQ4S7P22GWC39mqQrqn1rWWP9JrWMHhqywDy7yWJ' ? '✅' : '❌');

// Creator token accounts
const creatorWsolAta = getAssociatedTokenAddressSync(WSOL_MINT, CREATOR);
const creatorUsdcAta = getAssociatedTokenAddressSync(USDC_MINT, CREATOR);
console.log('\n=== Creator Token Accounts ===');
console.log('Creator WSOL ATA:', creatorWsolAta.toBase58());
console.log('Expected:         DjaGfM8AbvuxLaTD2cnaGSpvoi9iWjMFzTeLTMMB5rKQ');
console.log('Match:', creatorWsolAta.toBase58() === 'DjaGfM8AbvuxLaTD2cnaGSpvoi9iWjMFzTeLTMMB5rKQ' ? '✅' : '❌');

console.log('\nCreator USDC ATA:', creatorUsdcAta.toBase58());
console.log('Expected:         HJfjwL58XuFTBA1a8gEcxU3xJgN6gBUsmbqh6nRr4VE3');
console.log('Match:', creatorUsdcAta.toBase58() === 'HJfjwL58XuFTBA1a8gEcxU3xJgN6gBUsmbqh6nRr4VE3' ? '✅' : '❌');

// AMM event authority
const [ammEventAuth] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMP_AMM);
console.log('\n=== AMM Event Authority ===');
console.log('Derived:', ammEventAuth.toBase58());
console.log('Expected: GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR');
console.log('Match:', ammEventAuth.toBase58() === 'GS4CU59F31iL7aR2Q8zVS8DRrcRnXX1yjQ66TqNVQnaR' ? '✅' : '❌');

// Pump event authority
const [pumpEventAuth] = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], PUMPSWAP);
console.log('\n=== Pump Event Authority ===');
console.log('Derived:', pumpEventAuth.toBase58());
console.log('Expected: Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1');
console.log('Match:', pumpEventAuth.toBase58() === 'Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp9F1' ? '✅' : '❌');
