import express from "express";
import axios from "axios";

const app = express();
app.use(express.json());

const RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

// =============================
// Whale Tier System
// =============================
function getWhaleTier(sol) {
  if (sol >= 20) return "🐳 MEGA WHALE";
  if (sol >= 10) return "🐋 WHALE";
  if (sol >= 5) return "🐬 DOLPHIN";
  if (sol >= 1) return "🐟 FISH";
  return "🦐 SHRIMP";
}

// =============================
// Get Total Supply
// =============================
async function getTotalSupply() {
  try {
    const res = await axios.post(RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenSupply",
      params: [process.env.TOKEN_MINT]
    });

    return Number(res.data.result.value.uiAmount);
  } catch {
    return 0;
  }
}

// =============================
// Get Top Holders (clean list)
// =============================
async function getTopHolders() {
  try {
    const res = await axios.post(RPC, {
      jsonrpc: "2.0",
      id: 1,
      method: "getTokenLargestAccounts",
      params: [process.env.TOKEN_MINT]
    });

    return res.data.result.value
      .slice(0, 5) // reduced to 5 for cleaner embed
      .map((h, i) =>
        `#${i + 1} ${h.address.slice(0,4)}...${h.address.slice(-4)}`
      )
      .join("\n");

  } catch {
    return "Unavailable";
  }
}

// =============================
// Webhook Listener
// =============================
app.post("/webhook", async (req, res) => {
  try {
    const tx = req.body[0];
    if (!tx) return res.sendStatus(200);

    const transfer = tx.tokenTransfers?.find(
      t => t.mint === process.env.TOKEN_MINT
    );

    if (!transfer) return res.sendStatus(200);

    const buyer = transfer.toUserAccount;
    const tokens = Number(transfer.tokenAmount);
    const signature = tx.signature;

    // =============================
    // SOL DETECTION (Bonded Safe)
    // =============================
    let sol = 0;

    // Case 1: Normal native transfer
    if (tx.nativeTransfers?.length) {
      const solTransfer = tx.nativeTransfers.find(
        t => t.fromUserAccount === buyer
      );
      if (solTransfer) {
        sol = solTransfer.amount / 1e9;
      }
    }

    // Case 2: Swap event (Raydium)
    if (sol === 0 && tx.events?.swap) {
      const swap = tx.events.swap;
      if (swap.nativeInput?.amount) {
        sol = swap.nativeInput.amount / 1e9;
      }
    }

    if (sol < parseFloat(process.env.MIN_SOL)) {
      return res.sendStatus(200);
    }

    const whaleTier = getWhaleTier(sol);

    // =============================
    // MARKET CAP FIX
    // =============================
    const totalSupply = await getTotalSupply();

    let marketCap = 0;

    if (tokens > 0 && totalSupply > 0) {
      const pricePerToken = sol / tokens;
      marketCap = totalSupply * pricePerToken;
    }

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
            value: marketCap > 0
              ? `$${Math.round(marketCap).toLocaleString()}`
              : "Calculating...",
            inline: true
          },
          {
            name: "Transaction",
            value: `https://solscan.io/tx/${signature}`
          },
          {
            name: "Top Holders",
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
  console.log("🚀 Pump.fun bonded bot running...");
});
