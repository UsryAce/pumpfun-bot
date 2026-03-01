import axios from "axios";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

console.log("🚀 Pump.fun Bot Started (Polling Mode)");

let lastSignature = null;

async function checkTransactions() {
  try {
    const response = await axios.post(
      `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [TOKEN_MINT, { limit: 1 }]
      }
    );

    const latest = response.data.result[0];
    if (!latest) return;

    if (latest.signature === lastSignature) return;

    lastSignature = latest.signature;

    const tx = await axios.post(
      `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [latest.signature, { encoding: "jsonParsed" }]
      }
    );

    if (!tx.data.result) return;

    const solChange =
      (tx.data.result.meta.preBalances[0] -
        tx.data.result.meta.postBalances[0]) / 1e9;

    if (solChange <= 0) return;

    await axios.post(DISCORD_WEBHOOK, {
      content:
        `🚀 BUY DETECTED\n\n` +
        `SOL Spent: ${solChange}\n\n` +
        `Tx: https://solscan.io/tx/${latest.signature}`
    });

    console.log("Posted Buy:", solChange);

  } catch (err) {
    console.log("Error:", err.message);
  }
}

setInterval(checkTransactions, 3000);
