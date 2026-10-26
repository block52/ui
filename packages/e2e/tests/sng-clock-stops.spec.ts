import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * The blind-level clock stops once a sit-and-go has finished: with 1st place
 * recorded in results[] the header no longer counts on into red overtime.
 * Saves before/after screenshots under ui/screenshots/ for the PR description.
 */
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;
const BOT1 = "b521stubbot00000000000000000000000000000bot";
const BOT2 = "b521stubbot00000000000000000000000000000bt2";

type Json = Record<string, unknown>;

async function stubState(): Promise<Json> {
  const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${SNG_GAME_ID}`);
  return (await res.json()) as Json;
}

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

const seated = (address: string, seat: number, stack: string): Json => ({
  address, seat, stack, isSmallBlind: false, isBigBlind: false, isDealer: false, holeCards: [], status: "active", legalActions: [],
});

test("the blind clock stops when the sit-and-go finishes", async ({ page }) => {
  const base = (await stubState()).gameState as Json;
  const options = base.gameOptions as Json;
  // Level 3 started 12 minutes ago with 10-minute levels: 2 minutes of overtime.
  const levelStartTime = Date.now() - 12 * 60_000;
  const state = (results: Json[], players: Json[]): Json => ({
    ...base,
    handNumber: 9,
    round: "end",
    nextToAct: 0,
    previousActions: [],
    results,
    players,
    gameOptions: { ...options, scheduledStartTime: levelStartTime - 30 * 60_000, sngStartTime: levelStartTime - 20 * 60_000, blindLevelDuration: 10, blindLevel: 2, levelStartTime, lateRegistrationLevels: 0 },
  });

  await page.goto(`/table/${SNG_GAME_ID}`);
  await expect(page.getByTestId("scheduled-start-info")).toBeVisible({ timeout: 15_000 });
  const header = page.getByText(/^Level 3 /).first();
  const headerBar = { x: 0, y: 64, width: 1280, height: 40 };

  await test.step("in play: the level clock runs (here, into overtime)", async () => {
    await inject(state([{ place: 3, playerId: "b521stubbust0", payout: "0" }], [seated(TEST_ADDRESS, 1, "0"), seated(BOT1, 2, "3000"), seated(BOT2, 4, "1500")]));
    await expect(header).toContainText(/\(-\d+:\d\d\)/, { timeout: 15_000 });
    await page.screenshot({ path: `${SHOTS}sng-clock-in-play.png`, clip: headerBar });
  });

  await test.step("finished: 1st place recorded, no clock", async () => {
    await inject(state(
      [{ place: 3, playerId: "b521stubbust0", payout: "0" }, { place: 2, playerId: BOT2, payout: "0" }, { place: 1, playerId: BOT1, payout: "0" }],
      [seated(TEST_ADDRESS, 1, "0"), seated(BOT1, 2, "4500"), seated(BOT2, 4, "0")]
    ));
    await expect(header).not.toContainText("(", { timeout: 15_000 });
    await expect(page.getByTestId("blinds-panel-countdown")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}sng-clock-finished.png`, clip: headerBar });
  });
});
