import { MockBinanceWeb3Client } from "./mock";
import type { BinanceWeb3Client } from "./types";

/**
 * Factory: mock by default.
 * When BINANCE_WEB3_API_KEY + SECRET are set and USE_MOCK is not "true",
 * a future LiveBinanceWeb3Client can be returned here.
 */
export function createBinanceWeb3Client(): BinanceWeb3Client {
  const useMock =
    process.env.BINANCE_WEB3_USE_MOCK !== "false" ||
    !process.env.BINANCE_WEB3_API_KEY ||
    !process.env.BINANCE_WEB3_API_SECRET;

  if (useMock) {
    return new MockBinanceWeb3Client();
  }

  // Placeholder for the real adapter — keep mock until keys + live client ship.
  // import { LiveBinanceWeb3Client } from "./live";
  // return new LiveBinanceWeb3Client({
  //   apiKey: process.env.BINANCE_WEB3_API_KEY!,
  //   apiSecret: process.env.BINANCE_WEB3_API_SECRET!,
  // });
  console.warn(
    "[binance-web3] Keys present but LiveBinanceWeb3Client not implemented — using mock."
  );
  return new MockBinanceWeb3Client();
}

/** Singleton for server routes / RSC */
let cached: BinanceWeb3Client | null = null;

export function getBinanceWeb3Client(): BinanceWeb3Client {
  if (!cached) cached = createBinanceWeb3Client();
  return cached;
}
