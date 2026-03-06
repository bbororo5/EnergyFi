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
  // 전체 테스트 데이터 일괄 등록 (충전소×5, 충전기×15, SE칩×12)
  router.post("/all", async (req, res) => {
    const logs: string[] = [];

    const tryRegister = async (label: string, fn: () => Promise<string>) => {
      try {
        const msg = await fn();
        logs.push(msg);
      } catch (err) {
        logs.push(`❌ ${label}: ${String(err)}`);
      }
    };

    // 충전소 5개
    const STATION_DATA = [
      { id: "STATION-001", regionId: "KR11", location: "서울특별시 강남구 테헤란로 123" },
      { id: "STATION-002", regionId: "KR26", location: "부산광역시 해운대구 해운대해변로 456" },
      { id: "STATION-003", regionId: "KR11", location: "서울특별시 종로구 종로1가 789" },
      { id: "STATION-004", regionId: "KR11", location: "서울특별시 마포구 홍대입구역 101" },
      { id: "STATION-005", regionId: "KR41", location: "경기도 성남시 분당구 판교역로 202" },
    ];
    for (const s of STATION_DATA) {
      await tryRegister(`충전소 ${s.id}`, async () => {
        const sid = encodeBytes32String(s.id);
        const rid = regionBytes4(s.regionId);
        try {
          const tx = await ctx.stationRegistry.registerStation(sid, rid, s.location);
          await tx.wait();
          return `✅ 충전소 ${s.id} (${s.regionId}) 등록 완료`;
        } catch (err) {
          if (String(err).includes("StationAlreadyExists")) return `⏭ 충전소 ${s.id} 이미 등록됨`;
          throw err;
        }
      });
    }

    // 충전기 15개
    const CHARGER_DATA: { id: string; stationId: string; type: "완속7kW" | "완속11kW" | "완속22kW" }[] = [
      { id: "CHARGER-001", stationId: "STATION-001", type: "완속7kW"  },
      { id: "CHARGER-002", stationId: "STATION-001", type: "완속11kW" },
      { id: "CHARGER-003", stationId: "STATION-001", type: "완속22kW" },
      { id: "CHARGER-004", stationId: "STATION-002", type: "완속7kW"  },
      { id: "CHARGER-005", stationId: "STATION-002", type: "완속22kW" },
      { id: "CHARGER-006", stationId: "STATION-003", type: "완속7kW"  },
      { id: "CHARGER-007", stationId: "STATION-003", type: "완속11kW" },
      { id: "CHARGER-008", stationId: "STATION-003", type: "완속22kW" },
      { id: "CHARGER-009", stationId: "STATION-003", type: "완속22kW" },
      { id: "CHARGER-010", stationId: "STATION-004", type: "완속7kW"  },
      { id: "CHARGER-011", stationId: "STATION-005", type: "완속22kW" },
      { id: "CHARGER-012", stationId: "STATION-005", type: "완속11kW" },
      { id: "CHARGER-013", stationId: "STATION-005", type: "완속7kW"  }, // SE칩 미등록
      { id: "CHARGER-014", stationId: "STATION-005", type: "완속22kW" }, // SE칩 미등록
      { id: "CHARGER-015", stationId: "STATION-005", type: "완속11kW" }, // SE칩 미등록
    ];
    for (const c of CHARGER_DATA) {
      await tryRegister(`충전기 ${c.id}`, async () => {
        const cid = encodeBytes32String(c.id);
        const sid = encodeBytes32String(c.stationId);
        const ct = ChargerType[c.type];
        try {
          const tx = await ctx.stationRegistry.registerCharger(cid, sid, ct);
          await tx.wait();
          return `✅ 충전기 ${c.id} → ${c.stationId} (${c.type}) 등록 완료`;
        } catch (err) {
          if (String(err).includes("ChargerAlreadyExists")) return `⏭ 충전기 ${c.id} 이미 등록됨`;
          throw err;
        }
      });
    }

    // SE칩 12개 (CHARGER-001~012, 013~015는 의도적 미등록)
    for (let i = 1; i <= 12; i++) {
      const chargerLabel = `CHARGER-${String(i).padStart(3, "0")}`;
      await tryRegister(`SE칩 ${chargerLabel}`, async () => {
        const cid = encodeBytes32String(chargerLabel);
        const wallet = Wallet.createRandom();
        const pubBytes = getBytes(wallet.signingKey.publicKey);
        const pub64 = pubBytes.slice(1);
        try {
          const tx = await ctx.deviceRegistry.enrollChip(cid, pub64, 0);
          await tx.wait();
          return `✅ ${chargerLabel} SE칩 등록 완료`;
        } catch (err) {
          if (String(err).includes("ChipAlreadyActive")) return `⏭ ${chargerLabel} SE칩 이미 등록됨`;
          throw err;
        }
      });
    }
    logs.push("⚠️ CHARGER-013~015: SE칩 미등록 (탭1 경고 테스트용)");

    res.json({ ok: true, logs });
  });

  return router;
}
