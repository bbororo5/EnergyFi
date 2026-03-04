/**
 * GET 라우터 — 온체인 조회
 * 지역별 충전소 목록, CPO 현황, SE 칩 상태
 */

import { Router } from "express";
import type { ContractCtx } from "../server.js";
import { ZeroHash, encodeBytes32String } from "ethers";
import { regionBytes4, safeDecodeB32 } from "../lib/utils.js";

export function buildQueryRouter(ctx: ContractCtx): Router {
  const router = Router();

  // ── GET /query/region?regionId=KR11 ─────────────────────────────────────────
  // 탭1 왼쪽 패널: 지역별 충전소 + SE칩 현황 통합 반환
  router.get("/region", async (req, res) => {
    try {
      const code = (req.query["regionId"] as string) ?? "KR11";
      const regionId = regionBytes4(code);

      const stationIds: string[] = await ctx.stationRegistry.getStationsByRegion(regionId);
      const efStationIds: string[] = await ctx.stationRegistry.getEnergyFiStationsByRegion(regionId);
      const efSet = new Set(efStationIds);

      const stations = await Promise.all(
        stationIds.map(async (sid) => {
          const station = await ctx.stationRegistry.getStation(sid);
          const chargerIds: string[] = await ctx.stationRegistry.getChargersByStation(sid);

          let cpoName = "—";
          if (station.ownerType === 0n && station.cpoId !== ZeroHash) {
            try {
              const cpo = await ctx.stationRegistry.getCPO(station.cpoId);
              cpoName = cpo.name;
            } catch {
              cpoName = "?";
            }
          }

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
            ownerType: efSet.has(sid) ? "ENERGYFI" : "CPO",
            cpoName,
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

  // ── GET /query/cpos ──────────────────────────────────────────────────────────
  // 탭1 오른쪽 패널: 전체 CPO 목록 + 충전소/충전기 수
  router.get("/cpos", async (req, res) => {
    try {
      // StationRegistry에는 CPO 목록 조회 함수가 없으므로 등록 이벤트를 쿼리
      const filter = ctx.stationRegistry.filters["CPORegistered"]();
      const events = await ctx.stationRegistry.queryFilter(filter, 0, "latest");

      const cpos = await Promise.all(
        events.map(async (ev: any) => {
          const cpoId = ev.args[0] as string;
          try {
            const cpo = await ctx.stationRegistry.getCPO(cpoId);
            const stationIds: string[] = await ctx.stationRegistry.getStationsByCPO(cpoId);

            let totalChargers = 0;
            for (const sid of stationIds) {
              const cids: string[] = await ctx.stationRegistry.getChargersByStation(sid);
              totalChargers += cids.length;
            }

            return {
              cpoId: safeDecodeB32(cpoId),
              name: cpo.name,
              wallet: cpo.walletAddress,
              active: cpo.active,
              stationCount: stationIds.length,
              chargerCount: totalChargers,
            };
          } catch {
            return null;
          }
        })
      );

      res.json({ cpos: cpos.filter(Boolean) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/cpo/:cpoId/tree ───────────────────────────────────────────────
  // CPO 하나의 전체 인프라 트리 (충전소 → 충전기 → SE칩 상태)
  router.get("/cpo/:cpoId/tree", async (req, res) => {
    try {
      const cpoIdStr = req.params["cpoId"];
      const cpoId = encodeBytes32String(cpoIdStr);
      const cpo = await ctx.stationRegistry.getCPO(cpoId);
      const stationIds: string[] = await ctx.stationRegistry.getStationsByCPO(cpoId);

      const stations = await Promise.all(
        stationIds.map(async (sid) => {
          const station = await ctx.stationRegistry.getStation(sid);
          const chargerIds: string[] = await ctx.stationRegistry.getChargersByStation(sid);
          const TYPE_LABEL = ["완속 7kW", "완속 11kW", "완속 22kW"];

          const chargers = await Promise.all(
            chargerIds.map(async (cid) => {
              const charger = await ctx.stationRegistry.getCharger(cid);
              const chipActive: boolean = await ctx.deviceRegistry.isActiveChip(cid);
              return {
                chargerId: safeDecodeB32(cid),
                chargerIdRaw: cid,
                chargerType: TYPE_LABEL[Number(charger.chargerType)] ?? `타입${charger.chargerType}`,
                active: charger.active,
                chipActive,
              };
            })
          );

          return {
            stationId: safeDecodeB32(sid),
            stationIdRaw: sid,
            regionId: station.regionId,
            location: station.location,
            active: station.active,
            chargers,
          };
        })
      );

      res.json({
        cpo: {
          cpoId: cpoIdStr,
          name: cpo.name,
          wallet: cpo.walletAddress,
          active: cpo.active,
        },
        stations,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/energyfi/regions ────────────────────────────────────────────────
  // 17개 지역별 EnergyFi 충전소 + 수익 개요
  router.get("/energyfi/regions", async (req, res) => {
    try {
      const regionCodes = ["KR11", "KR26", "KR41", "KR27", "KR28", "KR29", "KR30", "KR31", "KR36", "KR42", "KR43", "KR44", "KR45", "KR46", "KR47", "KR48", "KR49"];
      const TYPE_LABEL = ["완속 7kW", "완속 11kW", "완속 22kW"];

      const regions = await Promise.all(
        regionCodes.map(async (code) => {
          const rid = regionBytes4(code);
          const stationIds: string[] = await ctx.stationRegistry.getEnergyFiStationsByRegion(rid);

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
              const pending = await ctx.revenueTracker.getEnergyFiRegionRevenue(rid);
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
