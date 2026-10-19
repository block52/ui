import { test, expect, CASH_GAME_ID } from "./fixtures.js";
import type { Page } from "@playwright/test";

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

/** Our own seat renders face cards as `Card N`; an opponent's shown cards as `Player Card N`. */
const heroCard = (page: Page) => page.locator('img[alt="Card 1"]');
const opponentShownCard = (page: Page) => page.locator('img[alt="Player Card 1"]');
const opponentCardBack = (page: Page) => page.locator('img[alt="Opposite Player Card"]');
const CARD_BACK = /CardBack/;

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
    await page.screenshot({ path: `${SHOTS}replay-button-header.png`, clip: { x: 0, y: 0, width: 1280, height: 100 } });
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
    // Our cards were shown at showdown, so the replay knows them on every
    // step: face up here, before the showdown. The bot mucked (never
    // "showing"), so its cards stay backs.
    await expect(heroCard(page)).toHaveAttribute("src", /./, { timeout: 10_000 });
    await expect(heroCard(page)).not.toHaveAttribute("src", CARD_BACK);
    await expect(opponentCardBack(page).first()).toBeVisible();
    await expect(opponentShownCard(page)).toHaveCount(0);
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
    await expect(heroCard(page)).not.toHaveAttribute("src", CARD_BACK);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}replay-transport-deal.png` });
  });

  await test.step("hand navigation: no earlier hand, no later hand yet", async () => {
    await expect(page.getByTestId("replay-prev-hand")).toBeDisabled();
    await expect(page.getByTestId("replay-next-hand")).toBeDisabled();
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});

test("a folded hand replays with our own cards (signed query) and the winner's shown cards", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  const SEAT = 5;
  await test.step(`sit down at seat ${SEAT} and fold preflop`, async () => {
    await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
    await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
    await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
    const confirm = page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") });
    await expect(confirm).toBeVisible();
    await confirm.click();
    await expect(page.locator(".btn-fold")).toBeVisible({ timeout: 15_000 });
    await page.locator(".btn-fold").click();
    await expect(page.locator(".seat-banner-text", { hasText: "WINS" })).toBeVisible({ timeout: 15_000 });
  });

  let replayUrl = "";
  await test.step("open hand #1's replay", async () => {
    const button = page.getByTestId("open-replay");
    await expect(button).toBeEnabled({ timeout: 10_000 });
    await page.evaluate(() => {
      (window as unknown as { __opened: string[] }).__opened = [];
      window.open = ((url: string, target: string) => {
        (window as unknown as { __opened: string[] }).__opened.push(`${target} ${url}`);
        return null;
      }) as typeof window.open;
    });
    await button.click();
    replayUrl = (await page.evaluate(() => (window as unknown as { __opened: string[] }).__opened))[0].split(" ")[1];
    await page.goto(replayUrl);
    await expect(page.getByTestId("replay-transport")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("at the deal: our folded cards are face up (own), the bot's too (shown as winner)", async () => {
    await page.getByTestId("replay-seek").fill("0");
    await expect(page.getByTestId("replay-step")).toContainText("Cards dealt", { timeout: 10_000 });
    // The public state masks a folded player's cards for good; only the signed
    // GameState query (our key, the block's own timestamp) can show them to us.
    await expect(heroCard(page)).toHaveAttribute("src", /./, { timeout: 10_000 });
    await expect(heroCard(page)).not.toHaveAttribute("src", CARD_BACK);
    await expect(opponentShownCard(page)).toHaveAttribute("src", /./, { timeout: 10_000 });
    await expect(opponentShownCard(page)).not.toHaveAttribute("src", CARD_BACK);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SHOTS}replay-known-cards-folded.png` });
  });

  expect(errors, `page errors: ${errors.join(" | ")}`).toHaveLength(0);
});
