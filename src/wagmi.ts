import { createConfig, http, injected } from "wagmi";
import { celo } from "wagmi/chains";

export function getConfig() {
  return createConfig({
    chains: [celo],
    connectors: [injected()],
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
