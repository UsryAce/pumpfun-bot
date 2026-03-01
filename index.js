import axios from "axios";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

console.log("🚀 Pump.fun Bot Started (Mint Tracking)");

let lastSignature = null;

async function checkMintActivity() {
  try {
    const sigRes = await axios.post(
      `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [TOKEN_MINT, { limit: 5 }]
      }
    );

    const signatures = sigRes.data.result;
    if (!signatures.length) return;

    const latest = signatures[0];
    if (latest.signature === lastSignature) return;

    lastSignature = latest.signature;

    const txRes = await axios.post(
      `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [latest.signature, { encoding: "jsonParsed" }]
      }
    );

    const tx = txRes.data.result;
    if (!tx) return;

    const postTokenBalances = tx.meta.postTokenBalances || [];
    const preTokenBalances = tx.meta.preTokenBalances || [];

    const tokenChange = postTokenBalances.find(
      b => b.mint === TOKEN_MINT
    );

    if (!tokenChange) return;

    const owner = tokenChange.owner;
    const postAmount = parseFloat(tokenChange.uiTokenAmount.uiAmount || 0);

    const preBalanceObj = preTokenBalances.find(
      b => b.owner === owner && b.mint === TOKEN_MINT
    );

    const preAmount = preBalanceObj
      ? parseFloat(preBalanceObj.uiTokenAmount.uiAmount || 0)
      : 0;

    const tokenBought = postAmount - preAmount;

    if (tokenBought <= 0) return;

    await axios.post(DISCORD_WEBHOOK, {
      content:
        `🚀 BUY DETECTED\n\n` +
        `Tokens Bought: ${tokenBought}\n\n` +
        `Tx: https://solscan.io/tx/${latest.signature}`
    });

    console.log("Posted Buy:", tokenBought);

  } catch (err) {
    console.log("Error:", err.message);
  }
}

setInterval(checkMintActivity, 3000);
