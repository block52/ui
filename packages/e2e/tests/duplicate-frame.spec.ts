import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Duplicate-frame dedup (WS Action Bus, Phase 2 / plan §5.5).
 *
 * Injecting the same state frame twice must COMMIT each frame (the render track
 * always advances) but derive ZERO new events for a frame identical to the one
 * before it — so no double badge / double sound. We assert numerically via the
 * bus's dev introspection handle (window.__B52_BUS__, §5.4): `committed` climbs
 * by two while `totalEvents` is unchanged and the last commit's `lastEventCount`
 * is 0.
 */

const STUB = "http://localhost:8546";

type BusHandle = {
  committed: number;
  totalEvents: number;
  lastEventCount: number;
};

type GameStateResponse = {
  gameId: string;
  format: string;
  variant: string;
  gameState: unknown;
};

function readBus(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const bus = (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__;
    return {
      committed: bus?.committed ?? 0,
      totalEvents: bus?.totalEvents ?? 0,
      lastEventCount: bus?.lastEventCount ?? -1,
    };
  });
}

test("duplicate frame commits but derives no new events", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
    // A stable point: it's our turn, so no engine frames arrive until we act.
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  // Fetch the current canonical state and wrap it as a chain state frame.
  const frame = await test.step("build a state frame from the current game state", async () => {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    const body = (await res.json()) as GameStateResponse;
    return {
      event: "action_performed",
      gameId: CASH_GAME_ID,
      data: { format: body.format, variant: body.variant, gameState: body.gameState },
    };
  });

  const inject = async () => {
    await fetch(`${STUB}/__control/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: CASH_GAME_ID, frame }),
    });
  };

  const baseline = await readBus(page);

  await test.step("inject the frame once", async () => {
    await inject();
    await expect.poll(async () => (await readBus(page)).committed, { timeout: 10_000 }).toBe(baseline.committed + 1);
  });
  const afterFirst = await readBus(page);

  await test.step("inject the identical frame again", async () => {
    await inject();
    await expect.poll(async () => (await readBus(page)).committed, { timeout: 10_000 }).toBe(baseline.committed + 2);
  });
  const afterSecond = await readBus(page);

  await test.step("second (duplicate) frame derived zero new events", async () => {
    // Both injects are identical to the frame already in hand, so neither adds
    // events — the render track still advanced twice (dedup, not drop).
    expect(afterSecond.lastEventCount).toBe(0);
    expect(afterSecond.totalEvents).toBe(afterFirst.totalEvents);
    expect(afterSecond.totalEvents).toBe(baseline.totalEvents);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
