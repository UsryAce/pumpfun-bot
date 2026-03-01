import WebSocket from "ws";
import axios from "axios";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

console.log("🚀 Bot starting...");

const ws = new WebSocket(
  `wss://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`
);

ws.on("open", () => {
  console.log("✅ Connected to Helius");

  ws.send(JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "logsSubscribe",
    params: [
      { mentions: [TOKEN_MINT] },
      { commitment: "finalized" }
    ]
  }));
});

ws.on("message", async (data) => {
  const msg = JSON.parse(data);
  if (!msg.params) return;

  const signature = msg.params.result.value.signature;

  try {
    const tx = await axios.post(
      `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`,
      {
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [signature, { encoding: "jsonParsed" }]
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
        `Signature: ${signature}`
    });

    console.log("Posted to Discord");

  } catch (err) {
    console.log("Error:", err.message);
  }
});
