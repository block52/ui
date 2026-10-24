import { test, expect, CASH_GAME_ID } from "./fixtures.js";
import type { Page } from "@playwright/test";

/**
 * Animation acks (WS Action Bus, Phase 5 / plan §2.7, §5.5).
 *
 * With the stub in per-frame mode (frameDelayMs 150), each street's deal arrives
 * as its own frame. The communityCardStagger decorator opts that frame's
 * `dealCards` hint into a drain-gating ACK; useCardAnimations (mounted in
 * TableBoard) resolves it via bus.ackAnimation once the staggered flip reveal
 * finishes. We assert numerically against window.__B52_BUS__ (§5.4):
 *
 *   - `ackTimeouts === 0` — every street's ack resolved before its timeout fired
 *     (the happy path: the render layer, not a fixed guess, released the drain);
 *   - `pendingAcks === 0` — nothing left dangling at the end of the hand;
 *   - a commitLog inter-commit gap comfortably exceeds the 150ms frame cadence —
 *     lower-bound proof that a commit was HELD by a gate (the flop/turn/river ack
 *     or the showdown hold), not merely paced by frame delay.
 *
 * Lower-bound assertions only, to stay unflaky under scheduler jitter.
 */

const STUB = "http://localhost:8546";

type BusHandle = {
  committed: number;
  pendingAcks: number;
  ackTimeouts: number;
  commitLog: Array<{ seq: number; committedAt: number; eventCount: number }>;
};

/** The frame cadence; a gap well beyond this means a commit was gated, not paced. */
const FRAME_DELAY_MS = 150;
/** Conservative lower bound proving a gate held (flop ack ≈ 1300ms, showdown 2000ms). */
const GATE_LOWER_BOUND_MS = 600;

function readBus(page: Page): Promise<BusHandle> {
  return page.evaluate(() => {
    const bus = (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__;
    return {
      committed: bus?.committed ?? 0,
      pendingAcks: bus?.pendingAcks ?? 0,
      ackTimeouts: bus?.ackTimeouts ?? 0,
      commitLog: bus?.commitLog ?? []
    };
  });
}

async function playToShowdown(page: Page): Promise<void> {
  await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  await page.locator(".btn-call").click(); // preflop: call the big blind
  for (const _street of ["flop", "turn", "river"] as const) {
    await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-check").click();
  }
}

test("street-deal commits gate on the animation ack and resolve without timing out", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("enable per-frame broadcasting", async () => {
    const res = await fetch(`${STUB}/__control/config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frameDelayMs: FRAME_DELAY_MS }),
    });
    expect(res.ok).toBeTruthy();
  });

  await test.step("open the seeded table and sit down", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByRole("button", { name: /^Sit in seat / }).first()).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: "Sit in seat 5" }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("play the hand to showdown (flop, turn, river all dealt)", async () => {
    await playToShowdown(page);
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 15_000 });
  });

  await test.step("acks all resolved without timing out, nothing left pending", async () => {
    // Let any final commit settle, then read the counters.
    await expect
      .poll(async () => (await readBus(page)).pendingAcks, { timeout: 15_000 })
      .toBe(0);

    const bus = await readBus(page);
    expect(bus.ackTimeouts, "an animation ack fell back to its timeout").toBe(0);
    expect(bus.commitLog.length).toBeGreaterThan(2);

    // At least one commit was HELD by a gate (ack or showdown hold), not merely
    // paced by the 150ms frame cadence.
    let maxGap = 0;
    for (let i = 1; i < bus.commitLog.length; i++) {
      maxGap = Math.max(maxGap, bus.commitLog[i].committedAt - bus.commitLog[i - 1].committedAt);
    }
    expect(maxGap, `largest inter-commit gap was only ${Math.round(maxGap)}ms`).toBeGreaterThanOrEqual(GATE_LOWER_BOUND_MS);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
