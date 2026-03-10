import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env") });
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatIgnitionEthers from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";

const energyfiL1TestnetRpc = process.env.ENERGYFI_L1_TESTNET_RPC?.trim();
const energyfiL1TestnetChainId = Number.parseInt(
  process.env.ENERGYFI_L1_TESTNET_CHAIN_ID?.trim() ?? "",
  10,
);
const deployerPrivateKeyCandidate = process.env.DEPLOYER_PRIVATE_KEY?.trim();
const deployerPrivateKey = deployerPrivateKeyCandidate
  && /^0x[0-9a-fA-F]{64}$/.test(deployerPrivateKeyCandidate)
  ? deployerPrivateKeyCandidate
  : undefined;

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatVerify,
    hardhatIgnition,
    hardhatIgnitionEthers,
    hardhatKeystore,
    hardhatNetworkHelpers,
    hardhatMocha,
  ],
  solidity: "0.8.28",
  paths: {
    tests: "test/unit",
  },
  networks: {
    localhost: {
      type: "http" as const,
      url: "http://127.0.0.1:8545",
    },
    ...(energyfiL1TestnetRpc && {
      "energyfi-l1-testnet": {
        type: "http" as const,
        url: energyfiL1TestnetRpc,
        accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
        ...(Number.isNaN(energyfiL1TestnetChainId) ? {} : { chainId: energyfiL1TestnetChainId }),
      },
    }),
  },
});
