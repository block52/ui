import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { attachChainWs, broadcastRaw, disconnectGame } from "./chain-ws.js";
import { handleCometRpc } from "./comet-rpc.js";
import {
  CASH_GAME_ID,
  getGameState,
  listGamesResponse,
  resetTables,
  setStubConfig,
  getFrameDelayMs,
} from "./state.js";

/**
 * @block52/pvm-stub — local stub server so the UI runs with no chain, funds,
 * or bridge. Modeled on dynamiq/h3-portal/packages/api-stub.
 *
 * Point the UI at this via the "Stub" network preset (all endpoints on :8546).
 * The app runs chain-direct: state reads over REST, live updates over the chain
 * WS (/ws, chain-ws.ts), and actions over CometBFT JSON-RPC (POST /, comet-rpc.ts)
 * which decodes the poker Msg and drives the holdem.ts engine + bot.
 * See ui/docs/plans/2026_07_11_wallet_stub_server.md.
 */

const PORT = Number(process.env.PORT ?? 8546);
const HOST = process.env.HOST ?? "0.0.0.0";

const USDC_MICRO = process.env.STUB_USDC ?? "1000000000"; // 1000 USDC
const STAKE = process.env.STUB_STAKE ?? "1000000000"; // 1000 stake

const app = new Hono();
app.use("*", cors()); // dev/test only — the UI POSTs cross-origin

app.use("*", async (c, next) => {
  await next();
  console.log(`[pvm-stub] ${c.req.method} ${new URL(c.req.url).pathname} -> ${c.res.status}`);
});

// ---- health -------------------------------------------------------------
app.get("/health", (c) => c.json({ status: "ok", pkg: "@block52/pvm-stub" }));

// ---- wallet balance (unlocks buy-in) ------------------------------------
app.get("/cosmos/bank/v1beta1/balances/:address", (c) =>
  c.json({
    balances: [
      { denom: "usdc", amount: USDC_MICRO },
      { denom: "stake", amount: STAKE },
    ],
    pagination: { next_key: null, total: "2" },
  })
);

// ---- lobby + game state -------------------------------------------------
// `games` is a JSON-encoded STRING here (verified against live node1).
app.get("/block52/pokerchain/poker/v1/list_games", (c) => c.json(listGamesResponse()));

app.get("/block52/pokerchain/poker/v1/game_state/:gameId", (c) => {
  const state = getGameState(c.req.param("gameId"));
  return state ? c.json(state) : c.json({ error: "unknown gameId" }, 404);
});

// ---- chain-direct action submission (CometBFT JSON-RPC over POST /) ------
// The UI's SDK signing client broadcasts poker Msgs here; the emulator decodes
// them, drives holdem.applyAction, and pushes the resulting frame over /ws.
app.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { id?: unknown; method?: string; params?: Record<string, unknown> };
  return c.json((await handleCometRpc(body)) as object);
});

// ---- cosmetic reads the UI polls (benign shapes, stop the {} noise) ------
app.get("/cosmos/base/tendermint/v1beta1/blocks/latest", (c) =>
  c.json({ block: { header: { height: "1", time: "2026-07-11T00:00:00Z" } } })
);
app.get("/cosmos/tx/v1beta1/txs", (c) => c.json({ txs: [], tx_responses: [], total: "0" }));
app.get("/pokerchain/poker/nft_avatar/:address", (c) => c.json({ avatar: "" }));

// ---- control surface (test isolation) -----------------------------------
// In-flight scripted-sequence timers (POST /__control/script), cleared on reset
// or when a new script starts so a run never leaks frames into the next test.
let scriptTimers: ReturnType<typeof setTimeout>[] = [];
function clearScript(): void {
  scriptTimers.forEach(clearTimeout);
  scriptTimers = [];
}

// Reset all game state to fresh/empty between test runs (api-stub's /__control
// pattern). No auth — the stub only runs in dev/test.
app.post("/__control/reset", (c) => {
  clearScript();
  resetTables(); // also clears stub config (frameDelayMs)
  return c.json({ ok: true });
});

// Configure per-frame broadcasting. { frameDelayMs: 150 } reproduces the live
// gateway (one frame per action); { frameDelayMs: 0 } (or unset) stays collapsed.
app.post("/__control/config", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { frameDelayMs?: number };
  setStubConfig(body);
  return c.json({ ok: true, frameDelayMs: getFrameDelayMs() });
});

// Inject an arbitrary JSON frame to a game's subscribers (duplicate/pending/
// error/malformed frames the engine never produces). { gameId, frame }.
app.post("/__control/inject", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { gameId?: string; frame?: unknown };
  const gameId = body.gameId ?? CASH_GAME_ID;
  broadcastRaw(gameId, body.frame);
  return c.json({ ok: true });
});

// Replay a recorded frame sequence with timing (plan §5.3). Each entry's
// `delayMs` is the absolute offset from the call, so `delayMs: 0` for all entries
// reproduces a catch-up BURST (frames arrive back-to-back), while spaced offsets
// reproduce a paced stream. Any previously-running script is cancelled first.
// { gameId, frames: [{ frame, delayMs }] }.
app.post("/__control/script", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as {
    gameId?: string;
    frames?: Array<{ frame: unknown; delayMs?: number }>;
  };
  const gameId = body.gameId ?? CASH_GAME_ID;
  const frames = body.frames ?? [];
  clearScript();
  for (const entry of frames) {
    const delay = Math.max(0, entry.delayMs ?? 0);
    scriptTimers.push(setTimeout(() => broadcastRaw(gameId, entry.frame), delay));
  }
  return c.json({ ok: true, scheduled: frames.length });
});

// Forcibly drop a game's WS subscribers (simulate an unexpected mid-hand drop).
// The UI has no auto-reconnect, so a resubscribe is user-driven. { gameId }.
app.post("/__control/disconnect", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { gameId?: string };
  disconnectGame(body.gameId ?? CASH_GAME_ID);
  return c.json({ ok: true });
});

// ---- unstubbed fallback -------------------------------------------------
app.all("*", (c) => {
  console.warn(`[pvm-stub] UNSTUBBED ${c.req.method} ${new URL(c.req.url).pathname} -> {} (TODO)`);
  return c.json({});
});

const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`[pvm-stub] listening on http://${HOST}:${info.port}`);
  console.log(`[pvm-stub] funded: ${Number(USDC_MICRO) / 1e6} USDC + ${STAKE} stake`);
  console.log(`[pvm-stub] seeded cash table: ${CASH_GAME_ID}`);
});

attachChainWs(server as unknown as Server);
