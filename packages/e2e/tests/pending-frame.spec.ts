import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Pending-frame surfacing (WS Action Bus, Phase 3 / plan §5.5).
 *
 * A `pending` frame is optimistic UI ("someone is acting") — it must surface
 * IMMEDIATELY, jumping any active showdown hold, because it carries no snapshot
 * and never disturbs the serialized STATE ordering. We assert numerically via the
 * bus handle (window.__B52_BUS__): injecting a pending frame increments
 * `committed` at once, even while a state hold could be running.
 */

const STUB = "http://localhost:8546";

type BusHandle = { committed: number };

function readCommitted(page: import("@playwright/test").Page) {
  return page.evaluate(() => (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.committed ?? 0);
}

test("a pending frame commits immediately", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByRole("button", { name: /^Sit in seat / }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Sit in seat 5" }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  const baseline = await readCommitted(page);

  await test.step("inject a pending frame", async () => {
    await fetch(`${STUB}/__control/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        gameId: CASH_GAME_ID,
        frame: { event: "pending", gameId: CASH_GAME_ID, data: { gameId: CASH_GAME_ID, actor: "b521bot", action: "call", amount: "0" } }
      })
    });
    // The pending frame commits at once (no snapshot, jumps any hold).
    await expect.poll(async () => readCommitted(page), { timeout: 10_000 }).toBe(baseline + 1);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
