/**
 * Phase 2 POST 라우터 — Oracle 쓰기 액션
 * 세션 생성, 정산, 실패 테스트, P-256 서명 생성
 */

import { Router } from "express";
import type { ContractCtx } from "../server.js";
import {
  encodeBytes32String,
  Wallet,
  hexlify,
  randomBytes,
} from "ethers";
import {
  chipKeyPairs,
  generateMockSignature,
  setupP256Chips,
  buildRandomSession,
  generateAndProcessSession,
  extractRevertReason,
} from "../lib/p256-keys.js";
import { calculatePeriod, currentPeriod } from "../lib/utils.js";

export function buildPhase2OracleRouter(ctx: ContractCtx): Router {
  const router = Router();

  // Phase 2 컨트랙트 존재 확인 미들웨어 (setup 제외)
  router.use((req, res, next) => {
    if (req.path === "/setup") return next();
    if (!ctx.chargeRouter || !ctx.chargeTransaction || !ctx.revenueTracker) {
      res.status(503).json({ error: "Phase 2 컨트랙트 미배포. Phase 2 Setup을 먼저 실행하세요." });
      return;
    }
    if (chipKeyPairs.size === 0) {
      res.status(503).json({ error: "P-256 키 미등록. Phase 2 Setup을 먼저 실행하세요." });
      return;
    }
    next();
  });

  // ── POST /oracle/phase2/setup ───────────────────────────────────────────
  router.post("/setup", async (req, res) => {
    try {
      // 1. Phase 1 데이터 존재 확인
      const cpoFilter = ctx.stationRegistry.filters["CPORegistered"]();
      const cpoEvents = await ctx.stationRegistry.queryFilter(cpoFilter, 0, "latest");
      if (cpoEvents.length === 0) {
        res.json({ ok: false, message: "Phase 1 데이터가 없습니다. Oracle Phase 1에서 '전체 테스트 데이터 등록'을 먼저 실행하세요." });
        return;
      }

      // 2. Phase 2 컨트랙트 확인
      if (!ctx.chargeRouter || !ctx.chargeTransaction || !ctx.revenueTracker) {
        res.json({ ok: false, message: "Phase 2 컨트랙트가 배포되지 않았습니다. deployments.json을 확인하세요." });
        return;
      }

      const logs = await setupP256Chips(ctx);
      logs.unshift(`Phase 1 데이터 확인: CPO ${cpoEvents.length}개`);
      logs.unshift("Phase 2 컨트랙트 연결 확인");
      logs.push("Phase 2 Setup 완료. 세션 생성 가능.");
      res.json({ ok: true, logs: logs.map(l => `✅ ${l}`) });
    } catch (err) {
      res.status(500).json({ ok: false, logs: [`❌ Setup 실패: ${String(err)}`] });
    }
  });

  // ── POST /oracle/phase2/session ─────────────────────────────────────────
  router.post("/session", async (req, res) => {
    try {
      const { stationId, ownerTypeFilter, regionId } = req.body as {
        stationId?: string; ownerTypeFilter?: "CPO" | "ENERGYFI"; regionId?: string;
      };
      const result = await generateAndProcessSession(ctx, stationId, ownerTypeFilter, regionId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /oracle/phase2/session/bulk ────────────────────────────────────
  router.post("/session/bulk", async (req, res) => {
    try {
      const { count = 5, stationId, ownerTypeFilter, regionId } = req.body as {
        count?: number; stationId?: string; ownerTypeFilter?: "CPO" | "ENERGYFI"; regionId?: string;
      };
      const logs: string[] = [];
      for (let i = 0; i < Math.min(count, 50); i++) {
        try {
          const result = await generateAndProcessSession(ctx, stationId, ownerTypeFilter, regionId);
          logs.push(result.message);
        } catch (err) {
          logs.push(`❌ Session #${i + 1}: ${String(err)}`);
        }
      }
      res.json({ ok: true, logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /oracle/phase2/session/regional ────────────────────────────────
  router.post("/session/regional", async (req, res) => {
    try {
      const { count = 10 } = req.body as { count?: number };
      const logs: string[] = [];
      const total = Math.min(count, 50);
      for (let i = 0; i < total; i++) {
        try {
          const result = await generateAndProcessSession(ctx, undefined, "ENERGYFI");
          logs.push(result.message);
        } catch (err) {
          logs.push(`❌ Session #${i + 1}: ${String(err)}`);
        }
      }
      res.json({ ok: true, logs, count: logs.length });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  // ── POST /oracle/phase2/claim ───────────────────────────────────────────
  router.post("/claim", async (req, res) => {
    try {
      const { cpoId, period } = req.body as { cpoId: string; period?: number };
      if (!cpoId) {
        res.status(400).json({ error: "cpoId 필수" });
        return;
      }
      const cid = encodeBytes32String(cpoId);
      const p = period ?? currentPeriod();
      const rt = ctx.revenueTracker!;

      const tx = await rt.claim(cid, p);
      const receipt = await tx.wait();

      const claimEvent = receipt.logs.find((log: any) => {
        try {
          return rt.interface.parseLog(log)?.name === "CPOClaimed";
        } catch { return false; }
      });
      const totalAmount = claimEvent
        ? rt.interface.parseLog(claimEvent)?.args[1]?.toString() ?? "?"
        : "?";

      res.json({
        ok: true,
        message: `✅ 정산 완료: ${cpoId} | 기간: ${p} | 총 금액: ${totalAmount}원`,
      });
    } catch (err) {
      const msg = String(err);
      if (msg.includes("NothingToClaim")) {
        res.json({ ok: false, message: `⏭ 정산할 금액 없음 (pending = 0)` });
      } else if (msg.includes("CPOHasNoStations")) {
        res.json({ ok: false, message: `⏭ CPO에 소속된 충전소가 없습니다` });
      } else {
        res.status(500).json({ error: msg });
      }
    }
  });

  // ── 실패 시나리오 테스트 ─────────────────────────────────────────────────

  // 8a. SE 서명 불일치
  router.post("/test/bad-signature", async (req, res) => {
    try {
      const session = await buildRandomSession(ctx);
      session.seSignature = hexlify(randomBytes(70));
      const period = calculatePeriod(Number(session.endTimestamp));

      const cr = ctx.chargeRouter!;
      const tx = await cr.processCharge(session, period);
      await tx.wait();
      res.json({ ok: false, message: "❌ 예상과 달리 성공함 (SE 서명 검증 실패가 발생해야 함)" });
    } catch (err) {
      res.json({ ok: true, message: `✅ 예상된 revert: ${extractRevertReason(String(err))}` });
    }
  });

  // 8b. 미등록 chargerId
  router.post("/test/unregistered-charger", async (req, res) => {
    try {
      const session = await buildRandomSession(ctx);
      session.chargerId = encodeBytes32String("FAKE-CHARGER");
      const period = calculatePeriod(Number(session.endTimestamp));

      const cr = ctx.chargeRouter!;
      const tx = await cr.processCharge(session, period);
      await tx.wait();
      res.json({ ok: false, message: "❌ 예상과 달리 성공함" });
    } catch (err) {
      res.json({ ok: true, message: `✅ 예상된 revert: ${extractRevertReason(String(err))}` });
    }
  });

  // 8c. 중복 sessionId
  router.post("/test/duplicate-session", async (req, res) => {
    try {
      const result = await generateAndProcessSession(ctx);
      const usedSessionId = result.sessionId;

      const session = await buildRandomSession(ctx);
      session.sessionId = usedSessionId;
      const period = calculatePeriod(Number(session.endTimestamp));

      const cr = ctx.chargeRouter!;
      const tx = await cr.processCharge(session, period);
      await tx.wait();
      res.json({ ok: false, message: "❌ 예상과 달리 성공함" });
    } catch (err) {
      res.json({ ok: true, message: `✅ 예상된 revert: ${extractRevertReason(String(err))}` });
    }
  });

  // 8d. Bridge 아닌 주소
  router.post("/test/unauthorized", async (req, res) => {
    try {
      const session = await buildRandomSession(ctx);
      const period = calculatePeriod(Number(session.endTimestamp));

      const randomWallet = Wallet.createRandom().connect(ctx.signer.provider!);
      const cr = ctx.chargeRouter!;
      const crWithRandomSigner = cr.connect(randomWallet);
      const tx = await (crWithRandomSigner as any).processCharge(session, period);
      await tx.wait();
      res.json({ ok: false, message: "❌ 예상과 달리 성공함" });
    } catch (err) {
      res.json({ ok: true, message: `✅ 예상된 revert: ${extractRevertReason(String(err))}` });
    }
  });

  // 8e. 미등록 stationId
  router.post("/test/unregistered-station", async (req, res) => {
    try {
      const session = await buildRandomSession(ctx);
      session.stationId = encodeBytes32String("FAKE-STATION");
      const period = calculatePeriod(Number(session.endTimestamp));

      const cr = ctx.chargeRouter!;
      const tx = await cr.processCharge(session, period);
      await tx.wait();
      res.json({ ok: false, message: "❌ 예상과 달리 성공함" });
    } catch (err) {
      res.json({ ok: true, message: `✅ 예상된 revert: ${extractRevertReason(String(err))}` });
    }
  });

  // 8f. 금액 0원
  router.post("/test/zero-amount", async (req, res) => {
    try {
      const session = await buildRandomSession(ctx);
      session.distributableKrw = 0n;
      const period = calculatePeriod(Number(session.endTimestamp));

      const cr = ctx.chargeRouter!;
      const tx = await cr.processCharge(session, period);
      await tx.wait();
      res.json({ ok: false, message: "❌ 예상과 달리 성공함" });
    } catch (err) {
      res.json({ ok: true, message: `✅ 예상된 revert: ${extractRevertReason(String(err))}` });
    }
  });

  // 9. 월경계 테스트
  router.post("/test/month-boundary", async (req, res) => {
    try {
      const logs: string[] = [];

      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 0);
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 1, 0);

      const endTimestamp1 = Math.floor(endOfMonth.getTime() / 1000);
      const endTimestamp2 = Math.floor(startOfNextMonth.getTime() / 1000);

      const period1 = calculatePeriod(endTimestamp1);
      const period2 = calculatePeriod(endTimestamp2);

      logs.push(`월경계 테스트: ${endOfMonth.toISOString()} (period=${period1}) → ${startOfNextMonth.toISOString()} (period=${period2})`);

      const s1 = await buildRandomSession(ctx);
      s1.endTimestamp = BigInt(endTimestamp1);
      s1.startTimestamp = BigInt(endTimestamp1 - 3600);
      s1.seSignature = hexlify(generateMockSignature(
        s1.chargerId as string, s1.energyKwh as bigint, s1.startTimestamp as bigint, s1.endTimestamp as bigint,
      ));
      const tx1 = await ctx.chargeRouter!.processCharge(s1, period1);
      await tx1.wait();
      logs.push(`세션 1 (${period1}): 금액 ${s1.distributableKrw}원`);

      const s2 = await buildRandomSession(ctx);
      s2.endTimestamp = BigInt(endTimestamp2);
      s2.startTimestamp = BigInt(endTimestamp2 - 3600);
      s2.seSignature = hexlify(generateMockSignature(
        s2.chargerId as string, s2.energyKwh as bigint, s2.startTimestamp as bigint, s2.endTimestamp as bigint,
      ));
      const tx2 = await ctx.chargeRouter!.processCharge(s2, period2);
      await tx2.wait();
      logs.push(`세션 2 (${period2}): 금액 ${s2.distributableKrw}원`);

      const rt = ctx.revenueTracker!;
      const rev1 = await rt.getStationRevenuePeriod(s1.stationId, period1);
      const rev2 = await rt.getStationRevenuePeriod(s2.stationId, period2);
      logs.push(`검증: period ${period1} 수익 ${rev1}원, period ${period2} 수익 ${rev2}원`);

      res.json({ ok: true, logs });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
