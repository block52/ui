import { test, expect, CASH_GAME_ID, TEST_ADDRESS } from "./fixtures.js";

/**
 * Winner wording comes from the SDK, not the chain (poker-vm#2721).
 *
 * The engine sends a showdown winner as its best five cards with no `name` or
 * `description`. The UI fills the wording in at ingest (withWinnerDescriptions),
 * so the seat still shows the hand in words. A pocket pair plus one on the board
 * reads "Set of Sevens"; the board is what tells it from trips.
 *
 * SHOTS_DIR, when set, saves a screenshot for the PR.
 */

const STUB = "http://localhost:8546";
const HERO_SEAT = 5;
const BOARD = ["7H", "KC", "9S", "2D", "4C"];

type PlayerLike = { address: string; seat: number; holeCards?: string[]; status?: string };
type StateLike = { players: PlayerLike[]; communityCards: string[]; winners: unknown[]; round: string; nextToAct: number; legalActions: unknown[] };
type GameStateResponse = { gameId: string; format: string; variant: string; gameState: StateLike };

test("a showdown winner sent as cards only reads in words on the seat", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(`Seat ${HERO_SEAT}`, { exact: true }).click();
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${HERO_SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("inject a showdown frame in the new engine shape: cards, no wording", async () => {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    const body = (await res.json()) as GameStateResponse;
    const state = body.gameState;
    state.round = "end";
    state.communityCards = BOARD;
    state.legalActions = [];
    for (const p of state.players) {
      // Real cards on every seat: an empty hero hand trips the hole-card watchdog (ui#409).
      p.holeCards = p.address === TEST_ADDRESS ? ["7S", "7D"] : ["AC", "QD"];
      p.status = "showing";
    }
    state.winners = [{ address: TEST_ADDRESS, seat: HERO_SEAT, amount: "4000000", cards: ["KC", "9S", "7S", "7D", "7H"] }];
    await fetch(`${STUB}/__control/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: CASH_GAME_ID,
        frame: { event: "action_performed", gameId: CASH_GAME_ID, data: { format: body.format, variant: body.variant, gameState: state } },
      }),
    });
  });

  await test.step("the seat names the hand", async () => {
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 10_000 });
    if (process.env.SHOTS_DIR) {
      await page.screenshot({ path: `${process.env.SHOTS_DIR}/${process.env.SHOT_PREFIX ?? "after"}-winner-description.png` });
    }
    if (process.env.EXPECT_WORDS !== "false") {
      await expect(page.getByText("Set of Sevens").first()).toBeVisible();
    }
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
