/** Supported tokenized-stock issuers on BNB Chain */
export type IssuerId = "bstocks" | "ondo" | "xstocks";

export type IssuerMeta = {
  id: IssuerId;
  displayName: string;
  /** Short label for UI badges */
  shortName: string;
  /** Human-friendly trading window note */
  hoursNote: string;
};

export type Ticker = string;

/** Raw quote from an issuer, before parity normalization */
export type RawIssuerQuote = {
  issuer: IssuerId;
  ticker: Ticker;
  /** On-chain token symbol, e.g. NVDAB, NVDAon, NVDAx */
  tokenSymbol: string;
  /** Token price in USD (what you pay per 1 token) */
  tokenPriceUsd: number;
  /**
   * Shares represented by 1 token (Binance tokenToShareRatio).
   * pricePerShare = tokenPriceUsd / tokenToShareRatio
   * Default ~1.0 (1 token ≈ 1 share).
   */
  tokenToShareRatio: number;
  /**
   * @deprecated Alias for 1/tokenToShareRatio during migration.
   * Prefer tokenToShareRatio.
   */
  tokensPerShare: number;
  /** BSC contract when verified */
  contractAddress?: string | null;
  /** Whether the issuer allows spot trading right now */
  tradeableNow: boolean;
  /** Optional reason when not tradeable (weekend, maintenance, etc.) */
  tradeableReason?: string;
  /** Rough liquidity hint for UX (not a guarantee) */
  liquidity: "high" | "medium" | "low";
  liquidityNote: string;
  /** 24h volume in USD (fixture / API) */
  volume24hUsd: number;
  updatedAt: string; // ISO
  /** Price impact % for the requested size (xStocks / PCS) */
  priceImpactPct?: number | null;
  /** Data provenance label */
  dataSource?: string;
};

/** Last traditional-market close for the underlying equity */
export type MarketClose = {
  ticker: Ticker;
  closeUsd: number;
  asOf: string; // ISO — last regular-session close
  sessionLabel: string; // e.g. "NYSE close"
  /** Short momentum vs prior close */
  direction?: "up" | "down" | "flat" | null;
};

export type SimulateTradeRequest = {
  issuer: IssuerId;
  ticker: Ticker;
  /** USD notional the user wants to spend */
  amountUsd: number;
  /** Wallet address — used for PCS eth_call when provided */
  walletAddress?: string;
};

export type SimulateTradeResult = {
  ok: boolean;
  issuer: IssuerId;
  ticker: Ticker;
  amountUsd: number;
  /** Tokens the user would receive */
  estimatedTokens: number;
  /** Effective USD paid per real share after tokenToShareRatio */
  effectivePricePerShare: number;
  estimatedFeesUsd: number;
  route: string;
  /** Mock / live tx steps for the Steps UI */
  steps: { label: string; status: "pending" | "ok" | "skip" }[];
  warning?: string;
  /** Size-aware extras */
  priceImpactPct?: number | null;
  blocked?: boolean;
  /** PCS path for client execute */
  pcs?: {
    tokenIn: string;
    tokenOut: string;
    amountInWei: string;
    amountOutMinWei: string;
    path: string[];
    slippageBps: number;
  };
};

export type ExecuteTradeRequest = SimulateTradeRequest & {
  /** Confirmed from simulate — stubbed only for Binance routes */
  simulationId?: string;
};

export type ExecuteTradeResult = {
  ok: boolean;
  stubbed: boolean;
  message: string;
  /** Would be a BSC tx hash when live */
  txHash?: string;
};

/** Data labels shown in UI */
export type DataMode = "mock" | "live" | "hybrid";

/** Client surface — hybrid (CMC/Yahoo/PCS) today, Binance Web3 when flagged */
export interface BinanceWeb3Client {
  listIssuers(): Promise<IssuerMeta[]>;
  getMarketClose(ticker: Ticker): Promise<MarketClose | null>;
  getQuotes(ticker: Ticker, amountUsd?: number): Promise<RawIssuerQuote[]>;
  simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult>;
  executeTrade(req: ExecuteTradeRequest): Promise<ExecuteTradeResult>;
  /** Honest mode label for API responses */
  getMode(): DataMode;
}

/** Binance Web3 error codes we map to plain English */
export const BINANCE_ERROR_MAP: Record<number, string> = {
  40367: "Ondo can't trade right now (session / venue restriction).",
  40369: "bStock can't trade right now (session / venue restriction).",
  40101: "API key is required or invalid.",
};

export const QUOTE_EXPIRY_MS = 30_000;
