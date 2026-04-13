import "./globals.css";
import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import { headers } from "next/headers";
import { type ReactNode } from "react";
import { cookieToInitialState } from "wagmi";

import { getConfig } from "../wagmi";
import { Providers } from "./providers";
import { AppShell } from "@/components/stabletask/AppShell";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
});

export const metadata: Metadata = {
  title: "StableTask",
  description: "Complete tasks, earn cUSD, and claim rewards in MiniPay.",
  other: {
    "talentapp:project_verification":
      "aef16397cf13ee21067175e576c9c06db09c7b47f4e538fb30288522a26738f7879757edc37247e15e57ea1a5666a86ba00487f3e5e114d645c576cc684224b8",
  },
};

export default async function RootLayout(props: { children: ReactNode }) {
  const initialState = cookieToInitialState(
    getConfig(),
    (await headers()).get("cookie"),
  );
  return (
    <html lang="en">
      <body className={`${manrope.variable} ${spaceGrotesk.variable}`}>
        <Providers initialState={initialState}>
          <AppShell>{props.children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
