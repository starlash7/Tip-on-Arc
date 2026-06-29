import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleDollarSign,
  ExternalLink,
  Loader2,
  RefreshCcw,
  Send,
  Wallet,
} from "lucide-react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { waitForTransactionReceipt } from "wagmi/actions";
import { formatUnits } from "viem";
import { arcTestnet } from "viem/chains";

import { tipJarAbi, type TipRecord, usdcAbi } from "./contracts";
import { ARC_EXPLORER_URL, tipJarAddress, USDC_ADDRESS, wagmiConfig } from "./config";
import { getTipAction, parseTipAmount } from "./lib/tip";

type SubmitPhase = "idle" | "approving" | "tipping" | "success" | "error";

function App() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [amountInput, setAmountInput] = useState("1");
  const [message, setMessage] = useState("");
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [status, setStatus] = useState("Ready for Arc Testnet USDC tips.");
  const [lastHash, setLastHash] = useState<`0x${string}` | undefined>();

  const parsedAmount = useMemo(() => {
    try {
      return parseTipAmount(amountInput);
    } catch {
      return undefined;
    }
  }, [amountInput]);

  const amountError = useMemo(() => {
    try {
      parseTipAmount(amountInput);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : "Enter a valid amount";
    }
  }, [amountInput]);

  const allowanceQuery = useReadContract({
    address: USDC_ADDRESS,
    abi: usdcAbi,
    functionName: "allowance",
    args: address && tipJarAddress ? [address, tipJarAddress] : undefined,
    query: {
      enabled: Boolean(address && tipJarAddress),
    },
  });

  const totalQuery = useReadContract({
    address: tipJarAddress,
    abi: tipJarAbi,
    functionName: "getTotalTipped",
    query: {
      enabled: Boolean(tipJarAddress),
    },
  });

  const tipsQuery = useReadContract({
    address: tipJarAddress,
    abi: tipJarAbi,
    functionName: "getTips",
    query: {
      enabled: Boolean(tipJarAddress),
    },
  });

  const allowance = (allowanceQuery.data as bigint | undefined) ?? 0n;
  const totalTipped = (totalQuery.data as bigint | undefined) ?? 0n;
  const tips = ((tipsQuery.data as TipRecord[] | undefined) ?? []).slice().reverse();
  const messageBytes = new TextEncoder().encode(message).length;
  const firstConnector = connectors[0];
  const action = parsedAmount
    ? getTipAction({
        account: address,
        chainId,
        tipJarAddress,
        amount: parsedAmount,
        allowance,
      })
    : undefined;
  const isBusy = phase === "approving" || phase === "tipping";
  const canSubmit = Boolean(parsedAmount) && messageBytes <= 280 && !isBusy;

  async function handlePrimaryAction() {
    if (!parsedAmount || messageBytes > 280) {
      return;
    }

    try {
      if (!address) {
        if (firstConnector) {
          connect({ connector: firstConnector });
        } else {
          setPhase("error");
          setStatus("No injected wallet detected. Install or unlock a browser wallet.");
        }
        return;
      }

      if (chainId !== arcTestnet.id) {
        switchChain({ chainId: arcTestnet.id });
        return;
      }

      if (!tipJarAddress) {
        setPhase("error");
        setStatus("Set VITE_TIPJAR_ADDRESS after deploying TipJar.");
        return;
      }

      if (allowance < parsedAmount) {
        setPhase("approving");
        setStatus("Approve USDC spending in your wallet.");
        const approvalHash = await writeContractAsync({
          address: USDC_ADDRESS,
          abi: usdcAbi,
          functionName: "approve",
          args: [tipJarAddress, parsedAmount],
        });
        setLastHash(approvalHash);
        setStatus("Waiting for approval confirmation.");
        await waitForTransactionReceipt(wagmiConfig, { hash: approvalHash });
        await allowanceQuery.refetch();
      }

      setPhase("tipping");
      setStatus("Send your tip transaction in your wallet.");
      const tipHash = await writeContractAsync({
        address: tipJarAddress,
        abi: tipJarAbi,
        functionName: "tip",
        args: [parsedAmount, message],
      });
      setLastHash(tipHash);
      setStatus("Waiting for tip confirmation.");
      await waitForTransactionReceipt(wagmiConfig, { hash: tipHash });
      await Promise.all([totalQuery.refetch(), tipsQuery.refetch(), allowanceQuery.refetch()]);
      setPhase("success");
      setStatus("Tip recorded on Arc Testnet.");
      setAmountInput("1");
      setMessage("");
    } catch (error) {
      setPhase("error");
      setStatus(error instanceof Error ? error.message : "Transaction failed.");
    }
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="Wallet status">
        <div>
          <p className="eyebrow">Arc Testnet · USDC tips</p>
          <h1>TipJar on Arc</h1>
        </div>
        <div className="wallet-strip">
          <span className={address ? "network-pill ready" : "network-pill"}>
            {address ? compactAddress(address) : "Wallet disconnected"}
          </span>
          {address ? (
            <button className="ghost-button" type="button" onClick={() => disconnect()}>
              Disconnect
            </button>
          ) : null}
        </div>
      </section>

      <section className="workspace-grid">
        <div className="tip-panel">
          <div className="panel-heading">
            <CircleDollarSign aria-hidden="true" />
            <div>
              <p className="eyebrow">Send a tip</p>
              <h2>USDC + onchain note</h2>
            </div>
          </div>

          <label className="field">
            <span>Amount</span>
            <div className="amount-field">
              <input
                inputMode="decimal"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                placeholder="1.00"
              />
              <strong>USDC</strong>
            </div>
          </label>
          {amountError ? <p className="field-error">{amountError}</p> : null}

          <label className="field">
            <span>Message</span>
            <textarea
              value={message}
              maxLength={280}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Thanks for building on Arc."
            />
          </label>
          <div className={messageBytes > 280 ? "byte-count over" : "byte-count"}>
            {messageBytes}/280 bytes
          </div>

          <button
            className="primary-button"
            type="button"
            disabled={!canSubmit || isConnecting || isSwitching}
            onClick={handlePrimaryAction}
          >
            {isBusy || isConnecting || isSwitching ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : action === "connect" ? (
              <Wallet aria-hidden="true" />
            ) : action === "tip" ? (
              <Send aria-hidden="true" />
            ) : (
              <CheckCircle2 aria-hidden="true" />
            )}
            {getButtonLabel(action, phase)}
          </button>

          <div className={`status-line ${phase}`}>
            <span>{status}</span>
            {lastHash ? (
              <a href={`${ARC_EXPLORER_URL}/tx/${lastHash}`} target="_blank" rel="noreferrer">
                Arcscan <ExternalLink aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </div>

        <aside className="summary-panel" aria-label="TipJar summary">
          <div className="stat-row">
            <span>Total tipped</span>
            <strong>{formatUsdc(totalTipped)} USDC</strong>
          </div>
          <div className="stat-row">
            <span>Network</span>
            <strong>{chainId === arcTestnet.id ? "Arc Testnet" : "Switch needed"}</strong>
          </div>
          <div className="stat-row">
            <span>TipJar</span>
            <strong>{tipJarAddress ? compactAddress(tipJarAddress) : "Not configured"}</strong>
          </div>
          <button
            className="ghost-button refresh-button"
            type="button"
            onClick={() => void Promise.all([totalQuery.refetch(), tipsQuery.refetch()])}
          >
            <RefreshCcw aria-hidden="true" />
            Refresh
          </button>
        </aside>

        <section className="tips-panel" aria-label="Recent tips">
          <div className="section-title">
            <p className="eyebrow">Onchain records</p>
            <h2>Recent tips</h2>
          </div>
          {tips.length ? (
            <div className="tip-list">
              {tips.slice(0, 8).map((tip, index) => (
                <article className="tip-item" key={`${tip.sender}-${tip.timestamp}-${index}`}>
                  <div>
                    <strong>{formatUsdc(tip.amount)} USDC</strong>
                    <p>{tip.message || "No message"}</p>
                  </div>
                  <span>
                    {compactAddress(tip.sender)} · {formatTimestamp(tip.timestamp)}
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              {tipJarAddress
                ? "No tips yet. Be the first record in this jar."
                : "Deploy TipJar and set VITE_TIPJAR_ADDRESS to load tips."}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

function getButtonLabel(action: string | undefined, phase: SubmitPhase) {
  if (phase === "approving") return "Approving USDC";
  if (phase === "tipping") return "Sending tip";
  if (action === "connect") return "Connect wallet";
  if (action === "switch") return "Switch to Arc";
  if (action === "configure") return "Configure TipJar";
  if (action === "approve") return "Approve and tip";
  return "Send tip";
}

function compactAddress(address: `0x${string}`) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsdc(amount: bigint) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  }).format(Number(formatUnits(amount, 6)));
}

function formatTimestamp(timestamp: bigint) {
  if (timestamp === 0n) {
    return "pending";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(Number(timestamp) * 1000));
}

export default App;
