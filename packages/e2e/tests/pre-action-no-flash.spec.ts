import { test, expect, CASH_GAME_ID } from "./fixtures.js";

/**
 * A fired pre-action must not flash the betting bar.
 *
 * Arm "Check" while another player is to act on the flop. When the turn reaches
 * us the pre-action submits CHECK, and the betting bar (Check / Bet / presets)
 * must stay hidden until the check lands. It used to clear the armed intent the
 * moment it submitted, so the whole bar showed while the move confirmed.
 *
 * The stub always puts us first to act, so the "bot to act" moment is an
 * injected copy of the real flop state with the turn moved to the bot. Then the
 * real state is replayed: it is our turn, the pre-action fires, and the stub
 * applies the check against its real state.
 */

const STUB = "http://localhost:8546";
const SEAT = 5;

type GameStateResponse = { format: string; variant: string; gameState: { nextToAct: number; players: Array<{ seat: number; legalActions: unknown[] }> } };

const stateFrame = (body: GameStateResponse) => ({
    event: "action_performed",
    gameId: CASH_GAME_ID,
    data: { format: body.format, variant: body.variant, gameState: body.gameState }
});

const inject = async (frame: unknown) => {
    const res = await fetch(`${STUB}/__control/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: CASH_GAME_ID, frame })
    });
    expect(res.ok).toBeTruthy();
};

test("a fired pre-action keeps the betting bar hidden", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("setting_preselectcheck", "true"));

    await test.step("sit down", async () => {
        await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false`);
        await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
        await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
        await page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") }).click();
    });

    await test.step("preflop: call; the flop comes to us", async () => {
        await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
        await page.locator(".btn-call").click();
        await expect(page.locator(".btn-check")).toBeVisible({ timeout: 15_000 });
    });

    const real = await test.step("read the real flop state", async () => {
        const res = await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`);
        return (await res.json()) as GameStateResponse;
    });
    const botSeat = real.gameState.players.find(p => p.seat !== SEAT)?.seat;
    expect(botSeat).toBeDefined();

    const armCheck = page.getByRole("checkbox", { name: "Pre-select Check for your turn" });
    await test.step("show the bot to act, and arm Check", async () => {
        const botToAct = structuredClone(real);
        botToAct.gameState.nextToAct = botSeat!;
        botToAct.gameState.players.forEach(p => (p.legalActions = []));
        await inject(stateFrame(botToAct));
        await expect(armCheck).toBeVisible({ timeout: 10_000 });
        await armCheck.click();
        await expect(armCheck).toHaveAttribute("aria-checked", "true");
    });

    await test.step("watch for the betting bar until our check is recorded", async () => {
        await page.evaluate((seat: number) => {
            const w = window as unknown as { __barSeen?: boolean };
            w.__barSeen = false;
            const ourFlopCheck = () =>
                Array.from(document.querySelectorAll("*")).some(el => el.childElementCount === 0 && el.textContent?.trim() === `Seat ${seat} · Flop`);
            const observer = new MutationObserver(() => {
                if (ourFlopCheck()) {
                    observer.disconnect();
                } else if (document.querySelector(".btn-check, .btn-raise")) {
                    w.__barSeen = true;
                }
            });
            observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        }, SEAT);
    });

    await test.step("our turn: the pre-action checks for us", async () => {
        await inject(stateFrame(real));
        await expect(page.getByText(`Seat ${SEAT} · Flop`)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("the betting bar never appeared before the check landed", async () => {
        const barSeen = await page.evaluate(() => (window as unknown as { __barSeen?: boolean }).__barSeen);
        expect(barSeen).toBe(false);
    });
});
