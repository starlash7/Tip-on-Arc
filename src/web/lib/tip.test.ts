import { describe, expect, it } from "vitest";

import { getTipAction, parseTipAmount } from "./tip";

describe("parseTipAmount", () => {
  it("parses USDC amounts with six decimals", () => {
    expect(parseTipAmount("1")).toBe(1_000000n);
    expect(parseTipAmount("12.345678")).toBe(12_345678n);
    expect(parseTipAmount("0.000001")).toBe(1n);
  });

  it("rejects empty, zero, negative, and over-precise values", () => {
    expect(() => parseTipAmount("")).toThrow("Enter an amount");
    expect(() => parseTipAmount("0")).toThrow("Amount must be greater than 0");
    expect(() => parseTipAmount("-1")).toThrow("Amount must be greater than 0");
    expect(() => parseTipAmount("1.0000001")).toThrow("Use at most 6 decimals");
  });
});

describe("getTipAction", () => {
  it("chooses the next wallet action", () => {
    expect(
      getTipAction({
        account: undefined,
        chainId: undefined,
        tipJarAddress: "0x1111111111111111111111111111111111111111",
        amount: 1n,
        allowance: 0n,
      }),
    ).toBe("connect");

    expect(
      getTipAction({
        account: "0x2222222222222222222222222222222222222222",
        chainId: 1,
        tipJarAddress: "0x1111111111111111111111111111111111111111",
        amount: 1n,
        allowance: 0n,
      }),
    ).toBe("switch");

    expect(
      getTipAction({
        account: "0x2222222222222222222222222222222222222222",
        chainId: 5042002,
        tipJarAddress: undefined,
        amount: 1n,
        allowance: 0n,
      }),
    ).toBe("configure");

    expect(
      getTipAction({
        account: "0x2222222222222222222222222222222222222222",
        chainId: 5042002,
        tipJarAddress: "0x1111111111111111111111111111111111111111",
        amount: 5n,
        allowance: 4n,
      }),
    ).toBe("approve");

    expect(
      getTipAction({
        account: "0x2222222222222222222222222222222222222222",
        chainId: 5042002,
        tipJarAddress: "0x1111111111111111111111111111111111111111",
        amount: 5n,
        allowance: 5n,
      }),
    ).toBe("tip");
  });
});
