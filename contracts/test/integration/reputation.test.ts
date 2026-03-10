/**
 * ReputationRegistry consumer-flow integration tests.
 *
 * Registry-only flow: writer bridge publishes snapshots, reader consumes
 * interface-scoped reads the way Explore will.
 */

import hre from "hardhat";
import { expect } from "chai";
import {
  expectRevertCustomError,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import {
  PeriodGranularity,
  PERIOD_MONTH_JAN,
  PERIOD_MONTH_FEB,
  PERIOD_MONTH_MAR,
  PERIOD_WEEK_10,
  REGION_BUSAN,
  REGION_SEOUL,
  makeSnapshot,
  expectSnapshotMatches,
} from "../helpers/reputation.js";
import type {
  IReputationRegistry,
  ReputationRegistry,
} from "../../typechain-types/index.js";
import {
  IReputationRegistry__factory,
} from "../../typechain-types/index.js";

describe("ReputationRegistry integration", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let bridge: Awaited<ReturnType<typeof ethers.getSigner>>;
  let reader: Awaited<ReturnType<typeof ethers.getSigner>>;
  let stranger: Awaited<ReturnType<typeof ethers.getSigner>>;

  let bridgeRegistry: IReputationRegistry;
  let readerRegistry: IReputationRegistry;
  let strangerRegistry: IReputationRegistry;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    bridge = signers[1];
    reader = signers[2];
    stranger = signers[3];

    const { contract } = await deployUUPSProxy<ReputationRegistry>(
      ethers,
      "ReputationRegistry",
    );
    await contract.initialize(admin.address, bridge.address);

    const address = await contract.getAddress();
    bridgeRegistry = IReputationRegistry__factory.connect(address, bridge);
    readerRegistry = IReputationRegistry__factory.connect(address, reader);
    strangerRegistry = IReputationRegistry__factory.connect(address, stranger);
  });

  it("lets the bridge publish weekly and monthly snapshots that the reader can consume", async function () {
    const monthly = makeSnapshot({
      regionId: REGION_SEOUL,
      granularity: PeriodGranularity.MONTHLY,
      periodId: PERIOD_MONTH_JAN,
    });
    const weekly = makeSnapshot({
      regionId: REGION_SEOUL,
      granularity: PeriodGranularity.WEEKLY,
      periodId: PERIOD_WEEK_10,
    });

    await bridgeRegistry.upsertRegionSnapshot(monthly);
    await bridgeRegistry.upsertRegionSnapshot(weekly);

    expect(
      await readerRegistry.hasRegionSnapshot(REGION_SEOUL, PeriodGranularity.MONTHLY, PERIOD_MONTH_JAN),
    ).to.equal(true);
    expect(
      await readerRegistry.hasRegionSnapshot(REGION_SEOUL, PeriodGranularity.WEEKLY, PERIOD_WEEK_10),
    ).to.equal(true);

    expectSnapshotMatches(
      await readerRegistry.getRegionSnapshot(REGION_SEOUL, PeriodGranularity.MONTHLY, PERIOD_MONTH_JAN),
      monthly,
    );
    expectSnapshotMatches(
      await readerRegistry.getRegionSnapshot(REGION_SEOUL, PeriodGranularity.WEEKLY, PERIOD_WEEK_10),
      weekly,
    );
  });

  it("rejects non-bridge publication attempts", async function () {
    await expectRevertCustomError(
      strangerRegistry.upsertRegionSnapshot(makeSnapshot()),
      "CallerNotBridge",
    );
  });

  it("keeps region state isolated across multiple published regions", async function () {
    const seoul = makeSnapshot({
      regionId: REGION_SEOUL,
      periodId: PERIOD_MONTH_JAN,
    });
    const busan = makeSnapshot({
      regionId: REGION_BUSAN,
      periodId: PERIOD_MONTH_FEB,
    });

    await bridgeRegistry.upsertRegionSnapshot(seoul);
    await bridgeRegistry.upsertRegionSnapshot(busan);

    expectSnapshotMatches(
      await readerRegistry.getRegionSnapshot(REGION_SEOUL, PeriodGranularity.MONTHLY, PERIOD_MONTH_JAN),
      seoul,
    );
    expectSnapshotMatches(
      await readerRegistry.getRegionSnapshot(REGION_BUSAN, PeriodGranularity.MONTHLY, PERIOD_MONTH_FEB),
      busan,
    );
  });

  it("should keep latest pinned to the highest period even after a backfill overwrite", async function () {
    await bridgeRegistry.upsertRegionSnapshot(makeSnapshot({
      periodId: PERIOD_MONTH_JAN,
    }));
    await bridgeRegistry.upsertRegionSnapshot(makeSnapshot({
      periodId: PERIOD_MONTH_MAR,
    }));
    await bridgeRegistry.upsertRegionSnapshot(makeSnapshot({
      periodId: PERIOD_MONTH_JAN,
      metricVersion: 99,
    }));

    const latest = await readerRegistry.getLatestRegionSnapshot(
      REGION_SEOUL,
      PeriodGranularity.MONTHLY,
    );

    expect(latest.periodId).to.equal(PERIOD_MONTH_MAR);
  });

  it("should expose period lists in unique ascending order for Explore diffs", async function () {
    await bridgeRegistry.upsertRegionSnapshot(makeSnapshot({
      periodId: PERIOD_MONTH_MAR,
    }));
    await bridgeRegistry.upsertRegionSnapshot(makeSnapshot({
      periodId: PERIOD_MONTH_JAN,
    }));
    await bridgeRegistry.upsertRegionSnapshot(makeSnapshot({
      periodId: PERIOD_MONTH_FEB,
    }));

    const periods = await readerRegistry.getRegionSnapshotPeriods(
      REGION_SEOUL,
      PeriodGranularity.MONTHLY,
    );

    expect(periods).to.deep.equal([PERIOD_MONTH_JAN, PERIOD_MONTH_FEB, PERIOD_MONTH_MAR]);
  });
});
