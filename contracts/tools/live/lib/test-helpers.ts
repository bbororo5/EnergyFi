/**
 * 공통 테스트 헬퍼 — 모든 스위트에서 import
 */

import { ethers } from "ethers";
import {
  ChargeRouter__factory,
  ChargeTransaction__factory,
  RevenueTracker__factory,
  DeviceRegistry__factory,
  StationRegistry__factory,
  BridgeGuarded__factory,
} from "../../../typechain-types/index.js";

// ── Types ────────────────────────────────────────────────────────────────────

export type Kind = "happy" | "reject" | "verify" | "edge";

export type SuiteResult = {
  suiteId: string;
  label: string;
  passed: number;
  failed: number;
  gaps: number;
};

export type VerifyEvent =
  | { type: "suite-start"; suiteId: string; label: string; caseCount: number }
  | { type: "suite-end"; suiteId: string; passed: number; failed: number; gaps: number }
  | { type: "case-start"; label: string; kind: Kind }
  | { type: "pass"; label: string; kind: Kind }
  | { type: "fail"; label: string; reason: string; kind: Kind; logs?: string[] }
  | { type: "gap"; label: string; detail: string }
  | { type: "setup-ok"; label: string }
  | { type: "summary"; totalPassed: number; totalFailed: number; totalGaps: number; suiteResults: SuiteResult[] }
  | { type: "done" };

export type EmitFn = (event: VerifyEvent) => void;
export type Counts = { passed: number; failed: number; gaps: number };

type TxResult = { wait: () => Promise<unknown> };

// ── Encode Helpers ───────────────────────────────────────────────────────────

export function b32(s: string): string {
  return ethers.encodeBytes32String(s);
}

export function regionBytes4(code: string): string {
  const buf = Buffer.from(code.padEnd(4, "\0").slice(0, 4), "ascii");
  return "0x" + buf.toString("hex");
}

export function randomPubKey(len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = Math.floor(Math.random() * 256);
  return bytes;
}

// ── Error Decoding ───────────────────────────────────────────────────────────

/**
 * ethers v6 에러에서 revert data 추출
 * err.data, err.info.error.data, 또는 에러 메시지의 data="0x..." 패턴 탐색
 */
export function extractRevertData(err: unknown): string {
  // 1) err.data 직접 접근
  const directData = (err as { data?: string })?.data;
  if (directData && directData.length >= 10) return directData;

  // 2) err.info.error.data (ethers v6 estimateGas 에러)
  const infoData = (err as { info?: { error?: { data?: string } } })?.info?.error?.data;
  if (infoData && infoData.length >= 10) return infoData;

  // 3) err.error.data (nested error)
  const nestedData = (err as { error?: { data?: string } })?.error?.data;
  if (nestedData && nestedData.length >= 10) return nestedData;

  // 4) err.error.error.data (double nested)
  const doubleNestedData = (err as { error?: { error?: { data?: string } } })?.error?.error?.data;
  if (doubleNestedData && doubleNestedData.length >= 10) return doubleNestedData;

  // 5) err.revert.data (ethers v6 CALL_EXCEPTION)
  const revertData = (err as { revert?: { args?: unknown[] } })?.revert;
  // revert field might have decoded info but not raw data

  // 6) 에러 메시지에서 data="0x..." 추출
  const msg = String(err);
  const dataMatch = msg.match(/data="(0x[0-9a-fA-F]+)"/);
  if (dataMatch) return dataMatch[1];

  // 7) error body에서 추출 (JsonRpc 에러)
  const bodyMatch = msg.match(/"data"\s*:\s*"(0x[0-9a-fA-F]+)"/);
  if (bodyMatch) return bodyMatch[1];

  // 8) data: "0x..." (다른 JSON 형식)
  const colonMatch = msg.match(/data:\s*"(0x[0-9a-fA-F]+)"/);
  if (colonMatch) return colonMatch[1];

  return "";
}

export function decodeCustomError(ifaces: ethers.Interface[], data: string): string | null {
  if (!data || data.length < 10) return null;

  // Error(string) — require 메시지 디코딩 (selector: 0x08c379a0)
  if (data.startsWith("0x08c379a0")) {
    try {
      const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["string"], "0x" + data.slice(10));
      return decoded[0] as string;
    } catch { /* fallthrough */ }
  }

  // Panic(uint256) — assert/overflow 디코딩 (selector: 0x4e487b71)
  if (data.startsWith("0x4e487b71")) {
    return "Panic";
  }

  // Custom error 디코딩
  for (const iface of ifaces) {
    try {
      const parsed = iface.parseError(data);
      if (parsed) return parsed.name;
    } catch {
      // selector not in this interface — try next
    }
  }
  return null;
}

// ── Test Helpers ─────────────────────────────────────────────────────────────

export async function expectRevert(
  label:    string,
  txFn:     () => Promise<unknown>,
  expected: string,
  ifaces:   ethers.Interface[],
  emit:     EmitFn,
  counts:   Counts,
  kind:     Kind = "reject",
): Promise<void> {
  emit({ type: "case-start", label, kind });
  try {
    const res = await txFn();
    if (res && typeof (res as TxResult).wait === "function") {
      await (res as TxResult).wait();
    }
    counts.failed++;
    emit({ type: "fail", label, reason: "revert 예상이었으나 성공함", kind });
  } catch (err: unknown) {
    const errData = extractRevertData(err);
    const decodedName = decodeCustomError(ifaces, errData);

    if (decodedName === expected || decodedName?.includes(expected)) {
      counts.passed++;
      emit({ type: "pass", label, kind });
      return;
    }

    // ethers v6 CALL_EXCEPTION: reason 필드 직접 확인
    const reason = (err as { reason?: string })?.reason;
    if (reason && reason.includes(expected)) {
      counts.passed++;
      emit({ type: "pass", label, kind });
      return;
    }

    // ethers v6 shortMessage 필드 확인
    const shortMsg = (err as { shortMessage?: string })?.shortMessage;
    if (shortMsg && shortMsg.includes(expected)) {
      counts.passed++;
      emit({ type: "pass", label, kind });
      return;
    }

    const errStr = [
      (err as Error)?.message ?? "",
      reason ?? "",
      shortMsg ?? "",
      String(err),
    ].join(" ");

    if (errStr.includes(expected)) {
      counts.passed++;
      emit({ type: "pass", label, kind });
      return;
    }

    const actual = decodedName ?? reason ?? "알 수 없음";
    counts.failed++;
    emit({ type: "fail", label, reason: `예상 "${expected}", 실제 "${actual}"`, kind,
      logs: [String(err).slice(0, 500)] });
  }
}

export async function expectGap(
  label:   string,
  detail:  string,
  txFn:    () => Promise<unknown>,
  emit:    EmitFn,
  counts:  Counts,
): Promise<void> {
  emit({ type: "case-start", label, kind: "verify" });
  try {
    const res = await txFn();
    if (res && typeof (res as TxResult).wait === "function") {
      await (res as TxResult).wait();
    }
    counts.gaps++;
    emit({ type: "gap", label, detail });
  } catch (err: unknown) {
    counts.gaps++;
    emit({ type: "gap", label, detail: `${detail} (예상과 달리 revert: ${String(err).slice(0, 80)})` });
  }
}

export async function setup(
  label:   string,
  txFn:    () => Promise<unknown>,
  emit:    EmitFn,
  counts:  Counts,
): Promise<boolean> {
  try {
    const res = await txFn();
    if (res && typeof (res as TxResult).wait === "function") {
      await (res as TxResult).wait();
    }
    emit({ type: "setup-ok", label });
    return true;
  } catch (err: unknown) {
    counts.failed++;
    emit({ type: "fail", label: `[전제조건] ${label}`, reason: String(err).slice(0, 200), kind: "happy" });
    return false;
  }
}

/** 성공 기대 + 결과 반환 */
export async function expectSuccess(
  label:   string,
  txFn:    () => Promise<unknown>,
  emit:    EmitFn,
  counts:  Counts,
  kind:    Kind = "happy",
): Promise<any> {
  emit({ type: "case-start", label, kind });
  try {
    const res = await txFn();
    if (res && typeof (res as TxResult).wait === "function") {
      const receipt = await (res as TxResult).wait();
      counts.passed++;
      emit({ type: "pass", label, kind });
      return receipt;
    }
    counts.passed++;
    emit({ type: "pass", label, kind });
    return res;
  } catch (err: unknown) {
    counts.failed++;
    emit({ type: "fail", label, reason: String(err).slice(0, 200), kind, logs: [String(err)] });
    return null;
  }
}

/** view 함수 결과 검증 */
export async function expectValue(
  label:    string,
  queryFn:  () => Promise<unknown>,
  check:    (result: any) => boolean | string,
  emit:     EmitFn,
  counts:   Counts,
  kind:     Kind = "verify",
): Promise<void> {
  emit({ type: "case-start", label, kind });
  try {
    const result = await queryFn();
    const checkResult = check(result);
    if (checkResult === true) {
      counts.passed++;
      emit({ type: "pass", label, kind });
    } else {
      const reason = typeof checkResult === "string" ? checkResult : "검증 실패";
      counts.failed++;
      emit({ type: "fail", label, reason, kind });
    }
  } catch (err: unknown) {
    counts.failed++;
    emit({ type: "fail", label, reason: String(err).slice(0, 200), kind, logs: [String(err)] });
  }
}

/** revert 에러에서 에러 이름 추출 (expectRevert 내부 로직 재사용) */
export function extractErrorName(err: unknown, ifaces: ethers.Interface[]): string | null {
  const errData = extractRevertData(err);
  const decoded = decodeCustomError(ifaces, errData);
  if (decoded) return decoded;

  const reason = (err as { reason?: string })?.reason;
  if (reason) return reason;

  const shortMsg = (err as { shortMessage?: string })?.shortMessage;
  if (shortMsg) return shortMsg;

  return null;
}

/** 새로운 Counts 생성 */
export function newCounts(): Counts {
  return { passed: 0, failed: 0, gaps: 0 };
}

// ── Concrete Error Interfaces ────────────────────────────────────────────────

/**
 * 모든 concrete 컨트랙트의 Interface를 반환 — custom error 디코딩용.
 *
 * Interface ABI (I*.sol)에는 custom error 선언이 없으므로
 * expectRevert / extractErrorName에서 에러를 디코딩하려면
 * concrete 컨트랙트 ABI가 필요하다.
 *
 * 포함: BridgeGuarded(CallerNotBridge, ZeroAddress),
 *       ChargeTransaction(SoulboundToken, DuplicateSession, StationNotRegistered, ChipNotActive, InvalidSESignature, SessionNotFound),
 *       RevenueTracker(StationNotRegistered, ZeroAmount, ...),
 *       ChargeRouter(BridgeGuarded 상속), DeviceRegistry, StationRegistry
 */
let _cachedErrorIfaces: ethers.Interface[] | null = null;

export function allErrorInterfaces(): ethers.Interface[] {
  if (!_cachedErrorIfaces) {
    _cachedErrorIfaces = [
      ChargeRouter__factory.createInterface(),
      ChargeTransaction__factory.createInterface(),
      RevenueTracker__factory.createInterface(),
      DeviceRegistry__factory.createInterface(),
      StationRegistry__factory.createInterface(),
      BridgeGuarded__factory.createInterface(),
    ];
  }
  return _cachedErrorIfaces;
}

/**
 * ChargeRouter concrete Interface — ChargeProcessed 이벤트 파싱용.
 * IChargeRouter에는 ChargeProcessed 이벤트 선언이 없으므로
 * cr.interface.parseLog()로는 이벤트를 파싱할 수 없다.
 */
let _cachedCRInterface: ethers.Interface | null = null;

export function chargeRouterConcreteInterface(): ethers.Interface {
  if (!_cachedCRInterface) {
    _cachedCRInterface = ChargeRouter__factory.createInterface();
  }
  return _cachedCRInterface!;
}
