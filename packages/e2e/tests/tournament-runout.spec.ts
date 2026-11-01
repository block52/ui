import { test, expect, TEST_ADDRESS } from "./fixtures.js";
import type { Page } from "@playwright/test";

/**
 * Tournament all-in run-out pacing (ui#873) and the watchable final hand (ui#874).
 *
 * Heads-up final of a sit-and-go: both players all in preflop, then ONE frame
 * carries the whole run-out, the winner and the final placings — exactly what
 * the engine sends. The bus must play it street by street with suspense holds
 * (no "bloop"), then hold a tournament-winner moment, and only then let the
 * hero's "You finished 2nd" modal appear.
 *
 * SHOTS_DIR, when set, saves a frame sequence for the PR (SHOT_PREFIX names it).
 * EXPECT_PACED=false skips the pacing assertions, for "before" shots on main.
 */

const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const BOT = "b521stubbot00000000000000000000000000000bot";
const BOARD = ["AS", "KD", "7C", "2H", "9S"];
const PACED = process.env.EXPECT_PACED !== "false";
const SHOTS_DIR = process.env.SHOTS_DIR;
const PREFIX = process.env.SHOT_PREFIX ?? "after";

/** reveal + flop + turn + river holds (src/bus/timing.ts runoutBeatHoldMs), minus slack. */
const MIN_RUNOUT_MS = 7_000;

type Json = Record<string, unknown>;
type BusHandle = { commitLog: Array<{ seq: number; committedAt: number }>; suspense: boolean };

async function inject(gameState: Json): Promise<void> {
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: SNG_GAME_ID,
      frame: { event: "action_performed", gameId: SNG_GAME_ID, data: { format: "sit-and-go", variant: "texas-holdem", gameState } },
    }),
  });
}

function readBus(page: Page): Promise<BusHandle> {
  return page.evaluate(() => {
    const bus = (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__;
    return { commitLog: bus?.commitLog ?? [], suspense: bus?.suspense ?? false };
  });
}

async function shot(page: Page, name: string): Promise<void> {
  if (SHOTS_DIR) {
    await page.screenshot({ path: `${SHOTS_DIR}/${PREFIX}-${name}.png` });
  }
}

/** Wait until `count` commits have landed after `baseline`, then `settleMs` more. */
async function afterCommit(page: Page, baseline: number, count: number, settleMs: number): Promise<void> {
  await expect.poll(async () => (await readBus(page)).commitLog.length - baseline, { timeout: 20_000, intervals: [50] }).toBeGreaterThanOrEqual(count);
  await page.waitForTimeout(settleMs);
}

const player = (address: string, seat: number, stack: string, holeCards: string[], status: string): Json => ({
  address, seat, stack, holeCards, status, isSmallBlind: false, isBigBlind: false, isDealer: false, legalActions: [], sumOfBets: "0",
});

test("a tournament-ending all-in plays out street by street, then the winner, then the result", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const base = ((await (await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${SNG_GAME_ID}`)).json()) as Json).gameState as Json;
  const options = base.gameOptions as Json;
  const action = (index: number, playerId: string, seat: number, act: string, amount: string): Json => ({
    playerId, seat, action: act, amount, round: "preflop", index, timestamp: Date.now(),
  });
  const hand = (over: Json): Json => ({
    ...base,
    gameOptions: { ...options, sngStartTime: Date.now() - 20 * 60_000, levelStartTime: Date.now() - 60_000, blindLevel: 0, lateRegistrationLevels: 0 },
    handNumber: 12,
    nextToAct: 0,
    legalActions: [],
    winners: [],
    results: [],
    communityCards: [],
    pots: ["3000"],
    totalPot: "3000",
    ...over,
  });

  // Preflop: the hero shoves, the bot calls — both all in, cards still hidden.
  const shove = [action(40, TEST_ADDRESS, 1, "all-in", "1500"), action(41, BOT, 2, "call", "1500")];
  const preflop = hand({
    round: "preflop",
    previousActions: [action(40, TEST_ADDRESS, 1, "all-in", "1500")],
    actionCount: 41,
    players: [player(TEST_ADDRESS, 1, "0", ["KS", "KC"], "all-in"), player(BOT, 2, "1500", ["X", "X"], "active")],
  });
  // ONE frame: run-out, showdown, payout and the final placings.
  const result = hand({
    round: "end",
    previousActions: shove,
    actionCount: 42,
    communityCards: BOARD,
    pots: ["0"],
    totalPot: "0",
    players: [player(TEST_ADDRESS, 1, "0", ["KS", "KC"], "showing"), player(BOT, 2, "3000", ["AH", "AD"], "showing")],
    winners: [{ address: BOT, seat: 2, amount: "3000", cards: ["AH", "AD", "AS", "KD", "9S"] }],
    results: [
      { place: 2, playerId: TEST_ADDRESS, payout: "3000000" },
      { place: 1, playerId: BOT, payout: "7000000" },
    ],
  });

  await test.step("open the heads-up final, both players all in preflop", async () => {
    await page.goto(`/table/${SNG_GAME_ID}`);
    await expect.poll(async () => (await readBus(page)).commitLog.length, { timeout: 15_000 }).toBeGreaterThan(0);
    await inject(preflop);
    await page.waitForTimeout(1500);
    await shot(page, "0-allin");
  });

  const baseline = (await readBus(page)).commitLog.length;
  const injectedAt = Date.now();
  await inject(result);

  await test.step("the run-out plays street by street; nothing about the result shows yet", async () => {
    await afterCommit(page, baseline, 1, 500);
    await shot(page, "1-faceup");
    if (PACED) {
      await expect(page.getByTestId("tournament-winner-moment")).toHaveCount(0);
      await expect(page.getByTestId("sng-result-modal")).toHaveCount(0);
    }
    await afterCommit(page, baseline, 2, 1900);
    await shot(page, "2-flop");
    await afterCommit(page, baseline, 3, 1500);
    await shot(page, "3-turn");
    await afterCommit(page, baseline, 4, 1500);
    await shot(page, "4-river");
    if (PACED) {
      await expect(page.getByTestId("sng-result-modal")).toHaveCount(0);
    }
    await afterCommit(page, baseline, 5, 1200);
    await shot(page, "5-result");
  });

  if (PACED) {
    await test.step("the board took real time — the backpressure valve no longer fast-forwards it", async () => {
      const log = (await readBus(page)).commitLog.slice(baseline);
      expect(log.length).toBeGreaterThanOrEqual(5);
      const runoutMs = log[4].committedAt - log[0].committedAt;
      expect(runoutMs, `run-out played in ${runoutMs}ms`).toBeGreaterThanOrEqual(MIN_RUNOUT_MS);
    });

    await test.step("a held tournament-winner moment comes before the results modal", async () => {
      const moment = page.getByTestId("tournament-winner-moment");
      await expect(moment).toBeVisible({ timeout: 10_000 });
      await expect(page.getByTestId("tournament-winner-headline")).toHaveText("Seat 2 wins the tournament!");
      await expect(page.getByTestId("tournament-winner-hand")).toContainText("with ");
      await expect(page.getByTestId("tournament-winner-prize")).toHaveText("$7.00");
      await expect(page.getByTestId("tournament-winner-runner-up")).toHaveText("Seat 1 finished 2nd · $3.00");
      await expect(page.getByTestId("sng-result-modal")).toHaveCount(0);
      await page.waitForTimeout(600);
      await shot(page, "6-winner-moment");
    });

    await test.step("then the hero's 'You finished 2nd' modal", async () => {
      await expect(page.getByTestId("sng-result-heading")).toHaveText("You finished 2nd!", { timeout: 10_000 });
      await expect(page.getByTestId("tournament-winner-moment")).toHaveCount(0);
      expect(Date.now() - injectedAt).toBeGreaterThan(MIN_RUNOUT_MS);
      await shot(page, "7-result-modal");
    });
  } else {
    await page.waitForTimeout(1000);
    await shot(page, "6-later");
  }

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
