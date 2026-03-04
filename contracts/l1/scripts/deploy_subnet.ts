import hre from "hardhat";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;

  const [deployer] = await ethers.getSigners();
  const network = conn.networkName;

  console.log(`\n=== EnergyFi Deployment (Phase 1 + Phase 2) ===`);
  console.log(`Network  : ${network}`);
  console.log(`Deployer : ${deployer.address}`);
  console.log(`Balance  : ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} EFI\n`);

  const EnergyFiProxy = await ethers.getContractFactory("EnergyFiProxy");

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 1: DeviceRegistry + StationRegistry (UUPS Proxy)
  // ══════════════════════════════════════════════════════════════════════════

  console.log("─── Phase 1 ───");

  // ── 1. DeviceRegistry (impl + proxy + initialize) ─────────────────────────
  console.log("Deploying DeviceRegistry implementation...");
  const DRImpl = await ethers.getContractFactory("DeviceRegistry");
  const drImpl = await DRImpl.deploy();
  await drImpl.waitForDeployment();
  const drImplAddr = await drImpl.getAddress();
  console.log(`  DR Impl         : ${drImplAddr}`);

  console.log("Deploying DeviceRegistry proxy...");
  const drProxy = await EnergyFiProxy.deploy(drImplAddr, "0x");
  await drProxy.waitForDeployment();
  const drProxyAddr = await drProxy.getAddress();
  console.log(`  DR Proxy        : ${drProxyAddr}`);

  const dr = await ethers.getContractAt("DeviceRegistry", drProxyAddr);
  await dr.initialize(deployer.address);
  console.log("  DeviceRegistry initialized");

  // ── 2. StationRegistry (impl + proxy + initialize) ────────────────────────
  console.log("Deploying StationRegistry implementation...");
  const SRImpl = await ethers.getContractFactory("StationRegistry");
  const srImpl = await SRImpl.deploy();
  await srImpl.waitForDeployment();
  const srImplAddr = await srImpl.getAddress();
  console.log(`  SR Impl         : ${srImplAddr}`);

  console.log("Deploying StationRegistry proxy...");
  const srProxy = await EnergyFiProxy.deploy(srImplAddr, "0x");
  await srProxy.waitForDeployment();
  const srProxyAddr = await srProxy.getAddress();
  console.log(`  SR Proxy        : ${srProxyAddr}`);

  const sr = await ethers.getContractAt("StationRegistry", srProxyAddr);
  await sr.initialize(deployer.address, drProxyAddr);
  console.log("  StationRegistry initialized");

  // ══════════════════════════════════════════════════════════════════════════
  // Phase 2: ChargeTransaction + RevenueTracker + ChargeRouter (UUPS Proxy)
  // ══════════════════════════════════════════════════════════════════════════

  console.log("\n─── Phase 2 ───");

  // ── 3. ChargeTransaction (impl + proxy) ─────────────────────────────────────
  console.log("Deploying ChargeTransaction implementation...");
  const CTImpl = await ethers.getContractFactory("ChargeTransaction");
  const ctImpl = await CTImpl.deploy();
  await ctImpl.waitForDeployment();
  const ctImplAddr = await ctImpl.getAddress();
  console.log(`  CT Impl         : ${ctImplAddr}`);

  console.log("Deploying ChargeTransaction proxy...");
  const ctProxy = await EnergyFiProxy.deploy(ctImplAddr, "0x");
  await ctProxy.waitForDeployment();
  const ctProxyAddr = await ctProxy.getAddress();
  console.log(`  CT Proxy        : ${ctProxyAddr}`);

  // ── 4. RevenueTracker (impl + proxy) ────────────────────────────────────────
  console.log("Deploying RevenueTracker implementation...");
  const RTImpl = await ethers.getContractFactory("RevenueTracker");
  const rtImpl = await RTImpl.deploy();
  await rtImpl.waitForDeployment();
  const rtImplAddr = await rtImpl.getAddress();
  console.log(`  RT Impl         : ${rtImplAddr}`);

  console.log("Deploying RevenueTracker proxy...");
  const rtProxy = await EnergyFiProxy.deploy(rtImplAddr, "0x");
  await rtProxy.waitForDeployment();
  const rtProxyAddr = await rtProxy.getAddress();
  console.log(`  RT Proxy        : ${rtProxyAddr}`);

  // ── 5. ChargeRouter (impl + proxy) ──────────────────────────────────────────
  console.log("Deploying ChargeRouter implementation...");
  const CRImpl = await ethers.getContractFactory("ChargeRouter");
  const crImpl = await CRImpl.deploy();
  await crImpl.waitForDeployment();
  const crImplAddr = await crImpl.getAddress();
  console.log(`  CR Impl         : ${crImplAddr}`);

  console.log("Deploying ChargeRouter proxy...");
  const crProxy = await EnergyFiProxy.deploy(crImplAddr, "0x");
  await crProxy.waitForDeployment();
  const crProxyAddr = await crProxy.getAddress();
  console.log(`  CR Proxy        : ${crProxyAddr}`);

  // ── 6. Initialize Phase 2 proxies ─────────────────────────────────────────
  // CT/RT bridgeAddress = ChargeRouter proxy (ChargeRouter calls them)
  // CR bridgeAddress = deployer (test) / AWS KMS Bridge (production)

  console.log("\nInitializing Phase 2 proxies...");

  const ct = await ethers.getContractAt("ChargeTransaction", ctProxyAddr);
  await ct.initialize(drProxyAddr, srProxyAddr, crProxyAddr, deployer.address);
  console.log("  ChargeTransaction initialized (bridge = ChargeRouter)");

  const rt = await ethers.getContractAt("RevenueTracker", rtProxyAddr);
  await rt.initialize(srProxyAddr, crProxyAddr, deployer.address);
  console.log("  RevenueTracker initialized (bridge = ChargeRouter)");

  const cr = await ethers.getContractAt("ChargeRouter", crProxyAddr);
  await cr.initialize(ctProxyAddr, rtProxyAddr, deployer.address, deployer.address);
  console.log("  ChargeRouter initialized (bridge = deployer)");

  // ── 7. Save deployments.json ────────────────────────────────────────────────
  const deploymentsPath = path.resolve(__dirname, "../deployments.json");
  let deployments: Record<string, Record<string, string>> = {};

  if (fs.existsSync(deploymentsPath)) {
    const raw = fs.readFileSync(deploymentsPath, "utf8");
    deployments = JSON.parse(raw) as Record<string, Record<string, string>>;
  }

  deployments[network] = {
    DeviceRegistry:    drProxyAddr,
    StationRegistry:   srProxyAddr,
    ChargeTransaction: ctProxyAddr,
    RevenueTracker:    rtProxyAddr,
    ChargeRouter:      crProxyAddr,
  };

  fs.writeFileSync(deploymentsPath, JSON.stringify(deployments, null, 2));
  console.log(`\ndeployments.json updated (network: ${network})`);

  console.log("\n=== Deployment complete ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
