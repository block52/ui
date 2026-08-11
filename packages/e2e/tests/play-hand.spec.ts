import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * The marquee e2e: drive the REAL UI through a whole hand against @block52/pvm-stub
 * — funded wallet, sit down, and play preflop → flop → turn → river → showdown,
 * with the auto-bot (check/call) as opponent. No chain, no funds, one window.
 *
 * Selectors are the app's stable action classes (.btn-call/.btn-check/…) and the
 * winner banner (.seat-banner-text "WINS"); see the mapped selectors in the plan.
 */

test("play a full hand solo vs. the stub bot, to showdown", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
  });

  // Seat 5 is top-center and clear of the footer action panel (seats 1-2 sit
  // behind it). The engine seats the human wherever they click.
  const SEAT = 5;
  await test.step(`sit down at seat ${SEAT} (buy in)`, async () => {
    await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
    // Cash-game buy-in modal — the Confirm button uniquely confirms it opened
    // (the buy-in defaults to max, which our $1000 balance covers).
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("preflop: it's our turn — CALL the big blind", async () => {
    // Action buttons only render on our turn (nextToAct === our seat).
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-call").click();
  });

  // Bot auto-checks/-calls between our turns; each street we check it down.
  for (const street of ["flop", "turn", "river"] as const) {
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
