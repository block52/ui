import { test, expect, CASH_GAME_ID, TEST_ADDRESS } from "./fixtures.js";

/**
 * The time bank alarm clock beside our own pill, left of the seat number (ui#19).
 *
 * Tapping the bank never costs us our own time: the turn clock keeps counting
 * down while the clock glows (armed), and only when it runs out does a fresh
 * countdown start for the bank, while the clock rings. The stub has no time
 * bank, so each moment is an injected copy of our real pre-flop turn with the
 * engine's time-bank fields set.
 *
 * SHOTS=<dir> also saves a crop of our pill per state (for the PR, not the repo).
 */

const STUB = "http://localhost:8546";
const SEAT = 5;
const SHOTS = process.env.SHOTS;
const AVATAR = `${process.env.UI_URL ?? "http://localhost:5173"}/logo192.png`;

type Action = { playerId: string; seat: number; action: string; amount: string; round: string; index: number; timestamp: number };
type Player = { seat: number; address: string; legalActions: Array<{ action: string; min: string; max: string; index: number }>; [k: string]: unknown };
type GameStateResponse = {
    format: string;
    variant: string;
    gameState: { round: string; nextToAct: number; gameOptions: Record<string, unknown>; players: Player[]; previousActions: Action[] };
};

const inject = async (body: GameStateResponse) => {
    const res = await fetch(`${STUB}/__control/inject`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            gameId: CASH_GAME_ID,
            frame: { event: "action_performed", gameId: CASH_GAME_ID, data: { format: body.format, variant: body.variant, gameState: body.gameState } }
        })
    });
    expect(res.ok).toBeTruthy();
};

test.use({ deviceScaleFactor: SHOTS ? 3 : 1 });

test("the alarm clock arms the bank, the turn clock runs out first, then the bank counts down", async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });

    await test.step("sit down; pre-flop comes to us", async () => {
        await page.goto(`/table/${CASH_GAME_ID}?autonewhand=false&autofold=false`);
        await expect(page.getByText("Click to Join").first()).toBeVisible({ timeout: 15_000 });
        await page.getByText(`Seat ${SEAT}`, { exact: true }).click();
        await page.getByRole("button", { name: new RegExp(`Confirm & Join Seat ${SEAT}`, "i") }).click();
        await expect(page.locator(".btn-call")).toBeVisible({ timeout: 15_000 });
    });

    const real = (await (await fetch(`${STUB}/block52/pokerchain/poker/v1/game_state/${CASH_GAME_ID}`)).json()) as GameStateResponse;
    expect(real.gameState.round).toBe("preflop");

    /** Our pre-flop turn on a 25s table with a 45s bank, `turnAgoMs` in; `bank` sets our time-bank fields. */
    const turn = (turnAgoMs: number, bank: { remainingMs: number; lastGrantMs?: number; tappedAgoMs?: number; offered: boolean; turnNo?: number; round?: string }) => {
        const s = structuredClone(real);
        const now = Date.now();
        s.gameState.gameOptions = { ...s.gameState.gameOptions, timeout: 25, timeBankMs: 45_000 };
        if (bank.round) s.gameState.round = bank.round;
        // The stub posts blinds without recording them, so the turn clock's
        // anchor is a big blind recorded `turnAgoMs` ago.
        const bot = s.gameState.players.find(p => p.seat !== SEAT)!;
        const last: Action = { playerId: bot.address, seat: bot.seat, action: "post-big-blind", amount: "20000000", round: "preflop", index: 1, timestamp: now - turnAgoMs - 5_000 }; // the clock starts 5s after the stamp (ui#944)
        // `turnNo` adds earlier actions so each step is a NEW turn: the timer
        // keeps one turn's anchor steady across re-stamped frames (#561).
        const earlier = Array.from({ length: bank.turnNo ?? 0 }, (_, i): Action => ({ ...last, action: "post-small-blind", amount: "10000000", index: 0, timestamp: last.timestamp - 1_000 - i }));
        const actions: Action[] = [...earlier, last];
        s.gameState.previousActions = actions;
        if (bank.tappedAgoMs !== undefined) {
            actions.push({ ...last, playerId: TEST_ADDRESS, seat: SEAT, action: "time-bank", amount: "0", index: last.index + 1, timestamp: now - bank.tappedAgoMs });
        }
        const me = s.gameState.players.find(p => p.seat === SEAT)!;
        // An NFT avatar, which sits on the pill's right end.
        me.avatar = AVATAR;
        me.timeBankRemainingMs = bank.remainingMs;
        if (bank.lastGrantMs !== undefined) me.timeBankLastGrantMs = bank.lastGrantMs;
        me.legalActions = me.legalActions.filter(a => a.action !== "time-bank");
        if (bank.offered) me.legalActions.push({ action: "time-bank", min: "0", max: "0", index: last.index + 1 });
        return s;
    };

    const clock = page.getByTestId("time-bank-clock");
    const pill = clock.locator("xpath=ancestor::div[contains(@class,'badge-container')]");
    const countdown = pill.locator(".seat-banner-box span").first();
    const shot = async (name: string) => {
        if (!SHOTS) return;
        await page.waitForTimeout(700); // let the glow / ring animation show
        const box = (await pill.boundingBox())!;
        await page.screenshot({ path: `${SHOTS}/${name}.png`, clip: { x: box.x - 60, y: box.y - 24, width: box.width + 100, height: box.height + 70 } });
    };

    await test.step("ready: our turn with 45s banked; no action-bar button any more", async () => {
        await inject(turn(2_000, { remainingMs: 45_000, offered: true }));
        await expect(clock).toHaveAttribute("data-state", "ready");
        await expect(clock).toHaveAccessibleName("Use time bank (+45s)");
        await expect(page.getByRole("button", { name: /TIME BANK/ })).toHaveCount(0);
        await shot("1-ready");
        // Outside the pill, left of the seat number: the pill's right end is
        // where an NFT avatar sits, and it used to cover the clock.
        const clockBox = (await clock.boundingBox())!;
        const seatBox = (await pill.locator(".badge-number").boundingBox())!;
        const pillBox = (await pill.boundingBox())!;
        expect(clockBox.x + clockBox.width).toBeLessThanOrEqual(pillBox.x);
        expect(Math.abs(clockBox.y + clockBox.height / 2 - (seatBox.y + seatBox.height / 2))).toBeLessThan(2);
        const avatarBox = (await page.getByAltText("Player avatar").first().boundingBox())!;
        expect(avatarBox.x).toBeGreaterThan(clockBox.x + clockBox.width);
        if (SHOTS) {
            const vp = page.viewportSize()!;
            await page.screenshot({ path: `${SHOTS}/0-action-bar.png`, clip: { x: 0, y: vp.height - 260, width: vp.width, height: 260 } });
        }
    });

    await test.step("armed: tapped with 11s left; the 15s pre-flop clock keeps counting, it does not jump to 60", async () => {
        await inject(turn(4_000, { remainingMs: 30_000, lastGrantMs: 45_000, tappedAgoMs: 500, offered: false, turnNo: 1 }));
        await expect(clock).toHaveAttribute("data-state", "armed");
        await expect(countdown).toHaveText(/^(1[01]|9)$/);
        await shot("2-armed");
    });

    await test.step("running: the turn clock is spent; a fresh 45s countdown runs on the bank", async () => {
        await inject(turn(25_000, { remainingMs: 30_000, lastGrantMs: 45_000, tappedAgoMs: 14_000, offered: false, turnNo: 2 }));
        await expect(clock).toHaveAttribute("data-state", "running");
        await expect(countdown).toHaveText(/^3[3-5]$/);
        await shot("3-running");
    });

    await test.step("flop: the table's full 25s clock (pre-flop is 15s)", async () => {
        await inject(turn(1_000, { remainingMs: 45_000, offered: true, turnNo: 4, round: "flop" }));
        await expect(clock).toHaveAttribute("data-state", "ready");
        await expect(countdown).toHaveText(/^2[34]$/);
        await shot("5-flop-25s");
    });

    await test.step("idle: second use spent, bank empty", async () => {
        await inject(turn(2_000, { remainingMs: 0, offered: false, turnNo: 3 }));
        await expect(clock).toHaveAttribute("data-state", "idle");
        await shot("4-empty");
    });
});
