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
  /** On-chain token symbol, e.g. bNVDA, NVDA.on, xNVDA */
  tokenSymbol: string;
  /** Token price in USD (what you pay per 1 token) */
  tokenPriceUsd: number;
  /**
   * How many tokens equal 1 real share of the underlying.
   * e.g. 1 means 1:1; 10 means 10 tokens = 1 share.
   */
  tokensPerShare: number;
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
};

/** Last traditional-market close for the underlying equity */
export type MarketClose = {
  ticker: Ticker;
  closeUsd: number;
  asOf: string; // ISO — last regular-session close
  sessionLabel: string; // e.g. "NYSE close"
};

export type SimulateTradeRequest = {
  issuer: IssuerId;
  ticker: Ticker;
  /** USD notional the user wants to spend */
  amountUsd: number;
  /** Wallet address placeholder — not used in mock */
  walletAddress?: string;
};

export type SimulateTradeResult = {
  ok: boolean;
  issuer: IssuerId;
  ticker: Ticker;
  amountUsd: number;
  /** Tokens the user would receive */
  estimatedTokens: number;
  /** Effective USD paid per real share after tokensPerShare */
  effectivePricePerShare: number;
  estimatedFeesUsd: number;
  route: string;
  /** Mock tx steps for the Steps UI */
  steps: { label: string; status: "pending" | "ok" | "skip" }[];
  warning?: string;
};

export type ExecuteTradeRequest = SimulateTradeRequest & {
  /** Confirmed from simulate — stubbed only */
  simulationId?: string;
};

export type ExecuteTradeResult = {
  ok: boolean;
  stubbed: true;
  message: string;
  /** Would be a BSC tx hash when live */
  txHash?: string;
};

/** Client surface — mock today, real Binance Web3 later */
export interface BinanceWeb3Client {
  listIssuers(): Promise<IssuerMeta[]>;
  getMarketClose(ticker: Ticker): Promise<MarketClose | null>;
  getQuotes(ticker: Ticker): Promise<RawIssuerQuote[]>;
  simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult>;
  executeTrade(req: ExecuteTradeRequest): Promise<ExecuteTradeResult>;
}
