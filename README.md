# Parity

**The fair price for every tokenized stock.**

Built for **BNB Hack: Tokenized Stocks Edition** by **BNB Chain** and **Binance Web3 Wallet**.

On BNB Chain, the same equity can exist as three tokens — **bStocks**, **Ondo**, and **xStocks**. They trade on different hours, use different **shares-per-token** ratios (`tokenToShareRatio`), and their prices drift (especially when the US cash market is closed). A buyer who just wants *“Buy $20 of NVDA”* shouldn’t have to do that math.

**Parity:**

1. Checks all three issuers and whether each can trade **right now** (US market clock + DEX)
2. Converts every quote into a **true price per real share** (`tokenPrice ÷ tokenToShareRatio`)
3. Shows distance **above / below last market close** (real Yahoo close in ET)
4. Picks the **best spot route**, dry-runs the trade, then buys **xStocks live** via PancakeSwap when you sign

Spot only. No perps. Copied for normal humans, not crypto jargon.

**Repo:** [github.com/Benito3262/Parity](https://github.com/Benito3262/Parity)  
**Live:** [parity-three-tau.vercel.app](https://parity-three-tau.vercel.app)

---

## What’s live vs pending

| Feature | Status |
| --- | --- |
| Landing + Compare → Simulate → Buy UX | **Live** |
| Real symbols (NVDAB / NVDAon / NVDAx) | **Live** |
| Verified BSC addresses (or marked unsupported) | **Live** |
| US market clock (pre/regular/post/overnight + 2026 holidays) | **Live** |
| Yahoo last regular close (ET) | **Live** |
| DexScreener token prices | **Live** |
| CoinMarketCap prices | **Optional** — only if `CMC_API_KEY` is set (not configured on production) |
| PancakeSwap V2 size-aware quotes + impact | **Live** (xStocks) |
| Wallet connect (injected + WalletConnect) on BSC 56 | **Live** |
| xStocks small spot buy (approve + swap, user signs) | **Live** |
| Drift badge in buy flow | **Live** |
| Ondo / bStock live RFQ fill | **Stubbed** — needs Binance Web3 portal keys + `BINANCE_LIVE=true` |
| Live Binance Web3 HTTP client (signed) | **Prepared** in `src/lib/binance-web3/live.ts` |

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS |
| Wallet | wagmi + viem + injected + WalletConnect |
| Prices | Yahoo Finance (closes), DexScreener (CMC optional, unused without key) |
| DEX | PancakeSwap V2 on BSC |
| Deploy | Vercel |

---

## Quick start

```bash
git clone https://github.com/Benito3262/Parity.git
cd Parity
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Landing: `/`
- Buy flow: `/trade` (works without a wallet; wallet needed for live xStocks buy)
- `/profile` redirects home (wallet connect stays in the header)

```bash
npm run build && npm start
```

---

## Environment variables

See `.env.example`. Important ones:

| Variable | Purpose |
| --- | --- |
| `CMC_API_KEY` | Optional — leave empty; production uses DexScreener + Yahoo + PCS (no CMC key configured) |
| `BSC_RPC_URL` | BSC JSON-RPC for PCS quotes / eth_call |
| `BINANCE_WEB3_API_KEY` / `SECRET` | Live Binance Web3 Build API |
| `BINANCE_LIVE` / `BINANCE_WEB3_USE_MOCK` | Switch hybrid → Binance live client |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Mobile wallet QR |
| `NEXT_PUBLIC_APP_URL` | Exact origin for Reown Verify |

Never commit secrets. If unset, `/api/cmc/*` returns 503 honestly and the app does not claim CMC prices.

### Enabling Binance live later

1. Get portal API credentials (`X-OC-*` signing).
2. Set keys in `.env.local` / Vercel.
3. Set `BINANCE_LIVE=true` (or `BINANCE_WEB3_USE_MOCK=false`).
4. UI stays the same — `LiveBinanceWeb3Client` maps 40367 / 40369 and 30s quote expiry.

---

## Parity math

```
pricePerShare = tokenPriceUsd / tokenToShareRatio
```

`tokenToShareRatio` = shares represented by **one** token (Binance field). Default `1.0` until the live API provides otherwise. The old fake “Ondo = 10 tokens per share” fixture is gone.

---

## Project map

```
src/lib/
  tokens.ts           # Verified BSC registry
  market-clock.ts     # America/New_York sessions + 2026 holidays
  yahoo.ts            # Underlying closes
  cmc.ts              # Allowlisted CMC proxy client
  dex-prices.ts       # DexScreener
  pancakeswap.ts      # V2 quotes + calldata
  parity.ts           # Normalization + drift badge
  data/hybrid.ts      # Default data path
  binance-web3/       # types, mock, live, factory
src/app/api/
  quote/  simulate/  cmc/[...path]/  swap/quote/
```

DX notes template: [`DX_LOG.md`](./DX_LOG.md)

---

## License

Hackathon MVP — use freely for the BNB Hack: Tokenized Stocks Edition submission.
