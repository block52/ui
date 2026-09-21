import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Reconnect (ui#613, WS Action Bus plan §5.5).
 *
 * The relay drops the socket mid-hand (POST /__control/disconnect). The UI must
 * recover ON ITS OWN — no navigation: the banner reports the reconnect, the
 * provider re-subscribes with a bounded backoff, the relay answers with the
 * current state, and the table is live again with the hand still where it was.
 * The commit log stays strictly monotonic across the reconnect (the bus resets
 * its queue but never reuses a seq), and the catch-up frame derives no events.
 */

const STUB = "http://localhost:8546";

type BusHandle = { commitLog: Array<{ seq: number }>; totalEvents: number; lastEventCount: number };

function readBus(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const bus = (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__;
    return {
      seqs: bus?.commitLog.map((e) => e.seq) ?? [],
      totalEvents: bus?.totalEvents ?? 0,
      lastEventCount: bus?.lastEventCount ?? -1,
    };
  });
}

test("recovers in place after a mid-hand WS drop: reconnects, re-snapshots, stays monotonic", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table and sit down (mid-hand)", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".table-container")).toHaveAttribute("data-connection", "live");
  });

  const before = await readBus(page);

  await test.step("force a mid-hand WS drop → the banner reports the reconnect", async () => {
    const res = await fetch(`${STUB}/__control/disconnect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: CASH_GAME_ID }),
    });
    expect(res.ok).toBeTruthy();
    await expect(page.getByTestId("connection-banner")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId("connection-banner")).toContainText(/reconnecting/i);
  });

  await test.step("the UI re-subscribes on its own and the table is live again", async () => {
    await expect(page.locator(".table-container")).toHaveAttribute("data-connection", "live", { timeout: 15_000 });
    await expect(page.getByTestId("connection-banner")).toHaveCount(0);
    // Catch-up: the current hand renders again — it is still our turn to CALL.
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("the commit log is strictly monotonic and the catch-up frame derived no events", async () => {
    const after = await readBus(page);
    expect(after.seqs.length).toBeGreaterThan(before.seqs.length);
    for (let i = 1; i < after.seqs.length; i++) {
      expect(after.seqs[i]).toBeGreaterThan(after.seqs[i - 1]);
    }
    expect(after.lastEventCount).toBe(0);
    expect(after.totalEvents).toBe(before.totalEvents);
  });

  await test.step("play on after the reconnect — actions are accepted again", async () => {
    await page.locator(".btn-call").click();
    await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
