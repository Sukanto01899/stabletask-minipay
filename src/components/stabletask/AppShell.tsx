"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  useConnect,
  useConnectors,
  useConnection,
  useDisconnect,
} from "wagmi";
import {
  GiftIcon,
  Tap01Icon,
  Task01Icon,
  UserCircleIcon,
} from "@hugeicons/core-free-icons";

import { BottomNav } from "@/components/stabletask/BottomNav";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { stableTaskConfig } from "@/lib/app-config";

type Eip1193Provider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

function toHexChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

function buildAddChainParams(chain: typeof stableTaskConfig.chain) {
  const rpcUrls =
    chain.rpcUrls?.default?.http?.length ? chain.rpcUrls.default.http : [];
  const blockExplorerUrls = chain.blockExplorers?.default?.url
    ? [chain.blockExplorers.default.url]
    : [];

  return {
    chainId: toHexChainId(chain.id),
    chainName: chain.name,
    nativeCurrency: chain.nativeCurrency,
    rpcUrls,
    blockExplorerUrls,
  };
}

const HEADER_COPY: Record<string, { title: string; subtitle: string }> = {
  "/tasks": {
    title: "Tasks",
    subtitle: "Complete tasks and earn cUSD.",
  },
  "/tap": {
    title: "Tap",
    subtitle: "Tap onchain and earn 1 XP per transaction.",
  },
  "/rewards": {
    title: "Rewards",
    subtitle: "Track your claimed rewards and progress.",
  },
  "/profile": {
    title: "Profile",
    subtitle: "Manage your wallet and preferences.",
  },
  "/admin/fraud": {
    title: "Fraud Dashboard",
    subtitle: "Monitor claim patterns and suspicious activity.",
  },
};

async function copyToClipboard(text: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === "undefined") return;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, chainId, isConnected } = useConnection();
  const connectors = useConnectors();
  const { connect, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();

  const switchAttemptedRef = useRef(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);

  const header = useMemo(() => {
    return (
      HEADER_COPY[pathname] ?? {
        title: "StableTask",
        subtitle: "Complete tasks and earn cUSD.",
      }
    );
  }, [pathname]);

  const shortAddress = useMemo(() => {
    if (!address) return undefined;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }, [address]);

  useEffect(() => {
    const provider =
      typeof window !== "undefined"
        ? ((window as Window & { ethereum?: unknown }).ethereum as
            | Eip1193Provider
            | undefined)
        : undefined;

    if (!isConnected || !provider) {
      switchAttemptedRef.current = false;
      return;
    }

    if (chainId === stableTaskConfig.chain.id) {
      switchAttemptedRef.current = false;
      return;
    }

    if (switchAttemptedRef.current) return;
    switchAttemptedRef.current = true;

    const switchToCelo = async () => {
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: toHexChainId(stableTaskConfig.chain.id) }],
        });
      } catch (error) {
        const errorCode = (error as { code?: unknown } | null)?.code;
        const isUnknownChain =
          errorCode === 4902 ||
          (typeof errorCode === "number" && errorCode === 4902) ||
          String(error).toLowerCase().includes("unrecognized chain") ||
          String(error).toLowerCase().includes("unknown chain");

        if (!isUnknownChain) {
          console.error("Failed to switch to Celo mainnet:", error);
          switchAttemptedRef.current = false;
          return;
        }

        try {
          await provider.request({
            method: "wallet_addEthereumChain",
            params: [buildAddChainParams(stableTaskConfig.chain)],
          });
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: toHexChainId(stableTaskConfig.chain.id) }],
          });
        } catch (addError) {
          console.error("Failed to add/switch to Celo mainnet:", addError);
        } finally {
          switchAttemptedRef.current = false;
        }
      }
    };

    void switchToCelo();
  }, [chainId, isConnected]);

  useEffect(() => {
    if (!walletSheetOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setWalletSheetOpen(false);
    };
    window.addEventListener("keydown", handleEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [walletSheetOpen]);

  useEffect(() => {
    if (!isConnected) setWalletSheetOpen(false);
  }, [isConnected]);

  const handleConnect = async () => {
    const [primaryConnector] = connectors;
    if (!primaryConnector) return;
    try {
      await connect({ connector: primaryConnector });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.toLowerCase().includes("already connected")) {
        console.error("Failed to connect:", error);
      }
    }
  };

  const handleCopyAddress = async () => {
    if (!address) return;
    try {
      await copyToClipboard(address);
      setHasCopied(true);
      window.setTimeout(() => setHasCopied(false), 1400);
    } catch (error) {
      console.error("Failed to copy address:", error);
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
    } finally {
      setWalletSheetOpen(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_58%)]" />
      <div className="pointer-events-none absolute right-[-72px] top-14 h-40 w-40 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[-88px] top-40 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />

      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(140deg,rgba(15,23,42,0.96),rgba(29,78,216,0.92)_45%,rgba(56,189,248,0.84))] px-5 py-5 text-white shadow-[0_24px_80px_rgba(37,99,235,0.28)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.24),transparent_28%)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="relative z-10">
              <h1 className="mt-3 font-heading text-[2rem] font-bold leading-none tracking-tight">
                {header.title}
              </h1>
            </div>
            <div className="relative z-10 flex items-center gap-2">
              <Badge className="border border-white/15 bg-white/12 text-sky-50 backdrop-blur">
                Celo
              </Badge>
              {isConnected ? (
                <button
                  type="button"
                  onClick={() => setWalletSheetOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-xs font-semibold text-sky-50 backdrop-blur transition hover:bg-white/18"
                  aria-label="Wallet menu"
                >
                  <span>{shortAddress ?? "No wallet"}</span>
                </button>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnectPending}
                  className="border border-white/15 bg-white/12 text-sky-50 hover:bg-white/18"
                >
                  {isConnectPending ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </div>
          <p className="relative z-10 mt-3 max-w-[18rem] text-sm text-sky-100/90">
            {header.subtitle}
          </p>
        </div>
      </header>

      {props.children}

      {isConnected && (
        <BottomNav
          items={[
            { label: "Tasks", href: "/tasks", icon: Task01Icon },
            { label: "Tap", href: "/tap", icon: Tap01Icon },
            { label: "Rewards", href: "/rewards", icon: GiftIcon },
            { label: "Profile", href: "/profile", icon: UserCircleIcon },
          ]}
        />
      )}

      {walletSheetOpen && isConnected && (
        <div
          className="fixed inset-0 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Wallet actions"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setWalletSheetOpen(false)}
            aria-label="Close wallet actions"
          />
          <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-md px-5 pb-[calc(env(safe-area-inset-bottom,0px)+1.25rem)]">
            <div className="relative overflow-hidden rounded-[1.75rem] border border-border/60 bg-background/95 p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">
                    Connected wallet
                  </div>
                  <div className="mt-1 font-mono text-sm font-semibold">
                    {shortAddress ?? address}
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline">Celo</Badge>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setWalletSheetOpen(false)}
                  aria-label="Close"
                >
                  ✕
                </Button>
              </div>

              <div className="mt-4 grid gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={handleCopyAddress}
                >
                  {hasCopied ? "Copied" : "Copy address"}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

