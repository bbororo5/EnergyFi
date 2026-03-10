/**
 * POST 라우터 — Oracle 쓰기 액션
 * 충전소 / 충전기 / SE칩 등록 (서버 측 deployer 키 사용)
 */

import { Router } from "express";
import type { ContractCtx } from "../server.js";
import {
  encodeBytes32String,
  Wallet,
  getBytes,
  hexlify,
} from "ethers";
import { regionBytes4 } from "../lib/utils.js";
import { ensureBulkData } from "../lib/bulk-setup.js";

const ChargerType = { "완속7kW": 0, "완속11kW": 1, "완속22kW": 2 } as const;

export function buildOracleRouter(ctx: ContractCtx): Router {
  const router = Router();

  // ── POST /oracle/station ─────────────────────────────────────────────────────
  router.post("/station", async (req, res) => {
    const { stationId, regionId, location } = req.body as {
      stationId: string;
      regionId: string;
      location: string;
    };
    if (!stationId || !regionId || !location) {
      res.status(400).json({ error: "stationId, regionId, location 필수" });
      return;
    }
    try {
      const sid = encodeBytes32String(stationId);
      const rid = regionBytes4(regionId);
      const tx = await ctx.stationRegistry.registerStation(sid, rid, location);
      await tx.wait();
      res.json({ ok: true, message: `✅ 충전소 ${stationId} (${regionId}) 등록 완료` });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("StationAlreadyExists")) {
        res.json({ ok: false, message: `⏭ ${stationId} — 이미 등록됨` });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  // ── POST /oracle/charger ─────────────────────────────────────────────────────
  router.post("/charger", async (req, res) => {
    const { chargerId, stationId, chargerType } = req.body as {
      chargerId: string;
      stationId: string;
      chargerType: "완속7kW" | "완속11kW" | "완속22kW";
    };
    if (!chargerId || !stationId || !chargerType) {
      res.status(400).json({ error: "chargerId, stationId, chargerType 필수" });
      return;
    }
    try {
      const cid = encodeBytes32String(chargerId);
      const sid = encodeBytes32String(stationId);
      const ct = ChargerType[chargerType] ?? 1;
      const tx = await ctx.stationRegistry.registerCharger(cid, sid, ct);
      await tx.wait();
      res.json({ ok: true, message: `✅ 충전기 ${chargerId} → ${stationId} (${chargerType}) 등록 완료` });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("ChargerAlreadyExists")) {
        res.json({ ok: false, message: `⏭ ${chargerId} — 이미 등록됨` });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  // ── POST /oracle/chip ────────────────────────────────────────────────────────
  // secp256k1 키쌍 자동 생성 후 공개키 등록
  router.post("/chip", async (req, res) => {
    const { chargerId } = req.body as { chargerId: string };
    if (!chargerId) {
      res.status(400).json({ error: "chargerId 필수" });
      return;
    }
    try {
      const cid = encodeBytes32String(chargerId);
      const wallet = Wallet.createRandom();
      const pubBytes = getBytes(wallet.signingKey.publicKey);
      const pub64 = pubBytes.slice(1); // strip 0x04 prefix → 64 bytes
      const tx = await ctx.deviceRegistry.enrollChip(cid, pub64, 0); // 0 = SECP256K1
      await tx.wait();
      res.json({
        ok: true,
        message: `✅ ${chargerId} SE칩 등록 완료 (pubkey: ${hexlify(pub64).slice(0, 18)}...)`,
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("ChipAlreadyActive")) {
        res.json({ ok: false, message: `⏭ ${chargerId} — 이미 등록됨` });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  // ── POST /oracle/all ─────────────────────────────────────────────────────────
  // 전체 테스트 데이터 일괄 등록 (shared helper 재사용)
  router.post("/all", async (req, res) => {
    try {
      await ensureBulkData(ctx);
      res.json({
        ok: true,
        logs: [
          "✅ Shared bulk setup applied",
          "✅ Stations, chips, and chargers ensured in contract-safe order",
        ],
      });
    } catch (err) {
      res.status(500).json({ ok: false, logs: [`❌ Bulk setup failed: ${String(err)}`] });
    }
  });

  return router;
}
