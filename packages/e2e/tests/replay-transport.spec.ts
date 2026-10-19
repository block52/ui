import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * In-table replay (ui#816): play a hand to showdown, press the circle-arrow
 * Replay button — it opens the previous hand's replay in a new tab — and drive
 * the media transport: step back, play through, skip between hands.
 *
 * The replay URL is captured from window.open and opened in THIS page (the
 * seeded wallet + Stub network live in this page's localStorage), which is the
 * same navigation the new tab makes.
 */
const SHOTS = new URL("../../../screenshots/", import.meta.url).pathname;

test("replay button opens the previous hand with working transport controls", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await test.step("open the seeded table: no completed hand yet, the button is disabled", async () => {
    // `?autonewhand=false` freezes the END state so hand 2 is not dealt under us
    // (which would make it the table's latest hand and enable "next hand").
    await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("open-replay")).toBeDisabled();
  });

  const SEAT = 5;
  await test.step(`sit down at seat ${SEAT} and play a hand to showdown`, async () => {
    await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-call").click();
    for (const _street of ["flop", "turn", "river"]) {
      await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
      await page.locator(".btn-check").click();
    }
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 15_000 });
  });

  let replayUrl = "";
  await test.step("the Replay button opens hand #1 in a new tab", async () => {
    const button = page.getByTestId("open-replay");
    await expect(button).toBeEnabled({ timeout: 10_000 });
    await expect(button).toHaveAttribute("title", /Replay hand #1/);
    await page.evaluate(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = ((url: string, target: string) => {
        (window as unknown as { __opened: string[] }).__opened.push(`${target} ${url}`);
        return null;
      }) as typeof window.open;
    });
    await button.click();
    const opened = await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened);
    expect(opened).toHaveLength(1);
    expect(opened[0]).toMatch(new RegExp(`^_blank .*\\/table\\/${CASH_GAME_ID}\\?hand=1$`));
    replayUrl = opened[0].split(" ")[1];
  });

  await test.step("the replay opens at the hand's final state with the transport", async () => {
    await page.goto(replayUrl);
    const transport = page.getByTestId("replay-transport");
    await expect(transport).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("replay-hand")).toHaveText(/Hand #1/);
    await expect(page.getByTestId("replay-step")).toContainText(/Step \d+ \/ \d+/, { timeout: 15_000 });
    // The live action panel is gone: no action buttons in a replay.
    await expect(page.locator(".btn-check")).toHaveCount(0);
  });

  await test.step("step back twice, then play to the end at 4×", async () => {
    const stepLabel = page.getByTestId("replay-step");
    const total = Number((await stepLabel.textContent())!.match(/Step (\d+) \/ (\d+)/)![2]);
    expect(total).toBeGreaterThan(3);
    await page.getByTestId("replay-step-back").click();
    await page.getByTestId("replay-step-back").click();
    await expect(stepLabel).toContainText(`Step ${total - 2} / ${total}`, { timeout: 10_000 });
    await page.waitForTimeout(1200); // let the cards finish dropping in before the picture
    await page.screenshot({ path: `${SHOTS}replay-transport-stepped-back.png` });

    await page.getByTestId("replay-speed").selectOption("4");
    await page.getByTestId("replay-play").click();
    await expect(stepLabel).toContainText(`Step ${total} / ${total}`, { timeout: 30_000 });
    await expect(page.getByTestId("replay-play")).toHaveAttribute("aria-label", "Play");
  });

  await test.step("skip back to the deal with the slider", async () => {
    await page.getByTestId("replay-seek").fill("0");
    await expect(page.getByTestId("replay-step")).toContainText(/Step 1 \//, { timeout: 10_000 });
    await expect(page.getByTestId("replay-step")).toContainText("Cards dealt");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}replay-transport-deal.png` });
  });

  await test.step("hand navigation: no earlier hand, no later hand yet", async () => {
    await expect(page.getByTestId("replay-prev-hand")).toBeDisabled();
    await expect(page.getByTestId("replay-next-hand")).toBeDisabled();
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
