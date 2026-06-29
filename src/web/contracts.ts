import tipJarAbiJson from "./abi/TipJar.json";

import type { Abi } from "viem";

export const tipJarAbi = tipJarAbiJson as Abi;

export const usdcAbi = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export type TipRecord = {
  sender: `0x${string}`;
  amount: bigint;
  message: string;
  timestamp: bigint;
};
