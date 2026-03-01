import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

// Get Top 10 holders
async function getTopHolders() {
  try {
    const res = await axios.post(RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenLargestAccounts",
      params: [process.env.TOKEN_MINT]
    });

    return res.data.result.value
      .slice(0, 10)
      .map((h, i) =>
        `#${i + 1} ${h.address.slice(0, 4)}...${h.address.slice(-4)} — ${h.uiAmount.toLocaleString()}`
      )
      .join("\n");
  } catch {
    return "Unavailable";
  }
}

app.post("/webhook", async (req, res) => {
  try {
    const tx = req.body[0];
    if (!tx) return res.sendStatus(200);

    const transfer = tx.tokenTransfers?.find(
      t => t.mint === process.env.TOKEN_MINT
    );
    if (!transfer) return res.sendStatus(200);

    const sol = (tx.nativeTransfers?.[0]?.amount || 0) / 1e9;

    // Ignore small buys
    if (sol < parseFloat(process.env.MIN_SOL)) {
      return res.sendStatus(200);
    }

    const buyer = transfer.toUserAccount;
    const tokens = transfer.tokenAmount;
    const signature = tx.signature;

    const holders = await getTopHolders();

    await axios.post(process.env.DISCORD_WEBHOOK, {
      embeds: [{
        title: "🚀 BUY DETECTED",
        color: 0xFFD700,
        fields: [
          { name: "Buyer", value: `${buyer.slice(0,4)}...${buyer.slice(-4)}`, inline: true },
          { name: "Amount", value: `${sol.toFixed(2)} SOL`, inline: true },
          { name: "Tokens", value: tokens.toLocaleString(), inline: true },
          { name: "Transaction", value: `https://solscan.io/tx/${signature}` },
          { name: "🏆 Top 10 Holders", value: holders }
        ],
        timestamp: new Date()
      }]
    });

    res.sendStatus(200);

  } catch (err) {
    console.log("Error:", err.message);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Bot running...");
});
