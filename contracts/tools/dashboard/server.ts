/**
 * EnergyFi web dashboard — Express server.
 * Phase 1 + Phase 2 integrated view with graceful degradation when Phase 2 is absent.
 *
 * Usage: npm run dashboard:testnet
 *
 * The deployer private key is only used on the server and is never exposed to the browser.
 */

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { buildLiveRuntime, hasPhase2 } from "../live/context.js";
import { buildQueryRouter } from "./routes/query.js";
import { buildOracleRouter } from "./routes/oracle.js";
import { buildPhase2QueryRouter } from "./routes/phase2-query.js";
import { buildPhase2OracleRouter } from "./routes/phase2-oracle.js";
import { buildEventsRouter, setupEventListeners } from "./routes/events.js";
import { buildVerifyRouter } from "./routes/verify.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const networkArg = process.argv[2] ?? "energyfi-l1-testnet";
  const port = Number(process.env["DASHBOARD_PORT"] ?? 3000);

  console.log(`\n=== EnergyFi Web Dashboard ===`);
  console.log(`Network : ${networkArg}`);

  const runtime = buildLiveRuntime(networkArg, path.resolve(__dirname, "../../deployments.json"));
  const { ctx, wallet, addresses } = runtime;
  console.log(`Signer  : ${wallet.address}`);
  console.log(`DeviceRegistry  : ${addresses.DeviceRegistry}`);
  console.log(`StationRegistry : ${addresses.StationRegistry}`);

  if (hasPhase2(ctx)) {
    console.log(`ChargeTransaction : ${addresses.ChargeTransaction}`);
    console.log(`RevenueTracker    : ${addresses.RevenueTracker}`);
    console.log(`ChargeRouter      : ${addresses.ChargeRouter}`);
  } else {
    console.log(`Phase 2 contracts are not deployed. Dashboard tabs 3-5 stay disabled.`);
  }

  // Express app
  const app = express();
  app.use(express.json());

  // Static files (index.html, app.js, style.css)
  app.use(express.static(path.join(__dirname, "public")));

  // Phase 1 routers
  app.use("/query",  buildQueryRouter(ctx));
  app.use("/oracle", buildOracleRouter(ctx));

  // Phase 2 routers
  app.use("/query/phase2",  buildPhase2QueryRouter(ctx));
  app.use("/oracle/phase2", buildPhase2OracleRouter(ctx));

  // SSE
  app.use("/events", buildEventsRouter(ctx));

  // Phase 1 integrated verification (SSE streaming)
  app.use("/verify", buildVerifyRouter(ctx));
  setupEventListeners(ctx);

  // Health check
  app.get("/api/status", (_req, res) => {
    res.json({
      network: networkArg,
      signer: wallet.address,
      contracts: {
        DeviceRegistry: addresses.DeviceRegistry,
        StationRegistry: addresses.StationRegistry,
        ChargeTransaction: addresses.ChargeTransaction ?? null,
        RevenueTracker: addresses.RevenueTracker ?? null,
        ChargeRouter: addresses.ChargeRouter ?? null,
      },
      phase2: hasPhase2(ctx),
    });
  });

  app.listen(port, () => {
    console.log(`\nDashboard running at: http://localhost:${port}`);
    console.log(`Network: ${networkArg}`);
    console.log(`Phase 2: ${hasPhase2(ctx) ? "enabled" : "disabled (contracts not deployed)"}`);
    console.log(`Stop: Ctrl+C\n`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
