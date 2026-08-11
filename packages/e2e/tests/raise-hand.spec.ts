import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Aggressive line: drive the BET/RAISE path (both render as `.btn-raise`, keyed by
 * label). RAISE preflop, BET the flop, then check it down to showdown. The bot only
 * calls/checks, so the human takes it to showdown and wins. Exercises the raise
 * slider's default (min) amount + the bet/raise submit handlers end-to-end.
 */

test("raise preflop and bet the flop, through to showdown", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table", async () => {
    await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
  });

  const SEAT = 5;
  await test.step(`sit down at seat ${SEAT} (buy in)`, async () => {
    await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("preflop: RAISE (default min raise)", async () => {
    // Facing the big blind, RAISE is offered; the slider defaults to the min
    // raise, so the enabled `.btn-raise` submits a valid RAISE TO.
    const raise = page.locator(".btn-raise", { hasText: /RAISE/i });
    await expect(raise).toBeEnabled({ timeout: 15_000 });
    await raise.click();
  });

  await test.step("flop: BET (default min bet)", async () => {
    // New street, no bet to face → the same button now reads BET.
    const bet = page.locator(".btn-raise", { hasText: /BET/i });
    await expect(bet).toBeEnabled({ timeout: 15_000 });
    await bet.click();
  });

  for (const street of ["turn", "river"] as const) {
    await test.step(`${street}: CHECK`, async () => {
      await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
      await page.locator(".btn-check").click();
    });
  }

  await test.step("showdown: a winner is declared", async () => {
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({
      timeout: 15_000,
    });
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
