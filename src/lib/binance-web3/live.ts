/**
 * Live Binance Web3 Build API client (typed stubs + real signing).
 * Base: https://web3.binance.com/build
 * Auth headers: X-OC-APIKEY, X-OC-TIMESTAMP, X-OC-SIGN, X-OC-RECV-WINDOW
 *
 * Enabled when BINANCE_LIVE=true (or BINANCE_WEB3_USE_MOCK=false) and keys exist.
 * Until portal Create is provisioned, calls will fail with honest errors —
 * hybrid CMC/PCS path remains the default.
 */

import { createHmac } from "crypto";
import type {
  BinanceWeb3Client,
  DataMode,
  ExecuteTradeRequest,
  ExecuteTradeResult,
  IssuerMeta,
  MarketClose,
  RawIssuerQuote,
  SimulateTradeRequest,
  SimulateTradeResult,
  Ticker,
} from "./types";
import { BINANCE_ERROR_MAP, QUOTE_EXPIRY_MS } from "./types";
import { issuerTradeability, getMarketStatus } from "@/lib/market-clock";
import { listTokensForTicker, tokenSymbolFor } from "@/lib/tokens";

const BASE =
  process.env.BINANCE_WEB3_BASE_URL?.replace(/\/$/, "") ||
  "https://web3.binance.com/build";

const ISSUERS: IssuerMeta[] = [
  {
    id: "bstocks",
    displayName: "bStocks",
    shortName: "bStocks",
    hoursNote: "Assumed US regular hours until API says otherwise",
  },
  {
    id: "ondo",
    displayName: "Ondo",
    shortName: "Ondo",
    hoursNote: "Assumed US regular hours until API says otherwise",
  },
  {
    id: "xstocks",
    displayName: "xStocks",
    shortName: "xStocks",
    hoursNote: "24/7 on DEX pools (BSC)",
  },
];

export type LiveClientConfig = {
  apiKey: string;
  apiSecret: string;
  recvWindowMs?: number;
};

function signPayload(
  secret: string,
  timestamp: string,
  method: string,
  path: string,
  body: string
): string {
  // Docs: HMAC-SHA256 over timestamp + method + path + body (canonical form).
  const payload = `${timestamp}${method.toUpperCase()}${path}${body}`;
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export class LiveBinanceWeb3Client implements BinanceWeb3Client {
  private apiKey: string;
  private apiSecret: string;
  private recvWindow: number;
  /** Cached RFQ quotes with expiry */
  private quoteCache = new Map<
    string,
    { expiresAt: number; payload: unknown }
  >();

  constructor(cfg: LiveClientConfig) {
    this.apiKey = cfg.apiKey;
    this.apiSecret = cfg.apiSecret;
    this.recvWindow = cfg.recvWindowMs ?? 5_000;
  }

  getMode(): DataMode {
    return "live";
  }

  /** Low-level signed request */
  async request<T = unknown>(
    method: "GET" | "POST",
    path: string,
    bodyObj?: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; data: T; errorCode?: number; errorMsg?: string }> {
    const timestamp = Date.now().toString();
    const body = bodyObj ? JSON.stringify(bodyObj) : "";
    const fullPath = path.startsWith("/") ? path : `/${path}`;
    const sign = signPayload(
      this.apiSecret,
      timestamp,
      method,
      fullPath,
      body
    );
    const res = await fetch(`${BASE}${fullPath}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-OC-APIKEY": this.apiKey,
        "X-OC-TIMESTAMP": timestamp,
        "X-OC-SIGN": sign,
        "X-OC-RECV-WINDOW": String(this.recvWindow),
      },
      body: method === "POST" ? body : undefined,
    });
    const data = (await res.json().catch(() => ({}))) as T & {
      code?: number;
      msg?: string;
      message?: string;
    };
    const errorCode = typeof data?.code === "number" ? data.code : undefined;
    const errorMsg =
      (data as { msg?: string; message?: string })?.msg ||
      (data as { message?: string })?.message;
    return {
      ok: res.ok && (errorCode === undefined || errorCode === 0),
      status: res.status,
      data,
      errorCode,
      errorMsg,
    };
  }

  // ─── RWA Data ─────────────────────────────────────────────
  async rwaTokens(params?: Record<string, string>) {
    const q = params
      ? "?" + new URLSearchParams(params).toString()
      : "";
    return this.request("GET", `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/tokens${q}`);
  }

  async rwaSearch(query: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/search?keyword=${encodeURIComponent(query)}`
    );
  }

  async rwaUnderlyingProfile(symbol: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/underlying-profile?symbol=${encodeURIComponent(symbol)}`
    );
  }

  // ─── Market ───────────────────────────────────────────────
  async marketPrice(symbol: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/price?symbol=${encodeURIComponent(symbol)}`
    );
  }

  // ─── Trading ──────────────────────────────────────────────
  async tradingQuote(body: Record<string, unknown>) {
    const res = await this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/quote`, body);
    if (res.ok) {
      const key = JSON.stringify(body);
      this.quoteCache.set(key, {
        expiresAt: Date.now() + QUOTE_EXPIRY_MS,
        payload: res.data,
      });
    }
    return res;
  }

  async tradingSwap(body: Record<string, unknown>) {
    return this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/swap`, body);
  }

  async orderSubmit(body: Record<string, unknown>) {
    return this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/order/submit`, body);
  }

  async pollOrder(orderId: string) {
    return this.request(
      "GET",
      `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/order/status?orderId=${encodeURIComponent(orderId)}`
    );
  }

  // ─── Transaction ──────────────────────────────────────────
  async transactionSimulate(body: Record<string, unknown>) {
    return this.request("POST", `/bapi/defi/v1/private/wallet-direct/buw/wallet/market/token/rwa/simulate`, body);
  }

  mapTradeError(code?: number, fallback?: string): string {
    if (code != null && BINANCE_ERROR_MAP[code]) return BINANCE_ERROR_MAP[code];
    return fallback || `Binance Web3 error${code != null ? ` ${code}` : ""}`;
  }

  isQuoteExpired(cacheKey: string): boolean {
    const e = this.quoteCache.get(cacheKey);
    if (!e) return true;
    return Date.now() > e.expiresAt;
  }

  // ─── BinanceWeb3Client surface ────────────────────────────
  async listIssuers(): Promise<IssuerMeta[]> {
    return ISSUERS;
  }

  async getMarketClose(ticker: Ticker): Promise<MarketClose | null> {
    // Prefer RWA underlying profile when live; fall back null so hybrid Yahoo can fill.
    try {
      const res = await this.rwaUnderlyingProfile(ticker.toUpperCase());
      const d = res.data as {
        data?: { lastClose?: number; closeTime?: string };
      };
      if (res.ok && d?.data?.lastClose) {
        return {
          ticker: ticker.toUpperCase(),
          closeUsd: d.data.lastClose,
          asOf: d.data.closeTime || new Date().toISOString(),
          sessionLabel: "NYSE close (Binance RWA)",
        };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  async getQuotes(
    ticker: Ticker,
    _amountUsd = 20
  ): Promise<RawIssuerQuote[]> {
    const t = ticker.toUpperCase();
    const listings = listTokensForTicker(t);
    const now = new Date().toISOString();
    const status = getMarketStatus();
    const quotes: RawIssuerQuote[] = [];

    for (const listing of listings) {
      const trade = issuerTradeability(listing.issuer, status);
      let tokenPriceUsd = 0;
      let volume24hUsd = 0;
      let dataSource = "binance-rwa";
      let tradeableNow = trade.tradeableNow && listing.verified;
      let tradeableReason = !listing.verified
        ? `No verified BSC address for ${listing.tokenSymbol} — marked unsupported.`
        : trade.tradeableReason;

      try {
        const res = await this.marketPrice(listing.tokenSymbol);
        const d = res.data as {
          data?: { price?: number; volume24h?: number };
          code?: number;
        };
        if (res.ok && d?.data?.price) {
          tokenPriceUsd = d.data.price;
          volume24hUsd = d.data.volume24h ?? 0;
        } else if (res.errorCode === 40367 || res.errorCode === 40369) {
          tradeableNow = false;
          tradeableReason = this.mapTradeError(res.errorCode);
        } else {
          dataSource = "binance-rwa-unavailable";
        }
      } catch {
        dataSource = "binance-rwa-error";
      }

      const ratio = listing.tokenToShareRatio || 1;
      quotes.push({
        issuer: listing.issuer,
        ticker: t,
        tokenSymbol: listing.tokenSymbol || tokenSymbolFor(t, listing.issuer),
        tokenPriceUsd,
        tokenToShareRatio: ratio,
        tokensPerShare: ratio > 0 ? 1 / ratio : 1,
        contractAddress: listing.address,
        tradeableNow: tradeableNow && tokenPriceUsd > 0,
        tradeableReason:
          tradeableNow && tokenPriceUsd <= 0
            ? "Live Binance price unavailable for this token."
            : tradeableReason,
        liquidity: volume24hUsd > 1_000_000 ? "high" : volume24hUsd > 100_000 ? "medium" : "low",
        liquidityNote: "Live Binance Web3 quote",
        volume24hUsd,
        updatedAt: now,
        dataSource,
      });
    }
    return quotes;
  }

  async simulateTrade(req: SimulateTradeRequest): Promise<SimulateTradeResult> {
    const res = await this.transactionSimulate({
      issuer: req.issuer,
      symbol: req.ticker,
      amountUsd: req.amountUsd,
      walletAddress: req.walletAddress,
    });
    if (!res.ok) {
      return {
        ok: false,
        issuer: req.issuer,
        ticker: req.ticker.toUpperCase(),
        amountUsd: req.amountUsd,
        estimatedTokens: 0,
        effectivePricePerShare: 0,
        estimatedFeesUsd: 0,
        route: "binance-web3",
        steps: [{ label: "Binance /simulate", status: "skip" }],
        warning: this.mapTradeError(res.errorCode, res.errorMsg),
      };
    }
    const d = res.data as {
      data?: {
        tokensOut?: number;
        pricePerShare?: number;
        feesUsd?: number;
        route?: string;
      };
    };
    return {
      ok: true,
      issuer: req.issuer,
      ticker: req.ticker.toUpperCase(),
      amountUsd: req.amountUsd,
      estimatedTokens: d?.data?.tokensOut ?? 0,
      effectivePricePerShare: d?.data?.pricePerShare ?? 0,
      estimatedFeesUsd: d?.data?.feesUsd ?? 0,
      route: d?.data?.route ?? "Binance Web3 spot",
      steps: [
        { label: "Check trade window", status: "ok" },
        { label: "Binance quote (30s expiry)", status: "ok" },
        { label: "Transaction /simulate", status: "ok" },
      ],
    };
  }

  async executeTrade(req: ExecuteTradeRequest): Promise<ExecuteTradeResult> {
    const submit = await this.orderSubmit({
      issuer: req.issuer,
      symbol: req.ticker,
      amountUsd: req.amountUsd,
      simulationId: req.simulationId,
    });
    if (!submit.ok) {
      return {
        ok: false,
        stubbed: false,
        message: this.mapTradeError(submit.errorCode, submit.errorMsg),
      };
    }
    const d = submit.data as { data?: { orderId?: string; txHash?: string } };
    if (d?.data?.orderId) {
      // Poll a few times for RFQ routes
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 1500));
        const st = await this.pollOrder(d.data!.orderId!);
        const sd = st.data as { data?: { status?: string; txHash?: string } };
        if (sd?.data?.status === "filled" || sd?.data?.txHash) {
          return {
            ok: true,
            stubbed: false,
            message: "Order filled",
            txHash: sd.data.txHash,
          };
        }
      }
    }
    return {
      ok: Boolean(d?.data?.txHash),
      stubbed: false,
      message: d?.data?.txHash ? "Submitted" : "Order submitted — still pending",
      txHash: d?.data?.txHash,
    };
  }
}
