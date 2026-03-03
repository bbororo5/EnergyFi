// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IRegionSTOFactory — 지역별 토큰증권 팩토리 인터페이스
 *
 * @notice 한국 17개 광역자치단체(ISO 3166-2:KR)에 대응하는 RegionSTO 토큰을
 *         배포하고 관리하는 팩토리.
 *
 *         - 각 지역은 독립된 RegionSTO 프록시(ERC-1967 UUPS)로 배포.
 *         - 모든 프록시는 동일한 RegionSTO implementation을 공유.
 *         - deployAllRegions()으로 17개 전체 일괄 배포 지원.
 *
 * @dev Phase 3 컨트랙트. UUPS 업그레이드 가능.
 *      StationRegistry 주소를 저장하여 각 RegionSTO에 전달.
 */
interface IRegionSTOFactory {
    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice 지역 토큰이 배포되었을 때 emit.
    event RegionDeployed(
        bytes4  indexed regionId,
        address indexed tokenAddress,
        string  name,
        string  symbol
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Mutative Functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice 단일 지역 토큰 배포.
     *
     * @dev Admin-only. RegionSTO impl → EnergyFiProxy → initialize 순서로 배포.
     *      이미 배포된 지역은 revert.
     *
     * @param regionId  ISO 3166-2:KR bytes4 지역 코드 (e.g. 0x4B523131 = "KR11")
     * @param name      토큰 이름 (e.g. "EnergyFi Seoul STO")
     * @param symbol    토큰 심볼 (e.g. "EFI-KR11")
     * @return tokenAddress 배포된 RegionSTO 프록시 주소
     */
    function deployRegion(
        bytes4 regionId,
        string calldata name,
        string calldata symbol
    ) external returns (address tokenAddress);

    /**
     * @notice 17개 전체 지역 일괄 배포.
     *
     * @dev Admin-only. 내부적으로 deployRegion()을 17번 호출.
     *      이미 배포된 지역이 있으면 revert.
     */
    function deployAllRegions() external;

    // ─────────────────────────────────────────────────────────────────────────
    // View Functions
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice RegionSTO implementation 주소.
    function regionSTOImpl() external view returns (address);

    /// @notice StationRegistry 주소.
    function stationRegistry() external view returns (address);

    /// @notice 지역 코드로 배포된 토큰 주소 조회. 미배포 시 address(0).
    function getRegionToken(bytes4 regionId) external view returns (address);

    /// @notice 배포된 모든 지역 코드 목록.
    function getAllRegionIds() external view returns (bytes4[] memory);

    /// @notice 배포된 지역 수.
    function getRegionCount() external view returns (uint256);
}
