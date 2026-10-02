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
| Wallet | wagmi v2 + viem + injected EIP-1193 + WalletConnect v2 |
| Deploy | Vercel-ready |
| Data | `lib/binance-web3` adapter — **mock by default** |

Free stack. No paid APIs required to run the MVP (WalletConnect Cloud projectId is free when you want mobile QR).

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
- Buy flow: `/trade` (works without a wallet)
- Profile + portfolio: `/profile` (connect → create profile → unlock UI)
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
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect Cloud project id (free). Needed for mobile / Zerion via WC. Injected wallets work without it. |

`.gitignore` ignores `.env*` but keeps `.env.example`.

### WalletConnect project id

1. Create a free project at [cloud.walletconnect.com](https://cloud.walletconnect.com).
2. Copy the **Project ID**.
3. Set `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` in `.env.local` (and in Vercel project env if deployed).
4. Redeploy / restart `npm run dev`.

If the variable is empty, Parity still ships **browser extension** connect (MetaMask, etc.) and shows a note that WalletConnect is offline.

### Adding real Binance keys later

1. Get Binance Web3 API credentials.
2. Put them in `.env.local`.
3. Set `BINANCE_WEB3_USE_MOCK=false`.
4. Implement `LiveBinanceWeb3Client` in `src/lib/binance-web3/` that satisfies the same `BinanceWeb3Client` interface as the mock (`types.ts`).
5. Uncomment the live branch in `client.ts`.
6. Wire execute to the connected wallet for live BSC spot buys — execute is still a placeholder today.

Until then, quotes + simulate use fixture data; execute never sends a chain transaction.

---

## Wallet + profile flow

1. **Connect** from the header (injected and/or WalletConnect → BSC chain id 56).
2. **Disconnect** from the address menu.
3. After connect, open **Create profile** / `/profile` — display name + optional bio, stored in `localStorage` keyed by address (`parity:profile:0x…`).
4. **Profile card + portfolio panel** only render after a profile exists for that address. Before that: connect empty state or create-profile form.
5. Portfolio holdings are **clearly labeled mock** until live balances exist.
6. Landing + `/trade` fair-price router remain usable **without** a wallet.

---

## Project map

```
src/
  app/
    page.tsx              # Landing
    trade/page.tsx        # Main buy flow
    profile/page.tsx      # Gated profile + portfolio
    api/quote/route.ts    # Compare issuers → parity table
    api/simulate/route.ts # Mock Transaction / dry-run API
  components/
    BuyForm.tsx
    ResultsTable.tsx
    StepsUI.tsx
    TradeFlow.tsx
    Header.tsx            # Connect wallet + Buy stock
    providers/Web3Provider.tsx
    wallet/ConnectButton.tsx
    wallet/ConnectModal.tsx
    profile/*
    portfolio/PortfolioPanel.tsx
  hooks/useProfile.ts
  lib/
    wagmi.ts              # BSC + injected + optional WalletConnect
    profile.ts            # localStorage profile helpers
    binance-web3/
    parity.ts
```

---

## What’s ready vs stubbed

| Feature | Status |
| --- | --- |
| Landing + trade UX | Ready |
| Amount + ticker input | Ready |
| 3-issuer compare table | Ready (mock data) |
| Compare → Simulate → Execute steps UI | Ready |
| Simulate (mock Transaction API) | Ready |
| Wallet connect / disconnect (injected) | Ready |
| WalletConnect v2 (mobile / Zerion) | Ready when `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` set |
| Profile create + gate | Ready (localStorage) |
| Portfolio panel | Ready (**mock** holdings) |
| Execute / live swap | **Stubbed** — no live on-chain swap yet |
| Live Binance Web3 HTTP client | **Not implemented** |

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
