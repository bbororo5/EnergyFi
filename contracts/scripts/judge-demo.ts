/**
 * EnergyFi — Judge Demo Script
 *
 * Processes 3 live EV charging sessions on the Avalanche L1 testnet
 * and prints explorer links so judges can verify on-chain.
 *
 * Usage:  cd contracts && npm run demo
 */
import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  Wallet,
  encodeBytes32String,
  hexlify,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
} from "ethers";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPLORER = "https://explorer-test.avax.network/efy";
const MVP_URL = "https://energyfi-mobile-demo.vercel.app";
const EXPECTED_CHAIN_ID = 64058n;
const CURRENT_PERIOD = 202603n;

// ─── ANSI Colors ─────────────────────────────────────────────────────────────

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  underline: "\x1b[4m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  white: "\x1b[37m",
};

// ─── Crypto helpers (from seed-demo.ts) ──────────────────────────────────────

function regionBytes4(code: string): `0x${string}` {
  const hex = Buffer.from(code, "ascii").toString("hex").padEnd(8, "0");
  return `0x${hex}` as `0x${string}`;
}

function deterministicWallet(label: string): Wallet {
  return new Wallet(keccak256(toUtf8Bytes(label)));
}

function buildMessageHash(
  chargerId: string,
  energyKwh: bigint,
  startTimestamp: bigint,
  endTimestamp: bigint,
): string {
  return solidityPackedKeccak256(
    ["bytes32", "uint256", "uint256", "uint256"],
    [chargerId, energyKwh, startTimestamp, endTimestamp],
  );
}

function signSession(
  chargerLabel: string,
  chargerId: string,
  energyKwh: bigint,
  startTimestamp: bigint,
  endTimestamp: bigint,
): `0x${string}` {
  const wallet = deterministicWallet(chargerLabel);
  const digest = buildMessageHash(chargerId, energyKwh, startTimestamp, endTimestamp);
  return hexlify(wallet.signingKey.sign(digest).serialized) as `0x${string}`;
}

function judgeSessionId(runTs: number, index: number): `0x${string}` {
  return keccak256(toUtf8Bytes(`judge-demo:${runTs}:${index}`)) as `0x${string}`;
}

// ─── Deployment loader (from seed-demo.ts) ───────────────────────────────────

interface DeploymentAddresses {
  DeviceRegistry: string;
  StationRegistry: string;
  ChargeTransaction: string;
  RevenueTracker: string;
  ChargeRouter: string;
}

function loadDeployments(network: string): DeploymentAddresses {
  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(
      "deployments.json not found. Deploy contracts first: npm run deploy:full:testnet",
    );
  }
  const all = JSON.parse(fs.readFileSync(deploymentsPath, "utf8")) as Record<
    string,
    Record<string, string>
  >;
  const values = all[network];
  if (
    !values?.DeviceRegistry ||
    !values?.StationRegistry ||
    !values?.ChargeTransaction ||
    !values?.RevenueTracker ||
    !values?.ChargeRouter
  ) {
    throw new Error(
      `Missing deployment addresses for network "${network}" in deployments.json`,
    );
  }
  return {
    DeviceRegistry: values.DeviceRegistry,
    StationRegistry: values.StationRegistry,
    ChargeTransaction: values.ChargeTransaction,
    RevenueTracker: values.RevenueTracker,
    ChargeRouter: values.ChargeRouter,
  };
}

// ─── Demo session templates ──────────────────────────────────────────────────

interface SessionTemplate {
  stationLabel: string;
  chargerLabel: string;
  chargerType: number;
  chargerTypeName: string;
  energyKwh: bigint;
  distributableKrw: bigint;
  vehicleCategory: number;
  regionCode: string;
}

const DEMO_SESSIONS: SessionTemplate[] = [
  {
    stationLabel: "KR11-ST01",
    chargerLabel: "KR11-ST01-CH01",
    chargerType: 0,
    chargerTypeName: "7 kW Slow",
    energyKwh: 1560n,
    distributableKrw: 4446n,
    vehicleCategory: 1,
    regionCode: "KR11",
  },
  {
    stationLabel: "KR11-ST01",
    chargerLabel: "KR11-ST01-CH02",
    chargerType: 1,
    chargerTypeName: "11 kW Slow",
    energyKwh: 2240n,
    distributableKrw: 6720n,
    vehicleCategory: 1,
    regionCode: "KR11",
  },
  {
    stationLabel: "KR11-ST02",
    chargerLabel: "KR11-ST02-CH01",
    chargerType: 0,
    chargerTypeName: "7 kW Slow",
    energyKwh: 890n,
    distributableKrw: 2670n,
    vehicleCategory: 2,
    regionCode: "KR11",
  },
];

// ─── Display helpers ─────────────────────────────────────────────────────────

function printBanner(network: string, signerAddress: string) {
  console.log(`
${C.cyan}╔════════════════════════════════════════════════════════════════════╗
║                                                                    ║
║   ${C.bold}EnergyFi — Judge Demo${C.reset}${C.cyan}                                          ║
║   Watch live EV charging data hit the Avalanche blockchain         ║
║                                                                    ║
╚════════════════════════════════════════════════════════════════════╝${C.reset}

  ${C.dim}Network${C.reset}  : ${C.white}EnergyFi L1 Testnet (Chain ID ${EXPECTED_CHAIN_ID.toString()})${C.reset}
  ${C.dim}Explorer${C.reset} : ${C.blue}${C.underline}${EXPLORER}${C.reset}
  ${C.dim}Bridge${C.reset}   : ${C.white}${signerAddress}${C.reset}
`);
}

function printBefore(totalSessions: bigint, regionRevenue: bigint) {
  console.log(
    `${C.yellow}─── BEFORE ────────────────────────────────────────────────────────${C.reset}`,
  );
  console.log(
    `  Total sessions on-chain : ${C.bold}${totalSessions.toString()}${C.reset}`,
  );
  console.log(
    `  Seoul (KR11) revenue    : ${C.bold}${Number(regionRevenue).toLocaleString()} KRW${C.reset}`,
  );
  console.log();
}

function printProcessingHeader() {
  console.log(
    `${C.yellow}─── Processing 3 charge sessions ───────────────────────────────────${C.reset}`,
  );
  console.log();
}

function printSessionResult(
  index: number,
  template: SessionTemplate,
  txHash: string,
) {
  const energyDisplay = (Number(template.energyKwh) / 100).toFixed(2);
  const revenueDisplay = Number(template.distributableKrw).toLocaleString();
  const chargerShort = template.chargerLabel.split("-").pop();

  console.log(
    `  ${C.cyan}[${index + 1}/3]${C.reset} Station ${C.bold}${template.stationLabel}${C.reset} · Charger ${chargerShort} (${template.chargerTypeName}) · ${energyDisplay} kWh · ${revenueDisplay} KRW`,
  );
  console.log(`        ${C.green}✓${C.reset} ${C.dim}${txHash}${C.reset}`);
  console.log(
    `        ${C.blue}${C.underline}${EXPLORER}/tx/${txHash}${C.reset}`,
  );
  console.log();
}

function printAfter(totalSessions: bigint, regionRevenue: bigint) {
  console.log(
    `${C.yellow}─── AFTER ─────────────────────────────────────────────────────────${C.reset}`,
  );
  console.log(
    `  Total sessions on-chain : ${C.bold}${totalSessions.toString()}${C.reset}`,
  );
  console.log(
    `  Seoul (KR11) revenue    : ${C.bold}${Number(regionRevenue).toLocaleString()} KRW${C.reset}`,
  );
  console.log();
}

function printSummary(
  totalBefore: bigint,
  totalAfter: bigint,
  revenueBefore: bigint,
  revenueAfter: bigint,
  txHashes: string[],
  startTime: number,
) {
  const sessionDelta = totalAfter - totalBefore;
  const revenueDelta = revenueAfter - revenueBefore;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log(
    `${C.yellow}─── RESULT ────────────────────────────────────────────────────────${C.reset}`,
  );
  console.log(
    `  Sessions : ${totalBefore.toString()} → ${C.green}${C.bold}${totalAfter.toString()}${C.reset} ${C.green}(+${sessionDelta.toString()})${C.reset}`,
  );
  console.log(
    `  Revenue  : ${Number(revenueBefore).toLocaleString()} → ${C.green}${C.bold}${Number(revenueAfter).toLocaleString()} KRW${C.reset} ${C.green}(+${Number(revenueDelta).toLocaleString()})${C.reset}`,
  );

  console.log();
  console.log(
    `${C.yellow}─── VERIFY ON-CHAIN ───────────────────────────────────────────────${C.reset}`,
  );
  for (const [i, hash] of txHashes.entries()) {
    console.log(
      `  TX ${i + 1} : ${C.blue}${C.underline}${EXPLORER}/tx/${hash}${C.reset}`,
    );
  }
  console.log();
  console.log(
    `  ${C.dim}Explorer${C.reset} : ${C.blue}${C.underline}${EXPLORER}${C.reset}`,
  );
  console.log(
    `  ${C.dim}Live MVP${C.reset} : ${C.blue}${C.underline}${MVP_URL}${C.reset}`,
  );
  console.log();
  console.log(`  ${C.green}✓${C.reset} Done in ${elapsed}s`);
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const runTs = Date.now();

  // Step 1 — Connect
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  // Verify chain
  const chainId = (await ethers.provider.getNetwork()).chainId;
  if (chainId !== EXPECTED_CHAIN_ID) {
    console.error(
      `${C.red}✗ Expected chain ID ${EXPECTED_CHAIN_ID.toString()}, got ${chainId.toString()}.${C.reset}`,
    );
    console.error(
      `  Check ENERGYFI_L1_TESTNET_RPC and ENERGYFI_L1_TESTNET_CHAIN_ID in .env`,
    );
    process.exit(1);
  }

  // Load addresses
  const addrs = loadDeployments(network);

  // Instantiate contracts
  const chargeRouter = await ethers.getContractAt(
    "ChargeRouter",
    addrs.ChargeRouter,
  );
  const chargeTransaction = await ethers.getContractAt(
    "ChargeTransaction",
    addrs.ChargeTransaction,
  );
  const revenueTracker = await ethers.getContractAt(
    "RevenueTracker",
    addrs.RevenueTracker,
  );

  // Verify bridge
  const bridgeAddress = await chargeRouter.bridgeAddress();
  if (bridgeAddress.toLowerCase() !== signerAddress.toLowerCase()) {
    console.error(
      `${C.red}✗ Signer ${signerAddress} is not the bridge wallet (${bridgeAddress}).${C.reset}`,
    );
    console.error(`  Check DEPLOYER_PRIVATE_KEY in .env`);
    process.exit(1);
  }

  // Step 0 — Banner (after verification succeeds)
  printBanner(network, signerAddress);

  // Step 2 — BEFORE snapshot
  const regionId = regionBytes4("KR11");
  const totalBefore = await chargeTransaction.totalSessions();
  const revenueBefore = await revenueTracker.getRegionRevenue(regionId);
  printBefore(totalBefore, revenueBefore);

  // Step 3 — Process sessions
  printProcessingHeader();
  const txHashes: string[] = [];

  for (const [i, template] of DEMO_SESSIONS.entries()) {
    const sessionId = judgeSessionId(runTs, i);
    const chargerId = encodeBytes32String(template.chargerLabel);
    const stationId = encodeBytes32String(template.stationLabel);

    const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
    const startTimestamp = nowSeconds - BigInt(3600 + i * 1200);
    const endTimestamp = nowSeconds - BigInt(600 + i * 300);

    const seSignature = signSession(
      template.chargerLabel,
      chargerId,
      template.energyKwh,
      startTimestamp,
      endTimestamp,
    );

    try {
      const tx = await chargeRouter.processCharge(
        {
          sessionId,
          chargerId,
          chargerType: template.chargerType,
          energyKwh: template.energyKwh,
          startTimestamp,
          endTimestamp,
          vehicleCategory: template.vehicleCategory,
          gridRegionCode: regionBytes4(template.regionCode),
          stationId,
          distributableKrw: template.distributableKrw,
          seSignature,
        },
        CURRENT_PERIOD,
      );

      const receipt = await tx.wait();
      txHashes.push(receipt.hash);
      printSessionResult(i, template, receipt.hash);
    } catch (err: any) {
      const reason =
        err?.reason || err?.shortMessage || err?.message || "Unknown error";
      console.log(
        `  ${C.red}[${i + 1}/3] ✗ Failed: ${reason}${C.reset}`,
      );
      console.log();
    }
  }

  // Step 4 — AFTER snapshot
  const totalAfter = await chargeTransaction.totalSessions();
  const revenueAfter = await revenueTracker.getRegionRevenue(regionId);
  printAfter(totalAfter, revenueAfter);

  // Step 5 — Summary
  printSummary(
    totalBefore,
    totalAfter,
    revenueBefore,
    revenueAfter,
    txHashes,
    startTime,
  );
}

main().catch((err) => {
  console.error(`\n${C.red}✗ Demo failed:${C.reset} ${err.message}`);
  if (err.message.includes("could not detect network")) {
    console.error(
      `  Cannot connect to EnergyFi L1. Check your network and .env configuration.`,
    );
  }
  process.exit(1);
});
