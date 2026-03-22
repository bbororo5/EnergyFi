// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IReputationRegistry
 * @notice Interface for the ReputationRegistry contract.
 *
 * Stores region-level derived reputation snapshots for Explore.
 * Snapshot narratives are composed in the frontend; on-chain state stores
 * only structured metrics for operational trust, revenue rhythm, and site mix.
 *
 * Source specification:
 *   - contracts/docs/phase4-reputation-spec.md
 */
interface IReputationRegistry {
    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Reporting cadence for a reputation snapshot.
     * @dev periodId is interpreted by granularity:
     *      - WEEKLY  -> YYYYWW
     *      - MONTHLY -> YYYYMM
     */
    enum PeriodGranularity {
        UNKNOWN,
        WEEKLY,
        MONTHLY
    }

    /**
     * @notice Primary site type used for region-level site narratives.
     * @dev MIXED is used when no single bucket dominates the region.
     */
    enum SiteType {
        UNKNOWN,
        RESIDENTIAL,
        WORKPLACE,
        PUBLIC_COMMERCIAL,
        MIXED
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Snapshot key is invalid for the requested operation.
     * @dev Implementations should use this when granularity is UNKNOWN or when
     *      periodId encoding does not match the selected cadence.
     */
    error InvalidSnapshotKey(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    );

    /**
     * @notice Requested snapshot does not exist.
     */
    error RegionSnapshotNotFound(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    );

    /**
     * @notice No latest snapshot exists for the region and cadence.
     */
    error LatestRegionSnapshotNotFound(
        bytes4 regionId,
        PeriodGranularity granularity
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a region reputation snapshot is inserted or updated.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param granularity Snapshot reporting cadence.
     * @param periodId Encoded period identifier (YYYYWW or YYYYMM).
     * @param metricVersion Version of the STRIKON-side computation formula.
     * @param sourceHash Hash of the upstream computation input bundle.
     * @param updatedAt Block timestamp of the upsert.
     */
    event RegionSnapshotUpserted(
        bytes4 indexed regionId,
        PeriodGranularity indexed granularity,
        uint256 indexed periodId,
        uint32 metricVersion,
        bytes32 sourceHash,
        uint256 updatedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Region-level operational trust metrics.
     * @dev Ratios use basis points (10_000 = 100%).
     *      Each field MUST be within the closed interval [0, 10_000].
     */
    struct TrustMetrics {
        uint16 activeChargerRatioBps;
        uint16 maintenanceResolutionRateBps;
        uint16 settlementContinuityBps;
    }

    /**
     * @notice Region-level revenue rhythm metrics.
     * @dev revenueStabilityBps uses basis points (10_000 = max stability).
     *      peakStartHour / peakEndHour use 24-hour Korea Standard Time
     *      (Asia/Seoul), with a half-open interval [start, end).
     *      If peakStartHour > peakEndHour, the window wraps past midnight.
     *      Published snapshots MUST NOT use peakStartHour == peakEndHour.
     */
    struct RhythmMetrics {
        uint256 sessionVolume;
        uint16 revenueStabilityBps;
        uint8 peakStartHour;
        uint8 peakEndHour;
    }

    /**
     * @notice Region-level site composition metrics.
     * @dev Mix ratios use basis points (10_000 = 100%).
     *      Each ratio MUST be within [0, 10_000].
     *      If all ratio fields are zero, primaryType MUST be UNKNOWN.
     *      Otherwise, ratio fields MUST sum to exactly 10_000.
     *      primaryType MUST equal the dominant bucket; ties MUST use MIXED.
     */
    struct SiteMetrics {
        SiteType primaryType;
        uint16 residentialBps;
        uint16 workplaceBps;
        uint16 publicCommercialBps;
        uint16 mixedBps;
    }

    /**
     * @notice Input payload supplied by the STRIKON bridge/oracle.
     * @dev sourceHash MUST commit to the canonical upstream computation bundle:
     *      keccak256(abi.encode(
     *          regionId,
     *          granularity,
     *          periodId,
     *          metricVersion,
     *          chargeDataRoot,
     *          revenueDataRoot,
     *          stationDataRoot,
     *          opsDataRoot
     *      )).
     *      The four domain roots are off-chain normalized digests computed by
     *      the STRIKON publisher. Unused domains should use bytes32(0).
     */
    struct RegionSnapshotInput {
        bytes4 regionId;
        PeriodGranularity granularity;
        uint256 periodId;
        uint32 metricVersion;
        bytes32 sourceHash;
        TrustMetrics trust;
        RhythmMetrics rhythm;
        SiteMetrics site;
    }

    /**
     * @notice Stored region reputation snapshot.
     */
    struct RegionSnapshot {
        bytes4 regionId;
        PeriodGranularity granularity;
        uint256 periodId;
        uint32 metricVersion;
        bytes32 sourceHash;
        TrustMetrics trust;
        RhythmMetrics rhythm;
        SiteMetrics site;
        uint256 updatedAt;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Insert or update a single region reputation snapshot.
     * @dev Intended to be called by the STRIKON bridge/oracle trust boundary.
     *      Implementations SHOULD reject UNKNOWN granularity and malformed
     *      periodId values with InvalidSnapshotKey.
     * @param snapshot Region snapshot payload to store.
     */
    function upsertRegionSnapshot(RegionSnapshotInput calldata snapshot) external;

    /**
     * @notice Insert or update multiple region reputation snapshots atomically.
     * @dev Intended for batch publication per cadence window.
     *      Implementations SHOULD reject UNKNOWN granularity and malformed
     *      periodId values with InvalidSnapshotKey.
     * @param snapshots Region snapshot payloads to store.
     */
    function upsertRegionSnapshots(RegionSnapshotInput[] calldata snapshots) external;

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the stored snapshot for a region and period key.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param granularity Snapshot reporting cadence.
     * @param periodId Encoded period identifier.
     * @dev Implementations SHOULD revert with RegionSnapshotNotFound when the
     *      snapshot key is absent, and InvalidSnapshotKey for malformed keys.
     */
    function getRegionSnapshot(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    ) external view returns (RegionSnapshot memory);

    /**
     * @notice Returns the latest stored snapshot for a region and cadence.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param granularity Snapshot reporting cadence.
     * @dev "Latest" means the highest published periodId within the selected
     *      cadence, not the most recently updated record by timestamp.
     *      Implementations SHOULD revert with LatestRegionSnapshotNotFound when
     *      no snapshot exists for the key space.
     */
    function getLatestRegionSnapshot(
        bytes4 regionId,
        PeriodGranularity granularity
    ) external view returns (RegionSnapshot memory);

    /**
     * @notice Lists all published periods for a region and cadence.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param granularity Snapshot reporting cadence.
     * @dev Returned periodIds MUST be unique and strictly ordered in ascending
     *      chronological order (oldest -> newest).
     */
    function getRegionSnapshotPeriods(
        bytes4 regionId,
        PeriodGranularity granularity
    ) external view returns (uint256[] memory);

    /**
     * @notice Returns true if a snapshot exists for the key.
     * @param regionId ISO 3166-2:KR bytes4 region code.
     * @param granularity Snapshot reporting cadence.
     * @param periodId Encoded period identifier.
     */
    function hasRegionSnapshot(
        bytes4 regionId,
        PeriodGranularity granularity,
        uint256 periodId
    ) external view returns (bool);
}
