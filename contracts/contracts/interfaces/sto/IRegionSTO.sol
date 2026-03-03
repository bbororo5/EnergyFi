// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRegionSTO — 지역별 토큰증권 인터페이스 (Security Token per Region)
 *
 * @notice 한국 전자증권법 개정안(2026.01.15 통과, 2027.02.04 시행)에 따른
 *         분산원장 기반 증권 발행 인터페이스.
 *
 *         ERC-20 기반이며, STO 고유 기능(차수 발행, 소각, 지역 조회)만 정의.
 *         ERC-20 표준 함수(transfer, balanceOf, totalSupply 등)는 OZ에서 상속.
 *
 *         - 발행인계좌관리기관(EnergyFi)이 Avalanche L1에서 직접 발행.
 *         - totalSupply()는 한국예탁결제원(KSD) 총량관리 노드가 검증 가능.
 *         - 배당 계산/실행은 증권사 또는 발행인이 오프체인에서 수행 (전통증권 모델).
 *         - Admin-only transfer: DEFAULT_ADMIN_ROLE만 토큰 이동 가능.
 *
 * @dev Phase 3 컨트랙트. UUPS 업그레이드 가능.
 *      StationRegistry를 참조하여 issueTranche 시 충전소 소유권 및 지역 검증.
 */
interface IRegionSTO {
    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 차수(Tranche) 발행 기록.
    ///         KSD 총량관리: 각 차수에서 발행된 토큰 수와 포함된 충전소 목록을 기록.
    struct Tranche {
        uint256   trancheId;       // 차수 ID (1-based)
        uint256   tokenAmount;     // 이 차수에서 발행된 토큰 수
        bytes32[] stationIds;      // 이 차수에 포함된 EnergyFi 소유 충전소 목록
        uint256   issuedAt;        // block.timestamp
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 새 차수가 발행되었을 때 emit.
    ///         KSD 총량관리 노드가 이 이벤트를 모니터링하여 발행 총량 변동을 추적.
    event TrancheIssued(
        uint256 indexed trancheId,
        address indexed to,
        uint256 tokenAmount,
        uint256 stationCount,
        uint256 issuedAt
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice 새 차수를 발행하고 토큰을 민팅한다.
     *
     * @dev Admin-only. 각 stationId에 대해 StationRegistry를 통해 검증:
     *      - 등록된 충전소인지 (isRegistered)
     *      - EnergyFi 소유인지 (isEnergyFiOwned)
     *      - 이 토큰의 지역에 소속되는지 (getStation().regionId == regionId)
     *      - 이미 다른 차수에 포함되지 않았는지 (중복 방지)
     *
     * @param to           토큰 수령 주소 (발행인 또는 투자자 계좌)
     * @param tokenAmount  발행할 토큰 수량
     * @param stationIds   이 차수에 추가되는 EnergyFi 소유 충전소 ID 목록
     * @return trancheId   생성된 차수 ID (1-based)
     */
    function issueTranche(
        address to,
        uint256 tokenAmount,
        bytes32[] calldata stationIds
    ) external returns (uint256 trancheId);

    /**
     * @notice Admin이 투자자 계좌 간 토큰을 이체한다.
     *
     * @dev Admin-only. 전통증권 모델에서 증권사 또는 발행인만 이체 가능.
     *      일반 사용자의 transfer/transferFrom은 revert.
     *
     * @param from   출금 주소
     * @param to     입금 주소
     * @param amount 이체 수량
     */
    function adminTransfer(address from, address to, uint256 amount) external;

    /**
     * @notice 토큰 소각 (감자).
     *
     * @dev Admin-only. 충전소 폐쇄 또는 STO 감자 시 사용.
     *      totalSupply가 감소하므로 KSD 총량관리에 반영됨.
     *
     * @param from   소각 대상 주소
     * @param amount 소각할 수량
     */
    function burn(address from, uint256 amount) external;

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 이 토큰이 대응하는 ISO 3166-2:KR 지역 코드 (e.g. 0x4B523131 = "KR11" = 서울).
    function regionId() external view returns (bytes4);

    /// @notice 차수 정보 조회.
    /// @param trancheId 조회할 차수 ID (1-based).
    function getTranche(uint256 trancheId) external view returns (Tranche memory);

    /// @notice 총 발행 차수 수.
    function getTrancheCount() external view returns (uint256);

    /// @notice 특정 충전소가 포함된 차수 ID 조회.
    /// @return trancheId 포함된 차수 ID. 0이면 어떤 차수에도 미포함.
    function getStationTranche(bytes32 stationId) external view returns (uint256);
}
