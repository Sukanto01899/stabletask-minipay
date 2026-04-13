import { celo, celoSepolia, type Chain } from 'wagmi/chains'
import {
  stableTaskRewardVaultAbi,
  stableTaskRewardVaultAddress,
} from '@/lib/contracts'

type SupportedNetwork = 'mainnet' | 'sepolia'

type TokenConfig = {
  address: `0x${string}`
  symbol: 'cUSD'
  decimals: number
}

type ContractConfig = {
  rewardVaultAddress: `0x${string}`
  rewardVaultAbi: readonly unknown[]
}

export type StableTaskConfig = {
  network: SupportedNetwork
  chain: Chain
  rewardToken: TokenConfig
  contracts: ContractConfig
}

const NETWORK = (process.env.NEXT_PUBLIC_CELO_NETWORK ?? 'sepolia') as SupportedNetwork

const NETWORK_CONFIG: Record<SupportedNetwork, Omit<StableTaskConfig, 'network'>> = {
  mainnet: {
    chain: celo,
    rewardToken: {
      address: (process.env.NEXT_PUBLIC_CUSD_MAINNET_ADDRESS ??
        '0x765DE816845861e75A25fCA122bb6898B8B1282a') as `0x${string}`,
      symbol: 'cUSD',
      decimals: 18,
    },
    contracts: {
      rewardVaultAddress: stableTaskRewardVaultAddress,
      rewardVaultAbi: stableTaskRewardVaultAbi,
    },
  },
  sepolia: {
    chain: celoSepolia,
    rewardToken: {
      address: (process.env.NEXT_PUBLIC_CUSD_SEPOLIA_ADDRESS ??
        '0xdE9e4C3ce781b4bA68120d6261cbad65ce0aB00b') as `0x${string}`,
      symbol: 'cUSD',
      decimals: 18,
    },
    contracts: {
      rewardVaultAddress: stableTaskRewardVaultAddress,
      rewardVaultAbi: stableTaskRewardVaultAbi,
    },
  },
}

export const stableTaskConfig: StableTaskConfig = {
  network: NETWORK === 'mainnet' ? 'mainnet' : 'sepolia',
  ...NETWORK_CONFIG[NETWORK === 'mainnet' ? 'mainnet' : 'sepolia'],
}
