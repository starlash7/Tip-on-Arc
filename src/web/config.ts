import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcTestnet } from "viem/chains";
import { isAddress } from "viem";

import type { Address } from "./lib/tip";

export const ARC_EXPLORER_URL = "https://testnet.arcscan.app";
export const ARC_RPC_URL = "https://rpc.testnet.arc.network";
export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as const;

export const tipJarAddress = getConfiguredAddress(import.meta.env.VITE_TIPJAR_ADDRESS);

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(ARC_RPC_URL),
  },
});

export const queryClient = new QueryClient();

function getConfiguredAddress(value: string | undefined): Address | undefined {
  if (!value || !isAddress(value)) {
    return undefined;
  }

  return value;
}
