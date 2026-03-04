# Refactor Specification — Enterprise-Grade Hardening

This document is the **shared contract** between the Implementation Agent (contracts) and Test Agent (tests).
Both agents MUST follow this specification exactly.

---

## Change Summary

| ID | Change | Severity | Affected Contracts |
|:---|:---|:---|:---|
| R01 | Storage gap 추가 | Critical | CT, CR, RT |
| R02 | DeviceRegistry UUPS 전환 | Critical | DR |
| R03 | StationRegistry UUPS 전환 | Critical | SR |
| R04 | Pausable 추가 | Critical | DR, SR, CT, CR, RT |
| R05 | Bridge/Router 주소 rotation | High | CT, CR, RT |
| R06 | onlyBridge 공통 base contract | High | CT, CR, RT |
| R07 | 입력 검증 보강 | Medium | SR |
| R08 | getSession tokenId 존재 검증 | Medium | CT |
| R09 | `_verifySecp256k1` pure→view | Low | DR |
| R10 | UUPS init 호출 추가 | Low | CT, CR, RT |

---

## Abbreviations

- DR = DeviceRegistry
- SR = StationRegistry
- CT = ChargeTransaction
- CR = ChargeRouter
- RT = RevenueTracker

---

## R01: Storage Gap

All UUPS upgradeable contracts MUST include a storage gap at the end of their storage section.

```solidity
// At the end of each UUPS contract's storage declarations:
uint256[50] private __gap;
```

Applies to: CT, CR, RT (already UUPS), and DR, SR (after R02/R03 conversion).

---

## R02: DeviceRegistry UUPS 전환

### Before
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";
contract DeviceRegistry is AccessControl, IDeviceRegistry {
    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }
}
```

### After
```solidity
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract DeviceRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IDeviceRegistry
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
```

### Deployment Pattern (Tests)
```typescript
// Before
const DR = await ethers.getContractFactory("DeviceRegistry");
const dr = await DR.deploy(admin.address);

// After
const DRImpl = await ethers.getContractFactory("DeviceRegistry");
const drImpl = await DRImpl.deploy();
await drImpl.waitForDeployment();
const EnergyFiProxy = await ethers.getContractFactory("EnergyFiProxy");
const drProxy = await EnergyFiProxy.deploy(await drImpl.getAddress(), "0x");
await drProxy.waitForDeployment();
const dr = await ethers.getContractAt("DeviceRegistry", await drProxy.getAddress());
await dr.initialize(admin.address);
```

### Interface Change: NONE
`IDeviceRegistry.sol` remains unchanged.

---

## R03: StationRegistry UUPS 전환

### Before
```solidity
import "@openzeppelin/contracts/access/AccessControl.sol";
contract StationRegistry is AccessControl, IStationRegistry {
    constructor(address admin, address _deviceRegistry) { ... }
}
```

### After
```solidity
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

contract StationRegistry is
    Initializable,
    AccessControlUpgradeable,
    UUPSUpgradeable,
    IStationRegistry
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() { _disableInitializers(); }

    function initialize(address admin, address _deviceRegistry) external initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        deviceRegistry = IDeviceRegistry(_deviceRegistry);
    }

    function _authorizeUpgrade(address) internal override onlyRole(DEFAULT_ADMIN_ROLE) {}
}
```

### Deployment Pattern (Tests)
```typescript
const SRImpl = await ethers.getContractFactory("StationRegistry");
const srImpl = await SRImpl.deploy();
await srImpl.waitForDeployment();
const srProxy = await EnergyFiProxy.deploy(await srImpl.getAddress(), "0x");
await srProxy.waitForDeployment();
const sr = await ethers.getContractAt("StationRegistry", await srProxy.getAddress());
await sr.initialize(admin.address, await dr.getAddress());
```

### Interface Change: NONE

---

## R04: Pausable 추가

All 5 contracts add `PausableUpgradeable` (for UUPS) with `whenNotPaused` on core mutating functions.

### New Imports
```solidity
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
```

### Inheritance
Each contract adds `PausableUpgradeable` to its inheritance list.

### Initialize
Each contract adds `__Pausable_init();` in its `initialize()`.

### New Functions (all 5 contracts)
```solidity
function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }
```

### `whenNotPaused` Modifier Applied To

| Contract | Functions |
|:---|:---|
| DR | `enrollChip()`, `revokeChip()` |
| SR | `registerCPO()`, `deactivateCPO()`, `registerStation()`, `deactivateStation()`, `registerCharger()`, `deactivateCharger()` |
| CT | `mint()` |
| CR | `processCharge()` |
| RT | `recordRevenue()`, `claim()` |

### Events
`Paused(address account)` and `Unpaused(address account)` are inherited from OpenZeppelin — no custom events needed.

### Error
`EnforcedPause()` is the OZ custom error when calling a `whenNotPaused` function while paused.
`ExpectedPause()` is the OZ custom error when calling a `whenPaused` function while unpaused.

### Test Cases Required
For each contract:
1. `pause()` by admin → success, emits `Paused` event
2. `pause()` by non-admin → revert (AccessControl)
3. Core function while paused → revert `EnforcedPause`
4. `unpause()` → core function works again
5. View functions still work while paused (no whenNotPaused on views)

---

## R05: Bridge/Router Address Rotation

### Affected Contracts: CT, CR, RT

### New Event
```solidity
event BridgeAddressUpdated(address indexed oldAddress, address indexed newAddress);
```

### New Function
```solidity
function updateBridgeAddress(address newBridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (newBridge == address(0)) revert ZeroAddress();
    address old = bridgeAddress;
    bridgeAddress = newBridge;
    emit BridgeAddressUpdated(old, newBridge);
}
```

Note: In CT and RT, the "bridge" is actually the ChargeRouter proxy address. The function name `updateBridgeAddress` is used consistently across all three contracts for simplicity, even though CT/RT's `bridgeAddress` points to ChargeRouter.

### Test Cases Required
1. Admin calls `updateBridgeAddress(newAddr)` → success, event emitted
2. Non-admin calls → revert (AccessControl)
3. `updateBridgeAddress(address(0))` → revert `ZeroAddress`
4. After update, old bridge address cannot call → revert `CallerNotBridge`
5. After update, new bridge address can call → success

---

## R06: onlyBridge 공통 Base Contract

### New File: `contracts/base/BridgeGuarded.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

abstract contract BridgeGuarded is Initializable {
    address public bridgeAddress;

    error CallerNotBridge();
    error ZeroAddress();

    event BridgeAddressUpdated(address indexed oldAddress, address indexed newAddress);

    modifier onlyBridge() {
        if (msg.sender != bridgeAddress) revert CallerNotBridge();
        _;
    }

    function __BridgeGuarded_init(address _bridgeAddress) internal onlyInitializing {
        if (_bridgeAddress == address(0)) revert ZeroAddress();
        bridgeAddress = _bridgeAddress;
    }

    // R05: rotation function — must be called with access control in the inheriting contract
    function _updateBridgeAddress(address newBridge) internal {
        if (newBridge == address(0)) revert ZeroAddress();
        address old = bridgeAddress;
        bridgeAddress = newBridge;
        emit BridgeAddressUpdated(old, newBridge);
    }
}
```

### Usage in CT, CR, RT
```solidity
contract ChargeRouter is ..., BridgeGuarded, ... {
    function initialize(..., address _bridgeAddress, ...) external initializer {
        ...
        __BridgeGuarded_init(_bridgeAddress);
    }

    function updateBridgeAddress(address newBridge) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _updateBridgeAddress(newBridge);
    }
}
```

### Impact
- CT, CR, RT remove their local `bridgeAddress`, `CallerNotBridge`, `ZeroAddress` (where it relates to bridge), and `onlyBridge` modifier
- These are inherited from `BridgeGuarded`
- `ZeroAddress` error for non-bridge zero checks (e.g., initialize params) should remain in the contract or use a different error name like `ZeroInitAddress`

### Test Impact
- No behavioral change — same function names, same errors
- Tests should verify `BridgeGuarded` behavior through the concrete contracts

---

## R07: 입력 검증 보강 (StationRegistry)

### registerCPO — New Validations

```solidity
error ZeroWalletAddress();
error EmptyName();

function registerCPO(...) external onlyRole(ADMIN_ROLE) whenNotPaused {
    if (walletAddress == address(0)) revert ZeroWalletAddress();
    if (bytes(name).length == 0) revert EmptyName();
    // ... existing logic
}
```

### Test Cases Required
1. `registerCPO(cpoId, address(0), "name")` → revert `ZeroWalletAddress`
2. `registerCPO(cpoId, wallet, "")` → revert `EmptyName`

---

## R08: getSession tokenId 존재 검증 (ChargeTransaction)

### New Error
```solidity
error SessionNotFound(uint256 tokenId);
```

### Changed Behavior
```solidity
function getSession(uint256 tokenId) external view returns (ChargeSession memory) {
    if (_sessions[tokenId].sessionId == bytes32(0)) revert SessionNotFound(tokenId);
    return _sessions[tokenId];
}
```

### Test Cases Required
1. `getSession(999)` (non-existent) → revert `SessionNotFound(999)`
2. `getSession(1)` after mint → returns correct data (existing test, unchanged)

### BREAKING CHANGE
Existing test `ChargeTransaction.test.ts:344-350` tests for empty struct return.
This test MUST be changed to test for revert instead.

---

## R09: `_verifySecp256k1` pure → view

### Before
```solidity
function _verifySecp256k1(...) private pure returns (bool) {
```

### After
```solidity
function _verifySecp256k1(...) private view returns (bool) {
```

### Test Impact: NONE
External behavior unchanged. No test changes needed.

---

## R10: __UUPSUpgradeable_init() 호출 추가

All UUPS contracts add `__UUPSUpgradeable_init();` in their `initialize()` function.

Applies to: DR (after R02), SR (after R03), CT, CR, RT.

### Test Impact: NONE
No behavioral change.

---

## Deployment Order (for tests)

All test `beforeEach` blocks must follow this deployment order:

```
1. DeviceRegistry     (UUPS proxy + initialize)
2. StationRegistry    (UUPS proxy + initialize, needs DR address)
3. ChargeTransaction  (UUPS proxy + initialize, needs DR + SR addresses)
4. RevenueTracker     (UUPS proxy + initialize, needs SR address)
5. ChargeRouter       (UUPS proxy + initialize, needs CT + RT addresses)
6. CT.updateBridgeAddress(CR proxy)  — CT's bridge = ChargeRouter
7. RT.updateBridgeAddress(CR proxy)  — RT's bridge = ChargeRouter
```

Note: Steps 6-7 are needed in ChargeRouter tests where CT/RT bridge must point to CR.
In standalone CT/RT tests, bridge = admin for simplicity.

---

## Helper Function Suggestion (for test reuse)

```typescript
async function deployUUPSProxy(
  ethers: any,
  contractName: string,
): Promise<{ impl: any; proxy: any; contract: any }> {
  const Factory = await ethers.getContractFactory(contractName);
  const impl = await Factory.deploy();
  await impl.waitForDeployment();

  const EnergyFiProxy = await ethers.getContractFactory("EnergyFiProxy");
  const proxy = await EnergyFiProxy.deploy(await impl.getAddress(), "0x");
  await proxy.waitForDeployment();

  const contract = await ethers.getContractAt(contractName, await proxy.getAddress());
  return { impl, proxy, contract };
}
```

---

## Interface Files — NO CHANGES

All 5 interface files remain unchanged:
- `IDeviceRegistry.sol` — no changes
- `IStationRegistry.sol` — no changes
- `IChargeTransaction.sol` — no changes
- `IChargeRouter.sol` — no changes
- `IRevenueTracker.sol` — no changes

New functions (`pause`, `unpause`, `updateBridgeAddress`) are admin-only and do NOT need interface exposure.
`SessionNotFound` error is on the concrete contract, not the interface.

---

## T01–T04: Test Quality Requirements (기존 테스트 분석 기반)

These are gaps identified in the existing test suites that MUST be addressed in this refactoring.
The Test Agent must incorporate these into the unit test files.

---

### T01: 데이터 정합성 교차 검증 (Priority: HIGH)

Currently, each test verifies data in isolation. Cross-validation that "total = sum of parts" is missing.

#### Required Test Cases

**RevenueTracker:**
1. **CPO 총수익 = 소속 충전소 수익 합** — `getCPORevenue(cpo).accumulated == sum(getStationRevenue(stn).accumulated)` for all stations under that CPO
2. **EnergyFi 지역 수익 = 소속 충전소 수익 합** — `getEnergyFiRegionRevenue(region) == sum(pending)` for all EF stations in that region
3. **정산 후 교차 검증** — After claim, verify `getCPORevenue().settled == sum(getStationRevenue().settled)` AND `getCPORevenue().pending == 0` AND each station `pending == 0`

**ChargeTransaction:**
4. **totalSessions == 실제 mint 횟수** — After N mints, `totalSessions() == N` AND `getTokenIdBySessionId()` returns valid ID for each session AND `getSession(id)` returns correct data for each

**StationRegistry:**
5. **getStationsByCPO 정합성** — After registering N stations under CPO, `getStationsByCPO(cpo).length == N` AND each station's `getStation().cpoId == cpo`
6. **getStationsByRegion vs getEnergyFiStationsByRegion** — EF stations in region must be a subset of all stations in region

---

### T02: 월경계 정산 독립성 (Priority: HIGH)

Current tests verify monthly revenue recording but NOT that claim() is independent across periods.

#### Required Test Cases

1. **월 A 세션 + 월 B 세션 → claim → 양쪽 다 정산됨 확인** — claim() settles ALL pending regardless of period. Verify this is the intended behavior by checking both months' stations are settled.
2. **claim 후 새 월 수익 추가 → 기존 정산 불변** — After claim(period_A), add revenue for period_B. Verify `settled` amount is unchanged, `pending` only includes new revenue.
3. **다중 CPO 독립 정산** — CPO_1 claim does not affect CPO_2's pending/accumulated/settled.
4. **EnergyFi 충전소는 claim 대상 아님** — EnergyFi-owned station의 수익은 CPO claim으로 정산되지 않음을 확인. After recording revenue for both CPO and EF stations, claim(cpo) only settles CPO stations.

---

### T03: 접근 제어 전면 검증 (Priority: HIGH)

Current unit tests cover some access control but not comprehensively. After refactoring, EVERY protected function must have an explicit non-admin/non-bridge rejection test.

#### Complete Access Control Matrix (ALL must be tested)

**onlyRole(ADMIN_ROLE):**
| Contract | Function | Test: non-admin call → revert |
|:---|:---|:---|
| DR | `enrollChip()` | Required |
| DR | `revokeChip()` | Required |
| SR | `registerCPO()` | Required |
| SR | `deactivateCPO()` | Required |
| SR | `registerStation()` | Required |
| SR | `deactivateStation()` | Required |
| SR | `registerCharger()` | Required |
| SR | `deactivateCharger()` | Required |

**onlyBridge (via BridgeGuarded):**
| Contract | Function | Test: non-bridge call → revert `CallerNotBridge` |
|:---|:---|:---|
| CT | `mint()` | Required |
| CR | `processCharge()` | Required |
| RT | `recordRevenue()` | Required |

**onlyRole(DEFAULT_ADMIN_ROLE):**
| Contract | Function | Test: non-admin call → revert |
|:---|:---|:---|
| RT | `claim()` | Required |
| DR | `pause()` / `unpause()` | Required (new R04) |
| SR | `pause()` / `unpause()` | Required (new R04) |
| CT | `pause()` / `unpause()` | Required (new R04) |
| CR | `pause()` / `unpause()` | Required (new R04) |
| RT | `pause()` / `unpause()` | Required (new R04) |
| DR | `updateBridgeAddress()` | N/A (DR has no bridge) |
| CT | `updateBridgeAddress()` | Required (new R05) |
| CR | `updateBridgeAddress()` | Required (new R05) |
| RT | `updateBridgeAddress()` | Required (new R05) |
| ALL UUPS | `upgradeToAndCall()` | Required |

---

### T04: UUPS 업그레이드 데이터 보존 (Priority: MEDIUM)

After R02/R03, DR and SR become UUPS upgradeable. They need the same upgrade tests that CT/CR/RT already have.

#### Required Test Cases (for DR and SR — new)

**DeviceRegistry:**
1. Admin upgrade → success (deploy v2 impl, upgradeToAndCall)
2. Non-admin upgrade → revert
3. Upgrade 후 기존 enrolled chip data 보존 — `isActiveChip()` still returns true, `verifySignature()` still works, `getChipRecord()` returns same data
4. Upgrade 후 새 enrollChip 정상 동작

**StationRegistry:**
1. Admin upgrade → success
2. Non-admin upgrade → revert
3. Upgrade 후 기존 CPO/Station/Charger data 보존 — `getCPO()`, `getStation()`, `getCharger()` return same data, index arrays preserved
4. Upgrade 후 새 registrations 정상 동작

---

### T05: View 함수 커버리지 강화 (Priority: MEDIUM)

Some view functions lack thorough testing.

#### Required Test Cases

**DeviceRegistry:**
1. `getChargerByPubkey()` after enroll → returns correct chargerId
2. `getChargerByPubkey()` after revoke → returns bytes32(0)
3. `getChipRecord()` all fields verified (publicKey, publicKeyHash, algorithm, enrolledAt, active)

**ChargeTransaction:**
1. `getTokenIdBySessionId()` after mint → returns correct tokenId
2. `getTokenIdBySessionId()` for unknown sessionId → returns 0
3. `totalSessions()` 초기값 = 0, mint 후 증가 확인

**RevenueTracker:**
1. `getMonthlyHistory()` — 다중 월 기록 후 배열 길이, 각 항목의 period/amount 검증
2. `getSettlementHistory()` — 다중 정산 후 배열 길이, 각 항목의 period/amount/settledAt 검증
3. `getStationRevenuePeriod()` — 미기록 기간 = 0

**StationRegistry:**
1. `isRegistered()` — true for registered, false for unknown
2. `getStationOwner()` — CPO returns (CPO, wallet), ENERGYFI returns (ENERGYFI, address(0))
3. `getChargersByStation()` — after register/deactivate, array reflects active chargers only

---

### Test Case Count Estimate

| Source | New Cases | Notes |
|:---|:---|:---|
| R01-R10 (refactoring) | ~45 | Pausable, bridge rotation, input validation, UUPS, etc. |
| T01 (데이터 정합성) | ~6 | Cross-validation |
| T02 (월경계 정산) | ~4 | Period independence |
| T03 (접근 제어) | ~8 | Comprehensive access control (some already exist) |
| T04 (UUPS DR/SR) | ~8 | New for DR and SR |
| T05 (View 커버리지) | ~12 | Some already exist, strengthen |
| **Total new** | **~83** | On top of existing ~156 unit tests |

Note: Many T03/T05 tests may already exist in the current suite. The Test Agent should CHECK existing tests before adding duplicates. If an existing test already covers the scenario, keep it (with deployment pattern update). Only ADD new tests for genuinely missing coverage.

---

## File Change Map

### Implementation Agent — Files to Modify/Create
| File | Action |
|:---|:---|
| `contracts/base/BridgeGuarded.sol` | **CREATE** |
| `contracts/DeviceRegistry.sol` | MODIFY (R02, R04, R09, R10) |
| `contracts/StationRegistry.sol` | MODIFY (R03, R04, R07) |
| `contracts/ChargeTransaction.sol` | MODIFY (R01, R04, R05, R06, R08, R10) |
| `contracts/ChargeRouter.sol` | MODIFY (R01, R04, R05, R06, R10) |
| `contracts/RevenueTracker.sol` | MODIFY (R01, R04, R05, R06, R10) |

### Test Agent — Files to Modify
| File | Action |
|:---|:---|
| `test/helpers.ts` | MODIFY (add `deployUUPSProxy` helper) |
| `test/DeviceRegistry.test.ts` | MODIFY (deployment + new tests) |
| `test/StationRegistry.test.ts` | MODIFY (deployment + new tests) |
| `test/ChargeTransaction.test.ts` | MODIFY (deployment + fix breaking test + new tests) |
| `test/ChargeRouter.test.ts` | MODIFY (deployment + new tests) |
| `test/RevenueTracker.test.ts` | MODIFY (deployment + new tests) |

---

*End of Specification*
