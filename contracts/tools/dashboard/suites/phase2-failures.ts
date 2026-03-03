/**
 * Suite 3: Phase 2 실패 시나리오
 * 기존 7개 POST 엔드포인트를 SSE 테스트로 통합 + SE칩 미등록 추가
 * 8 cases
 */

import { ethers, encodeBytes32String, Wallet, hexlify, randomBytes } from "ethers";
import type { TestSuite } from "../lib/test-suite.js";
import type { ContractCtx } from "../server.js";
import {
  newCounts, expectRevert, decodeCustomError, allErrorInterfaces,
  type EmitFn, type Counts,
} from "../lib/test-helpers.js";
import {
  chipKeyPairs,
  buildRandomSession,
  generateAndProcessSession,
} from "../lib/p256-keys.js";
import { calculatePeriod } from "../lib/utils.js";

export const phase2FailuresSuite: TestSuite = {
  id: "phase2-failures",
  label: "Phase 2 실패 시나리오",
  caseCount: 9,
  requires: "phase2",

  async run(ctx: ContractCtx, emit: EmitFn): Promise<Counts> {
    const counts = newCounts();
    const cr = ctx.chargeRouter!;
    const ct = ctx.chargeTransaction!;
    const rt = ctx.revenueTracker!;
    const dr = ctx.deviceRegistryAdmin; // enrollChip/revokeChip — 비인터페이스 write ops
    // concrete 컨트랙트 ABI 사용 — Interface ABI에는 custom error 선언이 없으므로
    const ifaces = allErrorInterfaces();

    const exp = (label: string, txFn: () => Promise<unknown>, expected: string) =>
      expectRevert(label, txFn, expected, ifaces, emit, counts);

    // F-1. 잘못된 SE 서명 → InvalidSESignature
    await exp("F-1 잘못된 SE 서명",
      async () => {
        const session = await buildRandomSession(ctx);
        session.seSignature = hexlify(randomBytes(70));
        const period = calculatePeriod(Number(session.endTimestamp));
        return cr.processCharge(session, period);
      },
      "InvalidSESignature");

    // F-2. 미등록 chargerId → revert
    await exp("F-2 미등록 chargerId",
      async () => {
        const session = await buildRandomSession(ctx);
        session.chargerId = encodeBytes32String("FAKE-CHARGER");
        const period = calculatePeriod(Number(session.endTimestamp));
        return cr.processCharge(session, period);
      },
      "ChipNotActive");

    // F-3. 중복 sessionId → DuplicateSession
    {
      const result = await generateAndProcessSession(ctx);
      const usedSessionId = result.sessionId;

      await exp("F-3 중복 sessionId",
        async () => {
          const session = await buildRandomSession(ctx);
          session.sessionId = usedSessionId;
          const period = calculatePeriod(Number(session.endTimestamp));
          return cr.processCharge(session, period);
        },
        "DuplicateSession");
    }

    // F-4. Bridge 아닌 주소 → CallerNotBridge
    await exp("F-4 Bridge 아닌 주소",
      async () => {
        const session = await buildRandomSession(ctx);
        const period = calculatePeriod(Number(session.endTimestamp));
        const randomWallet = Wallet.createRandom().connect(ctx.signer.provider!);
        const crRandom = cr.connect(randomWallet) as any;
        return crRandom.processCharge(session, period);
      },
      "CallerNotBridge");

    // F-5. 미등록 stationId → StationNotRegistered
    await exp("F-5 미등록 stationId",
      async () => {
        const session = await buildRandomSession(ctx);
        session.stationId = encodeBytes32String("FAKE-STATION");
        const period = calculatePeriod(Number(session.endTimestamp));
        return cr.processCharge(session, period);
      },
      "StationNotRegistered");

    // F-6. distributableKrw=0 → ZeroAmount
    await exp("F-6 distributableKrw=0",
      async () => {
        const session = await buildRandomSession(ctx);
        session.distributableKrw = 0n;
        const period = calculatePeriod(Number(session.endTimestamp));
        return cr.processCharge(session, period);
      },
      "ZeroAmount");

    // F-7. 비활성 SE칩 → ChipNotActive
    {
      // 임시 칩 등록 후 비활성화 (setup)
      const tempChargerId = encodeBytes32String(`TEMP-${Date.now()}`);
      const tempPub = new Uint8Array(64);
      crypto.getRandomValues(tempPub);
      const enrollTx = await dr.enrollChip(tempChargerId, tempPub, 1);
      await enrollTx.wait();
      const deactivateTx = await dr.revokeChip(tempChargerId);
      await deactivateTx.wait();

      await exp("F-7 비활성 SE칩",
        async () => {
          const session = await buildRandomSession(ctx);
          session.chargerId = tempChargerId;
          const period = calculatePeriod(Number(session.endTimestamp));
          return cr.processCharge(session, period);
        },
        "ChipNotActive");
    }

    // F-8. 미등록 SE칩 (enrollChip 미호출) → revert
    await exp("F-8 미등록 SE칩",
      async () => {
        const session = await buildRandomSession(ctx);
        session.chargerId = encodeBytes32String(`NEVER-ENROLLED-${Date.now()}`);
        const period = calculatePeriod(Number(session.endTimestamp));
        return cr.processCharge(session, period);
      },
      "ChipNotActive");

    // F-9. 크로스 칩 위조: 충전기A 세션을 충전기B 키로 서명 → InvalidSESignature
    await exp("F-9 크로스 칩 위조 서명 거부",
      async () => {
        const entries = Array.from(chipKeyPairs.entries());
        if (entries.length < 2) throw new Error("키페어 2개 미만");
        const [chargerIdA] = entries[0];
        const [chargerIdB] = entries[1];

        // A 충전기의 세션을 구성
        const session = await buildRandomSession(ctx);
        session.chargerId = chargerIdA;
        // B의 키로 서명 생성 (A의 세션 데이터를 B의 키로 서명)
        const energyKwh = BigInt(session.energyKwh);
        const startTs = BigInt(session.startTimestamp);
        const endTs = BigInt(session.endTimestamp);
        const keyPairB = chipKeyPairs.get(chargerIdB)!;
        const msgHash = ethers.keccak256(
          ethers.solidityPacked(
            ["bytes32", "uint256", "uint256", "uint256"],
            [chargerIdA, energyKwh, startTs, endTs],
          ),
        );
        const wrongSig = keyPairB.wallet.signingKey.sign(msgHash).serialized;
        session.seSignature = wrongSig;
        const period = calculatePeriod(Number(session.endTimestamp));
        return cr.processCharge(session, period);
      },
      "InvalidSESignature");

    return counts;
  },
};
