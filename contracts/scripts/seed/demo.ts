import hre from "hardhat";
import { encodeBytes32String, hexlify, id } from "ethers";
import { requireSurfaceDeployments, type SurfaceDeploymentAddresses } from "../lib/deployments.js";
import { nativeSymbol } from "../lib/env.js";
import {
  buildHistoricalSessions,
  buildLiveSessions,
  buildSnapshot,
  buildStationLabel,
  buildStations,
  CURRENT_PERIOD,
  DEFAULT_ADMIN_ROLE,
  deterministicWallet,
  FINALIZED_PERIODS,
  PRIMARY_INVESTOR_LABEL,
  publicKey64,
  REGION_SEEDS,
  RESERVE_INVESTOR_LABEL,
  REVOKED_CHARGER_LABELS,
  regionBytes4,
  signSession,
  ZERO_ADDRESS,
  type ChargerSeed,
  type RegionCode,
  type RegionSeed,
  type SessionSeed,
  type StationSeed,
} from "../lib/demo-fixtures.js";

interface Stats {
  chipsEnrolled: number;
  chipsSkipped: number;
  chipsRevoked: number;
  stationsRegistered: number;
  stationsSkipped: number;
  chargersRegistered: number;
  chargersSkipped: number;
  sessionsProcessed: number;
  sessionsSkipped: number;
  regionClaims: number;
  regionClaimsSkipped: number;
  snapshotsPublished: number;
  snapshotsSkipped: number;
  stoRegionsDeployed: number;
  stoRegionsSkipped: number;
  tranchesIssued: number;
  tranchesSkipped: number;
}

function newStats(): Stats {
  return {
    chipsEnrolled: 0,
    chipsSkipped: 0,
    chipsRevoked: 0,
    stationsRegistered: 0,
    stationsSkipped: 0,
    chargersRegistered: 0,
    chargersSkipped: 0,
    sessionsProcessed: 0,
    sessionsSkipped: 0,
    regionClaims: 0,
    regionClaimsSkipped: 0,
    snapshotsPublished: 0,
    snapshotsSkipped: 0,
    stoRegionsDeployed: 0,
    stoRegionsSkipped: 0,
    tranchesIssued: 0,
    tranchesSkipped: 0,
  };
}

function matchesCustomError(err: unknown, signature: string): boolean {
  const selector = id(signature).slice(0, 10).toLowerCase();
  const maybeError = err as { data?: string; error?: { data?: string } };
  const directData = typeof maybeError?.data === "string" ? maybeError.data.toLowerCase() : "";
  const nestedData = typeof maybeError?.error?.data === "string" ? maybeError.error.data.toLowerCase() : "";
  const message = String(err).toLowerCase();
  const errorName = signature.slice(0, signature.indexOf("(")).toLowerCase();

  return (
    directData.startsWith(selector)
    || nestedData.startsWith(selector)
    || message.includes(errorName)
  );
}

async function wait(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readWithRetry<T>(
  label: string,
  read: () => Promise<T>,
  attempts = 5,
  waitMs = 1500,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await read();
    } catch (error) {
      lastError = error;
      if (attempt === attempts) {
        break;
      }
      console.warn(`Retrying ${label} (${attempt}/${attempts - 1})...`);
      await wait(waitMs);
    }
  }

  throw lastError;
}

async function assertRegionTokenCompatibility(
  sto: any,
  signerAddress: string,
  expectedRegionId: `0x${string}`,
  stationRegistryAddress: string,
  label: string,
) {
  const issues: string[] = [];
  const settleAttempts = 40;
  const settleDelayMs = 2000;

  const [hasAdminRole, currentRegionId, currentStationRegistry] = await Promise.all([
    readWithRetry(
      `${label}.hasRole`,
      () => sto.hasRole(DEFAULT_ADMIN_ROLE, signerAddress),
      settleAttempts,
      settleDelayMs,
    ),
    readWithRetry<string>(`${label}.regionId`, () => sto.regionId(), settleAttempts, settleDelayMs),
    readWithRetry<string>(
      `${label}.stationRegistry`,
      () => sto.stationRegistry(),
      settleAttempts,
      settleDelayMs,
    ),
  ]);

  if (!hasAdminRole) {
    issues.push("DEFAULT_ADMIN_ROLE missing");
  }

  if (currentRegionId !== expectedRegionId) {
    issues.push(`regionId mismatch (current: ${currentRegionId})`);
  }

  if (currentStationRegistry.toLowerCase() !== stationRegistryAddress.toLowerCase()) {
    issues.push(`stationRegistry mismatch (current: ${currentStationRegistry})`);
  }

  if (issues.length > 0) {
    throw new Error(`RegionSTO compatibility failure for ${label}:\n- ${issues.join("\n- ")}`);
  }
}

async function assertDemoPermissions(
  ethers: any,
  signerAddress: string,
  stationRegistryAddress: string,
  deviceRegistry: any,
  stationRegistry: any,
  revenueTracker: any,
  chargeRouter: any,
  reputationRegistry: any,
  regionStoFactory: any,
) {
  const issues: string[] = [];
  const deviceAdminRole = await deviceRegistry.ADMIN_ROLE();
  const stationAdminRole = await stationRegistry.ADMIN_ROLE();

  if (!(await deviceRegistry.hasRole(deviceAdminRole, signerAddress))) {
    issues.push("DeviceRegistry.ADMIN_ROLE missing");
  }
  if (!(await stationRegistry.hasRole(stationAdminRole, signerAddress))) {
    issues.push("StationRegistry.ADMIN_ROLE missing");
  }
  if (!(await revenueTracker.hasRole(DEFAULT_ADMIN_ROLE, signerAddress))) {
    issues.push("RevenueTracker.DEFAULT_ADMIN_ROLE missing");
  }
  if (!(await regionStoFactory.hasRole(DEFAULT_ADMIN_ROLE, signerAddress))) {
    issues.push("RegionSTOFactory.DEFAULT_ADMIN_ROLE missing");
  }

  const routerBridge = await chargeRouter.bridgeAddress();
  if (routerBridge.toLowerCase() !== signerAddress.toLowerCase()) {
    issues.push(`ChargeRouter bridge mismatch (current: ${routerBridge})`);
  }

  const reputationBridge = await reputationRegistry.bridgeAddress();
  if (reputationBridge.toLowerCase() !== signerAddress.toLowerCase()) {
    issues.push(`ReputationRegistry bridge mismatch (current: ${reputationBridge})`);
  }

  const factoryStationRegistry = await regionStoFactory.stationRegistry();
  if (factoryStationRegistry.toLowerCase() !== stationRegistryAddress.toLowerCase()) {
    issues.push(`RegionSTOFactory stationRegistry mismatch (current: ${factoryStationRegistry})`);
  }

  for (const region of REGION_SEEDS) {
    const regionId = regionBytes4(region.code);
    const tokenAddress = await regionStoFactory.getRegionToken(regionId);
    if (tokenAddress === ZERO_ADDRESS) {
      continue;
    }
    const sto = await ethers.getContractAt("RegionSTO", tokenAddress);
    await assertRegionTokenCompatibility(sto, signerAddress, regionId, stationRegistryAddress, region.code);
  }

  if (issues.length > 0) {
    throw new Error(
      `Current signer ${signerAddress} cannot seed the demo surface:\n- ${issues.join("\n- ")}`,
    );
  }
}

async function ensureChip(deviceRegistry: any, charger: ChargerSeed, stats: Stats) {
  const chargerId = encodeBytes32String(charger.label);
  const wallet = deterministicWallet(charger.label);
  const expectedPublicKey = hexlify(publicKey64(wallet)).toLowerCase();
  const shouldRemainRevoked = REVOKED_CHARGER_LABELS.has(charger.label as `${RegionCode}-ST02-CH03`);
  const [publicKey, , algorithm, , active] = await deviceRegistry.getChipRecord(chargerId);
  const currentPublicKey = hexlify(publicKey).toLowerCase();
  const hasExistingPublicKey = currentPublicKey !== "0x";

  if (active) {
    if (currentPublicKey !== expectedPublicKey || Number(algorithm) !== 0) {
      throw new Error(`Chip metadata conflict for ${charger.label}`);
    }
    stats.chipsSkipped++;
    return;
  }

  if (hasExistingPublicKey && currentPublicKey !== expectedPublicKey) {
    throw new Error(`Inactive chip metadata conflict for ${charger.label}`);
  }

  if (hasExistingPublicKey && Number(algorithm) === 0 && shouldRemainRevoked) {
    stats.chipsSkipped++;
    return;
  }

  await (await deviceRegistry.enrollChip(chargerId, publicKey64(wallet), 0)).wait();
  stats.chipsEnrolled++;
}

async function ensureStation(stationRegistry: any, station: StationSeed, stats: Stats) {
  const stationId = encodeBytes32String(station.label);
  const expectedRegionId = regionBytes4(station.regionCode);

  const exists = await stationRegistry.isRegistered(stationId);
  if (exists) {
    const existing = await stationRegistry.getStation(stationId);
    if (
      existing.regionId !== expectedRegionId
      || existing.location !== station.location
      || existing.active !== true
    ) {
      throw new Error(`Station metadata conflict for ${station.label}`);
    }
    stats.stationsSkipped++;
    return;
  }

  await (await stationRegistry.registerStation(stationId, expectedRegionId, station.location)).wait();
  stats.stationsRegistered++;
}

async function ensureCharger(stationRegistry: any, station: StationSeed, charger: ChargerSeed, stats: Stats) {
  const chargerId = encodeBytes32String(charger.label);
  const stationId = encodeBytes32String(station.label);

  try {
    const existing = await stationRegistry.getCharger(chargerId);
    if (
      existing.stationId !== stationId
      || Number(existing.chargerType) !== charger.chargerType
      || existing.active !== true
    ) {
      throw new Error(`Charger metadata conflict for ${charger.label}`);
    }
    stats.chargersSkipped++;
  } catch (err) {
    if (!matchesCustomError(err, "ChargerNotFound(bytes32)")) {
      throw err;
    }
    await (await stationRegistry.registerCharger(chargerId, stationId, charger.chargerType)).wait();
    stats.chargersRegistered++;
  }
}

async function ensureSession(chargeTransaction: any, chargeRouter: any, session: SessionSeed, stats: Stats) {
  const existingTokenId = await chargeTransaction.getTokenIdBySessionId(session.sessionId);
  const chargerId = encodeBytes32String(session.chargerLabel);
  const stationId = encodeBytes32String(session.stationLabel);
  const isDynamicLiveSeed = session.key.includes(":live:");

  if (existingTokenId > 0n) {
    const existing = await chargeTransaction.getSession(existingTokenId);
    if (
      existing.sessionId !== session.sessionId
      || existing.chargerId !== chargerId
      || Number(existing.chargerType) !== session.chargerType
      || existing.energyKwh !== session.energyKwh
      || (!isDynamicLiveSeed && existing.startTimestamp !== session.startTimestamp)
      || (!isDynamicLiveSeed && existing.endTimestamp !== session.endTimestamp)
      || Number(existing.vehicleCategory) !== session.vehicleCategory
      || existing.gridRegionCode !== regionBytes4(session.regionCode)
      || existing.stationId !== stationId
      || existing.distributableKrw !== session.distributableKrw
    ) {
      throw new Error(`Session metadata conflict for ${session.key}`);
    }
    stats.sessionsSkipped++;
    return;
  }

  const tx = await chargeRouter.processCharge(
    {
      sessionId: session.sessionId,
      chargerId,
      chargerType: session.chargerType,
      energyKwh: session.energyKwh,
      startTimestamp: session.startTimestamp,
      endTimestamp: session.endTimestamp,
      vehicleCategory: session.vehicleCategory,
      gridRegionCode: regionBytes4(session.regionCode),
      stationId,
      distributableKrw: session.distributableKrw,
      seSignature: signSession(
        session.chargerLabel,
        chargerId,
        session.energyKwh,
        session.startTimestamp,
        session.endTimestamp,
      ),
    },
    BigInt(session.key.split(":")[1]),
  );
  await tx.wait();
  stats.sessionsProcessed++;
}

async function finalizeHistoricalPeriod(
  revenueTracker: any,
  chargeTransaction: any,
  chargeRouter: any,
  region: RegionSeed,
  period: bigint,
  sessions: SessionSeed[],
  stats: Stats,
) {
  const regionId = regionBytes4(region.code);
  const expectedTotal = sessions.reduce((sum, session) => sum + session.distributableKrw, 0n);
  const attestation = await revenueTracker.getRegionAttestation(regionId, period);

  if (attestation.finalizedAt !== 0n) {
    for (const session of sessions) {
      const tokenId = await chargeTransaction.getTokenIdBySessionId(session.sessionId);
      if (tokenId === 0n) {
        throw new Error(`Historical period ${region.code} ${period.toString()} is already finalized but missing session ${session.key}`);
      }
      await ensureSession(chargeTransaction, chargeRouter, session, stats);
    }
    if (attestation.distributableKrw !== expectedTotal) {
      throw new Error(`Attestation amount conflict for ${region.code} ${period.toString()}`);
    }
    stats.regionClaimsSkipped++;
    return;
  }

  for (const session of sessions) {
    await ensureSession(chargeTransaction, chargeRouter, session, stats);
  }

  const tx = await revenueTracker.claimRegion(regionId, period);
  await tx.wait();

  const nextAttestation = await revenueTracker.getRegionAttestation(regionId, period);
  if (nextAttestation.finalizedAt === 0n || nextAttestation.distributableKrw !== expectedTotal) {
    throw new Error(`Failed to finalize ${region.code} ${period.toString()} with the expected total`);
  }
  stats.regionClaims++;
}

async function ensureRegionToken(
  ethers: any,
  regionStoFactory: any,
  stationRegistryAddress: string,
  signerAddress: string,
  region: RegionSeed,
  stats: Stats,
) {
  const regionId = regionBytes4(region.code);
  let tokenAddress = await regionStoFactory.getRegionToken(regionId);
  let wasDeployedNow = false;

  if (tokenAddress === ZERO_ADDRESS) {
    const tx = await regionStoFactory.deployRegion(regionId, region.tokenName, region.tokenSymbol);
    await tx.wait();
    tokenAddress = await regionStoFactory.getRegionToken(regionId);
    stats.stoRegionsDeployed++;
    wasDeployedNow = true;
  } else {
    stats.stoRegionsSkipped++;
  }

  const sto = await ethers.getContractAt("RegionSTO", tokenAddress);
  if (!wasDeployedNow) {
    await assertRegionTokenCompatibility(sto, signerAddress, regionId, stationRegistryAddress, region.code);
  }
  return { sto, tokenAddress, wasDeployedNow };
}

async function ensureRegionIssuance(
  sto: any,
  region: RegionSeed,
  primaryInvestor: string,
  reserveInvestor: string,
  stats: Stats,
) {
  const expectedTranches = [
    {
      recipient: primaryInvestor,
      tokenAmount: region.stoMint.primary,
      stationId: encodeBytes32String(buildStationLabel(region.code, 1)),
    },
    {
      recipient: reserveInvestor,
      tokenAmount: region.stoMint.reserve,
      stationId: encodeBytes32String(buildStationLabel(region.code, 2)),
    },
  ];

  const currentCount = Number(
    await readWithRetry(`${region.code}.getTrancheCount`, () => sto.getTrancheCount(), 20, 2000),
  );
  if (currentCount > expectedTranches.length) {
    throw new Error(`Unexpected tranche count for ${region.code}: ${currentCount}`);
  }

  for (const [index, expected] of expectedTranches.entries()) {
    const trancheId = index + 1;
    if (trancheId <= currentCount) {
      const tranche = await readWithRetry<any>(
        `${region.code}.getTranche(${trancheId})`,
        () => sto.getTranche(BigInt(trancheId)),
        20,
        2000,
      );
      const stationIds = [...tranche.stationIds] as string[];
      if (
        tranche.tokenAmount !== expected.tokenAmount
        || stationIds.length !== 1
        || stationIds[0] !== expected.stationId
      ) {
        throw new Error(`Tranche metadata conflict for ${region.code} #${trancheId}`);
      }
      stats.tranchesSkipped++;
      continue;
    }

    await (await sto.issueTranche(expected.recipient, expected.tokenAmount, [expected.stationId])).wait();
    stats.tranchesIssued++;
  }

  const expectedTotalSupply = region.stoMint.primary + region.stoMint.reserve;
  const [totalSupply, primaryBalance, reserveBalance] = await Promise.all([
    readWithRetry(`${region.code}.totalSupply`, () => sto.totalSupply(), 20, 2000),
    readWithRetry(`${region.code}.primaryBalance`, () => sto.balanceOf(primaryInvestor), 20, 2000),
    readWithRetry(`${region.code}.reserveBalance`, () => sto.balanceOf(reserveInvestor), 20, 2000),
  ]);

  if (totalSupply !== expectedTotalSupply) {
    throw new Error(`totalSupply mismatch for ${region.code}`);
  }
  if (primaryBalance !== region.stoMint.primary) {
    throw new Error(`Primary investor balance mismatch for ${region.code}`);
  }
  if (reserveBalance !== region.stoMint.reserve) {
    throw new Error(`Reserve investor balance mismatch for ${region.code}`);
  }
}

async function revokeCoverageChips(deviceRegistry: any, stats: Stats) {
  for (const chargerLabel of REVOKED_CHARGER_LABELS) {
    const chargerId = encodeBytes32String(chargerLabel);
    const isActive = await deviceRegistry.isActiveChip(chargerId);
    if (!isActive) {
      continue;
    }
    await (await deviceRegistry.revokeChip(chargerId)).wait();
    stats.chipsRevoked++;
  }
}

async function publishSnapshots(reputationRegistry: any, stats: Stats) {
  const pendingSnapshots: any[] = [];

  for (const region of REGION_SEEDS) {
    for (const period of [202602n, 202603n] as const) {
      const snapshot = buildSnapshot(region, period);
      const exists = await reputationRegistry.hasRegionSnapshot(snapshot.regionId, snapshot.granularity, period);
      if (!exists) {
        pendingSnapshots.push(snapshot);
        continue;
      }

      const existing = await reputationRegistry.getRegionSnapshot(snapshot.regionId, snapshot.granularity, period);
      const same = (
        Number(existing.metricVersion) === snapshot.metricVersion
        && existing.sourceHash === snapshot.sourceHash
        && Number(existing.trust.activeChargerRatioBps) === snapshot.trust.activeChargerRatioBps
        && Number(existing.trust.maintenanceResolutionRateBps) === snapshot.trust.maintenanceResolutionRateBps
        && Number(existing.trust.settlementContinuityBps) === snapshot.trust.settlementContinuityBps
        && existing.rhythm.sessionVolume === snapshot.rhythm.sessionVolume
        && Number(existing.rhythm.revenueStabilityBps) === snapshot.rhythm.revenueStabilityBps
        && Number(existing.rhythm.peakStartHour) === snapshot.rhythm.peakStartHour
        && Number(existing.rhythm.peakEndHour) === snapshot.rhythm.peakEndHour
        && Number(existing.site.primaryType) === snapshot.site.primaryType
        && Number(existing.site.residentialBps) === snapshot.site.residentialBps
        && Number(existing.site.workplaceBps) === snapshot.site.workplaceBps
        && Number(existing.site.publicCommercialBps) === snapshot.site.publicCommercialBps
        && Number(existing.site.mixedBps) === snapshot.site.mixedBps
      );
      if (!same) {
        throw new Error(`Snapshot metadata conflict for ${region.code} ${period.toString()}`);
      }
      stats.snapshotsSkipped++;
    }
  }

  if (pendingSnapshots.length === 0) {
    return;
  }

  await (await reputationRegistry.upsertRegionSnapshots(pendingSnapshots)).wait();
  stats.snapshotsPublished += pendingSnapshots.length;
}

function printSummary(
  stats: Stats,
  deployments: SurfaceDeploymentAddresses,
  rpcUrl: string | undefined,
  primaryInvestorAddress: string,
) {
  console.log("\n=== Demo seed summary ===");
  console.log(`chips enrolled     : ${stats.chipsEnrolled}`);
  console.log(`chips skipped      : ${stats.chipsSkipped}`);
  console.log(`chips revoked      : ${stats.chipsRevoked}`);
  console.log(`stations added     : ${stats.stationsRegistered}`);
  console.log(`stations skipped   : ${stats.stationsSkipped}`);
  console.log(`chargers added     : ${stats.chargersRegistered}`);
  console.log(`chargers skipped   : ${stats.chargersSkipped}`);
  console.log(`STO regions added  : ${stats.stoRegionsDeployed}`);
  console.log(`STO regions reused : ${stats.stoRegionsSkipped}`);
  console.log(`tranches issued    : ${stats.tranchesIssued}`);
  console.log(`tranches skipped   : ${stats.tranchesSkipped}`);
  console.log(`sessions minted    : ${stats.sessionsProcessed}`);
  console.log(`sessions skipped   : ${stats.sessionsSkipped}`);
  console.log(`claims finalized   : ${stats.regionClaims}`);
  console.log(`claims skipped     : ${stats.regionClaimsSkipped}`);
  console.log(`snapshots added    : ${stats.snapshotsPublished}`);
  console.log(`snapshots skipped  : ${stats.snapshotsSkipped}`);

  console.log("\nMobile runtime env:");
  console.log(`EXPO_PUBLIC_ENERGYFI_RPC_URL=${rpcUrl ?? "<set me>"}`);
  console.log(`EXPO_PUBLIC_CHARGE_TRANSACTION_ADDRESS=${deployments.ChargeTransaction}`);
  console.log(`EXPO_PUBLIC_REVENUE_TRACKER_ADDRESS=${deployments.RevenueTracker}`);
  console.log(`EXPO_PUBLIC_STATION_REGISTRY_ADDRESS=${deployments.StationRegistry}`);
  console.log(`EXPO_PUBLIC_DEVICE_REGISTRY_ADDRESS=${deployments.DeviceRegistry}`);
  console.log(`EXPO_PUBLIC_REPUTATION_REGISTRY_ADDRESS=${deployments.ReputationRegistry}`);
  console.log(`EXPO_PUBLIC_REGION_STO_FACTORY_ADDRESS=${deployments.RegionSTOFactory}`);
  console.log(`EXPO_PUBLIC_DEMO_INVESTOR_ADDRESS=${primaryInvestorAddress}`);
  console.log("\n=== Demo seeding complete ===\n");
}

async function main() {
  const conn = await hre.network.connect();
  const ethers = conn.ethers;
  const network = conn.networkName;
  const currentDeployments = requireSurfaceDeployments(network);
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  const balance = await ethers.provider.getBalance(signerAddress);
  const rpcUrl = process.env.ENERGYFI_L1_TESTNET_RPC?.trim();
  const primaryInvestor = deterministicWallet(PRIMARY_INVESTOR_LABEL);
  const reserveInvestor = deterministicWallet(RESERVE_INVESTOR_LABEL);

  console.log("\n=== EnergyFi Demo Seeder ===");
  console.log(`Network          : ${network}`);
  console.log(`Signer           : ${signerAddress}`);
  console.log(`Balance          : ${ethers.formatEther(balance)} ${nativeSymbol()}`);
  console.log(`Demo investor    : ${primaryInvestor.address}`);
  console.log(`Reserve investor : ${reserveInvestor.address}`);
  console.log(`Current period   : ${CURRENT_PERIOD.toString()}`);

  const deviceRegistry = await ethers.getContractAt("DeviceRegistry", currentDeployments.DeviceRegistry);
  const stationRegistry = await ethers.getContractAt("StationRegistry", currentDeployments.StationRegistry);
  const chargeTransaction = await ethers.getContractAt("ChargeTransaction", currentDeployments.ChargeTransaction);
  const revenueTracker = await ethers.getContractAt("RevenueTracker", currentDeployments.RevenueTracker);
  const chargeRouter = await ethers.getContractAt("ChargeRouter", currentDeployments.ChargeRouter);
  const reputationRegistry = await ethers.getContractAt("ReputationRegistry", currentDeployments.ReputationRegistry);
  const regionStoFactory = await ethers.getContractAt("RegionSTOFactory", currentDeployments.RegionSTOFactory);

  await assertDemoPermissions(
    ethers,
    signerAddress,
    currentDeployments.StationRegistry,
    deviceRegistry,
    stationRegistry,
    revenueTracker,
    chargeRouter,
    reputationRegistry,
    regionStoFactory,
  );

  const stats = newStats();
  const stations = REGION_SEEDS.flatMap(buildStations);

  console.log("\n1. Ensuring deterministic demo chips...");
  for (const station of stations) {
    for (const charger of station.chargers) {
      await ensureChip(deviceRegistry, charger, stats);
    }
  }

  console.log("2. Ensuring stations...");
  for (const station of stations) {
    await ensureStation(stationRegistry, station, stats);
  }

  console.log("3. Ensuring chargers...");
  for (const station of stations) {
    for (const charger of station.chargers) {
      await ensureCharger(stationRegistry, station, charger, stats);
    }
  }

  console.log("4. Processing historical sessions and region finalizations...");
  for (const period of FINALIZED_PERIODS) {
    for (const [regionIndex, region] of REGION_SEEDS.entries()) {
      const sessions = buildHistoricalSessions(region, period, regionIndex);
      if (sessions.length === 0) {
        continue;
      }
      await finalizeHistoricalPeriod(
        revenueTracker,
        chargeTransaction,
        chargeRouter,
        region,
        period,
        sessions,
        stats,
      );
    }
  }

  console.log("5. Ensuring region STO contracts...");
  const stoContracts = new Map<RegionCode, any>();
  const freshStoRegions: RegionCode[] = [];
  for (const region of REGION_SEEDS) {
    const { sto, wasDeployedNow } = await ensureRegionToken(
      ethers,
      regionStoFactory,
      currentDeployments.StationRegistry,
      signerAddress,
      region,
      stats,
    );
    stoContracts.set(region.code, sto);
    if (wasDeployedNow) {
      freshStoRegions.push(region.code);
    }
  }

  if (freshStoRegions.length > 0) {
    console.log(
      `Detected ${freshStoRegions.length} freshly deployed RegionSTOs (${freshStoRegions.join(", ")}). Waiting for RPC convergence...`,
    );
    await wait(90_000);
    for (const regionCode of freshStoRegions) {
      const sto = stoContracts.get(regionCode);
      if (!sto) {
        throw new Error(`Missing RegionSTO instance for ${regionCode}`);
      }
      await assertRegionTokenCompatibility(
        sto,
        signerAddress,
        regionBytes4(regionCode),
        currentDeployments.StationRegistry,
        regionCode,
      );
    }
  }

  console.log("6. Issuing demo STO tranches...");
  for (const region of REGION_SEEDS) {
    const sto = stoContracts.get(region.code);
    if (!sto) {
      throw new Error(`Missing RegionSTO instance for ${region.code}`);
    }
    await ensureRegionIssuance(sto, region, primaryInvestor.address, reserveInvestor.address, stats);
  }

  console.log("7. Processing post-finalization live sessions...");
  const currentSessions = buildLiveSessions(REGION_SEEDS);
  for (const session of currentSessions) {
    await ensureSession(chargeTransaction, chargeRouter, session, stats);
  }

  console.log("8. Revoking three chips for coverage variance...");
  await revokeCoverageChips(deviceRegistry, stats);

  console.log("9. Publishing region reputation snapshots...");
  await publishSnapshots(reputationRegistry, stats);

  printSummary(stats, currentDeployments, rpcUrl, primaryInvestor.address);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
