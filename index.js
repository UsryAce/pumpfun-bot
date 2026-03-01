import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

console.log("🚀 Pump.fun Webhook Bot Running");

app.post("/webhook", async (req, res) => {
  try {
    const transactions = req.body;

    for (const tx of transactions) {
      if (!tx.tokenTransfers) continue;

      const transfer = tx.tokenTransfers.find(
        t => t.mint === TOKEN_MINT
      );

      if (!transfer) continue;

      if (transfer.tokenAmount <= 0) continue;

      await axios.post(DISCORD_WEBHOOK, {
        content:
          `🚀 BUY DETECTED\n\n` +
          `Buyer: ${transfer.toUserAccount}\n` +
          `Tokens: ${transfer.tokenAmount}\n` +
          `Tx: https://solscan.io/tx/${tx.signature}`
      });

      console.log("Posted buy:", transfer.tokenAmount);
    }

    res.status(200).send("OK");
  } catch (err) {
    console.log("Error:", err.message);
    res.status(500).send("Error");
  }
});

app.listen(3000, () => {
  console.log("Server listening on port 3000");
});
