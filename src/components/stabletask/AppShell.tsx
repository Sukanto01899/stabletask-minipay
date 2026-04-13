"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConnection } from "wagmi";

import { BottomNav } from "@/components/stabletask/BottomNav";
import { stableTaskConfig } from "@/lib/app-config";

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

export function AppShell(props: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { address, chainId, isConnected } = useConnection();
  const switchAttemptedRef = useRef(false);

  const header = useMemo(() => {
    return (
      HEADER_COPY[pathname] ?? {
        title: "StableTask",
        subtitle: "Complete tasks and earn cUSD.",
      }
    );
  }, [pathname]);

  useEffect(() => {
    const provider =
      typeof window !== "undefined"
        ? (window as Window & {
            ethereum?: {
              request: (args: {
                method: string;
                params?: unknown[];
              }) => Promise<unknown>;
            };
          }).ethereum
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

    void provider
      .request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: `0x${stableTaskConfig.chain.id.toString(16)}` }],
      })
      .catch((error) => {
        console.error("Failed to switch to Celo mainnet:", error);
        switchAttemptedRef.current = false;
      });
  }, [chainId, isConnected]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.22),_transparent_58%)]" />
      <div className="pointer-events-none absolute right-[-72px] top-14 h-40 w-40 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute left-[-88px] top-40 h-52 w-52 rounded-full bg-blue-500/15 blur-3xl" />
      {isConnected && (
        <header className="mx-auto w-full max-w-md px-5 pt-6">
          <div className="relative overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(140deg,rgba(15,23,42,0.96),rgba(29,78,216,0.92)_45%,rgba(56,189,248,0.84))] px-5 py-5 text-white shadow-[0_24px_80px_rgba(37,99,235,0.28)]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.24),transparent_28%)]" />
            <div className="flex items-start justify-between gap-3">
              <div className="relative z-10">
                <h1 className="mt-3 font-heading text-[2rem] font-bold leading-none tracking-tight">
                  {header.title}
                </h1>
              </div>
              <div className="relative z-10 rounded-full border border-white/15 bg-white/12 px-3 py-1 text-xs font-semibold text-sky-50 backdrop-blur">
                {address
                  ? `${address.slice(0, 6)}...${address.slice(-4)}`
                  : "No wallet"}
              </div>
            </div>
            <p className="relative z-10 mt-3 max-w-[18rem] text-sm text-sky-100/90">
              {header.subtitle}
            </p>
          </div>
        </header>
      )}
      {props.children}
      {isConnected && (
        <BottomNav
          items={[
            { label: "Tasks", href: "/tasks" },
            { label: "Tap", href: "/tap" },
            { label: "Rewards", href: "/rewards" },
            { label: "Profile", href: "/profile" },
          ]}
        />
      )}
    </div>
  );
}
