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
  process.env.EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS ?? '0xad54760b6c7Af14a39d6C16B2c94E03883e78156'
) as Address;

export const revenueTrackerAddress = (
  process.env.EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS ?? '0x295574ED07FB2901376FEa6D21b98F81c80dD6AC'
) as Address;

export const chargeRouterAddress = (
  process.env.EXPO_PUBLIC_CHARGE_ROUTER_ADDRESS ?? '0xFc78C4e202A5a681864d6D3E80a58F3B14DbAEa8'
) as Address;

export const stationRegistryAddress = (
  process.env.EXPO_PUBLIC_STATION_REGISTRY_ADDRESS ?? '0xADCfD47925F526a8abf51bE745B68d18D33952f9'
) as Address;

export const deviceRegistryAddress = (
  process.env.EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS ?? '0x17Df6a809BAe3249fC07eB4EEFb3e2b282Ad4959'
) as Address;

export const regionStoFactoryAddress = (
  process.env.EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS ?? zeroAddress
) as Address;

export const hasLiveRegionStoFactory = regionStoFactoryAddress !== zeroAddress;

export const demoOperatorAddress = (
  process.env.EXPO_PUBLIC_DEMO_OPERATOR_ADDRESS ?? '0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD'
) as Address;
