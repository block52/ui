import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Burst catch-up + coalescing (WS Action Bus, Phase 3 / plan §5.5).
 *
 * We script a burst (all frames at delayMs 0) whose FIRST frame is a showdown
 * (handEnded) — that opens a 2s showdown hold — followed by several intermediate
 * frames and a final frame. The intermediates pile up behind the hold and are
 * coalesced away, while the handEnded (committed first) and the newest frame
 * survive. Asserted numerically via window.__B52_BUS__:
 *   - `coalesced > 0` (dropping actually happened),
 *   - the render track advanced but by FEWER commits than frames sent,
 *   - zero page errors (the final state converged cleanly).
 */

const STUB = "http://localhost:8546";

type BusHandle = { committed: number; coalesced: number };

type GameStateResponse = { format: string; variant: string; gameState: Record<string, unknown> };

function readBus(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const bus = (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__;
    return { committed: bus?.committed ?? 0, coalesced: bus?.coalesced ?? 0 };
  });
}

test("a burst is coalesced, keeping the showdown and converging to the newest frame", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table and sit down (establishes a baseline snapshot)", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText("Seat 5", { exact: true }).click();
    const confirm = page.getByRole("button", { name: /Confirm & Join Seat 5/i });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  const frames = await test.step("build a handEnded-first burst from the current state", async () => {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    const body = (await res.json()) as GameStateResponse;
    const base = body.gameState;

    const handNumber = Number(base.handNumber);
    const startIndex = Number(base.actionCount) + 100; // well above the base max — no regression
    const basePrev = (base.previousActions as unknown[]) ?? [];
    const humanAddress = String((base.players as Array<{ address: string }>)?.[0]?.address ?? "b521winner");

    const winner = { address: humanAddress, amount: "1000", cards: ["AH", "KD"], name: "Winner", description: "High Card" };

    const syntheticAction = (i: number) => ({
      playerId: "b521bot",
      seat: 2,
      action: "check",
      amount: "0",
      round: "end",
      index: startIndex + i,
      timestamp: 0
    });

    const wrap = (gameState: Record<string, unknown>) => ({
      event: "action_performed",
      gameId: CASH_GAME_ID,
      data: { format: body.format, variant: body.variant, gameState }
    });

    const seq: Array<{ frame: unknown; delayMs: number }> = [];

    // f0: showdown — opens the 2s hold.
    seq.push({
      frame: wrap({ ...base, handNumber, winners: [winner], round: "end" }),
      delayMs: 0
    });

    // f1..f8: intermediate coalescible frames (winners already populated -> no
    // new handEnded; growing previousActions -> a new playerActed each).
    const actions = [...basePrev];
    for (let i = 0; i < 8; i++) {
      actions.push(syntheticAction(i));
      seq.push({
        frame: wrap({ ...base, handNumber, winners: [winner], round: "end", previousActions: [...actions], actionCount: startIndex + i }),
        delayMs: 0
      });
    }
    return seq;
  });

  const before = await readBus(page);

  await test.step("replay the burst", async () => {
    const res = await fetch(`${STUB}/__control/script`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: CASH_GAME_ID, frames })
    });
    expect(res.ok).toBeTruthy();
  });

  await test.step("the burst coalesced and the render track advanced by fewer than the frames sent", async () => {
    // Wait for the showdown hold to elapse and the queue to fully drain. The
    // newest frame commits only AFTER the 2s showdown hold opened by the leading
    // handEnded frame, so we must wait for BOTH coalescing to have happened AND
    // the render track to have committed the surviving frames — polling on
    // `coalesced` alone can read mid-hold (coalescing fires the instant the burst
    // is queued, before the newest frame lands).
    await expect
      .poll(
        async () => {
          const bus = await readBus(page);
          return bus.coalesced > before.coalesced && bus.committed - before.committed >= 2;
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    const after = await readBus(page);
    const committedDelta = after.committed - before.committed;
    expect(committedDelta).toBeGreaterThanOrEqual(2); // handEnded + newest at least
    expect(committedDelta).toBeLessThan(frames.length); // some frames were dropped
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
