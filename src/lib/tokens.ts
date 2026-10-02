/**
 * Verified BSC token registry for tokenized stocks.
 * Addresses come from official issuer sources (xStocks API, BscScan issuer tags,
 * Trust Wallet / bStocks announcements, Ondo BscScan tags). Never invent addresses —
 * missing verification → supported=false.
 */

import type { IssuerId } from "@/lib/binance-web3/types";

export type TokenListing = {
  ticker: string;
  issuer: IssuerId;
  /** On-chain symbol, e.g. NVDAB / NVDAon / NVDAx */
  tokenSymbol: string;
  /** Checksummed or lowercase BSC address when verified */
  address: `0x${string}` | null;
  decimals: number;
  /**
   * Shares represented by 1 token (Binance tokenToShareRatio).
   * Default 1.0 until live API provides otherwise.
   */
  tokenToShareRatio: number;
  /** True only when address is independently verified */
  verified: boolean;
  /** Optional CoinMarketCap id when known */
  cmcId?: number;
  source: string;
};

export type UnderlyingMeta = {
  ticker: string;
  name: string;
  /** Yahoo Finance symbol (usually same) */
  yahooSymbol: string;
};

/** Featured underlyings Parity demos. */
export const UNDERLYINGS: UnderlyingMeta[] = [
  { ticker: "NVDA", name: "NVIDIA", yahooSymbol: "NVDA" },
  { ticker: "AAPL", name: "Apple", yahooSymbol: "AAPL" },
  { ticker: "TSLA", name: "Tesla", yahooSymbol: "TSLA" },
  { ticker: "MSFT", name: "Microsoft", yahooSymbol: "MSFT" },
  { ticker: "AMZN", name: "Amazon", yahooSymbol: "AMZN" },
  { ticker: "META", name: "Meta", yahooSymbol: "META" },
  { ticker: "GOOGL", name: "Alphabet", yahooSymbol: "GOOGL" },
  { ticker: "NFLX", name: "Netflix", yahooSymbol: "NFLX" },
  { ticker: "AMD", name: "AMD", yahooSymbol: "AMD" },
  { ticker: "AVGO", name: "Broadcom", yahooSymbol: "AVGO" },
  { ticker: "SPY", name: "SPDR S&P 500", yahooSymbol: "SPY" },
  { ticker: "QQQ", name: "Invesco QQQ", yahooSymbol: "QQQ" },
  { ticker: "COIN", name: "Coinbase", yahooSymbol: "COIN" },
  { ticker: "MSTR", name: "Strategy (MicroStrategy)", yahooSymbol: "MSTR" },
  { ticker: "PLTR", name: "Palantir", yahooSymbol: "PLTR" },
  { ticker: "CRM", name: "Salesforce", yahooSymbol: "CRM" },
  { ticker: "ORCL", name: "Oracle", yahooSymbol: "ORCL" },
  { ticker: "INTC", name: "Intel", yahooSymbol: "INTC" },
  { ticker: "DIS", name: "Disney", yahooSymbol: "DIS" },
  { ticker: "BA", name: "Boeing", yahooSymbol: "BA" },
  { ticker: "JPM", name: "JPMorgan", yahooSymbol: "JPM" },
  { ticker: "V", name: "Visa", yahooSymbol: "V" },
  { ticker: "MA", name: "Mastercard", yahooSymbol: "MA" },
  { ticker: "COST", name: "Costco", yahooSymbol: "COST" },
  { ticker: "IWM", name: "iShares Russell 2000", yahooSymbol: "IWM" },
  { ticker: "SMCI", name: "Super Micro", yahooSymbol: "SMCI" },
  { ticker: "ARM", name: "Arm Holdings", yahooSymbol: "ARM" },
  { ticker: "HOOD", name: "Robinhood", yahooSymbol: "HOOD" },
];

export const FEATURED_TICKERS = UNDERLYINGS.map((u) => u.ticker);
export const FEATURED_TICKER_SET = new Set(FEATURED_TICKERS);

function sym(ticker: string, issuer: IssuerId): string {
  if (issuer === "bstocks") return `${ticker}B`;
  if (issuer === "ondo") return `${ticker}on`;
  return `${ticker}x`;
}

function listing(
  ticker: string,
  issuer: IssuerId,
  address: `0x${string}` | null,
  source: string,
  extras?: Partial<TokenListing>
): TokenListing {
  return {
    ticker,
    issuer,
    tokenSymbol: sym(ticker, issuer),
    address,
    decimals: extras?.decimals ?? 18,
    tokenToShareRatio: extras?.tokenToShareRatio ?? 1,
    verified: Boolean(address),
    cmcId: extras?.cmcId,
    source,
  };
}

/**
 * xStocks BSC addresses from official xStocks public assets API
 * (network=BinanceSmartChain), Oct 2026.
 */
const XSTOCKS_BSC: Record<string, `0x${string}`> = {
  NVDA: "0xc845b2894dbddd03858fd2d643b4ef725fe0849d",
  AAPL: "0x9d275685dc284c8eb1c79f6aba7a63dc75ec890a",
  TSLA: "0x8ad3c73f833d3f9a523ab01476625f269aeb7cf0",
  MSFT: "0x5621737f42dae558b81269fcb9e9e70c19aa6b35",
  AMZN: "0x3557ba345b01efa20a1bddc61f573bfd87195081",
  META: "0x96702be57cd9777f835117a809c7124fe4ec989a",
  GOOGL: "0xe92f673ca36c5e2efd2de7628f815f84807e803f",
  NFLX: "0xa6a65ac27e76cd53cb790473e4345c46e5ebf961",
  AMD: "0x3522513e5f146a2006e2901b05f16b2821485e19",
  AVGO: "0x38bac69cbbd28156796e4163b2b6dcb81e336565",
  SPY: "0x90a2a4c76b5d8c0bc892a69ea28aa775a8f2dd48",
  QQQ: "0xa753a7395cae905cd615da0b82a53e0560f250af",
  COIN: "0x364f210f430ec2448fc68a49203040f6124096f0",
  MSTR: "0xae2f842ef90c0d5213259ab82639d5bbf649b08e",
  PLTR: "0x6d482cec5f9dd1f05ccee9fd3ff79b246170f8e2",
  CRM: "0x4a4073f2eaf299a1be22254dcd2c41727f6f54a2",
  ORCL: "0x548308e91ec9f285c7bff05295badbd56a6e4971",
  INTC: "0xf8a80d1cb9cfd70d03d655d9df42339846f3b3c8",
  DIS: "0xb07f6ed1496aa9bb751dc3cb901328dc08a64ac4",
  BA: "0x5e5e6aa595f5ba2e12d3120810b9fe607735ac8c",
  JPM: "0xd9fc3e075d45254a1d834fea18af8041207dea0a",
  V: "0x2363fd1235c1b6d3a5088ddf8df3a0b3a30c5293",
  MA: "0xb365cd2588065f522d379ad19e903304f6b622c6",
  IWM: "0xdadfb355c6110eda0908740d52c834d6c2bcddc7",
  SMCI: "0x39c31fc6038490ea4bf8a21ca18cd18f33b8d3fb",
  ARM: "0xd15140134a81d3718c87a2d5c17145d324d874a6",
  HOOD: "0xe1385fdd5ffb10081cd52c56584f25efa9084015",
  // COST: not present in xStocks public assets at verification time
};

/** Optional V2 wrappers from xStocks API — try if primary has no PCS pool */
export const XSTOCKS_WRAPPER_BSC: Record<string, `0x${string}`> = {
  NVDA: "0xa8ddb5cd96b5222afe198316e9a57caa642850d5",
  AAPL: "0x943bf64d566c32a2bcd41ac92fb63c111cc9de8f",
  TSLA: "0xc3fdbe3a68ee5de461d30415a8165cf9aefe1171",
  MSFT: "0x166fbe68274b6a47e025f4ba17388c539f1fa1d0",
  AMZN: "0x910cabde3eba7fc1ce64fd14bd680b9f60fa0f90",
  META: "0xe840946ffebcd66b7c4e95095effafadfa0d0e56",
  GOOGL: "0xf8c5308f80e459bb53d9ebe689854d9cbb2caa6f",
  SPY: "0xe7e553cd128f0011777323a0b44a7b96ea1cb540",
  QQQ: "0x4c1ae29c159838fc1b224636e28e086eb69101f7",
};


/**
 * bStocks — only include addresses verified on BscScan (issuer-tagged) / Trust Wallet.
 * Launch set was small; others stay unverified.
 */
const BSTOCKS_BSC: Record<string, `0x${string}`> = {
  NVDA: "0x02Fca66C1D1aFB4E2A7884261eB00F63598a7436",
  TSLA: "0x5b1910eAaD6450E50f816082Aa078C41F10C292f",
  AAPL: "0x431a3BEE82E2ca41e49895CbECE5bB0F76A89b7A",
};

/**
 * Ondo GM tokens — BscScan issuer-tagged / docs examples only.
 */
const ONDO_BSC: Record<string, `0x${string}`> = {
  NVDA: "0xA9eE28C80f960B889dFbd1902055218cBa016F75",
  AAPL: "0x390a684EF9cADE28A7AD0DFa61AB1Eb3842618C4",
  TSLA: "0x2494b603319d4d9f9715c9f4496d9e0364b59d93",
  MSFT: "0x6Bfe75D1ad432050eA973C3A3DcD88F02e2444C3",
  AMZN: "0x4553cFe1C09f37f38b12dC509F676964e392F8Fc",
  META: "0xd7df5863a3e742f0c767768cdfcb63f09e0422f6",
  GOOGL: "0x091FC7778e6932d4009B087B191D1EE3bac5729A",
  SPY: "0x6a708ead771238919d85930b5a0f10454e1c331a",
  QQQ: "0x0cdE6936d305d5B34667fC46425E852efd73559a",
};

function buildRegistry(): TokenListing[] {
  const out: TokenListing[] = [];
  for (const u of UNDERLYINGS) {
    const t = u.ticker;
    out.push(
      listing(
        t,
        "bstocks",
        BSTOCKS_BSC[t] ?? null,
        BSTOCKS_BSC[t]
          ? "BscScan issuer tag / Trust Wallet bStocks list"
          : "Unverified — no official BSC address confirmed"
      )
    );
    out.push(
      listing(
        t,
        "ondo",
        ONDO_BSC[t] ?? null,
        ONDO_BSC[t]
          ? "BscScan Ondo Finance token page"
          : "Unverified — no official BSC address confirmed"
      )
    );
    out.push(
      listing(
        t,
        "xstocks",
        XSTOCKS_BSC[t] ?? null,
        XSTOCKS_BSC[t]
          ? "xStocks public assets API (BinanceSmartChain)"
          : "Unverified — not in xStocks BSC deployments"
      )
    );
  }
  return out;
}

export const TOKEN_REGISTRY: TokenListing[] = buildRegistry();

export function getUnderlying(ticker: string): UnderlyingMeta | undefined {
  return UNDERLYINGS.find((u) => u.ticker === ticker.toUpperCase());
}

export function getTokenListing(
  ticker: string,
  issuer: IssuerId
): TokenListing | undefined {
  const t = ticker.toUpperCase();
  return TOKEN_REGISTRY.find((x) => x.ticker === t && x.issuer === issuer);
}

export function listTokensForTicker(ticker: string): TokenListing[] {
  const t = ticker.toUpperCase();
  return TOKEN_REGISTRY.filter((x) => x.ticker === t);
}

export function tokenSymbolFor(ticker: string, issuer: IssuerId): string {
  return getTokenListing(ticker, issuer)?.tokenSymbol ?? sym(ticker.toUpperCase(), issuer);
}

/** BSC stablecoins / routers used by PancakeSwap helpers */
export const BSC = {
  chainId: 56,
  /** Binance-Peg BSC-USD (USDT) */
  USDT: "0x55d398326f99059fF775485246999027B3197955" as `0x${string}`,
  /** Binance-Peg USDC */
  USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" as `0x${string}`,
  WBNB: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" as `0x${string}`,
  /** PancakeSwap V2 Router */
  PCS_V2_ROUTER: "0x10ED43C718714eb63d5aA57B78B54704E256024E" as `0x${string}`,
  /** PancakeSwap V3 Smart Router */
  PCS_V3_SMART_ROUTER: "0x13f4EA83D0bd40E75C8222255bc855a974568Dd4" as `0x${string}`,
  explorerTx: (hash: string) => `https://bscscan.com/tx/${hash}`,
  explorerToken: (addr: string) => `https://bscscan.com/token/${addr}`,
} as const;
