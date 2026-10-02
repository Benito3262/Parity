/**
 * Server-side Yahoo Finance chart/quote helpers (no API key).
 * Used for last regular-session close of the underlying equity.
 */

import { cacheGetOrSet } from "@/lib/cache";
import { getMarketStatus } from "@/lib/market-clock";

export type YahooClose = {
  ticker: string;
  /** Last completed regular-session close (USD) */
  closeUsd: number;
  /** Unix seconds of that bar */
  closeTimeSec: number;
  /** ISO timestamp of that ET day's regular close */
  asOf: string;
  /** Calendar date in ET (YYYY-MM-DD) of the close bar */
  closeEtDate: string;
  /** Latest regularMarketPrice if available (may be live/extended) */
  lastPriceUsd: number | null;
  /** Short momentum: last completed close vs prior completed close */
  direction: "up" | "down" | "flat" | null;
  source: "yahoo";
};

const UA =
  "Mozilla/5.0 (compatible; ParityBot/1.0; +https://github.com/Benito3262/Parity)";

function etDateString(sec: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(sec * 1000));
}

/** Label asOf as that ET day's regular close (approx 16:00 ET → 20:00Z EDT). */
function regularCloseIso(etDate: string): string {
  return `${etDate}T20:00:00.000Z`;
}

/**
 * Last COMPLETED daily bar close.
 * Never use meta.chartPreviousClose — with a multi-day range it can be
 * weeks stale (e.g. TSLA showing $365.44 instead of Oct 1 $354.11).
 * During pre-market / regular, today's bar is incomplete → drop it.
 */
export async function fetchYahooClose(ticker: string): Promise<YahooClose | null> {
  const t = ticker.toUpperCase();
  return cacheGetOrSet(`yahoo:close:v4:${t}`, 5 * 60_000, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      t
    )}?interval=1d&range=15d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      chart?: {
        result?: Array<{
          meta?: {
            regularMarketPrice?: number;
            chartPreviousClose?: number;
            previousClose?: number;
            regularMarketTime?: number;
            currency?: string;
          };
          timestamp?: number[];
          indicators?: { quote?: Array<{ close?: Array<number | null> }> };
        }>;
      };
    };
    const result = data.chart?.result?.[0];
    if (!result) return null;

    const timestamps = result.timestamp ?? [];
    const closes = result.indicators?.quote?.[0]?.close ?? [];
    const pairs: { t: number; c: number; et: string }[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const c = closes[i];
      if (typeof c === "number" && Number.isFinite(c)) {
        pairs.push({ t: timestamps[i], c, et: etDateString(timestamps[i]) });
      }
    }
    if (pairs.length === 0) return null;

    const status = getMarketStatus();
    const todayEt = status.etDate;

    // Until the regular session has finished, today's daily bar is incomplete.
    let completed = pairs;
    const last = pairs[pairs.length - 1];
    if (
      last.et === todayEt &&
      (status.session === "pre-market" || status.session === "regular")
    ) {
      completed = pairs.slice(0, -1);
    }
    if (completed.length === 0) completed = pairs;

    const closeBar = completed[completed.length - 1];
    const prevBar = completed.length >= 2 ? completed[completed.length - 2] : null;

    let direction: YahooClose["direction"] = null;
    if (prevBar) {
      const d = closeBar.c - prevBar.c;
      direction = d > 0.01 ? "up" : d < -0.01 ? "down" : "flat";
    }

    const lastPrice =
      typeof result.meta?.regularMarketPrice === "number"
        ? result.meta.regularMarketPrice
        : null;

    return {
      ticker: t,
      closeUsd: closeBar.c,
      closeTimeSec: closeBar.t,
      asOf: regularCloseIso(closeBar.et),
      closeEtDate: closeBar.et,
      lastPriceUsd: lastPrice,
      direction,
      source: "yahoo",
    } satisfies YahooClose;
  });
}

/** Format a close timestamp in America/New_York for UI. */
export function formatEt(isoOrSec: string | number): string {
  const d =
    typeof isoOrSec === "number"
      ? new Date(isoOrSec * 1000)
      : new Date(isoOrSec);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  });
}
