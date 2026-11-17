/**
 * Tests for pre-flop bet presets (ui#751): big-blind multiples (2x / 2.5x / 3x / 5x)
 * for the opening raise only; once there's a raise — or on any later street — the
 * component shows pot fractions instead.
 */
import { ActionDTO, BettingLimit, GameVariant, PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import {
    highestPreflopContribution,
    postedBigBlind,
    isPreflopRaised,
    showPreflopMultiples,
    allowsBlindMultiples,
    preflopPresetAmount,
    UNOPENED_PREFLOP_PRESETS
} from "./preflopPresets";

const SB = "b521smallblind";
const BB = "b521bigblind";
const BTN = "b521button";

const act = (playerId: string, action: PlayerActionType, amount: string, round: TexasHoldemRound = TexasHoldemRound.PREFLOP): ActionDTO => ({
    playerId,
    seat: 1,
    action,
    amount,
    round,
    index: 0,
    timestamp: 0
});

// 0.01 / 0.02 blinds, in micro-units. Blinds post in the ANTE round.
const blinds: ActionDTO[] = [
    act(SB, PlayerActionType.SMALL_BLIND, "10000", TexasHoldemRound.ANTE),
    act(BB, PlayerActionType.BIG_BLIND, "20000", TexasHoldemRound.ANTE)
];
// The button raises to $0.06.
const raisedTo6c: ActionDTO[] = [...blinds, act(BTN, PlayerActionType.RAISE, "60000")];

const labels = (presets: readonly { label: string }[]) => presets.map(p => p.label);

describe("pre-flop situation", () => {
    it("the bet to match is the big blind in an unopened pot", () => {
        expect(highestPreflopContribution(blinds)).toBe(20_000n);
        expect(postedBigBlind(blinds)).toBe(20_000n);
        expect(isPreflopRaised(blinds)).toBe(false);
    });

    it("the bet to match is the raise-to total after a raise", () => {
        expect(highestPreflopContribution(raisedTo6c)).toBe(60_000n);
        expect(isPreflopRaised(raisedTo6c)).toBe(true);
    });

    it("a limp (call) does not count as a raise", () => {
        expect(isPreflopRaised([...blinds, act(BTN, PlayerActionType.CALL, "20000")])).toBe(false);
    });

    it("adds up a player's chips across actions (a raise after posting a blind)", () => {
        // SB posts 0.01 then raises with 0.05 more → 0.06 in total.
        expect(highestPreflopContribution([...blinds, act(SB, PlayerActionType.RAISE, "50000")])).toBe(60_000n);
    });
});

describe("showPreflopMultiples — the opening-raise-only rule", () => {
    it("offers the four big-blind multiples, in order, for the opening raise", () => {
        expect(labels(UNOPENED_PREFLOP_PRESETS)).toEqual(["2x", "2.5x", "3x", "5x"]);
    });

    it("shows multiples pre-flop while the pot is unopened", () => {
        expect(showPreflopMultiples(TexasHoldemRound.PREFLOP, blinds)).toBe(true);
    });

    it("hides multiples once there's a pre-flop raise (pot fractions take over)", () => {
        expect(showPreflopMultiples(TexasHoldemRound.PREFLOP, raisedTo6c)).toBe(false);
    });

    it("a limp keeps the opening multiples (still unopened)", () => {
        expect(showPreflopMultiples(TexasHoldemRound.PREFLOP, [...blinds, act(BTN, PlayerActionType.CALL, "20000")])).toBe(true);
    });

    it.each([TexasHoldemRound.FLOP, TexasHoldemRound.TURN, TexasHoldemRound.RIVER])(
        "never shows multiples post-flop (%s)",
        round => expect(showPreflopMultiples(round, blinds)).toBe(false)
    );
});

describe("preflopPresetAmount (chips added = raise-to total − chips already in)", () => {
    it.each([
        ["2x", 0, 40_000n],
        ["2.5x", 1, 50_000n],
        ["3x", 2, 60_000n],
        ["5x", 3, 100_000n]
    ])("unopened, from the button (nothing in yet): %s raises to the right total", (_label, i, raiseTo) => {
        // Nothing in: chips added = raise-to total.
        expect(preflopPresetAmount(20_000n, 20_000n, UNOPENED_PREFLOP_PRESETS[i].multiple)).toBe(raiseTo);
    });

    it("unopened, from the small blind: 2x raises to $0.04 by adding $0.03", () => {
        expect(preflopPresetAmount(20_000n, 10_000n, UNOPENED_PREFLOP_PRESETS[0].multiple)).toBe(30_000n);
    });

    it("unopened, from the big blind (option): 3x raises to $0.06 by adding $0.04", () => {
        expect(preflopPresetAmount(20_000n, 0n, UNOPENED_PREFLOP_PRESETS[2].multiple)).toBe(40_000n);
    });

    it("unopened: 5x raises to $0.10 (from the button, $0.02 to call)", () => {
        expect(preflopPresetAmount(20_000n, 20_000n, UNOPENED_PREFLOP_PRESETS[3].multiple)).toBe(100_000n);
    });

    it("uses exact fractions in tournament chips (2.5x of 50 → 125)", () => {
        expect(preflopPresetAmount(50n, 50n, UNOPENED_PREFLOP_PRESETS[1].multiple)).toBe(125n);
    });
});

describe("allowsBlindMultiples — only no-limit Hold'em opens in blinds", () => {
    it("no-limit Hold'em uses the multiples", () => {
        expect(allowsBlindMultiples(GameVariant.TEXAS_HOLDEM, BettingLimit.NO_LIMIT)).toBe(true);
        expect(allowsBlindMultiples(GameVariant.TEXAS_HOLDEM, undefined)).toBe(true); // absent = no-limit
    });

    it("Omaha never does, at any limit", () => {
        expect(allowsBlindMultiples(GameVariant.OMAHA, BettingLimit.POT_LIMIT)).toBe(false);
        expect(allowsBlindMultiples(GameVariant.OMAHA, BettingLimit.NO_LIMIT)).toBe(false);
    });

    it("pot-limit Hold'em sizes the open against the pot too", () => {
        expect(allowsBlindMultiples(GameVariant.TEXAS_HOLDEM, BettingLimit.POT_LIMIT)).toBe(false);
    });
});
