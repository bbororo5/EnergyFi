/**
 * SSE 스트림 엔드포인트 + 온체인 이벤트 리스너
 * GET /events — 실시간 온체인 이벤트 브로드캐스트
 */

import { Router } from "express";
import type { Response } from "express";
import type { ContractCtx } from "../server.js";
import { safeDecodeB32 } from "../lib/utils.js";

const sseClients: Set<Response> = new Set();

/** 모든 SSE 클라이언트에 이벤트 전송 */
function broadcast(event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    client.write(payload);
  }
}

/** 온체인 이벤트 리스너 등록 (Phase 2 컨트랙트 존재 시) */
export function setupEventListeners(ctx: ContractCtx) {
  if (!ctx.chargeTransaction || !ctx.revenueTracker) return;

  // ChargeSessionRecorded
  ctx.chargeTransaction.on(
    "ChargeSessionRecorded",
    async (tokenId, sessionId, chargerId, stationId, gridRegionCode, energyKwh, distributableKrw, startTimestamp, endTimestamp) => {
      // StationRegistry에서 메타데이터 조회
      let cpoId = "";
      let ownerType = "CPO";
      let regionId = "";
      try {
        const station = await ctx.stationRegistry.getStation(stationId);
        cpoId = station.cpoId;
        ownerType = station.ownerType === 0n ? "CPO" : "ENERGYFI";
        regionId = station.regionId;
      } catch { /* station lookup 실패 시 기본값 */ }

      broadcast("session", {
        tokenId: tokenId.toString(),
        sessionId,
        chargerId,
        stationId,
        stationName: safeDecodeB32(stationId),
        gridRegionCode,
        cpoId,
        ownerType,
        regionId,
        energyKwh: energyKwh.toString(),
        distributableKrw: distributableKrw.toString(),
        startTimestamp: startTimestamp.toString(),
        endTimestamp: endTimestamp.toString(),
        timestamp: Date.now(),
      });
    }
  );

  // RevenueRecorded
  ctx.revenueTracker.on(
    "RevenueRecorded",
    async (stationId, distributableKrw, accumulated, period_yyyyMM) => {
      let ownerType = "CPO";
      let regionId = "";
      try {
        const station = await ctx.stationRegistry.getStation(stationId);
        ownerType = station.ownerType === 0n ? "CPO" : "ENERGYFI";
        regionId = station.regionId;
      } catch { /* fallback */ }

      broadcast("revenue", {
        stationId,
        stationName: safeDecodeB32(stationId),
        ownerType,
        regionId,
        distributableKrw: distributableKrw.toString(),
        accumulated: accumulated.toString(),
        period: period_yyyyMM.toString(),
        timestamp: Date.now(),
      });
    }
  );

  // SettlementRecorded
  ctx.revenueTracker.on(
    "SettlementRecorded",
    (stationId, cpoId, amount, period_yyyyMM, settledAt) => {
      broadcast("settlement", {
        stationId,
        cpoId,
        amount: amount.toString(),
        period: period_yyyyMM.toString(),
        settledAt: settledAt.toString(),
        timestamp: Date.now(),
      });
    }
  );

  // CPOClaimed
  ctx.revenueTracker.on(
    "CPOClaimed",
    (cpoId, totalAmount, period_yyyyMM, claimedAt) => {
      broadcast("claim", {
        cpoId,
        totalAmount: totalAmount.toString(),
        period: period_yyyyMM.toString(),
        claimedAt: claimedAt.toString(),
        timestamp: Date.now(),
      });
    }
  );

  console.log("  SSE 이벤트 리스너 등록 완료 (ChargeSessionRecorded, RevenueRecorded, SettlementRecorded, CPOClaimed)");
}

export function buildEventsRouter(ctx: ContractCtx): Router {
  const router = Router();

  // GET /events — SSE 스트림
  router.get("/", (req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // 초기 연결 확인
    const hasPhase2 = !!(ctx.chargeTransaction && ctx.revenueTracker);
    res.write(`event: connected\ndata: ${JSON.stringify({ phase2: hasPhase2 })}\n\n`);

    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  return router;
}
