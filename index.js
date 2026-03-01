import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const TOKEN_MINT = process.env.TOKEN_MINT;

console.log("🚀 Pump.fun Webhook Bot Running");

// Health check route
app.get("/", (req, res) => {
  res.send("Bot is running");
});

// Webhook route
app.post("/webhook", async (req, res) => {
  console.log("Webhook received");

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

// IMPORTANT: bind to Railway port
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
