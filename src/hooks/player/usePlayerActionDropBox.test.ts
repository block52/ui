import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { formatActionAmount, getActionBadgeDisplay } from "./usePlayerActionDropBox";

// Issue #487: the action badge under a player's avatar showed "$0.00" on Sit & Go.
// Tournament amounts are raw whole chips; cash amounts are USDC micro-units (÷10^6).
describe("formatActionAmount", () => {
    describe("tournament / SNG (raw whole chips)", () => {
        it("should render small chip bets as whole chips, never $0.00", () => {
            // The exact bug: "5" chips formatted as micro-USDC rounds to "$0.00".
            expect(formatActionAmount("5", true)).toBe(" 5");
        });

        it("should render larger chip amounts with comma separators and no $", () => {
            expect(formatActionAmount("1500", true)).toBe(" 1,500");
            expect(formatActionAmount("1000000", true)).toBe(" 1,000,000");
        });

        it("should return empty string for zero / blank / undefined amounts", () => {
            expect(formatActionAmount("0", true)).toBe("");
            expect(formatActionAmount("", true)).toBe("");
            expect(formatActionAmount(undefined, true)).toBe("");
        });
    });

    describe("cash (USDC micro-units)", () => {
        it("should convert micro-units to a dollar amount", () => {
            expect(formatActionAmount("5000000", false)).toBe(" $5.00");
            expect(formatActionAmount("20000", false)).toBe(" $0.02");
        });

        it("should return empty string for zero / blank / undefined amounts", () => {
            expect(formatActionAmount("0", false)).toBe("");
            expect(formatActionAmount("", false)).toBe("");
            expect(formatActionAmount(undefined, false)).toBe("");
        });
    });

    it("should not crash on non-numeric input", () => {
        expect(formatActionAmount("abc", true)).toBe("");
        expect(formatActionAmount("abc", false)).toBe("");
    });
});

// Issue #638: the seat badge showed the STACK DELTA ("RAISE 500") while the
// button that made the action said "RAISE TO 600". BET/CALL/RAISE badges must
// show the actor's street total (blind-aware); raises are labelled "RAISE TO".
describe("getActionBadgeDisplay", () => {
    const SB_ADDRESS = "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer";
    const BB_ADDRESS = "b521qz4sdj8gfx9w9r8h8xvnkkl0xhucqhqv39gtr7";

    const act = (
        index: number,
        playerId: string,
        seat: number,
        action: PlayerActionType,
        amount: string,
        round: TexasHoldemRound
    ): ActionDTO => ({ playerId, seat, action, amount, round, index, timestamp: Date.now() });

    // The exact hand from #638: heads-up SNG at 100/200, hero raises from the SB.
    const sngBlinds = [
        act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100", TexasHoldemRound.ANTE),
        act(2, BB_ADDRESS, 2, PlayerActionType.BIG_BLIND, "200", TexasHoldemRound.ANTE)
    ];

    it("labels an SB raise as RAISE TO with the street total, matching the button (hand #6)", () => {
        const raise = act(3, SB_ADDRESS, 1, PlayerActionType.RAISE, "500", TexasHoldemRound.PREFLOP);
        expect(getActionBadgeDisplay(raise, [...sngBlinds, raise], true)).toEqual({
            action: "RAISE TO",
            amount: " 600"
        });
    });

    it("shows a call after a posted blind as the matched total, not the delta", () => {
        const call = act(3, SB_ADDRESS, 1, PlayerActionType.CALL, "100", TexasHoldemRound.PREFLOP);
        expect(getActionBadgeDisplay(call, [...sngBlinds, call], true)).toEqual({
            action: "CALL",
            amount: " 200"
        });
    });

    it("formats cash street totals as dollars", () => {
        const cashBlinds = [
            act(1, SB_ADDRESS, 1, PlayerActionType.SMALL_BLIND, "100000", TexasHoldemRound.ANTE),
            act(2, BB_ADDRESS, 2, PlayerActionType.BIG_BLIND, "200000", TexasHoldemRound.ANTE)
        ];
        const raise = act(3, SB_ADDRESS, 1, PlayerActionType.RAISE, "500000", TexasHoldemRound.PREFLOP);
        expect(getActionBadgeDisplay(raise, [...cashBlinds, raise], false)).toEqual({
            action: "RAISE TO",
            amount: " $0.60"
        });
    });

    it("keeps a postflop bet as its own amount (no blind folded in)", () => {
        const bet = act(5, SB_ADDRESS, 1, PlayerActionType.BET, "300", TexasHoldemRound.FLOP);
        expect(getActionBadgeDisplay(bet, [...sngBlinds, bet], true)).toEqual({
            action: "BET",
            amount: " 300"
        });
    });

    it("leaves non-committing actions on the raw-amount path", () => {
        const post = sngBlinds[0];
        expect(getActionBadgeDisplay(post, sngBlinds, true)).toEqual({
            action: "POST SB",
            amount: " 100"
        });

        const fold = act(4, BB_ADDRESS, 2, PlayerActionType.FOLD, "0", TexasHoldemRound.PREFLOP);
        expect(getActionBadgeDisplay(fold, [...sngBlinds, fold], true)).toEqual({
            action: "FOLD",
            amount: ""
        });
    });

    // ui#660: monetary actions (join/leave/top-up) carry USDC micro-units even
    // in tournaments — a LEFT badge must not chips-format the µUSDC payout.
    it("formats an SNG leave's monetary amount as USDC, not chips", () => {
        const leave: ActionDTO = {
            playerId: SB_ADDRESS,
            seat: 1,
            action: "leave" as ActionDTO["action"],
            amount: "200000",
            round: TexasHoldemRound.END,
            index: 9,
            timestamp: Date.now()
        };
        expect(getActionBadgeDisplay(leave, [leave], true)).toEqual({
            action: "LEFT",
            amount: " $0.20"
        });
    });
});
