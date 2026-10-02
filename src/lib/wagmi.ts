import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect } from "@wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

/** True when WalletConnect connector is registered (needed for mobile wallets). */
export const hasWalletConnect = projectId.length > 0;

/**
 * Canonical production origin for WalletConnect / Reown Verify metadata.
 * Must EXACTLY match the page origin users load (and the Reown allowlist).
 * Connectors are created at module load (SSR), so prefer NEXT_PUBLIC_APP_URL;
 * fall back to the live Vercel URL.
 */
export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  "https://parity-three-tau.vercel.app";

const connectors: CreateConnectorFn[] = [
  injected({
    shimDisconnect: true,
  }),
];

if (hasWalletConnect) {
  connectors.push(
    walletConnect({
      projectId,
      showQrModal: true,
      metadata: {
        name: process.env.NEXT_PUBLIC_APP_NAME || "Parity",
        description: "Fair-price router for tokenized stocks on BNB Chain",
        // Exact match required for Reown Verify (domain match → VALID).
        url: APP_URL,
        icons: [`${APP_URL}/parity-logo.svg`],
      },
    }),
  );
}

export const wagmiConfig = createConfig({
  chains: [bsc],
  connectors,
  transports: {
    [bsc.id]: http(),
  },
  ssr: true,
  storage: createStorage({
    storage: cookieStorage,
  }),
});

export const BSC_CHAIN_ID = bsc.id;
