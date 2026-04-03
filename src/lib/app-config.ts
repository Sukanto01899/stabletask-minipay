import { celo, celoSepolia, type Chain } from 'wagmi/chains'

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

export const stableTaskRewardVaultAbi = [
  {
    type: 'function',
    stateMutability: 'view',
    name: 'rewardToken',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'publicTaskCreationFee',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'nextTaskId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'createTask',
    inputs: [
      { name: 'taskType', type: 'uint8' },
      { name: 'pointReward', type: 'uint256' },
      { name: 'rewardAmount', type: 'uint256' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'taskId', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'payable',
    name: 'createPublicTask',
    inputs: [
      { name: 'taskType', type: 'uint8' },
      { name: 'pointReward', type: 'uint256' },
      { name: 'rewardAmount', type: 'uint256' },
      { name: 'metadataURI', type: 'string' },
    ],
    outputs: [{ name: 'taskId', type: 'uint256' }],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'markTaskCompleted',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'claimTaskPoint',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'nonpayable',
    name: 'claimReward',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'tasks',
    inputs: [{ name: 'taskId', type: 'uint256' }],
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'taskType', type: 'uint8' },
      { name: 'creator', type: 'address' },
      { name: 'pointReward', type: 'uint256' },
      { name: 'rewardAmount', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'publicCreated', type: 'bool' },
      { name: 'metadataURI', type: 'string' },
    ],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'isCompleted',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'hasClaimedReward',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    stateMutability: 'view',
    name: 'hasClaimedPoint',
    inputs: [
      { name: 'taskId', type: 'uint256' },
      { name: 'user', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'event',
    anonymous: false,
    name: 'TaskCreated',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'taskType', type: 'uint8' },
      { indexed: true, name: 'creator', type: 'address' },
      { indexed: false, name: 'pointReward', type: 'uint256' },
      { indexed: false, name: 'rewardAmount', type: 'uint256' },
      { indexed: false, name: 'publicCreated', type: 'bool' },
      { indexed: false, name: 'metadataURI', type: 'string' },
    ],
  },
  {
    type: 'event',
    anonymous: false,
    name: 'TaskCompleted',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'operator', type: 'address' },
    ],
  },
  {
    type: 'event',
    anonymous: false,
    name: 'PointClaimed',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
  },
  {
    type: 'event',
    anonymous: false,
    name: 'RewardClaimed',
    inputs: [
      { indexed: true, name: 'taskId', type: 'uint256' },
      { indexed: true, name: 'user', type: 'address' },
      { indexed: true, name: 'rewardToken', type: 'address' },
      { indexed: false, name: 'rewardAmount', type: 'uint256' },
    ],
  },
] as const

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
      rewardVaultAddress: '0x0000000000000000000000000000000000000000',
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
      rewardVaultAddress: '0x0000000000000000000000000000000000000000',
      rewardVaultAbi: stableTaskRewardVaultAbi,
    },
  },
}

export const stableTaskConfig: StableTaskConfig = {
  network: NETWORK === 'mainnet' ? 'mainnet' : 'sepolia',
  ...NETWORK_CONFIG[NETWORK === 'mainnet' ? 'mainnet' : 'sepolia'],
}
