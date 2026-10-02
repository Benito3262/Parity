/**
 * US equity market clock in America/New_York.
 * Sessions: pre-market 4:00–9:30, regular 9:30–16:00, post 16:00–20:00,
 * overnight, closed (weekends + NYSE holidays). Includes 2026 early closes.
 */

export type MarketSession =
  | "pre-market"
  | "regular"
  | "post-market"
  | "overnight"
  | "closed";

export type MarketStatus = {
  session: MarketSession;
  /** True during regular NYSE hours on a trading day */
  isRegularOpen: boolean;
  /** True if any extended US session is open (pre/regular/post) */
  isExtendedOpen: boolean;
  /** Plain-English label */
  label: string;
  /** Next regular open hint when closed */
  nextRegularOpenHint?: string;
  /** ISO of the evaluation time */
  asOf: string;
  /** Calendar date in ET (YYYY-MM-DD) */
  etDate: string;
};

/** Full-day NYSE holidays in 2026 (ET calendar dates). */
const NYSE_HOLIDAYS_2026 = new Set([
  "2026-01-01", // New Year's Day
  "2026-01-19", // MLK Day
  "2026-02-16", // Presidents' Day
  "2026-04-03", // Good Friday
  "2026-05-25", // Memorial Day
  "2026-06-19", // Juneteenth
  "2026-07-03", // Independence Day observed (Jul 4 is Sat)
  "2026-09-07", // Labor Day
  "2026-11-26", // Thanksgiving
  "2026-12-25", // Christmas
]);

/** Early close days (1:00 PM ET) in 2026. */
const NYSE_EARLY_CLOSE_2026 = new Set([
  "2026-11-27", // Day after Thanksgiving
  "2026-12-24", // Christmas Eve
]);

function etParts(date: Date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value])
  );
  const etDate = `${parts.year}-${parts.month}-${parts.day}`;
  const minutes = Number(parts.hour) * 60 + Number(parts.minute);
  const weekday = parts.weekday; // Mon..Sun
  return { etDate, minutes, weekday };
}

export function isNyseHoliday(etDate: string): boolean {
  return NYSE_HOLIDAYS_2026.has(etDate);
}

export function isNyseEarlyClose(etDate: string): boolean {
  return NYSE_EARLY_CLOSE_2026.has(etDate);
}

export function getMarketStatus(now: Date = new Date()): MarketStatus {
  const { etDate, minutes, weekday } = etParts(now);
  const asOf = now.toISOString();
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  const holiday = isNyseHoliday(etDate);

  if (isWeekend || holiday) {
    const hint =
      weekday === "Sat"
        ? "Might be cheaper at Monday's open."
        : weekday === "Sun"
          ? "Might be cheaper at Monday's open."
          : "US cash market is closed for a holiday.";
    return {
      session: "closed",
      isRegularOpen: false,
      isExtendedOpen: false,
      label: holiday ? "Closed (NYSE holiday)" : "Closed (weekend)",
      nextRegularOpenHint: hint,
      asOf,
      etDate,
    };
  }

  const early = isNyseEarlyClose(etDate);
  const regularEnd = early ? 13 * 60 : 16 * 60; // 1:00 PM or 4:00 PM
  const postEnd = early ? 13 * 60 : 20 * 60; // no post on early close

  const PRE_START = 4 * 60;
  const REG_START = 9 * 60 + 30;

  if (minutes >= REG_START && minutes < regularEnd) {
    return {
      session: "regular",
      isRegularOpen: true,
      isExtendedOpen: true,
      label: early ? "Regular session (early close day)" : "Regular session",
      asOf,
      etDate,
    };
  }
  if (minutes >= PRE_START && minutes < REG_START) {
    return {
      session: "pre-market",
      isRegularOpen: false,
      isExtendedOpen: true,
      label: "Pre-market",
      asOf,
      etDate,
    };
  }
  if (!early && minutes >= regularEnd && minutes < postEnd) {
    return {
      session: "post-market",
      isRegularOpen: false,
      isExtendedOpen: true,
      label: "Post-market",
      asOf,
      etDate,
    };
  }

  return {
    session: "overnight",
    isRegularOpen: false,
    isExtendedOpen: false,
    label: "Overnight (US cash market closed)",
    nextRegularOpenHint: "Might be cheaper at the next regular open.",
    asOf,
    etDate,
  };
}

/**
 * Ondo + bStock assumed tradeable only in regular US hours until live API says otherwise.
 * xStocks trade 24/7 on DEX pools.
 */
export function issuerTradeability(
  issuer: "bstocks" | "ondo" | "xstocks",
  status: MarketStatus = getMarketStatus()
): { tradeableNow: boolean; tradeableReason?: string } {
  if (issuer === "xstocks") {
    return { tradeableNow: true };
  }
  if (status.isRegularOpen) {
    return { tradeableNow: true };
  }
  const reason =
    issuer === "ondo"
      ? `Ondo spot follows US regular hours — currently ${status.label.toLowerCase()}.`
      : `bStocks RFQ / portal route follows US regular hours — currently ${status.label.toLowerCase()}.`;
  return { tradeableNow: false, tradeableReason: reason };
}

/** Weekday name of last regular close for drift copy (e.g. "Friday"). */
export function lastRegularCloseWeekdayLabel(now: Date = new Date()): string {
  const { weekday, etDate } = etParts(now);
  // Walk back to previous weekday that isn't a holiday
  const cursor = new Date(now);
  for (let i = 0; i < 10; i++) {
    cursor.setUTCDate(cursor.getUTCDate() - (i === 0 ? 0 : 1));
    const p = etParts(cursor);
    if (p.weekday === "Sat" || p.weekday === "Sun") continue;
    if (isNyseHoliday(p.etDate)) continue;
    // If today is a trading day and we're past regular close, today's close
    if (i === 0) {
      const status = getMarketStatus(now);
      if (status.session === "regular") {
        // Still in session — prior day
        continue;
      }
      if (
        status.session === "post-market" ||
        status.session === "overnight"
      ) {
        return weekdayLong(p.weekday);
      }
      // closed weekend/holiday — keep walking
      if (status.session === "closed" || status.session === "pre-market") {
        if (status.session === "pre-market") continue;
      }
    }
    return weekdayLong(p.weekday);
  }
  return "last";
}

function weekdayLong(short: string): string {
  const map: Record<string, string> = {
    Mon: "Monday",
    Tue: "Tuesday",
    Wed: "Wednesday",
    Thu: "Thursday",
    Fri: "Friday",
    Sat: "Saturday",
    Sun: "Sunday",
  };
  return map[short] ?? short;
}
