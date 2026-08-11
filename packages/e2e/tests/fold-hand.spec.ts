import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Fold path: sit down, then FOLD preflop → the sole surviving opponent (the bot)
 * wins the pot. Asserts the winner banner appears AND our own seat shows FOLD, so
 * the win is attributable to the opponent, not us. `?autonewhand=false` freezes the
 * END state so the terminal snapshot doesn't re-deal out from under the assertions.
 */

test("fold preflop and the opponent wins the pot", async ({ page }) => {
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

  await test.step("preflop: it's our turn — FOLD", async () => {
    await expect(page.locator(".btn-fold")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-fold").click();
  });

  await test.step("the opponent wins; our seat shows FOLD", async () => {
    // A winner banner appears (the bot, sole survivor) ...
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({
      timeout: 15_000,
    });
    // ... and our folded seat is badged FOLD, proving we didn't win.
    await expect(page.locator(".seat-banner-text", { hasText: "FOLD" })).toBeVisible();
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
