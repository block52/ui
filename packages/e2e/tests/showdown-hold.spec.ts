import { test, expect, CASH_GAME_ID } from "./fixtures.js";
import type { Page } from "@playwright/test";

/**
 * Showdown-hold pacing (WS Action Bus, Phase 3 / plan §5.5).
 *
 * With auto-new-hand ON (the paced path), a hand's WINS banner must stay visible
 * for the showdown-hold window before the next hand replaces it. We measure the
 * inter-commit gap from the bus introspection timestamps rather than the
 * wall-clock interval between two DOM visibility polls. The showdown hold is
 * 2000ms; we bound at 1000ms to leave ample margin for scheduler jitter while
 * still proving a real hold (the 150ms frame cadence would otherwise replace it
 * near instantly). This is the regression proof that pacing keeps the showdown
 * visible after the useAutoNewHand timer was retired.
 */

const LOWER_BOUND_MS = 1_000;

type BusHandle = {
  commitLog: Array<{ seq: number; committedAt: number; eventCount: number }>;
};

function readBus(page: Page): Promise<BusHandle> {
  return page.evaluate(() => ({
    commitLog: (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.commitLog ?? [],
  }));
}

async function playToShowdown(page: Page): Promise<void> {
  await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  await page.locator(".btn-call").click(); // preflop: call the big blind
  for (const _street of ["flop", "turn", "river"] as const) {
    await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-check").click();
  }
}

test("the WINS banner stays visible for the showdown hold before the next hand", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table (auto-new-hand ON) and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("play the hand to showdown", async () => {
    await playToShowdown(page);
  });

  const banner = page.locator(".seat-banner-text", { hasText: "WINS" });

  await test.step("banner appears, then persists through the hold before the next hand", async () => {
    await expect(banner).toBeVisible({ timeout: 15_000 });
    // The banner is rendered from the showdown commit. Record that commit's
    // timestamp from the bus rather than the time a Playwright visibility poll
    // happens to observe the DOM.
    const beforeNextHand = await readBus(page);
    const showdownCommit = beforeNextHand.commitLog.at(-1);
    expect(showdownCommit, "showdown commit was not recorded").toBeDefined();

    // Auto-new-hand + showdownHold hold the banner, then hand #2 commits and the
    // winner banner clears. Measure the inter-commit gap.
    await expect(banner).toBeHidden({ timeout: 15_000 });
    const afterNextHand = await readBus(page);
    const nextCommit = afterNextHand.commitLog.find(commit => commit.committedAt > showdownCommit!.committedAt);
    expect(nextCommit, "next-hand commit was not recorded").toBeDefined();

    const heldForMs = nextCommit!.committedAt - showdownCommit!.committedAt;
    expect(heldForMs, `showdown banner was only visible ${heldForMs}ms`).toBeGreaterThanOrEqual(LOWER_BOUND_MS);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
