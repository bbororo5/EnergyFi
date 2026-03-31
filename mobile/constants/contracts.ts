import type { Address, Chain } from 'viem';
import { defineChain } from 'viem';

export const zeroAddress = '0x0000000000000000000000000000000000000000' as Address;

const browserOrigin = typeof window !== 'undefined' ? window.location.origin : null;
const webRpcProxyPath = process.env.EXPO_PUBLIC_WEB_RPC_PROXY_PATH;
const webRpcProxyUrl = browserOrigin && webRpcProxyPath
  ? new URL(webRpcProxyPath, browserOrigin).toString()
  : null;

export const energyfiRpcUrl = webRpcProxyUrl ?? process.env.EXPO_PUBLIC_ENERGYFI_RPC_URL ?? 'http://127.0.0.1:8545';
const parsedEnergyfiChainId = Number.parseInt(process.env.EXPO_PUBLIC_ENERGYFI_CHAIN_ID ?? '59823', 10);
export const energyfiChainId = Number.isNaN(parsedEnergyfiChainId) ? 59823 : parsedEnergyfiChainId;

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
  process.env.EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS ?? '0x3c1d0E0572b00D67d6E4e8f7381C7960eB0ADDC3'
) as Address;

export const revenueTrackerAddress = (
  process.env.EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS ?? '0x693F237E5e15884A19cC81bA584F0535Bb9b3D02'
) as Address;

export const chargeRouterAddress = (
  process.env.EXPO_PUBLIC_CHARGE_ROUTER_ADDRESS ?? '0xACb74aAA9D8f479c72780849BCEd1c43F0AfB3F7'
) as Address;

export const stationRegistryAddress = (
  process.env.EXPO_PUBLIC_STATION_REGISTRY_ADDRESS ?? '0x462fA3589f3483FD19885b6996F72142CBaB85DB'
) as Address;

export const deviceRegistryAddress = (
  process.env.EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS ?? '0x2b7c0388F71797724666B609Ca09131b14B6Cc1b'
) as Address;

export const regionStoFactoryAddress = (
  process.env.EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS ?? '0xC954bAb6db0b83e33b5B753c966B08Cafe904076'
) as Address;

export const hasLiveRegionStoFactory = regionStoFactoryAddress !== zeroAddress;

export const demoInvestorAddress = (
  process.env.EXPO_PUBLIC_DEMO_INVESTOR_ADDRESS ?? '0x2b70CA5884943917b5D8b7b6dA8643e12aCE4E18'
) as Address;

export const demoOperatorAddress = (
  process.env.EXPO_PUBLIC_DEMO_OPERATOR_ADDRESS ?? '0xBdDFc6fdF2F28cBb67eadeCdB0165a15741387aD'
) as Address;
