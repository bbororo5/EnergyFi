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
    wingside: {
      type: "http",
      url: process.env.WINGSIDE_SUBNET_RPC || "http://127.0.0.1:9650/ext/bc/YOUR_SUBNET_ID/rpc",
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
      chainId: 12345,
    },
  },
});
