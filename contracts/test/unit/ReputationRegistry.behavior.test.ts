/**
 * ReputationRegistry interface-first behavior spec.
 *
 * All business assertions are executed through IReputationRegistry handles.
 * The harness is only used as a live proxy target during the red phase.
 */

import hre from "hardhat";
import { expect } from "chai";
import {
  expectRevertCustomError,
  findEvent,
  deployUUPSProxy,
} from "../helpers/helpers.js";
import {
  PeriodGranularity,
  SiteType,
  PERIOD_MONTH_JAN,
  PERIOD_MONTH_FEB,
  PERIOD_MONTH_MAR,
  PERIOD_WEEK_10,
  REGION_BUSAN,
  REGION_SEOUL,
  makeSnapshot,
  expectSnapshotMatches,
  expectUpdatedAtIncreased,
} from "../helpers/reputation.js";
import type {
  IReputationRegistry,
  ReputationRegistry,
} from "../../typechain-types/index.js";
import {
  IReputationRegistry__factory,
} from "../../typechain-types/index.js";

describe("IReputationRegistry behavior", function () {
  let ethers: Awaited<ReturnType<typeof hre.network.connect>>["ethers"];
  let admin: Awaited<ReturnType<typeof ethers.getSigner>>;
  let bridge: Awaited<ReturnType<typeof ethers.getSigner>>;
  let reader: Awaited<ReturnType<typeof ethers.getSigner>>;

  let writerRegistry: IReputationRegistry;
  let readerRegistry: IReputationRegistry;

  beforeEach(async function () {
    const conn = await hre.network.connect();
    ethers = conn.ethers;

    const signers = await ethers.getSigners();
    admin = signers[0];
    bridge = signers[1];
    reader = signers[2];

    const { contract } = await deployUUPSProxy<ReputationRegistry>(
      ethers,
      "ReputationRegistry",
    );
    await contract.initialize(admin.address, bridge.address);

    const address = await contract.getAddress();
    writerRegistry = IReputationRegistry__factory.connect(address, bridge);
    readerRegistry = IReputationRegistry__factory.connect(address, reader);
  });

  describe("green wiring", function () {
    it("stores a single snapshot and returns the exact payload", async function () {
      const snapshot = makeSnapshot();
      await writerRegistry.upsertRegionSnapshot(snapshot);

      const stored = await readerRegistry.getRegionSnapshot(
        snapshot.regionId,
        snapshot.granularity,
        snapshot.periodId,
      );

      expectSnapshotMatches(stored, snapshot);
      expect(stored.updatedAt > 0n).to.equal(true);
    });

    it("emits RegionSnapshotUpserted through the interface ABI", async function () {
      const snapshot = makeSnapshot();
      const tx = await writerRegistry.upsertRegionSnapshot(snapshot);
      const receipt = await tx.wait();

      const event = findEvent(receipt!, writerRegistry, "RegionSnapshotUpserted");
      expect(event).to.not.be.null;
      expect(event!.args.regionId).to.equal(snapshot.regionId);
      expect(event!.args.granularity).to.equal(BigInt(snapshot.granularity));
      expect(event!.args.periodId).to.equal(snapshot.periodId);
      expect(event!.args.metricVersion).to.equal(BigInt(snapshot.metricVersion));
      expect(event!.args.sourceHash).to.equal(snapshot.sourceHash);
    });

    it("separates snapshots by region and cadence", async function () {
      const seoulMonthly = makeSnapshot({
        regionId: REGION_SEOUL,
        granularity: PeriodGranularity.MONTHLY,
        periodId: PERIOD_MONTH_JAN,
      });
      const seoulWeekly = makeSnapshot({
        regionId: REGION_SEOUL,
        granularity: PeriodGranularity.WEEKLY,
        periodId: PERIOD_WEEK_10,
      });
      const busanMonthly = makeSnapshot({
        regionId: REGION_BUSAN,
        granularity: PeriodGranularity.MONTHLY,
        periodId: PERIOD_MONTH_JAN,
      });

      await writerRegistry.upsertRegionSnapshot(seoulMonthly);
      await writerRegistry.upsertRegionSnapshot(seoulWeekly);
      await writerRegistry.upsertRegionSnapshot(busanMonthly);

      expectSnapshotMatches(
        await readerRegistry.getRegionSnapshot(REGION_SEOUL, PeriodGranularity.MONTHLY, PERIOD_MONTH_JAN),
        seoulMonthly,
      );
      expectSnapshotMatches(
        await readerRegistry.getRegionSnapshot(REGION_SEOUL, PeriodGranularity.WEEKLY, PERIOD_WEEK_10),
        seoulWeekly,
      );
      expectSnapshotMatches(
        await readerRegistry.getRegionSnapshot(REGION_BUSAN, PeriodGranularity.MONTHLY, PERIOD_MONTH_JAN),
        busanMonthly,
      );
    });

    it("flips hasRegionSnapshot from false to true after publish", async function () {
      const snapshot = makeSnapshot();
      expect(
        await readerRegistry.hasRegionSnapshot(snapshot.regionId, snapshot.granularity, snapshot.periodId),
      ).to.equal(false);

      await writerRegistry.upsertRegionSnapshot(snapshot);

      expect(
        await readerRegistry.hasRegionSnapshot(snapshot.regionId, snapshot.granularity, snapshot.periodId),
      ).to.equal(true);
    });
  });

  describe("spec compliance", function () {
    it("should refresh updatedAt when the same key is overwritten", async function () {
      const snapshot = makeSnapshot();
      await writerRegistry.upsertRegionSnapshot(snapshot);
      const initial = await readerRegistry.getRegionSnapshot(
        snapshot.regionId,
        snapshot.granularity,
        snapshot.periodId,
      );

      await ethers.provider.send("evm_increaseTime", [60]);
      await ethers.provider.send("evm_mine", []);

      await writerRegistry.upsertRegionSnapshot({
        ...snapshot,
        metricVersion: 2,
      });
      const updated = await readerRegistry.getRegionSnapshot(
        snapshot.regionId,
        snapshot.granularity,
        snapshot.periodId,
      );

      expect(updated.metricVersion).to.equal(2n);
      expectUpdatedAtIncreased(initial.updatedAt, updated.updatedAt);
    });

    it("should use highest periodId for latest, not last write", async function () {
      await writerRegistry.upsertRegionSnapshot(makeSnapshot({
        periodId: PERIOD_MONTH_JAN,
        granularity: PeriodGranularity.MONTHLY,
      }));
      await writerRegistry.upsertRegionSnapshot(makeSnapshot({
        periodId: PERIOD_MONTH_MAR,
        granularity: PeriodGranularity.MONTHLY,
      }));
      await writerRegistry.upsertRegionSnapshot(makeSnapshot({
        periodId: PERIOD_MONTH_JAN,
        granularity: PeriodGranularity.MONTHLY,
        metricVersion: 2,
      }));

      const latest = await readerRegistry.getLatestRegionSnapshot(
        REGION_SEOUL,
        PeriodGranularity.MONTHLY,
      );

      expect(latest.periodId).to.equal(PERIOD_MONTH_MAR);
    });

    it("should return unique ascending periods only once per key", async function () {
      await writerRegistry.upsertRegionSnapshot(makeSnapshot({
        periodId: PERIOD_MONTH_MAR,
      }));
      await writerRegistry.upsertRegionSnapshot(makeSnapshot({
        periodId: PERIOD_MONTH_JAN,
      }));
      await writerRegistry.upsertRegionSnapshot(makeSnapshot({
        periodId: PERIOD_MONTH_MAR,
        metricVersion: 2,
      }));

      const periods = await readerRegistry.getRegionSnapshotPeriods(
        REGION_SEOUL,
        PeriodGranularity.MONTHLY,
      );

      expect(periods).to.deep.equal([PERIOD_MONTH_JAN, PERIOD_MONTH_MAR]);
    });

    it("should revert getRegionSnapshot when the snapshot is absent", async function () {
      await expectRevertCustomError(
        readerRegistry.getRegionSnapshot(REGION_SEOUL, PeriodGranularity.MONTHLY, PERIOD_MONTH_JAN),
        "RegionSnapshotNotFound",
      );
    });

    it("should revert getLatestRegionSnapshot when the cadence has no data", async function () {
      await expectRevertCustomError(
        readerRegistry.getLatestRegionSnapshot(REGION_SEOUL, PeriodGranularity.WEEKLY),
        "LatestRegionSnapshotNotFound",
      );
    });

    it("should reject UNKNOWN granularity", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          granularity: PeriodGranularity.UNKNOWN,
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject malformed monthly periodId", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          granularity: PeriodGranularity.MONTHLY,
          periodId: 202613n,
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject malformed weekly periodId", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          granularity: PeriodGranularity.WEEKLY,
          periodId: 202654n,
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject bps fields above 10_000", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          trust: {
            activeChargerRatioBps: 10001,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject SiteMetrics whose ratios do not sum to 10_000", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          site: {
            primaryType: SiteType.RESIDENTIAL,
            residentialBps: 5000,
            workplaceBps: 2000,
            publicCommercialBps: 1000,
            mixedBps: 1000,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject UNKNOWN-site mismatch when all site ratios are zero", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          site: {
            primaryType: SiteType.RESIDENTIAL,
            residentialBps: 0,
            workplaceBps: 0,
            publicCommercialBps: 0,
            mixedBps: 0,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject dominant-bucket mismatch for SiteMetrics", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          site: {
            primaryType: SiteType.MIXED,
            residentialBps: 7000,
            workplaceBps: 1000,
            publicCommercialBps: 1000,
            mixedBps: 1000,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject non-MIXED primaryType on tied site buckets", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          site: {
            primaryType: SiteType.RESIDENTIAL,
            residentialBps: 4000,
            workplaceBps: 4000,
            publicCommercialBps: 1000,
            mixedBps: 1000,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject equal peakStartHour and peakEndHour", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          rhythm: {
            peakStartHour: 22,
            peakEndHour: 22,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should reject hours above 23", async function () {
      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshot(makeSnapshot({
          rhythm: {
            peakStartHour: 24,
            peakEndHour: 2,
          },
        })),
        "InvalidSnapshotKey",
      );
    });

    it("should allow overnight peak windows", async function () {
      const overnight = makeSnapshot({
        granularity: PeriodGranularity.WEEKLY,
        periodId: PERIOD_WEEK_10,
        rhythm: {
          peakStartHour: 22,
          peakEndHour: 2,
        },
      });

      await writerRegistry.upsertRegionSnapshot(overnight);
      const stored = await readerRegistry.getRegionSnapshot(
        overnight.regionId,
        overnight.granularity,
        overnight.periodId,
      );

      expect(stored.rhythm.peakStartHour).to.equal(22n);
      expect(stored.rhythm.peakEndHour).to.equal(2n);
    });

    it("should reject invalid batch members and preserve atomicity", async function () {
      const valid = makeSnapshot({
        periodId: PERIOD_MONTH_FEB,
      });
      const invalid = makeSnapshot({
        periodId: 202600n,
      });

      await expectRevertCustomError(
        writerRegistry.upsertRegionSnapshots([valid, invalid]),
        "InvalidSnapshotKey",
      );

      expect(
        await readerRegistry.hasRegionSnapshot(valid.regionId, valid.granularity, valid.periodId),
      ).to.equal(false);
    });
  });
});
