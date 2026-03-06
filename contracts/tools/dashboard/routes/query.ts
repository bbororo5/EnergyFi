/**
 * GET 라우터 — 온체인 조회
 * 지역별 충전소 목록, SE 칩 상태
 */

import { Router } from "express";
import type { ContractCtx } from "../server.js";
import { encodeBytes32String } from "ethers";
import { regionBytes4, safeDecodeB32 } from "../lib/utils.js";

export function buildQueryRouter(ctx: ContractCtx): Router {
  const router = Router();

  // ── GET /query/region?regionId=KR11 ─────────────────────────────────────────
  // 지역별 충전소 + SE칩 현황 통합 반환
  router.get("/region", async (req, res) => {
    try {
      const code = (req.query["regionId"] as string) ?? "KR11";
      const regionId = regionBytes4(code);

      const stationIds: string[] = await ctx.stationRegistry.getStationsByRegion(regionId);

      const stations = await Promise.all(
        stationIds.map(async (sid) => {
          const station = await ctx.stationRegistry.getStation(sid);
          const chargerIds: string[] = await ctx.stationRegistry.getChargersByStation(sid);

          let kw7 = 0, kw11 = 0, kw22 = 0;
          const TYPE_LABEL = ["완속 7kW", "완속 11kW", "완속 22kW"];
          const chipStatus: { chargerId: string; active: boolean; chargerType: string }[] = [];
          for (const cid of chargerIds) {
            const charger = await ctx.stationRegistry.getCharger(cid);
            if (!charger.active) continue;
            const t = Number(charger.chargerType);
            if (t === 0) kw7++;
            else if (t === 1) kw11++;
            else if (t === 2) kw22++;
            const isActive: boolean = await ctx.deviceRegistry.isActiveChip(cid);
            chipStatus.push({ chargerId: safeDecodeB32(cid), active: isActive, chargerType: TYPE_LABEL[t] ?? `타입${t}` });
          }

          return {
            stationId: safeDecodeB32(sid),
            chargers: { kw7, kw11, kw22, total: chargerIds.length },
            chips: chipStatus,
            active: station.active,
          };
        })
      );

      // SE 칩 집계 (해당 지역 전체)
      const allChips = stations.flatMap((s) => s.chips);
      const chipSummary = {
        total: allChips.length,
        registered: allChips.filter((c) => c.active).length,
        unregistered: allChips.filter((c) => !c.active).map((c) => ({ id: c.chargerId, type: c.chargerType })),
      };

      res.json({ regionId: code, stations, chipSummary });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/regions ────────────────────────────────────────────────────
  // 17개 지역별 충전소 + 수익 개요
  router.get("/regions", async (req, res) => {
    try {
      const regionCodes = ["KR11", "KR26", "KR41", "KR27", "KR28", "KR29", "KR30", "KR31", "KR36", "KR42", "KR43", "KR44", "KR45", "KR46", "KR47", "KR48", "KR49"];
      const TYPE_LABEL = ["완속 7kW", "완속 11kW", "완속 22kW"];

      const regions = await Promise.all(
        regionCodes.map(async (code) => {
          const rid = regionBytes4(code);
          const stationIds: string[] = await ctx.stationRegistry.getStationsByRegion(rid);

          if (stationIds.length === 0) return null;

          const stations = await Promise.all(
            stationIds.map(async (sid) => {
              const station = await ctx.stationRegistry.getStation(sid);
              const chargerIds: string[] = await ctx.stationRegistry.getChargersByStation(sid);

              const chargers = await Promise.all(
                chargerIds.map(async (cid) => {
                  const charger = await ctx.stationRegistry.getCharger(cid);
                  const chipActive: boolean = await ctx.deviceRegistry.isActiveChip(cid);
                  return {
                    chargerId: safeDecodeB32(cid),
                    chargerIdRaw: cid,
                    chargerType: TYPE_LABEL[Number(charger.chargerType)] ?? `타입${charger.chargerType}`,
                    chipActive,
                  };
                })
              );

              return {
                stationId: safeDecodeB32(sid),
                stationIdRaw: sid,
                location: station.location,
                active: station.active,
                chargers,
              };
            })
          );

          // Phase 2 수익 (있으면)
          let revenue = "0";
          if (ctx.revenueTracker) {
            try {
              const pending = await ctx.revenueTracker.getRegionRevenue(rid);
              revenue = pending.toString();
            } catch { /* Phase 2 미배포 or 에러 */ }
          }

          return {
            regionId: code,
            stationCount: stations.length,
            stations,
            revenue,
          };
        })
      );

      res.json({ regions: regions.filter(Boolean) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
