import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

// ==========================
// Whale Tier Logic
// ==========================
function getWhaleTier(sol) {
  if (sol >= 10) return "🐳 MEGA WHALE";
  if (sol >= 5) return "🐋 WHALE";
  if (sol >= 1) return "🐬 DOLPHIN";
  if (sol >= 0.5) return "🐟 FISH";
  return "🦐 SHRIMP";
}

// ==========================
// Get Total Supply
// ==========================
async function getTotalSupply() {
  try {
    const res = await axios.post(RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [process.env.TOKEN_MINT]
    });

    return res.data.result.value.uiAmount;
  } catch {
    return 0;
  }
}

// ==========================
// Get Top 10 Holders
// ==========================
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
        `#${i + 1} ${h.address.slice(0,4)}...${h.address.slice(-4)}`
      )
      .join("\n");

  } catch {
    return "Unavailable";
  }
}

// ==========================
// Webhook
// ==========================
app.post("/webhook", async (req, res) => {
  try {
    const tx = req.body[0];
    if (!tx) return res.sendStatus(200);

    const transfer = tx.tokenTransfers?.find(
      t => t.mint === process.env.TOKEN_MINT
    );

    if (!transfer) return res.sendStatus(200);

    const buyer = transfer.toUserAccount;
    const tokens = transfer.tokenAmount;
    const signature = tx.signature;

    // ===== SOL CALCULATION =====
    let sol = 0;

    if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
      const buyerPayment = tx.nativeTransfers.find(
        t => t.fromUserAccount === buyer
      );

      if (buyerPayment) {
        sol = buyerPayment.amount / 1e9;
      }
    }

    if (sol < parseFloat(process.env.MIN_SOL)) {
      return res.sendStatus(200);
    }

    const whaleTier = getWhaleTier(sol);

    // ===== MARKET CAP =====
    const totalSupply = await getTotalSupply();
    const pricePerToken = sol / tokens;
    const marketCap = totalSupply * pricePerToken;

    const holders = await getTopHolders();

    await axios.post(process.env.DISCORD_WEBHOOK, {
      embeds: [{
        title: `🚀 BUY DETECTED — ${whaleTier}`,
        color: 0xFFD700,
        fields: [
          {
            name: "Buyer",
            value: `${buyer.slice(0,4)}...${buyer.slice(-4)}`,
            inline: true
          },
          {
            name: "Amount",
            value: `${sol.toFixed(2)} SOL`,
            inline: true
          },
          {
            name: "Tokens",
            value: tokens.toLocaleString(),
            inline: true
          },
          {
            name: "Market Cap",
            value: `$${Math.round(marketCap).toLocaleString()}`,
            inline: true
          },
          {
            name: "Transaction",
            value: `https://solscan.io/tx/${signature}`
          },
          {
            name: "🏆 Top 10 Holders",
            value: holders
          }
        ],
        timestamp: new Date()
      }]
    });

    console.log("Posted buy:", sol);
    res.sendStatus(200);

  } catch (err) {
    console.log("Webhook error:", err.message);
    res.sendStatus(500);
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Pump.fun bot running...");
});
