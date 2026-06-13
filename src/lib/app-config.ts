import { celo, type Chain } from 'wagmi/chains'
import {
  stableTaskRewardVaultAbi,
  stableTaskRewardVaultAddress,
  stableTaskYieldVaultAbi,
  stableTaskYieldVaultAddress,
} from '@/lib/contracts'

type TokenConfig = {
  address: `0x${string}`
  symbol: 'cUSD'
  decimals: number
}

type ContractConfig = {
  rewardVaultAddress: `0x${string}`
  rewardVaultAbi: readonly unknown[]
  yieldVaultAddress: `0x${string}`
  yieldVaultAbi: readonly unknown[]
}

export type StableTaskConfig = {
  network: 'mainnet'
  chain: Chain
  rewardToken: TokenConfig
  contracts: ContractConfig
}

export const stableTaskConfig: StableTaskConfig = {
  network: 'mainnet',
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
    yieldVaultAddress: stableTaskYieldVaultAddress,
    yieldVaultAbi: stableTaskYieldVaultAbi,
  },
}
