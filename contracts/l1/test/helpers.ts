/**
 * Common test helpers shared across DeviceRegistry, StationRegistry,
 * ChargeTransaction, RevenueTracker, and ChargeRouter tests.
 */
import { expect } from "chai";
import { encodeBytes32String, keccak256, getBytes, solidityPacked } from "ethers";

/** Structural type matching both Wallet and HDNodeWallet. */
export interface WalletLike {
  signingKey: {
    publicKey: string;
    sign(digest: string): { r: string; s: string; v: number };
  };
}

// ── Revert Helpers ────────────────────────────────────────────────────────────

export async function expectRevert(promise: Promise<unknown>): Promise<void> {
  try {
    await promise;
    expect.fail("Expected transaction to revert, but it succeeded");
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Expected transaction to revert")) {
      throw err;
    }
    // Reverted as expected
  }
}

export async function expectRevertWith(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected transaction to revert with "${message}", but it succeeded`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Expected transaction to revert")) {
      throw err;
    }
    const errMsg = String((err as { message?: string }).message ?? "");
    expect(errMsg, `Expected revert message to contain "${message}"`).to.include(message);
  }
}

export async function expectRevertCustomError(promise: Promise<unknown>, errorName: string): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected transaction to revert with custom error "${errorName}", but it succeeded`);
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith("Expected transaction to revert")) {
      throw err;
    }
    const errMsg = String((err as { message?: string }).message ?? "");
    expect(errMsg, `Expected error name "${errorName}" in revert message`).to.include(errorName);
  }
}

// ── Encoding Helpers ──────────────────────────────────────────────────────────

export const b32 = (s: string) => encodeBytes32String(s);

export function regionBytes4(code: string): string {
  const buf = Buffer.from(code, "ascii");
  return "0x" + buf.toString("hex").padEnd(8, "0");
}

// ── SE Signature Helpers (secp256k1 for local testing) ──────────────────────

export function getPublicKey64(wallet: WalletLike): Uint8Array {
  const pubHex = wallet.signingKey.publicKey; // "0x04..." 65 bytes
  const bytes = getBytes(pubHex);
  return bytes.slice(1); // 64 bytes: x || y
}

export function signRaw(wallet: WalletLike, msgHash: string): Uint8Array {
  const sig = wallet.signingKey.sign(msgHash);
  const r = getBytes(sig.r);
  const s = getBytes(sig.s);
  const result = new Uint8Array(65);
  result.set(r, 0);
  result.set(s, 32);
  result[64] = sig.v;
  return result;
}

export function buildMsgHash(
  chargerId: string,
  energyKwh: bigint,
  startTs: bigint,
  endTs: bigint,
): string {
  return keccak256(
    solidityPacked(
      ["bytes32", "uint256", "uint256", "uint256"],
      [chargerId, energyKwh, startTs, endTs],
    ),
  );
}

// ── Event Helpers ────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Find the first event matching `eventName` in the receipt, parsed via the
 * given contract's ABI.  Returns the parsed LogDescription or null.
 */
export function findEvent(
  receipt: { logs: ReadonlyArray<{ topics: ReadonlyArray<string>; data: string }> },
  contract: { interface: { parseLog(log: { topics: ReadonlyArray<string>; data: string }): any } },
  eventName: string,
): any | null {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === eventName) return parsed;
    } catch {
      // Log belongs to a different contract — skip
    }
  }
  return null;
}

/**
 * Find ALL events matching `eventName` in the receipt.
 */
export function findAllEvents(
  receipt: { logs: ReadonlyArray<{ topics: ReadonlyArray<string>; data: string }> },
  contract: { interface: { parseLog(log: { topics: ReadonlyArray<string>; data: string }): any } },
  eventName: string,
): any[] {
  const results: any[] = [];
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === eventName) results.push(parsed);
    } catch {
      // Log belongs to a different contract — skip
    }
  }
  return results;
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// ── UUPS Proxy Deployment Helper ────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Deploy a UUPS-upgradeable contract behind an EnergyFiProxy (ERC-1967).
 *
 * Returns the implementation, proxy, and a typed contract instance
 * that points to the proxy address.
 *
 * Caller must call `contract.initialize(...)` after deployment.
 */
export async function deployUUPSProxy(
  ethers: any,
  contractName: string,
): Promise<{ impl: any; proxy: any; contract: any }> {
  const Factory = await ethers.getContractFactory(contractName);
  const impl = await Factory.deploy();
  await impl.waitForDeployment();

  const EnergyFiProxy = await ethers.getContractFactory("EnergyFiProxy");
  const proxy = await EnergyFiProxy.deploy(await impl.getAddress(), "0x");
  await proxy.waitForDeployment();

  const contract = await ethers.getContractAt(contractName, await proxy.getAddress());
  return { impl, proxy, contract };
}

/* eslint-enable @typescript-eslint/no-explicit-any */
