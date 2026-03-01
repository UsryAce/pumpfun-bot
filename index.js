import axios from "axios";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

const PUMP_FUN_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

console.log("🚀 Pump.fun Bot Started (Program Tracking)");

let lastSignature = null;

async function checkPumpFun() {
  try {
    const sigRes = await axios.post(
      `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [PUMP_FUN_PROGRAM, { limit: 5 }]
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

    const tokenChanges = tx.meta.postTokenBalances || [];

    const isOurToken = tokenChanges.some(
      t => t.mint === TOKEN_MINT
    );

    if (!isOurToken) return;

    const solChange =
      (tx.meta.preBalances[0] - tx.meta.postBalances[0]) / 1e9;

    if (solChange <= 0) return;

    await axios.post(DISCORD_WEBHOOK, {
      content:
        `🚀 BUY DETECTED\n\n` +
        `SOL Spent: ${solChange}\n\n` +
        `Tx: https://solscan.io/tx/${latest.signature}`
    });

    console.log("Posted Pump.fun Buy:", solChange);

  } catch (err) {
    console.log("Error:", err.message);
  }
}

setInterval(checkPumpFun, 3000);
