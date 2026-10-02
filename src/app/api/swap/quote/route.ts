import { NextRequest, NextResponse } from "next/server";
import { getTokenListing } from "@/lib/tokens";
import { quoteBuyWithUsdt } from "@/lib/pancakeswap";

export const dynamic = "force-dynamic";

/** PancakeSwap V2 size-aware quote for an xStock ticker */
export async function GET(req: NextRequest) {
  const ticker = (req.nextUrl.searchParams.get("ticker") || "").trim().toUpperCase();
  const amountUsd = Number(req.nextUrl.searchParams.get("amount") || "20");
  if (!ticker) {
    return NextResponse.json({ error: "ticker required" }, { status: 400 });
  }
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    return NextResponse.json({ error: "amount must be positive" }, { status: 400 });
  }
  const listing = getTokenListing(ticker, "xstocks");
  if (!listing?.verified || !listing.address) {
    return NextResponse.json(
      { error: `No verified xStocks BSC address for ${ticker}` },
      { status: 404 }
    );
  }
  const quote = await quoteBuyWithUsdt({
    tokenOut: listing.address,
    amountUsd,
    tokenDecimals: listing.decimals,
  });
  return NextResponse.json({ mode: "pancakeswap-v2", listing, quote });
}
