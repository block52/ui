/**
 * Tests for the CoinPoker-style pre-action bar rules (ui#388): when the bar shows,
 * which buttons it shows per betting situation, and what each pre-action resolves to
 * on the player's turn.
 */
import { PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import {
    shouldShowPreActions,
    shouldClearPreAction,
    resolvePreAction,
    preActionButtons,
    isBettingRound,
    PreActionsState,
    PreActionLegal
} from "./preActions";

const base: PreActionsState = {
    enabled: true,
    isUsersTurn: false,
    playerStatus: PlayerStatus.ACTIVE,
    round: TexasHoldemRound.FLOP
};

const canCheck: PreActionLegal = { hasCheckAction: true, hasCallAction: false, hasFoldAction: true };
const facingBet: PreActionLegal = { hasCheckAction: false, hasCallAction: true, hasFoldAction: true };
const blindTurn: PreActionLegal = { hasCheckAction: false, hasCallAction: false, hasFoldAction: true };

describe("shouldShowPreActions", () => {
    it("shows while in the hand, on a betting street, and not to act", () => {
        expect(shouldShowPreActions(base)).toBe(true);
    });
    it("hides when the setting is off", () => {
        expect(shouldShowPreActions({ ...base, enabled: false })).toBe(false);
    });
    it("hides on the player's own turn (the betting bar shows instead)", () => {
        expect(shouldShowPreActions({ ...base, isUsersTurn: true })).toBe(false);
    });
    it.each([PlayerStatus.FOLDED, PlayerStatus.SITTING_OUT, PlayerStatus.ALL_IN, PlayerStatus.SEATED, null, undefined])(
        "hides when not an active seat (%s)",
        playerStatus => expect(shouldShowPreActions({ ...base, playerStatus })).toBe(false)
    );
    it.each([TexasHoldemRound.ANTE, TexasHoldemRound.SHOWDOWN, TexasHoldemRound.END, null, undefined])(
        "hides off a betting street (%s)",
        round => expect(shouldShowPreActions({ ...base, round })).toBe(false)
    );
});

describe("preActionButtons", () => {
    it("can check → Check/Fold · Check · Call Any", () => {
        expect(preActionButtons(true, false, false)).toEqual(["check-fold", "check", "call-any"]);
        // owe/all-in flags are ignored once you can check
        expect(preActionButtons(true, true, true)).toEqual(["check-fold", "check", "call-any"]);
    });
    it("committed with nothing owed → nothing (bar hidden)", () => {
        expect(preActionButtons(false, false, false)).toEqual([]);
    });
    it("owe a bet you can cover → Fold · Call {amount} · Call Any", () => {
        expect(preActionButtons(false, true, false)).toEqual(["fold", "call-exact", "call-any"]);
    });
    it("owe a bet that would jam → Fold · All In", () => {
        expect(preActionButtons(false, true, true)).toEqual(["fold", "all-in"]);
    });
});

describe("resolvePreAction", () => {
    it("check-fold: checks when free, folds only when genuinely facing a bet", () => {
        expect(resolvePreAction("check-fold", canCheck)).toBe("check");
        expect(resolvePreAction("check-fold", facingBet)).toBe("fold");
        expect(resolvePreAction("check-fold", blindTurn)).toBeNull();
    });
    it("check: checks when free, otherwise nothing (never calls)", () => {
        expect(resolvePreAction("check", canCheck)).toBe("check");
        expect(resolvePreAction("check", facingBet)).toBeNull();
    });
    it("fold: folds whenever fold is legal", () => {
        expect(resolvePreAction("fold", facingBet)).toBe("fold");
        expect(resolvePreAction("fold", { hasCheckAction: false, hasCallAction: false, hasFoldAction: false })).toBeNull();
    });
    it("call-exact / call-any / all-in: call when facing a bet (all-in is a capped call)", () => {
        for (const a of ["call-exact", "call-any", "all-in"] as const) {
            expect(resolvePreAction(a, facingBet)).toBe("call");
            expect(resolvePreAction(a, canCheck)).toBe("check");
            expect(resolvePreAction(a, blindTurn)).toBeNull();
        }
    });
});

describe("shouldClearPreAction", () => {
    it("clears when the player leaves the hand", () => {
        expect(shouldClearPreAction({ action: "check-fold", isUsersTurn: false, playerStatus: PlayerStatus.FOLDED })).toBe(true);
    });
    it("does not clear while still active, or on the player's turn", () => {
        expect(shouldClearPreAction({ action: "call-any", isUsersTurn: false, playerStatus: PlayerStatus.ACTIVE })).toBe(false);
        expect(shouldClearPreAction({ action: "call-any", isUsersTurn: true, playerStatus: PlayerStatus.FOLDED })).toBe(false);
    });
    it("nothing to clear when none is armed", () => {
        expect(shouldClearPreAction({ action: null, isUsersTurn: false, playerStatus: PlayerStatus.FOLDED })).toBe(false);
    });
});

describe("isBettingRound", () => {
    it("true on preflop/flop/turn/river, false otherwise", () => {
        for (const r of [TexasHoldemRound.PREFLOP, TexasHoldemRound.FLOP, TexasHoldemRound.TURN, TexasHoldemRound.RIVER]) {
            expect(isBettingRound(r)).toBe(true);
        }
        for (const r of [TexasHoldemRound.ANTE, TexasHoldemRound.SHOWDOWN, TexasHoldemRound.END, null, undefined]) {
            expect(isBettingRound(r)).toBe(false);
        }
    });
});
