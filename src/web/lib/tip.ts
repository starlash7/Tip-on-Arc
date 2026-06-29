import { parseUnits } from "viem";

export const ARC_TESTNET_CHAIN_ID = 5_042_002;

export type Address = `0x${string}`;
export type TipAction = "connect" | "switch" | "configure" | "approve" | "tip";

export type TipActionInput = {
  account?: Address;
  chainId?: number;
  tipJarAddress?: Address;
  amount: bigint;
  allowance?: bigint;
};

export function parseTipAmount(value: string): bigint {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Enter an amount");
  }
  if (trimmed.startsWith("-")) {
    throw new Error("Amount must be greater than 0");
  }
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("Enter a valid USDC amount");
  }

  const [, decimals = ""] = trimmed.split(".");
  if (decimals.length > 6) {
    throw new Error("Use at most 6 decimals");
  }

  const amount = parseUnits(trimmed, 6);
  if (amount <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  return amount;
}

export function getTipAction(input: TipActionInput): TipAction {
  if (!input.account) {
    return "connect";
  }
  if (input.chainId !== ARC_TESTNET_CHAIN_ID) {
    return "switch";
  }
  if (!input.tipJarAddress) {
    return "configure";
  }
  if ((input.allowance ?? 0n) < input.amount) {
    return "approve";
  }

  return "tip";
}
