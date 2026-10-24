import { test, expect } from "./fixtures.js";

/**
 * Dismissible Sit & Go auto-join modal (ui#837) — a player who is late to the
 * tournament or short on funds must be able to close the modal and WATCH the
 * table instead of being stuck behind the overlay. Each step saves a
 * screenshot under ui/screenshots/ for the PR description.
 */
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("auto-join modal: dismiss to spectate, reopen to join", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);

  await test.step("the modal opens over the table with a spectate exit", async () => {
    const modal = page.getByTestId("sng-autojoin-modal");
    await expect(modal).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("sng-autojoin-close-btn")).toBeVisible();
    await expect(page.getByTestId("sng-autojoin-spectate-btn")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}sng-autojoin-dismissible.png` });
  });

  await test.step("Watch as Spectator clears the overlay and leaves a reopen pill", async () => {
    await page.getByTestId("sng-autojoin-spectate-btn").click();
    await expect(page.getByTestId("sng-autojoin-modal")).toBeHidden();
    await expect(page.getByTestId("sng-autojoin-reopen-btn")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}sng-autojoin-spectating.png` });
  });

  await test.step("the reopen pill brings the join modal back", async () => {
    await page.getByTestId("sng-autojoin-reopen-btn").click();
    await expect(page.getByTestId("sng-autojoin-modal")).toBeVisible();
    await expect(page.getByTestId("sng-autojoin-reopen-btn")).toBeHidden();
  });

  await test.step("Escape also dismisses the modal", async () => {
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("sng-autojoin-modal")).toBeHidden();
    await expect(page.getByTestId("sng-autojoin-reopen-btn")).toBeVisible();
  });
});

const STUB = "http://localhost:8546";
type Json = Record<string, unknown>;

async function injectSng(gameState: Json): Promise<void> {
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: SNG_GAME_ID,
      frame: { event: "action_performed", gameId: SNG_GAME_ID, data: { format: "sit-and-go", variant: "texas-holdem", gameState } },
    }),
  });
}

const active = (address: string, seat: number): Json => ({
  address, seat, stack: "1450", isSmallBlind: false, isBigBlind: false, isDealer: false, holeCards: [], status: "active", legalActions: [],
});

test("spectator: click an open seat to late-register; closed seats say so", async ({ page }) => {
  const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${SNG_GAME_ID}`);
  const base = ((await res.json()) as Json).gameState as Json;
  const started = (sngStartTime: number): Json => ({
    ...base,
    handNumber: 4,
    previousActions: [],
    results: [],
    gameOptions: { ...(base.gameOptions as Json), scheduledStartTime: sngStartTime - 60_000, sngStartTime, blindLevelDuration: 10, lateRegistrationLevels: 3 },
    players: [active("b521stubbot00000000000000000000000000000bot", 2), active("b521stubbot00000000000000000000000000000bt2", 4)],
  });

  await page.goto(`/table/${SNG_GAME_ID}`);
  await expect(page.getByTestId("sng-autojoin-modal")).toBeVisible({ timeout: 15_000 });

  await test.step("late registration open: watch, then click a seat to join", async () => {
    await injectSng(started(Date.now() - 5 * 60_000));
    await expect(page.getByTestId("late-registration-open")).toBeVisible({ timeout: 10_000 });
    await page.getByTestId("sng-autojoin-spectate-btn").click();
    await expect(page.getByTestId("sng-autojoin-modal")).toBeHidden();
    await expect(page.getByText("Click to Join").first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}spectator-seats-open.png` });
    await page.getByText("Seat 3", { exact: true }).click();
    await expect(page.getByText("Sit & Go Buy-In")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}spectator-seat-buyin.png` });
  });

  await test.step("late registration over: the buy-in closes and the open seats say Registration closed", async () => {
    await injectSng(started(Date.now() - 2 * 60 * 60_000));
    await expect(page.getByText("Sit & Go Buy-In")).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText("Registration closed").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Click to Join")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}spectator-seats-closed.png` });
  });
});
