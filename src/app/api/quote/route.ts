import { NextRequest, NextResponse } from "next/server";
import { getBinanceWeb3Client } from "@/lib/binance-web3";
import { buildParityComparison } from "@/lib/parity";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "").trim();
  const amountRaw = req.nextUrl.searchParams.get("amount") || "20";
  const amountUsd = Number(amountRaw);

  if (!ticker) {
    return NextResponse.json(
      { error: "ticker is required (e.g. NVDA)" },
      { status: 400 }
    );
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json(
      { error: "amount must be a positive number" },
      { status: 400 }
    );
  }

  const client = getBinanceWeb3Client();
  const [quotes, issuers, marketClose] = await Promise.all([
    client.getQuotes(ticker),
    client.listIssuers(),
    client.getMarketClose(ticker),
  ]);

  const comparison = buildParityComparison({
    ticker,
    amountUsd,
    quotes,
    issuers,
    marketClose,
  });

  return NextResponse.json({
    mode: "mock",
    comparison,
  });
}
