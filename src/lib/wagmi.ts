import { http, createConfig, createStorage, cookieStorage } from "wagmi";
import { bsc } from "wagmi/chains";
import { injected, walletConnect } from "@wagmi/connectors";
import type { CreateConnectorFn } from "wagmi";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() ?? "";

export const hasWalletConnect = projectId.length > 0;

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
        url: "https://parity-three-tau.vercel.app",
        icons: ["https://parity-three-tau.vercel.app/parity-logo.svg"],
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
