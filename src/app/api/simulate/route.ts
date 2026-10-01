import { NextRequest, NextResponse } from "next/server";
import { getBinanceWeb3Client, type IssuerId } from "@/lib/binance-web3";

export const dynamic = "force-dynamic";

const ISSUERS: IssuerId[] = ["bstocks", "ondo", "xstocks"];

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { issuer, ticker, amountUsd, walletAddress } = (body ?? {}) as {
    issuer?: string;
    ticker?: string;
    amountUsd?: number;
    walletAddress?: string;
  };

  if (!issuer || !ISSUERS.includes(issuer as IssuerId)) {
    return NextResponse.json(
      { error: "issuer must be one of bstocks | ondo | xstocks" },
      { status: 400 }
    );
  }
  if (!ticker || typeof ticker !== "string") {
    return NextResponse.json({ error: "ticker is required" }, { status: 400 });
  }
  if (
    typeof amountUsd !== "number" ||
    !Number.isFinite(amountUsd) ||
    amountUsd <= 0
  ) {
    return NextResponse.json(
      { error: "amountUsd must be a positive number" },
      { status: 400 }
    );
  }

  const client = getBinanceWeb3Client();
  const result = await client.simulateTrade({
    issuer: issuer as IssuerId,
    ticker,
    amountUsd,
    walletAddress,
  });

  return NextResponse.json({ mode: "mock", result });
}
