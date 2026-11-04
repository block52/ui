import { test, expect, CASH_GAME_ID, TEST_ADDRESS } from "./fixtures.js";

/**
 * A loser who busts on the showdown keeps their hand face up (poker-vm#2758).
 *
 * After the payout the engine moves a busted cash player to sitting-out (busted
 * in a sit-and-go or tournament), so their status is no longer `showing`. Every
 * hand that reaches the showdown is tabled (all-ins face up, TDA Rule 16): the
 * engine marks it `cardsShown`, and the seat must draw its cards, not backs.
 *
 * SHOTS_DIR, when set, saves a screenshot for the PR. EXPECT_SHOWN=false runs
 * the same steps against a build without the fix (the "before" shot).
 */

const STUB = "http://localhost:8546";
const HERO_SEAT = 5;
const BOARD = ["7H", "2C", "9S", "3D", "4C"];

type PlayerLike = { address: string; seat: number; holeCards?: string[]; status?: string; stack?: string; cardsShown?: boolean };
type StateLike = { players: PlayerLike[]; communityCards: string[]; winners: unknown[]; round: string; legalActions: unknown[] };
type GameStateResponse = { gameId: string; format: string; variant: string; gameState: StateLike };

test("a loser who busts on the showdown has their hand shown", async ({ page }) => {
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

  await test.step("inject the showdown: we win, the caller busts and sits out", async () => {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    const body = (await res.json()) as GameStateResponse;
    const state = body.gameState;
    state.round = "end";
    state.communityCards = BOARD;
    state.legalActions = [];
    for (const p of state.players) {
      if (p.address === TEST_ADDRESS) {
        p.holeCards = ["AS", "AD"];
        p.status = "showing";
      } else {
        p.holeCards = ["KS", "KD"];
        p.status = "sitting-out";
        p.stack = "0";
      }
      p.cardsShown = true;
    }
    state.winners = [{ address: TEST_ADDRESS, seat: HERO_SEAT, amount: "4000000", cards: ["AS", "AD", "9S", "7H", "4C"] }];
    await fetch(`${STUB}/__control/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: CASH_GAME_ID,
        frame: { event: "action_performed", gameId: CASH_GAME_ID, data: { format: body.format, variant: body.variant, gameState: state } },
      }),
    });
  });

  await test.step("the busted seat shows its kings", async () => {
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 10_000 });
    if (process.env.EXPECT_SHOWN !== "false") {
      await expect(page.getByAltText("Player Card 1").first()).toBeVisible();
      await expect(page.getByAltText("Opposite Player Card")).toHaveCount(0);
    }
    if (process.env.SHOTS_DIR) {
      await page.screenshot({ path: `${process.env.SHOTS_DIR}/${process.env.SHOT_PREFIX ?? "after"}-busted-cards-shown.png` });
    }
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
