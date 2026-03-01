import axios from "axios";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY;

console.log("Testing Helius HTTP...");

axios.post(
  `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`,
  {
    jsonrpc: "2.0",
    id: 1,
    method: "getHealth"
  }
)
.then(res => {
  console.log("Success:", res.data);
})
.catch(err => {
  console.log("HTTP Error:", err.response?.status);
});
