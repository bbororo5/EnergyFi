// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./IRevenueTracker.sol";

/**
 * @title IRevenueTrackerV2
 * @notice Phase 3 확장 인터페이스 — 지역별 수익 확정 + CPO 지역 뷰.
 *
 * IRevenueTracker를 상속하며, 기존 함수 시그니처를 일절 변경하지 않음.
 * RevenueTracker V2 (UUPS 업그레이드)에서 구현.
 *
 * 추가 기능:
 *  - claimRegion(): EnergyFi 소유 충전소 수익을 지역 단위로 확정 (정산)
 *  - RegionAttestation: 확정된 수익의 불변 온체인 기록 (전통증권 모델 배당의 법적 근거)
 *  - getCPORegionRevenue(): CPO의 특정 지역 내 충전소 수익 합계
 *
 * @dev Essential contract — data source for Phase 3 RegionSTO.
 */
interface IRevenueTrackerV2 is IRevenueTracker {
    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 지역별 수익 확정 시 emit.
    ///         KSD 총량관리 노드가 이 이벤트를 모니터링하여 정산 상태를 추적.
    event RegionSettlementFinalized(
        bytes4  indexed regionId,
        uint256 period_yyyyMM,
        uint256 totalAmount,
        uint256 stationCount,
        uint256 finalizedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice 지역별 EnergyFi 소유 충전소 수익을 확정(finalize)한다.
     *
     * @dev Admin-only. 해당 지역의 모든 EnergyFi 소유 충전소의 pending을 0으로 리셋하고
     *      RegionAttestation을 온체인에 기록한다.
     *      기존 CPO claim()과 동일한 settled += pending 패턴.
     *
     *      전통증권 모델: 이 attestation을 근거로 오프체인에서 원화 배당을 집행.
     *      투자자별 배당 = (balance / totalSupply) × distributableKrw.
     *
     * @param regionId ISO 3166-2:KR bytes4 지역 코드.
     * @param period_yyyyMM 정산 기간 (e.g. 202603).
     * @return totalClaimed 확정된 총 수익 (원).
     * @return stationCount 정산에 포함된 충전소 수.
     */
    function claimRegion(bytes4 regionId, uint256 period_yyyyMM)
        external returns (uint256 totalClaimed, uint256 stationCount);

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice 지역별 수익 확정 기록 조회.
     * @param regionId ISO 3166-2:KR bytes4 지역 코드.
     * @param period_yyyyMM 조회할 정산 기간.
     */
    function getRegionAttestation(bytes4 regionId, uint256 period_yyyyMM)
        external view returns (RegionAttestation memory);

    /**
     * @notice 지역의 모든 확정 기간 목록.
     * @param regionId ISO 3166-2:KR bytes4 지역 코드.
     */
    function getRegionAttestationPeriods(bytes4 regionId)
        external view returns (uint256[] memory);

    /**
     * @notice CPO의 특정 지역 내 충전소 수익 합계.
     *
     * @dev StationRegistry.getStationsByCPO()로 CPO 전체 충전소를 가져온 후
     *      getStation().regionId로 해당 지역만 필터링하여 합산.
     *      WARNING: CPO의 충전소 수가 많으면 가스 비용이 높을 수 있음.
     *
     * @param cpoId bytes32 CPO 식별자.
     * @param regionId ISO 3166-2:KR bytes4 지역 코드.
     * @return accumulated 누적 수익 (원).
     * @return settled 정산 완료 수익 (원).
     * @return pending 미정산 수익 (원).
     */
    function getCPORegionRevenue(bytes32 cpoId, bytes4 regionId)
        external view returns (uint256 accumulated, uint256 settled, uint256 pending);
}
