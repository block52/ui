import { ActionDTO, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import { toEntry } from "./useAppliedActions";

/**
 * Unit tests for toEntry — the pure committed-action → badge mapper behind the
 * per-seat action echo (Approach C). Covers label formatting (cash vs tournament,
 * amount vs no-amount) and the isMe ownership flag.
 */

const ME = "b521avgyh77ycn997ja45q5q8ss8y9mr424jsnxx93";
const THEM = "b521stubbot00000000000000000000000000000bot";

const makeAction = (over: Partial<ActionDTO>): ActionDTO => ({
    playerId: THEM,
    seat: 1,
    action: PlayerActionType.CALL,
    amount: "0",
    round: TexasHoldemRound.PREFLOP,
    index: 1,
    timestamp: 0,
    ...over
});

describe("toEntry", () => {
    it("carries index, seat and action through", () => {
        const entry = toEntry(makeAction({ index: 7, seat: 5, action: PlayerActionType.CHECK }), false, ME);
        expect(entry.index).toBe(7);
        expect(entry.seat).toBe(5);
        expect(entry.action).toBe(PlayerActionType.CHECK);
    });

    it("labels a no-amount action with just its name", () => {
        expect(toEntry(makeAction({ action: PlayerActionType.FOLD, amount: "0" }), false, ME).label).toBe("Fold");
        expect(toEntry(makeAction({ action: PlayerActionType.CHECK, amount: "0" }), false, ME).label).toBe("Check");
    });

    it("appends the USDC-formatted amount for cash chip actions", () => {
        expect(toEntry(makeAction({ action: PlayerActionType.CALL, amount: "10000000" }), false, ME).label).toBe("Call $10.00");
        expect(toEntry(makeAction({ action: PlayerActionType.RAISE, amount: "6000000" }), false, ME).label).toBe("Raise $6.00");
    });

    it("uses raw chip formatting in tournament mode", () => {
        expect(toEntry(makeAction({ action: PlayerActionType.BET, amount: "1500" }), true, ME).label).toBe("Bet 1,500 chips");
    });

    it("flags isMe on an address match (case-insensitive)", () => {
        expect(toEntry(makeAction({ playerId: ME }), false, ME).isMe).toBe(true);
        expect(toEntry(makeAction({ playerId: ME.toUpperCase() }), false, ME).isMe).toBe(true);
    });

    it("does not flag isMe for another player or when no address is known", () => {
        expect(toEntry(makeAction({ playerId: THEM }), false, ME).isMe).toBe(false);
        expect(toEntry(makeAction({ playerId: ME }), false, null).isMe).toBe(false);
    });
});
