import { createConfig, http, injected } from "wagmi";
import { celo, celoSepolia } from "wagmi/chains";

export function getConfig() {
  return createConfig({
    chains: [celo, celoSepolia],
    connectors: [injected()],
    transports: {
      [celo.id]: http(),
      [celoSepolia.id]: http(),
    },
  });
}

declare module "wagmi" {
  interface Register {
    config: ReturnType<typeof getConfig>;
  }
}
