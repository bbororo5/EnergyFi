/**
 * Nonce-resilient signer for fast L1 chains.
 *
 * 프로덕션 Bridge는 RabbitMQ consumer(prefetch=1)로 invoice.paid를 순차 소비하므로
 * nonce 충돌이 구조적으로 불가능하다. 이 signer는 동일 패턴을 구현한다:
 *
 * 1. 최초 1회 RPC에서 nonce 조회 후 메모리에서 추적
 * 2. sendTransaction 성공 시 증가
 * 3. estimateGas revert (TX 미전송) 시 유지 — nonce 미소비
 * 4. "nonce already used" 에러 시 재동기화
 *
 * 이 방식은 ethers v6가 매 TX마다 eth_getTransactionCount를 호출하여
 * fast L1 체인에서 stale nonce를 받는 문제를 해결한다.
 */

import { ethers } from "ethers";

export class LiveTestSigner extends ethers.Wallet {
  private _nonce: number | null = null;

  /**
   * 로컬 nonce 반환. 최초 호출 시에만 RPC 조회.
   * ethers v6 내부에서 populateTransaction → getNonce("pending") 경로로 호출됨.
   */
  override async getNonce(blockTag?: string): Promise<number> {
    if (this._nonce === null) {
      this._nonce = await super.getNonce("pending");
    }
    return this._nonce;
  }

  /**
   * TX 전송 + 로컬 nonce 관리.
   *
   * ethers v6 flow:
   *   super.sendTransaction(tx)
   *     → this.populateTransaction(tx)  // this.getNonce → 로컬 값
   *       → this.estimateGas(tx)        // revert 시 여기서 throw
   *     → this.signTransaction(pop)
   *     → provider.broadcastTransaction(signed)
   *
   * - estimateGas revert: TX 미전송, nonce 미소비 → _nonce 유지
   * - broadcast 성공: nonce 소비 → _nonce++
   * - "nonce already used": 로컬이 체인에 뒤처짐 → 재동기화
   */
  override async sendTransaction(
    tx: ethers.TransactionRequest,
  ): Promise<ethers.TransactionResponse> {
    if (this._nonce === null) {
      this._nonce = await super.getNonce("pending");
    }
    try {
      const resp = await super.sendTransaction(tx);
      this._nonce!++;
      return resp;
    } catch (err) {
      const msg = String(err);
      if (msg.includes("nonce has already been used") || msg.includes("nonce too low")) {
        // 로컬 nonce가 체인보다 뒤처짐 → 강제 재동기화
        this._nonce = null;
      }
      // estimateGas revert 등 기타 에러: TX 미전송, nonce 미소비 → 유지
      throw err;
    }
  }
}
