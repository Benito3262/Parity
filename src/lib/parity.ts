import type {
  IssuerId,
  IssuerMeta,
  MarketClose,
  RawIssuerQuote,
} from "@/lib/binance-web3";

/** Normalized row for the results table */
export type ParityRow = {
  issuer: IssuerId;
  displayName: string;
  shortName: string;
  tokenSymbol: string;
  tradeableNow: boolean;
  tradeableReason?: string;
  /** True USD cost of 1 real share via this issuer */
  pricePerShare: number;
  /** Token unit price (raw) */
  tokenPriceUsd: number;
  tokensPerShare: number;
  /** % above (+) / below (−) last market close */
  premiumVsClosePct: number | null;
  premiumVsCloseUsd: number | null;
  liquidity: "high" | "medium" | "low";
  liquidityNote: string;
  volume24hUsd: number;
  hoursNote: string;
  isBestRoute: boolean;
};

export type ParityComparison = {
  ticker: string;
  amountUsd: number;
  marketClose: MarketClose | null;
  rows: ParityRow[];
  bestIssuer: IssuerId | null;
  /** Plain-language summary for normal users */
  summary: string;
};

/**
 * Convert issuer token quotes into true price-per-share and pick the best
 * tradeable route (lowest price per share among tradeable venues).
 */
export function buildParityComparison(args: {
  ticker: string;
  amountUsd: number;
  quotes: RawIssuerQuote[];
  issuers: IssuerMeta[];
  marketClose: MarketClose | null;
}): ParityComparison {
  const { ticker, amountUsd, quotes, issuers, marketClose } = args;
  const metaById = Object.fromEntries(issuers.map((i) => [i.id, i])) as Record<
    IssuerId,
    IssuerMeta
  >;

  const scored = quotes.map((q) => {
    const pricePerShare = q.tokenPriceUsd * q.tokensPerShare;
    const close = marketClose?.closeUsd ?? null;
    const premiumVsCloseUsd =
      close != null ? pricePerShare - close : null;
    const premiumVsClosePct =
      close != null && close > 0
        ? ((pricePerShare - close) / close) * 100
        : null;
    const meta = metaById[q.issuer];

    return {
      issuer: q.issuer,
      displayName: meta?.displayName ?? q.issuer,
      shortName: meta?.shortName ?? q.issuer,
      tokenSymbol: q.tokenSymbol,
      tradeableNow: q.tradeableNow,
      tradeableReason: q.tradeableReason,
      pricePerShare,
      tokenPriceUsd: q.tokenPriceUsd,
      tokensPerShare: q.tokensPerShare,
      premiumVsClosePct,
      premiumVsCloseUsd,
      liquidity: q.liquidity,
      liquidityNote: q.liquidityNote,
      volume24hUsd: q.volume24hUsd,
      hoursNote: meta?.hoursNote ?? "",
      isBestRoute: false,
    } satisfies ParityRow;
  });

  const tradeable = scored.filter((r) => r.tradeableNow);
  let bestIssuer: IssuerId | null = null;
  if (tradeable.length > 0) {
    tradeable.sort((a, b) => a.pricePerShare - b.pricePerShare);
    bestIssuer = tradeable[0].issuer;
  }

  const rows = scored.map((r) => ({
    ...r,
    isBestRoute: bestIssuer != null && r.issuer === bestIssuer,
  }));

  // Stable issuer order: bstocks, ondo, xstocks
  const order: IssuerId[] = ["bstocks", "ondo", "xstocks"];
  rows.sort((a, b) => order.indexOf(a.issuer) - order.indexOf(b.issuer));

  let summary: string;
  if (quotes.length === 0) {
    summary = `No mock quotes for ${ticker.toUpperCase()}. Try NVDA or AAPL.`;
  } else if (!bestIssuer) {
    summary = `None of the three issuers can trade ${ticker.toUpperCase()} right now. Compare premiums and check again when markets reopen.`;
  } else {
    const best = rows.find((r) => r.issuer === bestIssuer)!;
    const prem =
      best.premiumVsClosePct != null
        ? best.premiumVsClosePct >= 0
          ? `${best.premiumVsClosePct.toFixed(2)}% above last close`
          : `${Math.abs(best.premiumVsClosePct).toFixed(2)}% below last close`
        : "vs close unavailable";
    summary = `Best spot route for $${amountUsd} of ${ticker.toUpperCase()}: ${best.displayName} at $${best.pricePerShare.toFixed(2)} per share (${prem}).`;
  }

  return {
    ticker: ticker.toUpperCase(),
    amountUsd,
    marketClose,
    rows,
    bestIssuer,
    summary,
  };
}

export function formatUsd(n: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}
