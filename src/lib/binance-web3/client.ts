import { MockBinanceWeb3Client } from "./mock";
import { LiveBinanceWeb3Client } from "./live";
import { HybridDataClient } from "@/lib/data/hybrid";
import type { BinanceWeb3Client } from "./types";

/**
 * Factory:
 * - BINANCE_LIVE=true (or USE_MOCK=false) + keys → LiveBinanceWeb3Client
 * - otherwise → HybridDataClient (Yahoo + Dex/CMC + PCS) — not the old fixture mock
 * - MockBinanceWeb3Client kept for tests / FORCE_FIXTURE_MOCK=true
 */
export function createBinanceWeb3Client(): BinanceWeb3Client {
  if (process.env.FORCE_FIXTURE_MOCK === "true") {
    return new MockBinanceWeb3Client();
  }

  const liveFlag =
    process.env.BINANCE_LIVE === "true" ||
    process.env.BINANCE_WEB3_USE_MOCK === "false";
  const hasKeys =
    Boolean(process.env.BINANCE_WEB3_API_KEY?.trim()) &&
    Boolean(process.env.BINANCE_WEB3_API_SECRET?.trim());

  if (liveFlag && hasKeys) {
    return new LiveBinanceWeb3Client({
      apiKey: process.env.BINANCE_WEB3_API_KEY!,
      apiSecret: process.env.BINANCE_WEB3_API_SECRET!,
    });
  }

  if (liveFlag && !hasKeys) {
    console.warn(
      "[binance-web3] BINANCE_LIVE set but keys missing — using hybrid CMC/Yahoo/PCS client."
    );
  }

  return new HybridDataClient();
}

/** Singleton for server routes / RSC */
let cached: BinanceWeb3Client | null = null;

export function getBinanceWeb3Client(): BinanceWeb3Client {
  if (!cached) cached = createBinanceWeb3Client();
  return cached;
}

/** Reset singleton (tests / hot reload) */
export function resetBinanceWeb3Client(): void {
  cached = null;
}
