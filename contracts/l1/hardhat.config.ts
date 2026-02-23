import { defineConfig } from "hardhat/config";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatIgnitionEthers from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";
import hardhatMocha from "@nomicfoundation/hardhat-mocha";

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
  networks: {
    localhost: {
      type: "http" as const,
      url: "http://127.0.0.1:8545",
    },
    ...(process.env.ENERGYFI_L1_TESTNET_RPC && {
      "energyfi-l1-testnet": {
        type: "http" as const,
        url: process.env.ENERGYFI_L1_TESTNET_RPC,
        accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        chainId: 270626,
      },
    }),
    ...(process.env.ENERGYFI_L1_MAINNET_RPC && {
      "energyfi-l1-mainnet": {
        type: "http" as const,
        url: process.env.ENERGYFI_L1_MAINNET_RPC,
        accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        chainId: 270626,
      },
    }),
    ...(process.env.ENERGYFI_L1_LOCAL_RPC && {
      "energyfi-l1-local": {
        type: "http" as const,
        url: process.env.ENERGYFI_L1_LOCAL_RPC,
        accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
        chainId: 270626,
      },
    }),
  },
});
