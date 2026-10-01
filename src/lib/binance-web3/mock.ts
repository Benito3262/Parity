import type {
  BinanceWeb3Client,
  ExecuteTradeRequest,
  ExecuteTradeResult,
  IssuerMeta,
  MarketClose,
  RawIssuerQuote,
  SimulateTradeRequest,
  SimulateTradeResult,
  Ticker,
} from "./types";

const ISSUERS: IssuerMeta[] = [
  {
    id: "bstocks",
    displayName: "bStocks",
    shortName: "bStocks",
    hoursNote: "Near 24/7 on BNB; may pause around corporate actions",
  },
  {
    id: "ondo",
    displayName: "Ondo",
    shortName: "Ondo",
    hoursNote: "Aligned with US market hours + limited after-hours",
  },
  {
    id: "xstocks",
    displayName: "xStocks",
    shortName: "xStocks",
    hoursNote: "Extended hours on BNB; weekend quotes can drift",
  },
];

type StockFixture = {
  ticker: string;
  name: string;
  closeUsd: number;
  /** Relative liquidity tier for volume / depth heuristics */
  depth: "mega" | "large" | "mid" | "thin";
  /** Extra weekend premium on xStocks (bps-ish fraction) */
  weekendDrift: number;
  /** Whether Ondo lists this name (some mid/thin may be off) */
  ondoListed: boolean;
  /** Whether xStocks lists this name */
  xListed: boolean;
};

/**
 * ~28 liquid-ish tickers for mock mode.
 * Closes are fixture NYSE refs (not live) for premium math demos.
 */
const STOCKS: StockFixture[] = [
  { ticker: "NVDA", name: "NVIDIA", closeUsd: 178.4, depth: "mega", weekendDrift: 0.028, ondoListed: true, xListed: true },
  { ticker: "AAPL", name: "Apple", closeUsd: 228.15, depth: "mega", weekendDrift: 0.018, ondoListed: true, xListed: true },
  { ticker: "TSLA", name: "Tesla", closeUsd: 248.6, depth: "mega", weekendDrift: 0.042, ondoListed: true, xListed: true },
  { ticker: "MSFT", name: "Microsoft", closeUsd: 428.9, depth: "mega", weekendDrift: 0.014, ondoListed: true, xListed: true },
  { ticker: "AMZN", name: "Amazon", closeUsd: 186.2, depth: "mega", weekendDrift: 0.02, ondoListed: true, xListed: true },
  { ticker: "META", name: "Meta", closeUsd: 572.4, depth: "mega", weekendDrift: 0.022, ondoListed: true, xListed: true },
  { ticker: "GOOGL", name: "Alphabet", closeUsd: 165.8, depth: "mega", weekendDrift: 0.016, ondoListed: true, xListed: true },
  { ticker: "NFLX", name: "Netflix", closeUsd: 712.3, depth: "large", weekendDrift: 0.024, ondoListed: true, xListed: true },
  { ticker: "AMD", name: "AMD", closeUsd: 164.5, depth: "large", weekendDrift: 0.031, ondoListed: true, xListed: true },
  { ticker: "AVGO", name: "Broadcom", closeUsd: 172.8, depth: "large", weekendDrift: 0.019, ondoListed: true, xListed: true },
  { ticker: "SPY", name: "SPDR S&P 500", closeUsd: 571.2, depth: "mega", weekendDrift: 0.008, ondoListed: true, xListed: true },
  { ticker: "QQQ", name: "Invesco QQQ", closeUsd: 488.7, depth: "mega", weekendDrift: 0.01, ondoListed: true, xListed: true },
  { ticker: "COIN", name: "Coinbase", closeUsd: 198.4, depth: "mid", weekendDrift: 0.055, ondoListed: true, xListed: true },
  { ticker: "MSTR", name: "MicroStrategy", closeUsd: 342.1, depth: "mid", weekendDrift: 0.062, ondoListed: true, xListed: true },
  { ticker: "PLTR", name: "Palantir", closeUsd: 38.75, depth: "large", weekendDrift: 0.036, ondoListed: true, xListed: true },
  { ticker: "CRM", name: "Salesforce", closeUsd: 268.9, depth: "large", weekendDrift: 0.017, ondoListed: true, xListed: true },
  { ticker: "ORCL", name: "Oracle", closeUsd: 168.4, depth: "large", weekendDrift: 0.015, ondoListed: true, xListed: true },
  { ticker: "INTC", name: "Intel", closeUsd: 23.45, depth: "mid", weekendDrift: 0.028, ondoListed: true, xListed: true },
  { ticker: "DIS", name: "Disney", closeUsd: 96.8, depth: "large", weekendDrift: 0.021, ondoListed: true, xListed: true },
  { ticker: "BA", name: "Boeing", closeUsd: 154.2, depth: "mid", weekendDrift: 0.033, ondoListed: true, xListed: true },
  { ticker: "JPM", name: "JPMorgan", closeUsd: 212.6, depth: "mega", weekendDrift: 0.012, ondoListed: true, xListed: true },
  { ticker: "V", name: "Visa", closeUsd: 284.3, depth: "mega", weekendDrift: 0.011, ondoListed: true, xListed: true },
  { ticker: "MA", name: "Mastercard", closeUsd: 498.7, depth: "large", weekendDrift: 0.012, ondoListed: true, xListed: true },
  { ticker: "COST", name: "Costco", closeUsd: 912.5, depth: "large", weekendDrift: 0.013, ondoListed: true, xListed: true },
  { ticker: "IWM", name: "iShares Russell 2000", closeUsd: 218.4, depth: "large", weekendDrift: 0.014, ondoListed: true, xListed: true },
  { ticker: "SMCI", name: "Super Micro", closeUsd: 42.8, depth: "thin", weekendDrift: 0.048, ondoListed: false, xListed: true },
  { ticker: "ARM", name: "Arm Holdings", closeUsd: 142.6, depth: "mid", weekendDrift: 0.029, ondoListed: true, xListed: true },
  { ticker: "HOOD", name: "Robinhood", closeUsd: 38.2, depth: "mid", weekendDrift: 0.044, ondoListed: false, xListed: true },
];

export const MOCK_TICKERS = STOCKS.map((s) => s.ticker);
export const MOCK_TICKER_SET = new Set(MOCK_TICKERS);

const MARKET_CLOSES: Record<string, MarketClose> = Object.fromEntries(
  STOCKS.map((s) => [
    s.ticker,
    {
      ticker: s.ticker,
      closeUsd: s.closeUsd,
      asOf: "2026-09-26T20:00:00.000Z",
      sessionLabel: "NYSE close",
    } satisfies MarketClose,
  ])
);

function depthVolumes(depth: StockFixture["depth"], isWeekend: boolean) {
  const base = {
    mega: { b: 4_200_000, o: 1_850_000, x: 2_100_000 },
    large: { b: 2_400_000, o: 980_000, x: 1_200_000 },
    mid: { b: 780_000, o: 320_000, x: 410_000 },
    thin: { b: 220_000, o: 90_000, x: 140_000 },
  }[depth];
  const weekendFactor = isWeekend ? 0.18 : 1;
  return {
    bstocks: Math.round(base.b * (isWeekend ? 0.55 : 1)),
    ondo: Math.round(base.o * weekendFactor),
    xstocks: Math.round(base.x * (isWeekend ? 0.22 : 1)),
  };
}

function depthLiquidity(
  depth: StockFixture["depth"],
  issuer: "bstocks" | "ondo" | "xstocks",
  isWeekend: boolean
): "high" | "medium" | "low" {
  if (issuer === "ondo" && isWeekend) return "low";
  if (issuer === "xstocks" && isWeekend) {
    return depth === "mega" || depth === "large" ? "low" : "low";
  }
  if (issuer === "bstocks") {
    if (depth === "mega" || depth === "large") return "high";
    if (depth === "mid") return "medium";
    return "low";
  }
  if (issuer === "ondo") {
    return depth === "mega" ? "medium" : depth === "large" ? "medium" : "low";
  }
  // xstocks weekday
  if (depth === "mega") return "medium";
  if (depth === "large") return "medium";
  return "low";
}

/**
 * Build realistic issuer quotes for a ticker.
 * tokensPerShare differs so raw token price alone is misleading.
 */
function buildQuotes(ticker: Ticker): RawIssuerQuote[] {
  const t = ticker.toUpperCase();
  const stock = STOCKS.find((s) => s.ticker === t);
  if (!stock) return [];

  const now = new Date().toISOString();
  const day = new Date().getUTCDay(); // 0 Sun … 6 Sat
  const isWeekend = day === 0 || day === 6;
  const vols = depthVolumes(stock.depth, isWeekend);
  const close = stock.closeUsd;

  // Stable-ish hash so premiums vary by ticker without looking random each request
  const salt = t.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const jitter = ((salt % 17) - 8) / 1000; // -0.008 … +0.008

  const quotes: RawIssuerQuote[] = [];

  // bStocks — 1:1, usually tight to close, always tradeable in mock
  {
    const prem = 0.006 + jitter + (isWeekend ? 0.004 : 0);
    const pricePerShare = close * (1 + prem);
    quotes.push({
      issuer: "bstocks",
      ticker: t,
      tokenSymbol: `b${t}`,
      tokenPriceUsd: round4(pricePerShare),
      tokensPerShare: 1,
      tradeableNow: true,
      liquidity: depthLiquidity(stock.depth, "bstocks", isWeekend),
      liquidityNote:
        stock.depth === "thin"
          ? "Thinner book — keep size modest"
          : "Deep pool; typical fill for $20–$5k",
      volume24hUsd: vols.bstocks,
      updatedAt: now,
    });
  }

  // Ondo — often 10 tokens = 1 share; pauses weekends
  if (stock.ondoListed) {
    const prem = (isWeekend ? 0.018 : 0.003) + jitter * 0.8;
    const pricePerShare = close * (1 + prem);
    const tokensPerShare = 10;
    quotes.push({
      issuer: "ondo",
      ticker: t,
      tokenSymbol: `${t}.on`,
      tokenPriceUsd: round4(pricePerShare / tokensPerShare),
      tokensPerShare,
      tradeableNow: !isWeekend,
      tradeableReason: isWeekend
        ? "Ondo spot pauses over the weekend"
        : undefined,
      liquidity: depthLiquidity(stock.depth, "ondo", isWeekend),
      liquidityNote: isWeekend
        ? "Not tradeable now — check again Mon open"
        : "Solid depth during US hours",
      volume24hUsd: vols.ondo,
      updatedAt: now,
    });
  }

  // xStocks — 1:1; weekend premium drift is the product story
  if (stock.xListed) {
    const prem =
      (isWeekend ? stock.weekendDrift : 0.002 + Math.abs(jitter)) + jitter * 0.5;
    const pricePerShare = close * (1 + prem);
    const liq = depthLiquidity(stock.depth, "xstocks", isWeekend);
    quotes.push({
      issuer: "xstocks",
      ticker: t,
      tokenSymbol: `x${t}`,
      tokenPriceUsd: round4(pricePerShare),
      tokensPerShare: 1,
      tradeableNow: true,
      liquidity: liq,
      liquidityNote: isWeekend
        ? "Thin weekend book — larger slippage risk"
        : liq === "low"
          ? "Light depth — good for small spot buys"
          : "Good for small spot buys",
      volume24hUsd: vols.xstocks,
      updatedAt: now,
    });
  }

  return quotes;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class MockBinanceWeb3Client implements BinanceWeb3Client {
  async listIssuers(): Promise<IssuerMeta[]> {
    await sleep(80);
    return ISSUERS;
  }

  async getMarketClose(ticker: Ticker): Promise<MarketClose | null> {
    await sleep(60);
    return MARKET_CLOSES[ticker.toUpperCase()] ?? null;
  }

  async getQuotes(ticker: Ticker): Promise<RawIssuerQuote[]> {
    await sleep(120);
    return buildQuotes(ticker);
  }

  async simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult> {
    await sleep(200);
    const quotes = buildQuotes(req.ticker);
    const q = quotes.find((x) => x.issuer === req.issuer);

    if (!q) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: req.ticker.toUpperCase(),
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: 0,
        estimatedFeesUsd: 0,
        route: "none",
        steps: [{ label: "Lookup quote", status: "skip" }],
        warning: `No mock quote for ${req.ticker} on ${req.issuer}`,
      };
    }

    if (!q.tradeableNow) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: req.ticker.toUpperCase(),
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: q.tokenPriceUsd * q.tokensPerShare,
        estimatedFeesUsd: 0,
        route: `${q.tokenSymbol} (unavailable)`,
        steps: [
          { label: "Check trade window", status: "skip" },
          { label: "Build swap path", status: "skip" },
        ],
        warning: q.tradeableReason ?? "Not tradeable right now",
      };
    }

    const feeBps = 8; // 0.08% mock fee
    const estimatedFeesUsd = (req.amountUsd * feeBps) / 10_000;
    const spendable = req.amountUsd - estimatedFeesUsd;
    const estimatedTokens = spendable / q.tokenPriceUsd;
    const effectivePricePerShare = q.tokenPriceUsd * q.tokensPerShare;

    return {
      ok: true,
      issuer: req.issuer,
      ticker: req.ticker.toUpperCase(),
      amountUsd: req.amountUsd,
      estimatedTokens,
      effectivePricePerShare,
      estimatedFeesUsd,
      route: `USDT → ${q.tokenSymbol} (spot, BSC)`,
      steps: [
        { label: "Check trade window", status: "ok" },
        { label: "Normalize price per share", status: "ok" },
        { label: "Estimate fees & tokens out", status: "ok" },
        { label: "Dry-run swap path", status: "ok" },
      ],
      warning:
        q.liquidity === "low"
          ? "Low liquidity — expect more slippage on live execute"
          : undefined,
    };
  }

  async executeTrade(_req: ExecuteTradeRequest): Promise<ExecuteTradeResult> {
    await sleep(100);
    return {
      ok: false,
      stubbed: true,
      message:
        "Execute is stubbed. Connect a wallet and set BINANCE_WEB3_API_KEY to enable live BSC spot buys.",
      txHash: undefined,
    };
  }
}
