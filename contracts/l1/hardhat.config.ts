import { defineConfig } from "hardhat/config";
import "dotenv/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import hardhatVerify from "@nomicfoundation/hardhat-verify";
import hardhatIgnition from "@nomicfoundation/hardhat-ignition";
import hardhatIgnitionEthers from "@nomicfoundation/hardhat-ignition-ethers";
import hardhatKeystore from "@nomicfoundation/hardhat-keystore";
import hardhatNetworkHelpers from "@nomicfoundation/hardhat-network-helpers";

export default defineConfig({
  plugins: [
    hardhatEthers,
    hardhatVerify,
    hardhatIgnition,
    hardhatIgnitionEthers,
    hardhatKeystore,
    hardhatNetworkHelpers,
  ],
  solidity: "0.8.20",
  networks: {
    "energyfi-l1-testnet": {
      type: "http",
      url: process.env.ENERGYFI_L1_TESTNET_RPC || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 270626,
    },
    "energyfi-l1-mainnet": {
      type: "http",
      url: process.env.ENERGYFI_L1_MAINNET_RPC || "",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 270626,
    },
  },
});
