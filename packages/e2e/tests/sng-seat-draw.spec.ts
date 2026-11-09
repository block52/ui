import { test, expect, TEST_ADDRESS, CASH_GAME_ID } from "./fixtures.js";

/**
 * Sit & Go seats are drawn, not picked (ui#969), against the stub's seeded
 * scheduled sit-and-go (SNG_GAME_ID: 6 seats, one bot registered at seat 3).
 * The join popup and an open seat both take a random empty seat; a cash table
 * still names the seat you pick. Saves screenshots under ui/screenshots/ (or
 * SHOTS_DIR) for the PR description.
 */
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const SHOTS = process.env.SHOTS_DIR ?? new URL("../../../screenshots/", import.meta.url).pathname;
const BOT_SEAT = 3;

/** The test wallet's seat in the stub's state, or undefined while unseated. */
async function testWalletSeat(gameId: string): Promise<number | undefined> {
  const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${gameId}`);
  const body = (await res.json()) as { gameState: { players: { address: string; seat: number }[] } };
  return body.gameState.players.find(p => p.address === TEST_ADDRESS)?.seat;
}

test("the Sit & Go join popup takes a drawn seat", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 }); // the whole popup, for the screenshot
  await page.goto(`/table/${SNG_GAME_ID}`);
  const popup = page.getByRole("dialog");
  await expect(popup.getByTestId("seat-draw-note")).toHaveText("Your seat is drawn at random", { timeout: 15_000 });
  await expect(popup.getByRole("button", { name: "Take My Seat" })).toBeEnabled();
  await popup.screenshot({ path: `${SHOTS}sng-seat-draw-join-popup.png` });

  // Taking a seat reloads the page shortly after; the stub has the join by then.
  const reloaded = page.waitForEvent("load", { timeout: 20_000 });
  await popup.getByRole("button", { name: "Take My Seat" }).click();
  await reloaded;
  await expect.poll(() => testWalletSeat(SNG_GAME_ID), { timeout: 10_000 }).toBeDefined();
  expect([1, 2, 4, 5, 6]).toContain(await testWalletSeat(SNG_GAME_ID));
});

test("a spectator sees open seats, and an open seat joins a drawn seat", async ({ page }) => {
  await page.goto(`/table/${SNG_GAME_ID}`);
  await page.getByTestId("sng-spectate").click({ timeout: 15_000 });

  // Five open seats (six minus the bot), none offered by number.
  await expect(page.getByText("Open Seat", { exact: true })).toHaveCount(5);
  await expect(page.getByText(/^Seat \d$/)).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}sng-seat-draw-open-seats.png` });

  await page.getByText("Open Seat", { exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Sit & Go Buy-In" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm & Join", exact: true })).toBeVisible();
  await expect(page.getByTestId("seat-draw-note")).toHaveText("Your seat is drawn at random");
  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Sit & Go Buy-In" }) }).last();
  await modal.screenshot({ path: `${SHOTS}sng-seat-draw-buy-in.png` });

  await page.getByRole("button", { name: "Confirm & Join", exact: true }).click();
  await expect.poll(() => testWalletSeat(SNG_GAME_ID), { timeout: 10_000 }).toBeDefined();
  expect(await testWalletSeat(SNG_GAME_ID)).not.toBe(BOT_SEAT);
});

test("a cash table still names the seat you pick", async ({ page }) => {
  await page.goto(`/table/${CASH_GAME_ID}`);
  await expect(page.getByText("Seat 2", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Open Seat", { exact: true })).toHaveCount(0);
  await page.getByText("Seat 2", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm & Join Seat 2" })).toBeVisible();
  await expect(page.getByTestId("seat-draw-note")).toHaveCount(0);
});
