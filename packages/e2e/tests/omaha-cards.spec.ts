import { test, expect, CASH_GAME_ID, TEST_ADDRESS } from "./fixtures.js";

/**
 * Omaha seats (ui#768): an Omaha table deals four hole cards, so the viewer's
 * seat shows four faces and every opponent four backs — not the two a
 * Hold'em seat is built around. The stub plays Hold'em, so the Omaha frame is
 * the stub's own state re-labelled as Omaha with four cards per seat.
 */

const STUB = "http://localhost:8546";

type PlayerState = { address: string; holeCards?: string[] };
type GameStateResponse = {
  format: string;
  variant: string;
  gameState: { players: PlayerState[]; gameOptions: Record<string, unknown> };
};

test("an Omaha table shows four hole cards per seat", async ({ page }) => {
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

  await test.step("inject the same table as Omaha with four cards a seat", async () => {
    const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
    const body = (await res.json()) as GameStateResponse;
    const players = body.gameState.players.map((p) => ({
      ...p,
      holeCards: p.address === TEST_ADDRESS ? ["AH", "KH", "QS", "JD"] : ["??", "??", "??", "??"],
    }));
    const frame = {
      event: "action_performed",
      gameId: CASH_GAME_ID,
      data: {
        format: body.format,
        variant: "omaha",
        gameState: {
          ...body.gameState,
          players,
          // A-K-Q-J in the hand and a ten on the board: Hold'em's best five
          // of seven is a straight; Omaha's two-plus-three is not.
          round: "flop",
          communityCards: ["TC", "2D", "3S"],
          gameOptions: { ...body.gameState.gameOptions, bettingLimit: "pot-limit" },
        },
      },
    };
    await fetch(`${STUB}/__control/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ gameId: CASH_GAME_ID, frame }),
    });
  });

  await test.step("four faces on our seat, four backs on the opponent's", async () => {
    await expect(page.getByAltText(/^Card [1-4]$/)).toHaveCount(4);
    await expect(page.getByAltText("Opposite Player Card")).toHaveCount(4);
    await page.screenshot({ path: test.info().outputPath("omaha-seats.png") });
  });

  await test.step("the header names the game and hand strength uses two hole cards", async () => {
    await expect(page.getByText("Pot-Limit Omaha")).toBeVisible();
    await expect(page.getByText(/straight/i)).toHaveCount(0);
  });
});
