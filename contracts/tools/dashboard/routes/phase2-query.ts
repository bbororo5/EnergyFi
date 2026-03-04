/**
 * Phase 2 GET 라우터 — 충전 세션 + 수익 조회
 */

import { Router } from "express";
import type { ContractCtx } from "../server.js";
import { ZeroHash, encodeBytes32String } from "ethers";
import { safeDecodeB32, regionBytes4, formatKwh, formatKrw } from "../lib/utils.js";

export function buildPhase2QueryRouter(ctx: ContractCtx): Router {
  const router = Router();

  // Phase 2 컨트랙트 존재 확인 미들웨어
  router.use((_req, res, next) => {
    if (!ctx.chargeTransaction || !ctx.revenueTracker) {
      res.status(503).json({ error: "Phase 2 컨트랙트 미배포" });
      return;
    }
    next();
  });

  // ── GET /query/phase2/sessions/recent?limit=20&cpoId=X&ownerType=Y&regionId=Z
  router.get("/sessions/recent", async (req, res) => {
    try {
      const limit = Math.min(Number(req.query["limit"] ?? 20), 100);
      const filterCpoId = req.query["cpoId"] as string | undefined;
      const filterOwnerType = req.query["ownerType"] as string | undefined;
      const filterRegionId = req.query["regionId"] as string | undefined;
      const ct = ctx.chargeTransaction!;

      const filter = ct.filters["ChargeSessionRecorded"]();
      const currentBlock = await ctx.signer.provider!.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000);
      const events = await ct.queryFilter(filter, fromBlock, "latest");

      // Station metadata cache (avoid duplicate lookups)
      const stationCache = new Map<string, { cpoId: string; ownerType: string; regionId: string }>();
      async function getStationMeta(sid: string) {
        if (stationCache.has(sid)) return stationCache.get(sid)!;
        try {
          const station = await ctx.stationRegistry.getStation(sid);
          const efStations = await ctx.stationRegistry.getEnergyFiStationsByRegion(station.regionId);
          const meta = {
            cpoId: safeDecodeB32(station.cpoId),
            ownerType: efStations.includes(sid) ? "ENERGYFI" : "CPO",
            regionId: station.regionId,
          };
          stationCache.set(sid, meta);
          return meta;
        } catch {
          const fallback = { cpoId: "", ownerType: "CPO", regionId: "" };
          stationCache.set(sid, fallback);
          return fallback;
        }
      }

      const needsFilter = filterCpoId || filterOwnerType || filterRegionId;
      const allSessions = events.reverse();
      const sessions: any[] = [];

      for (const ev of allSessions as any[]) {
        if (sessions.length >= limit) break;

        const sid = ev.args[3] as string;
        const session: any = {
          tokenId: ev.args[0].toString(),
          sessionId: ev.args[1],
          chargerId: ev.args[2],
          stationId: sid,
          gridRegionCode: ev.args[4],
          energyKwh: ev.args[5].toString(),
          distributableKrw: ev.args[6].toString(),
          startTimestamp: ev.args[7].toString(),
          endTimestamp: ev.args[8].toString(),
          blockNumber: ev.blockNumber,
        };

        if (needsFilter) {
          const meta = await getStationMeta(sid);
          if (filterCpoId && meta.cpoId !== filterCpoId) continue;
          if (filterOwnerType && meta.ownerType !== filterOwnerType) continue;
          if (filterRegionId && meta.regionId !== filterRegionId) continue;
          session.cpoId = meta.cpoId;
          session.ownerType = meta.ownerType;
          session.regionId = meta.regionId;
        }

        sessions.push(session);
      }

      res.json({ sessions, total: events.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/session/:tokenId ──────────────────────────────────
  router.get("/session/:tokenId", async (req, res) => {
    try {
      const tokenId = Number(req.params["tokenId"]);
      const ct = ctx.chargeTransaction!;

      const session = await ct.getSession(tokenId);
      const owner = await ct.ownerOf(tokenId);
      const ctAddress = await ct.getAddress();

      res.json({
        tokenId,
        sessionId: session.sessionId,
        chargerId: session.chargerId,
        chargerType: Number(session.chargerType),
        energyKwh: session.energyKwh.toString(),
        startTimestamp: session.startTimestamp.toString(),
        endTimestamp: session.endTimestamp.toString(),
        vehicleCategory: Number(session.vehicleCategory),
        gridRegionCode: session.gridRegionCode,
        cpoId: session.cpoId,
        stationId: session.stationId,
        distributableKrw: session.distributableKrw.toString(),
        seSignature: session.seSignature,
        owner,
        soulbound: owner.toLowerCase() === ctAddress.toLowerCase(),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/station-revenue ───────────────────────────────────
  router.get("/station-revenue", async (req, res) => {
    try {
      const rt = ctx.revenueTracker!;

      // 전체 충전소 목록 조회 (StationRegistered 이벤트로)
      const stationFilter = ctx.stationRegistry.filters["StationRegistered"]();
      const stationEvents = await ctx.stationRegistry.queryFilter(stationFilter, 0, "latest");

      const revenues = await Promise.all(
        stationEvents.map(async (ev: any) => {
          const sid = ev.args[0] as string;
          try {
            const [accumulated, settled, pending] = await rt.getStationRevenue(sid);
            const station = await ctx.stationRegistry.getStation(sid);
            const efStations = await ctx.stationRegistry.getEnergyFiStationsByRegion(station.regionId);
            const isEnergyFi = efStations.includes(sid);

            return {
              stationId: safeDecodeB32(sid),
              stationIdRaw: sid,
              ownerType: isEnergyFi ? "ENERGYFI" : "CPO",
              accumulated: accumulated.toString(),
              settled: settled.toString(),
              pending: pending.toString(),
            };
          } catch {
            return null;
          }
        })
      );

      res.json({ revenues: revenues.filter(Boolean) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/cpo-revenue ───────────────────────────────────────
  router.get("/cpo-revenue", async (req, res) => {
    try {
      const rt = ctx.revenueTracker!;
      const cpoFilter = ctx.stationRegistry.filters["CPORegistered"]();
      const cpoEvents = await ctx.stationRegistry.queryFilter(cpoFilter, 0, "latest");

      const revenues = await Promise.all(
        cpoEvents.map(async (ev: any) => {
          const cpoId = ev.args[0] as string;
          try {
            const cpo = await ctx.stationRegistry.getCPO(cpoId);
            const [accumulated, settled, pending] = await rt.getCPORevenue(cpoId);
            return {
              cpoId: safeDecodeB32(cpoId),
              cpoIdRaw: cpoId,
              name: cpo.name,
              accumulated: accumulated.toString(),
              settled: settled.toString(),
              pending: pending.toString(),
            };
          } catch {
            return null;
          }
        })
      );

      res.json({ revenues: revenues.filter(Boolean) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/cpo/:cpoId/revenue ────────────────────────────────
  // 특정 CPO의 소속 충전소 수익 통합
  router.get("/cpo/:cpoId/revenue", async (req, res) => {
    try {
      const cpoIdStr = req.params["cpoId"];
      const cpoId = encodeBytes32String(cpoIdStr);
      const rt = ctx.revenueTracker!;
      const stationIds: string[] = await ctx.stationRegistry.getStationsByCPO(cpoId);

      let totalAccumulated = 0n;
      let totalSettled = 0n;
      let totalPending = 0n;
      const stations: any[] = [];

      for (const sid of stationIds) {
        try {
          const [accumulated, settled, pending] = await rt.getStationRevenue(sid);
          totalAccumulated += accumulated;
          totalSettled += settled;
          totalPending += pending;
          stations.push({
            stationId: safeDecodeB32(sid),
            accumulated: accumulated.toString(),
            settled: settled.toString(),
            pending: pending.toString(),
          });
        } catch { /* skip */ }
      }

      res.json({
        cpo: {
          accumulated: totalAccumulated.toString(),
          settled: totalSettled.toString(),
          pending: totalPending.toString(),
        },
        stations,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/region-revenue ────────────────────────────────────
  router.get("/region-revenue", async (req, res) => {
    try {
      const rt = ctx.revenueTracker!;
      const regions = ["KR11", "KR26", "KR41", "KR27", "KR28", "KR29", "KR30", "KR31", "KR36", "KR42", "KR43", "KR44", "KR45", "KR46", "KR47", "KR48", "KR49"];

      const revenues = await Promise.all(
        regions.map(async (code) => {
          const rid = regionBytes4(code);
          try {
            const pending = await rt.getEnergyFiRegionRevenue(rid);
            const stations = await ctx.stationRegistry.getEnergyFiStationsByRegion(rid);
            if (stations.length === 0 && pending === 0n) return null;
            return {
              regionId: code,
              stationCount: stations.length,
              pending: pending.toString(),
            };
          } catch {
            return null;
          }
        })
      );

      res.json({ revenues: revenues.filter(Boolean) });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/monthly?period=202606 ─────────────────────────────
  router.get("/monthly", async (req, res) => {
    try {
      const period = Number(req.query["period"] ?? 0);
      if (!period) {
        res.status(400).json({ error: "period 파라미터 필수 (예: 202606)" });
        return;
      }
      const rt = ctx.revenueTracker!;

      const stationFilter = ctx.stationRegistry.filters["StationRegistered"]();
      const stationEvents = await ctx.stationRegistry.queryFilter(stationFilter, 0, "latest");

      let totalKrw = 0n;
      let efiKrw = 0n;
      let cpoKrw = 0n;
      const stationBreakdown: any[] = [];

      for (const ev of stationEvents as any[]) {
        const sid = ev.args[0] as string;
        try {
          const amount = await rt.getStationRevenuePeriod(sid, period);
          if (amount === 0n) continue;
          const station = await ctx.stationRegistry.getStation(sid);
          const efStations = await ctx.stationRegistry.getEnergyFiStationsByRegion(station.regionId);
          const isEnergyFi = efStations.includes(sid);

          totalKrw += amount;
          if (isEnergyFi) efiKrw += amount;
          else cpoKrw += amount;

          stationBreakdown.push({
            stationId: safeDecodeB32(sid),
            ownerType: isEnergyFi ? "ENERGYFI" : "CPO",
            amount: amount.toString(),
          });
        } catch {
          // skip
        }
      }

      const ct = ctx.chargeTransaction!;
      const totalSessions = await ct.totalSessions();

      res.json({
        period,
        totalKrw: totalKrw.toString(),
        efiKrw: efiKrw.toString(),
        cpoKrw: cpoKrw.toString(),
        efiPercent: totalKrw > 0n ? Number((efiKrw * 1000n) / totalKrw) / 10 : 0,
        totalSessions: totalSessions.toString(),
        stations: stationBreakdown,
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/settlements/:stationId ────────────────────────────
  router.get("/settlements/:stationId", async (req, res) => {
    try {
      const stationId = req.params["stationId"];
      const rt = ctx.revenueTracker!;
      const sid = encodeBytes32String(stationId);
      const history = await rt.getSettlementHistory(sid);

      const records = history.map((r: any) => ({
        period: Number(r.period_yyyyMM),
        amount: r.amount.toString(),
        settledAt: r.settledAt.toString(),
      }));

      res.json({ stationId, records });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── GET /query/phase2/token-info ────────────────────────────────────────
  router.get("/token-info", async (req, res) => {
    try {
      const ct = ctx.chargeTransaction!;
      const totalSessions = await ct.totalSessions();
      const ctAddress = await ct.getAddress();
      const balance = await ct.balanceOf(ctAddress);
      const name = await ct.name();
      const symbol = await ct.symbol();

      res.json({
        name,
        symbol,
        totalSessions: totalSessions.toString(),
        contractAddress: ctAddress,
        soulboundBalance: balance.toString(),
      });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
