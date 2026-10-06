/**
 * One signed RWA price call for TSLAon on BSC (chain 56).
 * Prints the raw response. Exits non-zero unless code is 0.
 *
 *   node scripts/test-binance.ts
 *
 * Reads BINANCE_WEB3_API_KEY and BINANCE_WEB3_API_SECRET from the
 * environment or .env.local. Does not follow redirects.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

function loadEnvLocal() {
  const p = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  loadEnvLocal();
  const apiKey = (process.env.BINANCE_WEB3_API_KEY || "").trim();
  const secret = (process.env.BINANCE_WEB3_API_SECRET || "").trim();
  if (!apiKey || !secret) {
    console.error(
      "Missing BINANCE_WEB3_API_KEY or BINANCE_WEB3_API_SECRET."
    );
    process.exit(1);
  }

  const address = "0x2494b603319d4d9f9715c9f4496d9e0364b59d93";
  const qs =
    "?binanceChainId=56&tokenContractAddresses=" +
    encodeURIComponent(address);
  const requestPath = "/build/api/v1/dex/market/rwa/price" + qs;
  const timestamp = new Date().toISOString();
  const preHash = timestamp + "GET" + requestPath + "";
  const sign = crypto
    .createHmac("sha256", secret)
    .update(preHash, "utf8")
    .digest("base64");

  const res = await fetch("https://web3.binance.com" + requestPath, {
    method: "GET",
    redirect: "manual",
    headers: {
      Accept: "application/json",
      "X-OC-APIKEY": apiKey,
      "X-OC-TIMESTAMP": timestamp,
      "X-OC-SIGN": sign,
      "X-OC-RECV-WINDOW": "5000",
    },
  });

  if (res.status >= 300 && res.status < 400) {
    console.error("redirect refused", res.status, res.headers.get("location"));
    process.exit(1);
  }
  const text = await res.text();
  console.log(text);
  if (!text.trim() || text.trim() === "{}" || text.trim().startsWith("<")) {
    process.exit(1);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    process.exit(1);
  }
  if (body.code !== 0 && body.code !== "0") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
