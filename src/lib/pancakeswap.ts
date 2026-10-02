/**
 * PancakeSwap V2 helpers on BSC (chain 56) for xStocks spot quotes + swap encoding.
 * Uses public RPC (BSC_RPC_URL or fallbacks). Spot only — user must sign.
 */

import {
  createPublicClient,
  http,
  parseUnits,
  formatUnits,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { bsc } from "viem/chains";
import { BSC } from "@/lib/tokens";
import { cacheGetOrSet } from "@/lib/cache";

const ROUTER_ABI = [
  {
    name: "getAmountsOut",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "path", type: "address[]" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
  {
    name: "swapExactTokensForTokens",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amountIn", type: "uint256" },
      { name: "amountOutMin", type: "uint256" },
      { name: "path", type: "address[]" },
      { name: "to", type: "address" },
      { name: "deadline", type: "uint256" },
    ],
    outputs: [{ name: "amounts", type: "uint256[]" }],
  },
] as const;

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const RPC_FALLBACKS = [
  process.env.BSC_RPC_URL,
  "https://bsc-dataseed.binance.org",
  "https://bsc-dataseed1.defibit.io",
  "https://rpc.ankr.com/bsc",
].filter(Boolean) as string[];

export function getBscPublicClient() {
  return createPublicClient({
    chain: bsc,
    transport: http(RPC_FALLBACKS[0] ?? "https://bsc-dataseed.binance.org", {
      timeout: 12_000,
    }),
  });
}

export type PcsQuoteResult = {
  ok: boolean;
  tokenIn: Address;
  tokenOut: Address;
  amountInUsd: number;
  amountInWei: string;
  amountOutWei: string;
  amountOutTokens: number;
  /** Effective USD per 1 token out */
  effectiveTokenPriceUsd: number;
  /** Spot mid (tiny probe) USD per token */
  midTokenPriceUsd: number | null;
  priceImpactPct: number | null;
  path: Address[];
  pathLabel: string;
  slippageBps: number;
  amountOutMinWei: string;
  warning?: string;
  blocked?: boolean;
  blockReason?: string;
  gasEstimate?: string;
  source: "pancakeswap-v2";
};

function buildPaths(tokenOut: Address): Address[][] {
  const usdt = BSC.USDT;
  const wbnb = BSC.WBNB;
  const usdc = BSC.USDC;
  return [
    [usdt, tokenOut],
    [usdt, wbnb, tokenOut],
    [usdc, tokenOut],
    [usdc, wbnb, tokenOut],
  ];
}

async function tryGetAmountsOut(
  client: ReturnType<typeof getBscPublicClient>,
  amountIn: bigint,
  path: Address[]
): Promise<bigint[] | null> {
  try {
    const amounts = await client.readContract({
      address: BSC.PCS_V2_ROUTER,
      abi: ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [amountIn, path],
    });
    return amounts as bigint[];
  } catch {
    return null;
  }
}

/**
 * Quote buying `tokenOut` with USDT (18 decimals on BSC) for `amountUsd`.
 */
export async function quoteBuyWithUsdt(args: {
  tokenOut: Address;
  amountUsd: number;
  tokenDecimals?: number;
  slippageBps?: number;
}): Promise<PcsQuoteResult> {
  const slippageBps = args.slippageBps ?? 100; // 1%
  const tokenDecimals = args.tokenDecimals ?? 18;
  const client = getBscPublicClient();
  const amountIn = parseUnits(args.amountUsd.toFixed(6), 18);

  // Probe mid with $5
  const probeIn = parseUnits("5", 18);
  let best: {
    path: Address[];
    amounts: bigint[];
    probe?: bigint[];
  } | null = null;

  for (const path of buildPaths(args.tokenOut)) {
    const amounts = await tryGetAmountsOut(client, amountIn, path);
    if (!amounts || amounts.length < 2) continue;
    const probe = await tryGetAmountsOut(client, probeIn, path);
    if (!best || amounts[amounts.length - 1] > best.amounts[best.amounts.length - 1]) {
      best = { path, amounts, probe: probe ?? undefined };
    }
  }

  if (!best) {
    return {
      ok: false,
      tokenIn: BSC.USDT,
      tokenOut: args.tokenOut,
      amountInUsd: args.amountUsd,
      amountInWei: amountIn.toString(),
      amountOutWei: "0",
      amountOutTokens: 0,
      effectiveTokenPriceUsd: 0,
      midTokenPriceUsd: null,
      priceImpactPct: null,
      path: [],
      pathLabel: "no route",
      slippageBps,
      amountOutMinWei: "0",
      blocked: true,
      blockReason:
        "No PancakeSwap V2 route found for this token on BSC (missing pool or RPC error).",
      source: "pancakeswap-v2",
    };
  }

  const out = best.amounts[best.amounts.length - 1];
  const amountOutTokens = Number(formatUnits(out, tokenDecimals));
  const effective =
    amountOutTokens > 0 ? args.amountUsd / amountOutTokens : 0;

  let mid: number | null = null;
  let priceImpactPct: number | null = null;
  if (best.probe && best.probe.length >= 2) {
    const probeOut = Number(
      formatUnits(best.probe[best.probe.length - 1], tokenDecimals)
    );
    if (probeOut > 0) {
      mid = 5 / probeOut;
      if (mid > 0 && effective > 0) {
        priceImpactPct = ((effective - mid) / mid) * 100;
      }
    }
  }

  const amountOutMin =
    (out * BigInt(10_000 - slippageBps)) / BigInt(10_000);

  let warning: string | undefined;
  let blocked = false;
  let blockReason: string | undefined;

  if (priceImpactPct != null && priceImpactPct >= 15) {
    blocked = true;
    blockReason = `Price impact ~${priceImpactPct.toFixed(
      1
    )}% is too high for a safe spot buy. Try a smaller size.`;
  } else if (priceImpactPct != null && priceImpactPct >= 3) {
    warning = `Elevated price impact (~${priceImpactPct.toFixed(
      1
    )}%). Consider a smaller order.`;
  }

  if (args.amountUsd > 5000) {
    warning =
      (warning ? warning + " " : "") +
      "Large notional — Parity is tuned for small spot buys.";
  }

  let gasEstimate: string | undefined;
  try {
    const gas = await client.estimateContractGas({
      address: BSC.PCS_V2_ROUTER,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [
        amountIn,
        amountOutMin,
        best.path,
        "0x0000000000000000000000000000000000000001",
        BigInt(Math.floor(Date.now() / 1000) + 600),
      ],
      account: "0x0000000000000000000000000000000000000001",
    });
    gasEstimate = gas.toString();
  } catch {
    // estimate may fail without balances — ignore for quote
  }

  const pathLabel = best.path
    .map((a) => {
      const l = a.toLowerCase();
      if (l === BSC.USDT.toLowerCase()) return "USDT";
      if (l === BSC.USDC.toLowerCase()) return "USDC";
      if (l === BSC.WBNB.toLowerCase()) return "WBNB";
      return "TOKEN";
    })
    .join(" → ");

  return {
    ok: !blocked,
    tokenIn: BSC.USDT,
    tokenOut: args.tokenOut,
    amountInUsd: args.amountUsd,
    amountInWei: amountIn.toString(),
    amountOutWei: out.toString(),
    amountOutTokens,
    effectiveTokenPriceUsd: effective,
    midTokenPriceUsd: mid,
    priceImpactPct,
    path: best.path,
    pathLabel,
    slippageBps,
    amountOutMinWei: amountOutMin.toString(),
    warning,
    blocked,
    blockReason,
    gasEstimate,
    source: "pancakeswap-v2",
  };
}

export function encodeApproveUsdt(amountWei: bigint): Hex {
  return encodeFunctionData({
    abi: ERC20_ABI,
    functionName: "approve",
    args: [BSC.PCS_V2_ROUTER, amountWei],
  });
}

export function encodeSwapExactTokens(args: {
  amountInWei: bigint;
  amountOutMinWei: bigint;
  path: Address[];
  to: Address;
  deadlineSec?: number;
}): Hex {
  return encodeFunctionData({
    abi: ROUTER_ABI,
    functionName: "swapExactTokensForTokens",
    args: [
      args.amountInWei,
      args.amountOutMinWei,
      args.path,
      args.to,
      BigInt(args.deadlineSec ?? Math.floor(Date.now() / 1000) + 600),
    ],
  });
}

export async function getUsdtAllowance(
  owner: Address
): Promise<bigint> {
  const client = getBscPublicClient();
  return client.readContract({
    address: BSC.USDT,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [owner, BSC.PCS_V2_ROUTER],
  });
}

export async function getUsdtBalance(owner: Address): Promise<bigint> {
  const client = getBscPublicClient();
  return client.readContract({
    address: BSC.USDT,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [owner],
  });
}

/** Simulate swap via eth_call (dry-run). */
export async function simulateSwap(args: {
  from: Address;
  amountInWei: bigint;
  amountOutMinWei: bigint;
  path: Address[];
}): Promise<{ ok: boolean; error?: string }> {
  const client = getBscPublicClient();
  try {
    await client.simulateContract({
      address: BSC.PCS_V2_ROUTER,
      abi: ROUTER_ABI,
      functionName: "swapExactTokensForTokens",
      args: [
        args.amountInWei,
        args.amountOutMinWei,
        args.path,
        args.from,
        BigInt(Math.floor(Date.now() / 1000) + 600),
      ],
      account: args.from,
    });
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message.slice(0, 240) : "Simulation failed",
    };
  }
}

export { ERC20_ABI, ROUTER_ABI };
