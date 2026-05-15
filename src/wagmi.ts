import { createConfig, http, injected } from "wagmi";
import { celo } from "wagmi/chains";

export function getConfig() {
  return createConfig({
    chains: [celo],
    connectors: [
      injected({
        target() {
          const eth = typeof window !== 'undefined' ? (window as any).ethereum : undefined
          const providers: any[] = eth?.providers ?? []
          return {
            id: 'metaMask',
            name: 'MetaMask',
            provider:
              providers.find((p: any) => p.isMetaMask && !p.isRabby) ??
              (eth?.isMetaMask && !eth?.isRabby ? eth : undefined),
          }
        },
      }),
      injected({
        target() {
          const eth = typeof window !== 'undefined' ? (window as any).ethereum : undefined
          const providers: any[] = eth?.providers ?? []
          return {
            id: 'rabby',
            name: 'Rabby Wallet',
            provider:
              providers.find((p: any) => p.isRabby) ?? (eth?.isRabby ? eth : undefined),
          }
        },
      }),
      injected(),
    ],
    transports: {
      [celo.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
