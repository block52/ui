import { PlayerActionType, TexasHoldemRound } from "@block52/poker-vm-sdk";
import type { ContributionAction, ContributionSnapshot } from "./handContribution";
import {
    addHandStyle,
    emptyPlayingStyle,
    formatPlayingStyle,
    PLAYING_STYLE_FIGURES,
    playingStyleHands,
    playingStyleNote,
    styleFromSnapshot,
    type HandStyle
} from "./playingStyle";

const ME = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const OTHER = "b521otherplayer000000000000000000000000";
const THIRD = "b521thirdplayer000000000000000000000000";

const act = (playerId: string, action: string, amount: string, round: string): ContributionAction => ({ playerId, action, amount, round });

const snap = (actions: ContributionAction[], extra: Partial<ContributionSnapshot> = {}): ContributionSnapshot => ({
    previousActions: actions,
    communityCards: [],
    round: TexasHoldemRound.END,
    winners: [],
    ...extra
});

describe("styleFromSnapshot", () => {
    it("does not count a walk: the big blind is forced, and a fold-win is not a showdown", () => {
        const style = styleFromSnapshot(
            snap([
                act(OTHER, PlayerActionType.SMALL_BLIND, "750", TexasHoldemRound.ANTE),
                act(ME, PlayerActionType.BIG_BLIND, "1500", TexasHoldemRound.ANTE),
                act(OTHER, PlayerActionType.FOLD, "0", TexasHoldemRound.PREFLOP)
            ]),
            ME,
            2250
        );
        expect(style).toMatchObject({ vpip: false, pfr: false, sawFlop: false, showdown: false, wonShowdown: false, bets: 0, calls: 0 });
    });

    it("counts a preflop call as VPIP and not PFR", () => {
        const style = styleFromSnapshot(
            snap([
                act(OTHER, PlayerActionType.SMALL_BLIND, "750", TexasHoldemRound.ANTE),
                act(ME, PlayerActionType.BIG_BLIND, "1500", TexasHoldemRound.ANTE),
                act(OTHER, PlayerActionType.ALL_IN, "14674", TexasHoldemRound.PREFLOP),
                act(ME, PlayerActionType.CALL, "13924", TexasHoldemRound.PREFLOP)
            ]),
            ME,
            0
        );
        expect(style).toMatchObject({ vpip: true, pfr: false, calls: 1, allInRaises: 0 });
    });

    it("counts a preflop raise as PFR", () => {
        const style = styleFromSnapshot(
            snap([
                act(OTHER, PlayerActionType.SMALL_BLIND, "500", TexasHoldemRound.ANTE),
                act(THIRD, PlayerActionType.BIG_BLIND, "1000", TexasHoldemRound.ANTE),
                act(ME, PlayerActionType.RAISE, "2000", TexasHoldemRound.PREFLOP),
                act(OTHER, PlayerActionType.FOLD, "0", TexasHoldemRound.PREFLOP),
                act(THIRD, PlayerActionType.FOLD, "0", TexasHoldemRound.PREFLOP)
            ]),
            ME,
            0
        );
        expect(style).toMatchObject({ vpip: true, pfr: true, raises: 1 });
    });

    it("counts an all-in that raises the blind, and one that only calls", () => {
        const shove = styleFromSnapshot(
            snap([
                act(OTHER, PlayerActionType.SMALL_BLIND, "10", TexasHoldemRound.ANTE),
                act(THIRD, PlayerActionType.BIG_BLIND, "20", TexasHoldemRound.ANTE),
                act(ME, PlayerActionType.ALL_IN, "1500", TexasHoldemRound.PREFLOP)
            ]),
            ME,
            0
        );
        expect(shove).toMatchObject({ vpip: true, pfr: true, allInRaises: 1, allInCalls: 0 });

        const call = styleFromSnapshot(
            snap([
                act(OTHER, PlayerActionType.SMALL_BLIND, "50", TexasHoldemRound.ANTE),
                act(THIRD, PlayerActionType.BIG_BLIND, "100", TexasHoldemRound.ANTE),
                act(ME, PlayerActionType.CALL, "100", TexasHoldemRound.PREFLOP),
                act(OTHER, PlayerActionType.CALL, "50", TexasHoldemRound.PREFLOP),
                act(THIRD, PlayerActionType.RAISE, "100", TexasHoldemRound.PREFLOP),
                act(ME, PlayerActionType.CALL, "100", TexasHoldemRound.PREFLOP),
                act(OTHER, PlayerActionType.RAISE, "200", TexasHoldemRound.PREFLOP),
                act(THIRD, PlayerActionType.ALL_IN, "800", TexasHoldemRound.PREFLOP),
                act(ME, PlayerActionType.ALL_IN, "800", TexasHoldemRound.PREFLOP)
            ]),
            ME,
            0
        );
        expect(call).toMatchObject({ vpip: true, pfr: false, calls: 2, allInCalls: 1, allInRaises: 0 });
    });

    it("keeps the blind in the live bet, so a short all-in over a shove is still a raise", () => {
        // BB 3000, facing 6580. Adding 3802 makes 6802, which is more than the current bet.
        const style = styleFromSnapshot(
            snap([
                act(OTHER, PlayerActionType.SMALL_BLIND, "1500", TexasHoldemRound.ANTE),
                act(ME, PlayerActionType.BIG_BLIND, "3000", TexasHoldemRound.ANTE),
                act(THIRD, PlayerActionType.ALL_IN, "6580", TexasHoldemRound.PREFLOP),
                act(OTHER, PlayerActionType.CALL, "5080", TexasHoldemRound.PREFLOP),
                act(ME, PlayerActionType.ALL_IN, "3802", TexasHoldemRound.PREFLOP)
            ]),
            ME,
            0
        );
        expect(style).toMatchObject({ vpip: true, pfr: true, allInRaises: 1 });
    });

    it("counts a flop seen, a showdown reached, and a showdown won", () => {
        const lost = styleFromSnapshot(
            snap(
                [
                    act(ME, PlayerActionType.CALL, "800", TexasHoldemRound.PREFLOP),
                    act(ME, PlayerActionType.CALL, "800", TexasHoldemRound.FLOP),
                    act(ME, PlayerActionType.BET, "800", TexasHoldemRound.TURN),
                    act(ME, PlayerActionType.BET, "800", TexasHoldemRound.RIVER)
                ],
                { communityCards: ["As", "Kd", "2c", "9h", "3s"], round: TexasHoldemRound.SHOWDOWN }
            ),
            ME,
            0
        );
        expect(lost).toMatchObject({ vpip: true, sawFlop: true, showdown: true, wonShowdown: false, bets: 2, calls: 2 });

        const won = styleFromSnapshot(
            snap(
                [act(ME, PlayerActionType.ALL_IN, "1500", TexasHoldemRound.PREFLOP), act(OTHER, PlayerActionType.CALL, "1500", TexasHoldemRound.PREFLOP)],
                {
                    communityCards: ["As", "Kd", "2c", "9h", "3s"],
                    round: TexasHoldemRound.END,
                    winners: [{ address: ME, amount: "3020", cards: ["Ah", "Ad", "Kd", "2c", "9h"] }]
                }
            ),
            ME,
            3020
        );
        expect(won).toMatchObject({ showdown: true, wonShowdown: true, sawFlop: true });
    });

    it("does not give a preflop fold credit for a flop the other players saw", () => {
        const style = styleFromSnapshot(
            snap(
                [act(ME, PlayerActionType.FOLD, "0", TexasHoldemRound.PREFLOP), act(OTHER, PlayerActionType.CHECK, "0", TexasHoldemRound.FLOP)],
                { communityCards: ["As", "Kd", "2c", "9h", "3s"] }
            ),
            ME,
            0
        );
        expect(style).toMatchObject({ vpip: false, sawFlop: false, showdown: false });
    });

    it("counts a postflop bet and raise in aggression, and a postflop all-in that only calls as a call", () => {
        const style = styleFromSnapshot(
            snap([
                act(ME, PlayerActionType.CHECK, "0", TexasHoldemRound.PREFLOP),
                act(ME, PlayerActionType.BET, "400", TexasHoldemRound.FLOP),
                act(OTHER, PlayerActionType.RAISE, "800", TexasHoldemRound.FLOP),
                act(ME, PlayerActionType.ALL_IN, "400", TexasHoldemRound.FLOP)
            ]),
            ME,
            0
        );
        expect(style).toMatchObject({ vpip: false, pfr: false, bets: 1, allInCalls: 1, allInRaises: 0, sawFlop: true });
    });

    it("leaves the hand unknown when the log or a chip amount cannot be read", () => {
        expect(styleFromSnapshot(undefined, ME, 0)).toBeUndefined();
        expect(styleFromSnapshot(snap([]), ME, 0)).toBeUndefined();
        expect(styleFromSnapshot(snap([act(ME, PlayerActionType.BET, "12.5", TexasHoldemRound.FLOP)]), ME, 0)).toBeUndefined();
        expect(styleFromSnapshot(snap([act(ME, PlayerActionType.FOLD, "0", TexasHoldemRound.PREFLOP)]), undefined, 0)).toBeUndefined();
    });

    it("matches the player without regard to case, and uses the indexer win when the snapshot has no winner row", () => {
        const style = styleFromSnapshot(
            snap([act(ME.toUpperCase(), PlayerActionType.CALL, "20", TexasHoldemRound.PREFLOP)], {
                round: TexasHoldemRound.SHOWDOWN,
                communityCards: ["As", "Kd", "2c"]
            }),
            ME,
            40
        );
        expect(style).toMatchObject({ vpip: true, showdown: true, wonShowdown: true });
    });
});

describe("playing style totals and display", () => {
    const hand = (over: Partial<HandStyle>): HandStyle => ({
        vpip: false,
        pfr: false,
        bets: 0,
        raises: 0,
        calls: 0,
        allInRaises: 0,
        allInCalls: 0,
        sawFlop: false,
        showdown: false,
        wonShowdown: false,
        ...over
    });

    it("sums hands and classifies all-ins into the aggression ratio", () => {
        const totals = [hand({ vpip: true, calls: 1, sawFlop: true }), hand({ vpip: true, pfr: true, bets: 1, allInRaises: 1, sawFlop: true, showdown: true, wonShowdown: true })].reduce(
            addHandStyle,
            emptyPlayingStyle()
        );
        expect(totals).toEqual({ hands: 2, vpip: 2, pfr: 1, aggressive: 2, calls: 1, sawFlop: 2, showdown: 1, wonShowdown: 1 });
        expect(formatPlayingStyle(totals, false)).toEqual({
            vpip: "100.00%",
            pfr: "50.00%",
            aggression: "2.00",
            wtsd: "50.00%",
            wssd: "100.00%"
        });
    });

    it("shows an ellipsis while reads are in flight and an em dash when a denominator is zero", () => {
        const empty = emptyPlayingStyle();
        expect(formatPlayingStyle(empty, true)).toEqual({ vpip: "…", pfr: "…", aggression: "…", wtsd: "…", wssd: "…" });
        expect(formatPlayingStyle(empty, false)).toEqual({ vpip: "—", pfr: "—", aggression: "—", wtsd: "—", wssd: "—" });
        expect(formatPlayingStyle({ ...empty, hands: 4, vpip: 1, pfr: 0, calls: 0 }, false).aggression).toBe("—");
    });

    it("names the hands the figures use and the ones the node no longer has", () => {
        expect(playingStyleNote(0, 0)).toBeUndefined();
        expect(playingStyleNote(1, 0)).toBe("Based on 1 hand.");
        expect(playingStyleNote(489, 0)).toBe("Based on 489 hands.");
        expect(playingStyleNote(489, 46)).toBe("Based on 489 hands. Skips 46 hands the node no longer has.");
        expect(playingStyleNote(12, 1)).toBe("Based on 12 hands. Skips 1 hand the node no longer has.");
    });
});

describe("PLAYING_STYLE_FIGURES", () => {
    it("names each figure in full and keeps the explanation for its bubble", () => {
        expect(PLAYING_STYLE_FIGURES.map(figure => [figure.title, figure.name, figure.explanation])).toEqual([
            [
                "VPIP",
                "Voluntarily put money in pot",
                "How often you put chips in preflop by choice, by calling or raising, not just posting blinds. It shows how loose you play."
            ],
            ["PFR", "Preflop raise", "How often you raise preflop. It shows how aggressive you are before the flop."],
            ["Aggression", "Aggression", "Bets and raises divided by calls. Above 1 means you bet more than you call."],
            ["WTSD", "Went to showdown", "Of the hands where you saw the flop, how often you reached showdown."],
            ["W$SD", "Won money at showdown", "Of the hands that reached showdown, how often you won."]
        ]);
    });
});

describe("playingStyleHands", () => {
    it("keeps every finished hand once, including an open session, and drops a hand that cannot be queried", () => {
        const selected = playingStyleHands([
            { game_id: "cash", hand_number: 2, block_height: 10, won_amount: 5 },
            { game_id: "cash", hand_number: 2, block_height: 10, won_amount: 9 },
            { game_id: "sng", hand_number: 1, block_height: 4, won_amount: 0 },
            { game_id: "bad", hand_number: 0, block_height: 4, won_amount: 1 }
        ]);
        expect(selected.dropped).toBe(1);
        expect(selected.hands).toEqual([
            { gameId: "cash", handNumber: 2, blockHeight: 10, wonAmount: 5 },
            { gameId: "sng", handNumber: 1, blockHeight: 4, wonAmount: 0 }
        ]);
    });
});
