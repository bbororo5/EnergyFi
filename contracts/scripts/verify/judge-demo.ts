/**
 * EnergyFi — Judge Testnet Script
 *
 * Processes 3 live EV charging sessions on the Avalanche L1 testnet
 * and prints explorer links for direct judge verification.
 *
 * Zero configuration required — testnet credentials are embedded.
 * This is a zero-gas testnet; the native token (EFI) has no economic value.
 *
 * Usage:  cd contracts && npm install && npm run judge:testnet
 */
import {
  Contract,
  JsonRpcProvider,
  Wallet,
  encodeBytes32String,
  hexlify,
  keccak256,
  solidityPackedKeccak256,
  toUtf8Bytes,
} from "ethers";

// ─── Testnet Configuration (zero-gas, no economic value) ─────────────────────

const RPC_URL = "https://subnets.avax.network/efy/testnet/rpc";
const EXPECTED_CHAIN_ID = 64058n;
const BRIDGE_KEY =
  "0x6b70ae3b66cbfc19f03cf7f0dbb49476ef1cea1c35152f8929c9a608c656a030";

const CONTRACTS = {
  ChargeRouter: "0x8Fae69Bf1Bc4e1c987508a5fC6Cc0f65BaC829E7",
  ChargeTransaction: "0x743907BE700c527950D912ec2fe35D3e701D1286",
  RevenueTracker: "0x3D23900e2AFF32363d129c2237e606efb00C9777",
};

// ─── Minimal ABIs (only the functions this script calls) ─────────────────────

const ROUTER_ABI = [
  "function processCharge(tuple(bytes32 sessionId, bytes32 chargerId, uint8 chargerType, uint256 energyKwh, uint256 startTimestamp, uint256 endTimestamp, uint8 vehicleCategory, bytes4 gridRegionCode, bytes32 stationId, uint256 distributableKrw, bytes seSignature) session, uint256 period) external returns (uint256)",
  "function bridgeAddress() view returns (address)",
];

const CHARGE_TX_ABI = [
  "function totalSessions() view returns (uint256)",
];

const REVENUE_ABI = [
  "function getRegionRevenue(bytes4 regionId) view returns (uint256)",
];

// ─── Constants ───────────────────────────────────────────────────────────────

const EXPLORER = "https://explorer-test.avax.network/efy";
const MVP_URL = "https://energyfi-mobile-demo.vercel.app";
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

// ─── Crypto helpers ──────────────────────────────────────────────────────────

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

function judgeDemoSessionId(runTs: number, index: number): `0x${string}` {
  return keccak256(toUtf8Bytes(`judge-demo:${runTs}:${index}`)) as `0x${string}`;
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

function printBanner(signerAddress: string) {
  console.log(`
${C.cyan}\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557
\u2551                                                                    \u2551
\u2551   ${C.bold}EnergyFi \u2014 Judge Testnet${C.reset}${C.cyan}                                      \u2551
\u2551   Watch live EV charging data hit the Avalanche blockchain         \u2551
\u2551                                                                    \u2551
\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d${C.reset}

  ${C.dim}Network${C.reset}  : ${C.white}EnergyFi L1 Testnet (Chain ID ${EXPECTED_CHAIN_ID.toString()})${C.reset}
  ${C.dim}Explorer${C.reset} : ${C.blue}${C.underline}${EXPLORER}${C.reset}
  ${C.dim}Bridge${C.reset}   : ${C.white}${signerAddress}${C.reset}
`);
}

function printBefore(totalSessions: bigint, regionRevenue: bigint) {
  console.log(
    `${C.yellow}\u2500\u2500\u2500 BEFORE \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${C.reset}`,
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
    `${C.yellow}\u2500\u2500\u2500 Processing 3 charge sessions \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${C.reset}`,
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
    `  ${C.cyan}[${index + 1}/3]${C.reset} Station ${C.bold}${template.stationLabel}${C.reset} \u00b7 Charger ${chargerShort} (${template.chargerTypeName}) \u00b7 ${energyDisplay} kWh \u00b7 ${revenueDisplay} KRW`,
  );
  console.log(`        ${C.green}\u2713${C.reset} ${C.dim}${txHash}${C.reset}`);
  console.log(
    `        ${C.blue}${C.underline}${EXPLORER}/tx/${txHash}${C.reset}`,
  );
  console.log();
}

function printAfter(totalSessions: bigint, regionRevenue: bigint) {
  console.log(
    `${C.yellow}\u2500\u2500\u2500 AFTER \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${C.reset}`,
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
    `${C.yellow}\u2500\u2500\u2500 RESULT \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${C.reset}`,
  );
  console.log(
    `  Sessions : ${totalBefore.toString()} \u2192 ${C.green}${C.bold}${totalAfter.toString()}${C.reset} ${C.green}(+${sessionDelta.toString()})${C.reset}`,
  );
  console.log(
    `  Revenue  : ${Number(revenueBefore).toLocaleString()} \u2192 ${C.green}${C.bold}${Number(revenueAfter).toLocaleString()} KRW${C.reset} ${C.green}(+${Number(revenueDelta).toLocaleString()})${C.reset}`,
  );

  console.log();
  console.log(
    `${C.yellow}\u2500\u2500\u2500 VERIFY ON-CHAIN \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500${C.reset}`,
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
  console.log(`  ${C.green}\u2713${C.reset} Done in ${elapsed}s`);
  console.log();
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const runTs = Date.now();

  // Step 1 — Connect directly (no Hardhat, no .env required)
  const provider = new JsonRpcProvider(RPC_URL);
  const signer = new Wallet(BRIDGE_KEY, provider);
  const signerAddress = await signer.getAddress();

  // Verify chain
  const network = await provider.getNetwork();
  if (network.chainId !== EXPECTED_CHAIN_ID) {
    console.error(
      `${C.red}\u2717 Expected chain ID ${EXPECTED_CHAIN_ID.toString()}, got ${network.chainId.toString()}.${C.reset}`,
    );
    console.error(`  The EnergyFi L1 testnet may be temporarily unavailable.`);
    process.exit(1);
  }

  // Instantiate contracts with inline ABIs
  const chargeRouter = new Contract(CONTRACTS.ChargeRouter, ROUTER_ABI, signer);
  const chargeTransaction = new Contract(
    CONTRACTS.ChargeTransaction,
    CHARGE_TX_ABI,
    provider,
  );
  const revenueTracker = new Contract(
    CONTRACTS.RevenueTracker,
    REVENUE_ABI,
    provider,
  );

  // Verify bridge
  const bridgeAddress = await chargeRouter.bridgeAddress();
  if (bridgeAddress.toLowerCase() !== signerAddress.toLowerCase()) {
    console.error(
      `${C.red}\u2717 Embedded signer is not the bridge wallet. Demo configuration may be outdated.${C.reset}`,
    );
    process.exit(1);
  }

  // Step 0 — Banner (after verification succeeds)
  printBanner(signerAddress);

  // Step 2 — BEFORE snapshot
  const regionId = regionBytes4("KR11");
  const totalBefore = await chargeTransaction.totalSessions();
  const revenueBefore = await revenueTracker.getRegionRevenue(regionId);
  printBefore(totalBefore, revenueBefore);

  // Step 3 — Process sessions
  printProcessingHeader();
  const txHashes: string[] = [];

  for (const [i, template] of DEMO_SESSIONS.entries()) {
    const sessionId = judgeDemoSessionId(runTs, i);
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
        `  ${C.red}[${i + 1}/3] \u2717 Failed: ${reason}${C.reset}`,
      );
      console.log();
    }
  }

  // Step 4 — AFTER snapshot (before attestation, so pending delta is visible)
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
  console.error(`\n${C.red}\u2717 Demo failed:${C.reset} ${err.message}`);
  if (
    err.message.includes("could not detect network") ||
    err.message.includes("ECONNREFUSED") ||
    err.message.includes("fetch failed")
  ) {
    console.error(
      `  Cannot connect to EnergyFi L1 testnet. Please check your internet connection.`,
    );
  }
  process.exit(1);
});
