import { test, expect, TEST_ADDRESS } from "./fixtures.js";

/**
 * Ante controls on the create modal (ui#891): antes on/off, the level they
 * start at and their size as a % of the big blind, with the schedule in the
 * level preview. Saves screenshots of the modal for the PR.
 */
const SHOTS = process.env.SHOTS_DIR ?? new URL("../../../screenshots/", import.meta.url).pathname;
const STUB = "http://localhost:8546";
const SNG_GAME_ID = "0x00000000000000000000000000000000000000000000000000000000cafe0002";
const BOT1 = "b521stubbot00000000000000000000000000000bot";

type Json = Record<string, unknown>;

/** The ladder from 50/100 with a full-big-blind ante from level 4, as the create form submits it. */
const LADDER_WITH_ANTES = {
  progression: "table",
  levels: [
    [50, 100, 0], [100, 200, 0], [150, 300, 0], [200, 400, 400], [300, 600, 600]
  ].map(([sb, bb, ante], level) => ({ level, smallBlind: String(sb), bigBlind: String(bb), ante: String(ante), durationMinutes: 10, isBreak: false }))
};

test("the create modal sets antes and previews them", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1400 });
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  await page.getByPlaceholder("Search by table name or ID...").fill("no-such-table");
  await page.getByRole("button", { name: "Create table" }).click();

  const modal = page.locator("div", { has: page.getByRole("heading", { name: "Create New Table" }) }).last();
  const preview = page.getByTestId("blind-preview");
  const rows = preview.locator("tbody tr");
  const controls = page.getByTestId("ante-controls");
  await expect(page.getByTestId("blind-structure")).toHaveValue("ladder");

  // Default: on, from level 4, a full big blind (AC-1).
  await expect(page.getByTestId("ante-on")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ante-start-level")).toHaveValue("4");
  await expect(page.getByTestId("ante-percent")).toHaveValue("100");
  await expect(preview.locator("thead")).toContainText("Ante");
  await expect(rows.nth(2).locator("td").nth(2)).toHaveText("—");
  await expect(rows.nth(3)).toContainText("40 / 80");
  await expect(rows.nth(3).locator("td").nth(2)).toHaveText("80");
  await expect(rows.nth(4).locator("td").nth(2)).toHaveText("100");
  await controls.scrollIntoViewIfNeeded();
  await modal.screenshot({ path: `${SHOTS}ante-on-default.png` });

  // Start level and size update the preview at once (AC-3).
  await page.getByTestId("ante-start-level").fill("2");
  await page.getByTestId("ante-percent-50").click();
  await expect(rows.nth(0).locator("td").nth(2)).toHaveText("—");
  await expect(rows.nth(1).locator("td").nth(2)).toHaveText("20");
  await expect(rows.nth(2).locator("td").nth(2)).toHaveText("30");
  await modal.screenshot({ path: `${SHOTS}ante-level2-50pct.png` });

  // Off: no antes, and the preview drops its Ante column (AC-2).
  await page.getByTestId("ante-off").click();
  await expect(page.getByTestId("ante-start-level")).toHaveCount(0);
  await expect(preview.locator("thead")).not.toContainText("Ante");
  await modal.screenshot({ path: `${SHOTS}ante-off.png` });

  // A preset fills the controls from the preset (10% from level 5 for Turbo).
  await page.getByTestId("blind-structure").selectOption("turbo");
  await expect(page.getByTestId("ante-on")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("ante-start-level")).toHaveValue("5");
  await expect(page.getByTestId("ante-percent")).toHaveValue("10");
  await expect(rows.nth(4).locator("td").nth(2)).toHaveText("80");
  await modal.screenshot({ path: `${SHOTS}ante-turbo-preset.png` });

  // Custom opens with that structure written out, and the controls rewrite its ante line.
  await page.getByTestId("blind-structure").selectOption("custom");
  await expect(page.getByTestId("blind-custom")).toHaveValue(/ante: level >= 4 \? bb \* 0\.1 : 0/);
  await page.getByTestId("ante-percent-100").click();
  await expect(page.getByTestId("blind-custom")).toHaveValue(/ante: level >= 4 \? bb : 0/);
  await expect(rows.nth(4).locator("td").nth(2)).toHaveText("800");
  await modal.screenshot({ path: `${SHOTS}ante-custom-sync.png` });
});

test("the table header shows the ante once it is active", async ({ page }) => {
  const base = ((await (await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${SNG_GAME_ID}`)).json()) as Json).gameState as Json;
  const options = base.gameOptions as Json;
  const levelStartTime = Date.now() - 2 * 60_000;
  const seated = (address: string, seat: number, stack: string): Json => ({
    address, seat, stack, isSmallBlind: false, isBigBlind: false, isDealer: false, holeCards: [], status: "active", legalActions: [],
  });

  await page.goto(`/table/${SNG_GAME_ID}`);
  await expect(page.getByTestId("scheduled-start-info")).toBeVisible({ timeout: 15_000 });
  await fetch(`${STUB}/__control/inject`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      gameId: SNG_GAME_ID,
      frame: {
        event: "action_performed",
        gameId: SNG_GAME_ID,
        data: {
          format: "sit-and-go",
          variant: "texas-holdem",
          gameState: {
            ...base,
            handNumber: 12,
            round: "end",
            nextToAct: 0,
            previousActions: [],
            players: [seated(TEST_ADDRESS, 1, "1200"), seated(BOT1, 2, "1800")],
            gameOptions: {
              ...options,
              blindStructure: LADDER_WITH_ANTES,
              smallBlind: "200",
              bigBlind: "400",
              nextSmallBlind: "300",
              nextBigBlind: "600",
              ante: "400",
              blindLevel: 3,
              blindLevelDuration: 10,
              scheduledStartTime: levelStartTime - 40 * 60_000,
              sngStartTime: levelStartTime - 30 * 60_000,
              levelStartTime,
              lateRegistrationLevels: 0
            }
          }
        }
      }
    })
  });
  const header = page.getByText(/^Level 4 /).first();
  await expect(header).toContainText("200/400 (400) Next 300/600", { timeout: 15_000 });
  await page.screenshot({ path: `${SHOTS}ante-table-header.png`, clip: { x: 0, y: 64, width: 1280, height: 40 } });
});

test("the lobby says when antes start", async ({ page }) => {
  // The stub's sit-and-go has no blind structure; give it the ladder with antes.
  await page.route("**/poker/v1/list_games*", async route => {
    const res = await route.fetch();
    const body = (await res.json()) as { games: string };
    const games = (JSON.parse(body.games) as Json[]).map(g => (g.gameId === SNG_GAME_ID ? { ...g, gameOptions: { ...(g.gameOptions as Json), blindStructure: LADDER_WITH_ANTES } } : g));
    await route.fulfill({ response: res, json: { games: JSON.stringify(games) } });
  });
  await page.addInitScript(() => localStorage.setItem("seen_upcoming_sng_modal", "true"));
  await page.goto("/");
  const label = page.getByTestId("lobby-antes").first();
  await expect(label).toHaveText("Antes from level 4", { timeout: 15_000 });
  const row = page.locator("tr", { has: label });
  await row.screenshot({ path: `${SHOTS}ante-lobby-row.png` });
});
