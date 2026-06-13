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
  CoinsIcon,
} from "@hugeicons/core-free-icons";

import { BottomNav } from "@/components/stabletask/BottomNav";
import { ScrollToTop } from "@/components/stabletask/ScrollToTop";
import { StatusDot } from "@/components/stabletask/StatusDot";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { stableTaskConfig } from "@/lib/app-config";
import { copyText } from "@/lib/clipboard";
import { detectMiniPay, useIsMiniPay } from "@/lib/minipay";
import { usePendingCount } from "@/lib/pending-count-context";

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
  "/": {
    title: "Home",
    subtitle: "Your XP, daily progress, and quick actions.",
  },
  "/tasks": {
    title: "Quest Board",
    subtitle: "Complete quests, claim XP, and pull cUSD from the vault.",
  },
  "/tap": {
    title: "Tap Arena",
    subtitle: "Hit the chain and stack XP one tap at a time.",
  },
  "/rewards": {
    title: "Rewards",
    subtitle: "Track claimed rewards and player progress.",
  },
  "/earn": {
    title: "Earn",
    subtitle: "Deposit cUSD and earn 1 XP per cUSD per day.",
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

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, chainId, isConnected } = useConnection();
  const { pendingPayoutsCount, activeTasksCount } = usePendingCount();
  const connectors = useConnectors();
  const { connect, isPending: isConnectPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { toast } = useToast();
  const isMiniPay = useIsMiniPay();

  const switchAttemptedRef = useRef(false);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [hasCopied, setHasCopied] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const header = useMemo(() => {
    return (
      HEADER_COPY[pathname] ?? {
        title: "StableTask",
        subtitle: "Quest, tap, and claim cUSD rewards.",
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

  // Reset the disconnect confirmation whenever the wallet sheet is closed.
  useEffect(() => {
    if (!walletSheetOpen) setConfirmDisconnect(false);
  }, [walletSheetOpen]);

  // MiniPay connection is implicit: auto-connect the injected wallet on load.
  // Guarded by detectMiniPay() so desktop browsers are not force-prompted.
  const miniPayConnectAttempted = useRef(false);
  useEffect(() => {
    if (isConnected || miniPayConnectAttempted.current) return;
    if (!detectMiniPay()) return;

    const [miniPayConnector] = connectors;
    if (!miniPayConnector) return;

    miniPayConnectAttempted.current = true;
    void connect({ connector: miniPayConnector });
  }, [connect, connectors, isConnected]);

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
      await copyText(address);
      setHasCopied(true);
      window.setTimeout(() => setHasCopied(false), 1400);
      toast({ title: "Copied", description: "Wallet address copied to clipboard.", variant: "success" });
    } catch (error) {
      console.error("Failed to copy address:", error);
      toast({ title: "Copy failed", description: "Could not copy address.", variant: "error" });
    }
  };

  const handleDisconnect = () => {
    try {
      disconnect();
      toast({ title: "Disconnected", description: "Wallet disconnected.", variant: "default" });
    } finally {
      setWalletSheetOpen(false);
    }
  };

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(34,211,238,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(250,204,21,0.06)_1px,transparent_1px)] [background-size:34px_34px]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-lime-300/70 to-transparent" />

      <header className="mx-auto w-full max-w-md px-5 pt-6">
        <div className="game-panel-strong relative overflow-hidden rounded-[1.5rem] px-5 py-5 text-white">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-lime-300 via-cyan-300 to-amber-300" />
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(20,184,166,0.16),transparent_34%,rgba(245,158,11,0.13)_74%,transparent)]" />
          <div className="flex items-start justify-between gap-3">
            <div className="relative z-10">
              <div className="text-[11px] font-black uppercase tracking-[0.28em] text-lime-200">
                StableTask
              </div>
              <h1 className="mt-2 font-heading text-[2rem] font-black leading-none tracking-tight text-slate-50">
                {header.title}
              </h1>
            </div>
            <div className="relative z-10 flex items-center gap-2">
              <Badge className="game-chip backdrop-blur">
                Celo
              </Badge>
              {isConnected ? (
                <button
                  type="button"
                  onClick={() => setWalletSheetOpen(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-cyan-300/25 bg-cyan-300/10 px-3 py-1 text-xs font-semibold text-cyan-50 backdrop-blur transition hover:bg-cyan-300/16"
                  aria-label="Wallet menu"
                >
                  <StatusDot status="online" />
                  <span>{shortAddress ?? "No wallet"}</span>
                </button>
              ) : isMiniPay ? (
                // MiniPay: connection is implicit/auto — show a status chip, no manual button.
                <span className="inline-flex items-center gap-2 rounded-full border border-lime-300/25 bg-lime-300/10 px-3 py-1 text-xs font-semibold text-lime-100 backdrop-blur">
                  <StatusDot status={isConnectPending ? "connecting" : "online"} />
                  {isConnectPending ? "Connecting..." : "MiniPay"}
                </span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleConnect}
                  disabled={isConnectPending}
                  className="border border-lime-300/30 bg-lime-300/15 text-lime-50 hover:bg-lime-300/22"
                >
                  <StatusDot status={isConnectPending ? "connecting" : "offline"} />
                  {isConnectPending ? "Connecting..." : "Connect"}
                </Button>
              )}
            </div>
          </div>
          <p className="relative z-10 mt-3 max-w-[18rem] text-sm text-slate-300">
            {header.subtitle}
          </p>
        </div>
      </header>

      {props.children}

      {isConnected && (
        <>
          <ScrollToTop />
          <BottomNav
            items={[
              { label: "Tasks", href: "/tasks", icon: Task01Icon, badge: activeTasksCount },
              { label: "Tap", href: "/tap", icon: Tap01Icon },
              { label: "Earn", href: "/earn", icon: CoinsIcon },
              { label: "Rewards", href: "/rewards", icon: GiftIcon, badge: pendingPayoutsCount },
              { label: "Profile", href: "/profile", icon: UserCircleIcon },
            ]}
          />
        </>
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
            <div className="game-panel-strong relative overflow-hidden rounded-[1.5rem] p-4">
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
                {confirmDisconnect ? (
                  <div className="grid gap-2">
                    <div className="text-center text-xs text-muted-foreground">
                      Disconnect this wallet?
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="lg"
                        onClick={() => setConfirmDisconnect(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="lg"
                        onClick={handleDisconnect}
                      >
                        Confirm
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="lg"
                    onClick={() => setConfirmDisconnect(true)}
                  >
                    Disconnect
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
