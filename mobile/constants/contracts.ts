import type { Address, Chain } from 'viem';
import { defineChain } from 'viem';

export const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : null;
const webRpcProxyPath = process.env.EXPO_PUBLIC_WEB_RPC_PROXY_PATH;
const webRpcProxyUrl = browserOrigin && webRpcProxyPath
  ? new URL(webRpcProxyPath, browserOrigin).toString()
  : null;

export const energyfiRpcUrl = webRpcProxyUrl ?? process.env.EXPO_PUBLIC_ENERGYFI_RPC_URL ?? 'http://127.0.0.1:8545';
const parsedEnergyfiChainId = Number.parseInt(process.env.EXPO_PUBLIC_ENERGYFI_CHAIN_ID ?? '270626', 10);
export const energyfiChainId = Number.isNaN(parsedEnergyfiChainId) ? 270626 : parsedEnergyfiChainId;

export const energyfiChain: Chain = defineChain({
  id: energyfiChainId,
  name: 'EnergyFi L1 Testnet',
  nativeCurrency: { name: 'EFI', symbol: 'EFI', decimals: 18 },
  rpcUrls: { default: { http: [energyfiRpcUrl] } },
});

export const reputationGranularity = {
  weekly: 1,
  monthly: 2,
} as const;

export const reputationRegistryAddress = (
  process.env.EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS ?? zeroAddress
) as Address;

export const hasLiveReputationRegistry = reputationRegistryAddress !== zeroAddress;

export const chargeTransactionAddress = (
  process.env.EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS ?? '0x743907BE700c527950D912ec2fe35D3e701D1286'
) as Address;

export const revenueTrackerAddress = (
  process.env.EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS ?? '0x3D23900e2AFF32363d129c2237e606efb00C9777'
) as Address;

export const chargeRouterAddress = (
  process.env.EXPO_PUBLIC_CHARGE_ROUTER_ADDRESS ?? '0x8Fae69Bf1Bc4e1c987508a5fC6Cc0f65BaC829E7'
) as Address;

export const stationRegistryAddress = (
  process.env.EXPO_PUBLIC_STATION_REGISTRY_ADDRESS ?? '0x7755040f6B6032eF126DA24eE5aC33BC366DFb7f'
) as Address;

export const deviceRegistryAddress = (
  process.env.EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS ?? '0x08c36c0C0e249F8dcfA891997Ee95808C6150C13'
) as Address;

export const regionStoFactoryAddress = (
  process.env.EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS ?? '0x2524e8cFBeBd81afFe25C38BCb82226427c22abB'
) as Address;

export const hasLiveRegionStoFactory = regionStoFactoryAddress !== zeroAddress;

export const demoInvestorAddress = (
  process.env.EXPO_PUBLIC_DEMO_INVESTOR_ADDRESS ?? '0x2b70CA5884943917b5D8b7b6dA8643e12aCE4E18'
) as Address;

export const demoOperatorAddress = (
  process.env.EXPO_PUBLIC_DEMO_OPERATOR_ADDRESS ?? '0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD'
) as Address;
