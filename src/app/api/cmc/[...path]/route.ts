import { NextRequest, NextResponse } from "next/server";
import { cmcProxyFetch, isAllowlistedCmcPath } from "@/lib/cmc";

export const dynamic = "force-dynamic";

/**
 * Server-side CoinMarketCap proxy.
 * Only allowlisted paths; API key injected from env, never exposed to client.
 * Example: GET /api/cmc/v2/cryptocurrency/quotes/latest?symbol=BTC
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> }
) {
  const { path } = await ctx.params;
  const joined = "/" + (path || []).join("/");
  const qs = req.nextUrl.searchParams.toString();
  const pathWithQuery = qs ? `${joined}?${qs}` : joined;

  if (!isAllowlistedCmcPath(joined)) {
    return NextResponse.json(
      { error: "Endpoint not allowlisted", path: joined },
      { status: 400 }
    );
  }

  const { status, body } = await cmcProxyFetch(pathWithQuery);
  return NextResponse.json(body, { status });
}
