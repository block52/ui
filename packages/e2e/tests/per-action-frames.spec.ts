import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * Per-action frame fidelity (WS Action Bus, Phase 2 / plan §5.5).
 *
 * With the stub in per-frame mode (frameDelayMs: 150) each engine step — the
 * human action, then each bot action — is broadcast as its OWN frame, ~150ms
 * apart, reproducing the live gateway stream (instead of one collapsed frame).
 *
 * We assert numerically against the bus's dev introspection handle
 * (window.__B52_BUS__, §5.4) rather than screenshot-timing: a single human CALL
 * must produce MULTIPLE committed frames (its own + the bot's separate frame),
 * and every commit's seq is strictly increasing (serialization guarantee).
 */

const STUB = "http://localhost:8546";

type BusHandle = {
  committed: number;
  commitLog: Array<{ seq: number; committedAt: number; eventCount: number }>;
};

test("per-action frames: one human action yields multiple ordered commits", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  // Enable per-frame broadcasting BEFORE the UI acts (fixtures reset the stub,
  // which also clears this config, so set it after navigation-time reset).
  await test.step("enable per-frame broadcasting", async () => {
    const res = await fetch(`${STUB}/__control/config`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ frameDelayMs: 150 }),
    });
    expect(res.ok).toBeTruthy();
  });

  await test.step("open the seeded table", async () => {
    await page.goto(`/table/${CASH_GAME_ID}`);
    await expect(page.getByRole("button", { name: /^Sit in seat / }).first()).toBeVisible({ timeout: 15_000 });
  });

  const SEAT = 5;
  await test.step(`sit down at seat ${SEAT}`, async () => {
    await page.getByRole("button", { name: `Sit in seat ${SEAT}` }).click();
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
  });

  await test.step("preflop: wait for our turn", async () => {
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
  });

  // Baseline commit count just before the human action.
  const baseline = await page.evaluate(() => (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.committed ?? 0);

  await test.step("CALL — expect the human frame AND the bot frame as separate commits", async () => {
    await page.locator(".btn-call").click();

    // Poll the bus until at least two more frames have committed (human CALL +
    // bot CHECK arriving as its own delayed frame).
    await expect
      .poll(
        async () =>
          page.evaluate(() => (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.committed ?? 0),
        { timeout: 10_000 }
      )
      .toBeGreaterThanOrEqual(baseline + 2);
  });

  await test.step("commit log is strictly seq-ordered", async () => {
    const seqs = await page.evaluate(
      () => (window as unknown as { __B52_BUS__?: BusHandle }).__B52_BUS__?.commitLog.map((e) => e.seq) ?? []
    );
    expect(seqs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < seqs.length; i++) {
      expect(seqs[i]).toBeGreaterThan(seqs[i - 1]);
    }
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
