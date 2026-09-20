import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Frame hardening (ui#623 / block52/pokerchain#364).
 *
 * The relay's contract is one JSON document per WebSocket frame, but the
 * ws-server used to batch queued messages into ONE frame separated by "\n" —
 * and the client parsed the frame as a single document, threw, dropped every
 * message in it and swapped the table for an error page. Two properties are
 * pinned here, numerically via window.__B52_BUS__:
 *
 *   1. a newline-batched frame carrying two state documents commits BOTH
 *      (committed climbs by two, parseFailures stays 0);
 *   2. a frame that is not JSON at all is counted (parseFailures climbs by one),
 *      commits nothing, and the table stays on screen — no error page.
 */

const STUB = "http://localhost:8546";

type BusHandle = {
  committed: number;
  parseFailures: number;
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
      parseFailures: bus?.parseFailures ?? -1,
    };
  });
}

async function injectRaw(frame: string): Promise<void> {
  // `frame` as a STRING is sent verbatim by the stub (chain-ws.ts broadcastRaw),
  // which is how a newline-joined or malformed frame reaches the client.
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ gameId: CASH_GAME_ID, frame }),
  });
}

test("a newline-batched frame commits every document; a malformed frame is counted, not fatal", async ({ page }) => {
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

  const stateDoc = await test.step("build a state document from the current game state", async () => {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    const body = (await res.json()) as GameStateResponse;
    return JSON.stringify({
      event: "action_performed",
      gameId: CASH_GAME_ID,
      data: { format: body.format, variant: body.variant, gameState: body.gameState },
    });
  });

  const baseline = await readBus(page);
  expect(baseline.parseFailures).toBe(0);

  await test.step("two documents in one frame → both commit, nothing counted as a failure", async () => {
    await injectRaw(`${stateDoc}\n${stateDoc}\n`);
    await expect.poll(async () => (await readBus(page)).committed, { timeout: 10_000 }).toBe(baseline.committed + 2);
    expect((await readBus(page)).parseFailures).toBe(0);
  });

  await test.step("a frame that is not JSON → counted, nothing commits, the table stays up", async () => {
    await injectRaw("not-json{{{");
    await expect.poll(async () => (await readBus(page)).parseFailures, { timeout: 10_000 }).toBe(1);
    expect((await readBus(page)).committed).toBe(baseline.committed + 2);
    // No error page: the action bar of the live hand is still on screen.
    await expect(page.locator(".btn-call")).toBeVisible();
    await expect(page.getByText(/Error parsing WebSocket message/i)).toHaveCount(0);
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
