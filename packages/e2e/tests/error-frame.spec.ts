import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Error-frame surfacing (WS Action Bus, Phase 3 / plan §5.5).
 *
 * An injected `error` / GAME_NOT_FOUND frame jumps the queue and surfaces
 * immediately (Commandment 7) — asserted numerically via __B52_BUS__ and
 * visually via the error text.
 */

const STUB = "http://localhost:8546";

type BusHandle = { committed: number };

test("an error frame surfaces immediately", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  const baseline = await page.evaluate(() => (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.committed ?? 0);

  await test.step("inject a GAME_NOT_FOUND error frame — it commits at once", async () => {
    await fetch(`${STUB}/__control/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: CASH_GAME_ID,
        frame: {
          type: "error",
          code: "GAME_NOT_FOUND",
          message: "Game not found",
          details: { suggestion: "Check the table id" }
        }
      })
    });
    await expect
      .poll(async () => page.evaluate(() => (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.committed ?? 0), {
        timeout: 10_000
      })
      .toBe(baseline + 1);
  });

  await test.step("the error text is surfaced in the UI", async () => {
    await expect(page.getByText(/Game not found/i).first()).toBeVisible({ timeout: 10_000 });
  });

  // A surfaced game error is expected; assert it did not throw an uncaught error.
  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
