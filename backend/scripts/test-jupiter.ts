import { config } from '../src/config';

async function testJupiterQuote() {
  const testAmount = BigInt(1_000_000); // 1 USDC

  const quoteParams = new URLSearchParams({
    inputMint: config.usdcMint.toBase58(),
    outputMint: config.wsolMint.toBase58(),
    amount: testAmount.toString(),
    slippageBps: '300',
    swapMode: 'ExactIn',
  });

  const quoteUrl = `https://quote-api.jup.ag/v6/quote?${quoteParams}`;
  console.log('Testing Jupiter v6 quote...');
  console.log('URL:', quoteUrl);

  const response = await fetch(quoteUrl);
  console.log('Status:', response.status);

  if (!response.ok) {
    const text = await response.text();
    console.log('Error response:', text);
    return;
  }

  const data = await response.json();
  console.log('Quote response:', JSON.stringify(data, null, 2).substring(0, 2000));

  if (data.outAmount) {
    const outAmount = BigInt(data.outAmount);
    const solAmount = Number(outAmount) / 1_000_000_000;
    console.log(`\n1 USDC = ${solAmount} SOL`);
  }

  // Test swap endpoint
  console.log('\nTesting swap endpoint...');
  const swapResponse = await fetch('https://quote-api.jup.ag/v6/swap', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: data,
      userPublicKey: config.walletPublicKey.toBase58(),
      wrapAndUnwrapSol: true,
    }),
  });

  console.log('Swap status:', swapResponse.status);

  if (!swapResponse.ok) {
    const text = await swapResponse.text();
    console.log('Swap error:', text);
    return;
  }

  const swapData = await swapResponse.json();
  if (swapData.swapTransaction) {
    console.log('Swap transaction received! Length:', swapData.swapTransaction.length);
    console.log('Test passed OK');
  } else {
    console.log('Swap response:', JSON.stringify(swapData, null, 2).substring(0, 1000));
  }
}

testJupiterQuote().catch(console.error);
