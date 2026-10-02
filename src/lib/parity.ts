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
  /**
   * Shares per 1 token (Binance tokenToShareRatio).
   * pricePerShare = tokenPriceUsd / tokenToShareRatio
   */
  tokenToShareRatio: number;
  /** @deprecated 1/tokenToShareRatio — kept for older UI bits */
  tokensPerShare: number;
  /** % above (+) / below (−) last market close */
  premiumVsClosePct: number | null;
  premiumVsCloseUsd: number | null;
  liquidity: "high" | "medium" | "low";
  liquidityNote: string;
  volume24hUsd: number;
  hoursNote: string;
  isBestRoute: boolean;
  priceImpactPct?: number | null;
  dataSource?: string;
  contractAddress?: string | null;
  /** Extra paid vs best route (if this row is worse and tradeable) */
  worseByUsd?: number | null;
  worseByPct?: number | null;
};

export type ParityComparison = {
  ticker: string;
  amountUsd: number;
  marketClose: MarketClose | null;
  rows: ParityRow[];
  bestIssuer: IssuerId | null;
  /** Plain-language summary for normal users */
  summary: string;
  /** When quotes were built */
  priceAsOf: string;
  /** Drift badge helper inputs */
  closeWeekdayLabel?: string;
  marketClosed?: boolean;
};

/**
 * Convert issuer token quotes into true price-per-share and pick the best
 * tradeable route (lowest price per share among tradeable venues).
 *
 * pricePerShare = tokenPriceUsd / tokenToShareRatio
 */
export function buildParityComparison(args: {
  ticker: string;
  amountUsd: number;
  quotes: RawIssuerQuote[];
  issuers: IssuerMeta[];
  marketClose: MarketClose | null;
  closeWeekdayLabel?: string;
  marketClosed?: boolean;
}): ParityComparison {
  const {
    ticker,
    amountUsd,
    quotes,
    issuers,
    marketClose,
    closeWeekdayLabel,
    marketClosed,
  } = args;
  const metaById = Object.fromEntries(issuers.map((i) => [i.id, i])) as Record<
    IssuerId,
    IssuerMeta
  >;
  const priceAsOf = new Date().toISOString();

  const scored = quotes.map((q) => {
    const ratio =
      q.tokenToShareRatio > 0
        ? q.tokenToShareRatio
        : q.tokensPerShare > 0
          ? 1 / q.tokensPerShare
          : 1;
    const pricePerShare =
      q.tokenPriceUsd > 0 && ratio > 0 ? q.tokenPriceUsd / ratio : 0;
    const close = marketClose?.closeUsd ?? null;
    const premiumVsCloseUsd =
      close != null && pricePerShare > 0 ? pricePerShare - close : null;
    const premiumVsClosePct =
      close != null && close > 0 && pricePerShare > 0
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
      tokenToShareRatio: ratio,
      tokensPerShare: ratio > 0 ? 1 / ratio : 1,
      premiumVsClosePct,
      premiumVsCloseUsd,
      liquidity: q.liquidity,
      liquidityNote: q.liquidityNote,
      volume24hUsd: q.volume24hUsd,
      hoursNote: meta?.hoursNote ?? "",
      isBestRoute: false,
      priceImpactPct: q.priceImpactPct,
      dataSource: q.dataSource,
      contractAddress: q.contractAddress,
      worseByUsd: null as number | null,
      worseByPct: null as number | null,
    } satisfies ParityRow;
  });

  const tradeable = scored.filter((r) => r.tradeableNow && r.pricePerShare > 0);
  let bestIssuer: IssuerId | null = null;
  let bestPrice = 0;
  if (tradeable.length > 0) {
    tradeable.sort((a, b) => a.pricePerShare - b.pricePerShare);
    bestIssuer = tradeable[0].issuer;
    bestPrice = tradeable[0].pricePerShare;
  }

  const rows = scored.map((r) => {
    let worseByUsd: number | null = null;
    let worseByPct: number | null = null;
    if (
      bestIssuer &&
      r.tradeableNow &&
      r.pricePerShare > 0 &&
      r.issuer !== bestIssuer &&
      bestPrice > 0
    ) {
      worseByUsd = r.pricePerShare - bestPrice;
      worseByPct = (worseByUsd / bestPrice) * 100;
    }
    return {
      ...r,
      isBestRoute: bestIssuer != null && r.issuer === bestIssuer,
      worseByUsd,
      worseByPct,
    };
  });

  const order: IssuerId[] = ["bstocks", "ondo", "xstocks"];
  rows.sort((a, b) => order.indexOf(a.issuer) - order.indexOf(b.issuer));

  let summary: string;
  if (quotes.length === 0) {
    summary = `No quotes for ${ticker.toUpperCase()}. Try NVDA, AAPL, TSLA, SPY, or another liquid ticker.`;
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
    priceAsOf,
    closeWeekdayLabel,
    marketClosed,
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

/** Drift badge copy for buy flow */
export function driftBadgeText(args: {
  premiumVsClosePct: number | null;
  closeWeekdayLabel?: string;
  direction?: "up" | "down" | "flat" | null;
  marketClosed?: boolean;
}): string | null {
  if (args.premiumVsClosePct == null) return null;
  const abs = Math.abs(args.premiumVsClosePct).toFixed(1);
  const day = args.closeWeekdayLabel || "last";
  const side =
    args.premiumVsClosePct >= 0
      ? `+${abs}% above ${day}'s close`
      : `−${abs}% below ${day}'s close`;
  let dir = "";
  if (args.direction === "up") dir = " and rising";
  else if (args.direction === "down") dir = " and falling";
  let extra = "";
  if (
    args.marketClosed &&
    args.premiumVsClosePct >= 1.5
  ) {
    extra = " Might be cheaper at Monday's open.";
  }
  return `${side}${dir}.${extra}`;
}
