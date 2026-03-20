/**
 * Phase 1 + Phase 2 공유 유틸리티
 * UUID↔bytes32 변환, 포맷팅 함수
 */

import { decodeBytes32String } from "ethers";

/** UUID → bytes32 (접두사 제거 + 하이픈 제거 → hex → zero-padding) */
export function uuidToBytes32(uuid: string): string {
  const withoutPrefix = uuid.replace(/^[a-z]+_/, "");
  const hex = withoutPrefix.replace(/-/g, "");
  return "0x" + hex.padEnd(64, "0");
}

/** bytes32 → UUID (상위 16바이트 추출 → 하이픈 삽입) */
export function bytes32ToUuid(bytes32: string, prefix?: string): string {
  const hex = bytes32.slice(2, 34);
  const uuid = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  return prefix ? `${prefix}_${uuid}` : uuid;
}

/** regionCode → bytes4 */
export function regionBytes4(code: string): string {
  const buf = Buffer.from(code, "ascii");
  return "0x" + buf.toString("hex").padEnd(8, "0");
}

/** bytes32 → 사람이 읽을 수 있는 문자열 */
export function safeDecodeB32(hex: string): string {
  try {
    return decodeBytes32String(hex);
  } catch {
    return hex;
  }
}

/** kWh 포맷 (678 → "6.78 kWh") */
export function formatKwh(scaledKwh: bigint): string {
  const whole = scaledKwh / 100n;
  const frac = scaledKwh % 100n;
  return `${whole}.${String(frac).padStart(2, "0")} kWh`;
}

/** KRW 포맷 (13560 → "13,560원") */
export function formatKrw(amount: bigint): string {
  return `${Number(amount).toLocaleString("ko-KR")}원`;
}

/** period 포맷 (202606 → "2026년 6월") */
export function formatPeriod(period: number): string {
  const year = Math.floor(period / 100);
  const month = period % 100;
  return `${year}년 ${month}월`;
}

/** endTimestamp → period_yyyyMM (오프체인 계산) */
export function calculatePeriod(endTimestamp: number | bigint): number {
  const date = new Date(Number(endTimestamp) * 1000);
  return date.getFullYear() * 100 + (date.getMonth() + 1);
}

/** 현재 period_yyyyMM */
export function currentPeriod(): number {
  const now = new Date();
  return now.getFullYear() * 100 + (now.getMonth() + 1);
}
