import axios from "axios";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

const PUMP_FUN_PROGRAM = "FK4DHfaBsYZnznVnZcNjFmJYmwHuw1tNmjMCmHrNpump";

console.log("🚀 Pump.fun Bot Started (Program Scanner)");

let processed = new Set();

async function scanProgram() {
  console.log("Scanning program...");

  try {
    const sigRes = await axios.post(
      `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [PUMP_FUN_PROGRAM, { limit: 20 }]
      }
    );

    const signatures = sigRes.data.result;
    if (!signatures.length) return;

    for (const sigObj of signatures) {
      const signature = sigObj.signature;

      if (processed.has(signature)) continue;

      processed.add(signature);

      const txRes = await axios.post(
        `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
        {
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [signature, { encoding: "jsonParsed" }]
        }
      );

      const tx = txRes.data.result;
      if (!tx) continue;

      const postBalances = tx.meta.postTokenBalances || [];
      const preBalances = tx.meta.preTokenBalances || [];

      const tokenChange = postBalances.find(
        b => b.mint === TOKEN_MINT
      );

      if (!tokenChange) continue;

      const owner = tokenChange.owner;
      const postAmount = Number(tokenChange.uiTokenAmount.uiAmount || 0);

      const preBalanceObj = preBalances.find(
        b => b.owner === owner && b.mint === TOKEN_MINT
      );

      const preAmount = preBalanceObj
        ? Number(preBalanceObj.uiTokenAmount.uiAmount || 0)
        : 0;

      const tokenBought = postAmount - preAmount;

      if (tokenBought <= 0) continue;

      await axios.post(DISCORD_WEBHOOK, {
        content:
          `🚀 BUY DETECTED\n\n` +
          `Tokens Bought: ${tokenBought}\n\n` +
          `Tx: https://solscan.io/tx/${signature}`
      });

      console.log("Posted Buy:", tokenBought);
    }

  } catch (err) {
    console.log("Error:", err.message);
  }
}

setInterval(scanProgram, 4000);
