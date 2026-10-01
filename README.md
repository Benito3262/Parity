# Parity

**The fair price for every tokenized stock.**

Built for **Trex’s BNB Hack: Tokenized Stocks Edition**.

On BNB Chain, the same equity can exist as three tokens — **bStocks**, **Ondo**, and **xStocks**. They trade on different hours, use different tokens-per-share ratios, and their prices drift (especially on weekends). A buyer who just wants *“Buy $20 of NVDA”* shouldn’t have to do that math.

**Parity:**

1. Checks all three issuers and whether each can trade **right now**
2. Converts every quote into a **true price per real share**
3. Shows distance **above / below last market close**
4. Picks the **best spot route**, test-runs the trade, then (when wired) buys live on BSC

Spot only. No perps. Copied for normal humans, not crypto jargon.

---

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js (App Router) + TypeScript |
| UI | Tailwind CSS |
| Deploy | Vercel-ready |
| Data | `lib/binance-web3` adapter — **mock by default** |

Free stack. No paid APIs required to run the MVP.

---

## Quick start

```bash
cd /workspace/parity   # or wherever you cloned this repo
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Landing: `/`
- Buy flow: `/trade`
- Sample tickers in mock mode: **28 liquid names** (NVDA, AAPL, TSLA, MSFT, SPY, QQQ, COIN, …)

Production build:

```bash
npm run build
npm start
```

---

## Environment variables

Copy `.env.example` → `.env.local` (never commit secrets).

| Variable | Purpose |
| --- | --- |
| `BINANCE_WEB3_API_KEY` | Live Binance Web3 / tokenized-stocks API key (empty = mock) |
| `BINANCE_WEB3_API_SECRET` | API secret (empty = mock) |
| `BINANCE_WEB3_USE_MOCK` | `"true"` (default) forces mock even if keys exist |
| `NEXT_PUBLIC_CHAIN_ID` | `56` = BSC mainnet |
| `NEXT_PUBLIC_APP_NAME` | Display name |

`.gitignore` ignores `.env*` but keeps `.env.example`.

### Adding real keys later

1. Get Binance Web3 API credentials.
2. Put them in `.env.local`.
3. Set `BINANCE_WEB3_USE_MOCK=false`.
4. Implement `LiveBinanceWeb3Client` in `src/lib/binance-web3/` that satisfies the same `BinanceWeb3Client` interface as the mock (`types.ts`).
5. Uncomment the live branch in `client.ts`.
6. Wire a wallet adapter (e.g. WalletConnect / Binance Web3 Wallet) for the **Execute** step — currently a placeholder.

Until then, quotes + simulate use fixture data; execute never sends a chain transaction.

---

## Project map

```
src/
  app/
    page.tsx              # Landing
    trade/page.tsx        # Main buy flow
    api/quote/route.ts    # Compare issuers → parity table
    api/simulate/route.ts # Mock Transaction / dry-run API
  components/
    BuyForm.tsx           # "Buy $20 of NVDA"
    ResultsTable.tsx      # 3 issuers + best-route badge
    StepsUI.tsx           # compare → simulate → execute
    TradeFlow.tsx         # Client orchestration
    Header.tsx
  lib/
    binance-web3/
      types.ts            # Client interface + domain types
      mock.ts             # ~28 liquid ticker fixtures across 3 issuers
      client.ts           # Factory (mock today, live later)
      index.ts
    parity.ts             # Normalize to $/share, premium vs close, best route
```

---

## What’s ready vs stubbed

| Feature | Status |
| --- | --- |
| Landing + trade UX | Ready |
| Amount + ticker input | Ready |
| 3-issuer compare table (tradeable, $/share, premium vs close, liquidity, best route) | Ready (mock data) |
| Compare → Simulate → Execute steps UI | Ready |
| Simulate (mock Transaction API) | Ready |
| Execute / wallet connect | **Stubbed** — shows placeholder; no live swap |
| Live Binance Web3 HTTP client | **Not implemented** — plug in via adapter + env vars |
| Wallet / BSC tx broadcast | **Not implemented** |

Do not assume live swaps work. They don’t in this scaffold.

---

## Hack notes (BNB / Trex)

- **Network:** BSC mainnet (`chainId` 56). Spot tokenized stocks only.
- **Issuers in scope:** bStocks, Ondo, xStocks — same underlying, different wrappers.
- **Parity math:** `pricePerShare = tokenPriceUsd × tokensPerShare`. Never rank by raw token price alone.
- **Weekend drift:** Mock Ondo pauses on weekends; xStocks shows thinner books + wider premium — mirrors the product story for the DX report.
- **DX report angle:** Document that without normalization, a “cheaper” token can be *more expensive per share*; Parity’s table makes that visible in one screen.
- **No secrets in git.** Keys stay in `.env.local`.

---

## License

Hackathon MVP scaffold — use freely for the Trex BNB Hack submission.
