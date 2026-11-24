import { GameVariant, PlayerStatus, TexasHoldemRound } from "@block52/poker-vm-sdk";
import {
    contestsAllInEquity,
    equityHands,
    exactShowdownWinPercentages,
    isBettingClosed,
    runoutSubframeStatus,
    shouldShowAllInEquity,
    type EquityPlayer
} from "./allInEquity";

const BOARD = ["2C", "9D", "4S", "8H", "3C"];

function seat(over: Partial<EquityPlayer> & Pick<EquityPlayer, "seat" | "status">): EquityPlayer {
    return {
        holeCards: ["X", "X"],
        ...over
    };
}

/** The tournament snapshot the runout frames used to drop: last caller still ACTIVE, losers BUSTED. */
function tournamentRunout(): EquityPlayer[] {
    return [
        seat({ seat: 1, status: PlayerStatus.ACTIVE, holeCards: ["AH", "AD"] }),
        seat({ seat: 2, status: PlayerStatus.BUSTED, cardsShown: true, holeCards: ["KS", "KC"] }),
        seat({ seat: 3, status: PlayerStatus.BUSTED, cardsShown: true, holeCards: ["QS", "QC"] }),
        seat({ seat: 4, status: PlayerStatus.FOLDED, holeCards: ["7H", "2D"] }),
        seat({ seat: 5, status: PlayerStatus.SITTING_OUT, holeCards: ["JD", "JC"] })
    ];
}

function show(round: TexasHoldemRound, _board: string[], nextToAct: number, players = tournamentRunout()) {
    return shouldShowAllInEquity({ players, round, nextToAct, holeCount: 2 });
}

describe("isBettingClosed", () => {
    it("treats -1 and 0 as nobody to act", () => {
        expect(isBettingClosed(-1)).toBe(true);
        expect(isBettingClosed(0)).toBe(true);
    });

    it("treats a seat and a missing pointer as betting still open", () => {
        expect(isBettingClosed(1)).toBe(false);
        expect(isBettingClosed(4)).toBe(false);
        expect(isBettingClosed(undefined)).toBe(false);
        expect(isBettingClosed(null)).toBe(false);
    });
});

describe("shouldShowAllInEquity during an all-in runout (ui#210)", () => {
    it("shows on a preflop reveal when the last caller is ACTIVE and losers are BUSTED", () => {
        expect(show(TexasHoldemRound.PREFLOP, [], -1)).toBe(true);
        expect(equityHands(tournamentRunout(), 2).map(hand => hand.seat)).toEqual([1, 2, 3]);
    });

    it("shows on the flop and the turn with the same seats", () => {
        expect(show(TexasHoldemRound.FLOP, BOARD.slice(0, 3), -1)).toBe(true);
        expect(show(TexasHoldemRound.TURN, BOARD.slice(0, 4), 0)).toBe(true);
    });

    it("stays closed while someone still has the action", () => {
        expect(show(TexasHoldemRound.FLOP, BOARD.slice(0, 3), 4)).toBe(false);
    });

    it("excludes a folded seat even when its cards are face up", () => {
        const players = tournamentRunout();
        expect(contestsAllInEquity(players[3])).toBe(false);
        expect(equityHands(players, 2).some(hand => hand.seat === 4)).toBe(false);
    });

    it("ignores a busted player from an earlier hand and a sitting-out seat", () => {
        const players = [
            ...tournamentRunout(),
            seat({ seat: 6, status: PlayerStatus.BUSTED, holeCards: ["5H", "5D"] })
        ];
        expect(contestsAllInEquity(players[4])).toBe(false);
        expect(contestsAllInEquity(players[5])).toBe(false);
        expect(show(TexasHoldemRound.PREFLOP, [], -1, players)).toBe(true);
        expect(equityHands(players, 2).map(hand => hand.seat)).toEqual([1, 2, 3]);
    });

    it("stays closed when a contesting hand is still face down", () => {
        const players = tournamentRunout();
        players[2] = seat({ seat: 3, status: PlayerStatus.BUSTED, cardsShown: true, holeCards: ["X", "X"] });
        expect(show(TexasHoldemRound.PREFLOP, [], -1, players)).toBe(false);
    });

    it("still opens for an ordinary all-in where every seat is ALL_IN or SHOWING", () => {
        const players = [
            seat({ seat: 1, status: PlayerStatus.ALL_IN, holeCards: ["AH", "AD"] }),
            seat({ seat: 2, status: PlayerStatus.SHOWING, holeCards: ["KS", "KC"] })
        ];
        expect(shouldShowAllInEquity({
            players,
            round: TexasHoldemRound.FLOP,
            nextToAct: 1,
            holeCount: 2
        })).toBe(true);
    });

    it("still opens at showdown when the round itself says the hand is over", () => {
        const players = [
            seat({ seat: 1, status: PlayerStatus.ACTIVE, holeCards: ["AH", "AD"] }),
            seat({ seat: 2, status: PlayerStatus.ACTIVE, holeCards: ["KS", "KC"] })
        ];
        expect(shouldShowAllInEquity({
            players,
            round: TexasHoldemRound.SHOWDOWN,
            nextToAct: 1,
            holeCount: 2
        })).toBe(true);
    });

    it("counts a cash loser moved to sitting-out once the hand is tabled", () => {
        const players = [
            seat({ seat: 1, status: PlayerStatus.SHOWING, holeCards: ["AH", "AD"] }),
            seat({ seat: 2, status: PlayerStatus.SITTING_OUT, cardsShown: true, holeCards: ["KS", "KC"] })
        ];
        expect(show(TexasHoldemRound.RIVER, [...BOARD], -1, players)).toBe(true);
    });
});

describe("runoutSubframeStatus (ui#210)", () => {
    it("keeps a fold folded and an existing all-in all-in", () => {
        expect(runoutSubframeStatus(
            { status: PlayerStatus.ACTIVE, holeCards: ["AH", "AD"] },
            { status: PlayerStatus.FOLDED, holeCards: ["AH", "AD"] }
        )).toBe(PlayerStatus.FOLDED);
        expect(runoutSubframeStatus(
            { status: PlayerStatus.ALL_IN, holeCards: ["KS", "KC"] },
            { status: PlayerStatus.BUSTED, cardsShown: true, holeCards: ["KS", "KC"] }
        )).toBe(PlayerStatus.ALL_IN);
    });

    it("tables the ACTIVE last caller and a BUSTED loser as SHOWING", () => {
        expect(runoutSubframeStatus(
            { status: PlayerStatus.ACTIVE, holeCards: ["X", "X"] },
            { status: PlayerStatus.ACTIVE, cardsShown: true, holeCards: ["QS", "QC"] }
        )).toBe(PlayerStatus.SHOWING);
        expect(runoutSubframeStatus(
            { status: PlayerStatus.ACTIVE, holeCards: ["X", "X"] },
            { status: PlayerStatus.BUSTED, cardsShown: true, holeCards: ["KS", "KC"] }
        )).toBe(PlayerStatus.SHOWING);
    });

    it("does not table a seat whose hand is still masked", () => {
        expect(runoutSubframeStatus(
            { status: PlayerStatus.ACTIVE, holeCards: ["X", "X"] },
            { status: PlayerStatus.ACTIVE, holeCards: ["X", "X"] }
        )).toBe(PlayerStatus.ACTIVE);
    });
});

describe("exactShowdownWinPercentages", () => {
    const river = ["2H", "7D", "9S", "JC", "4D"];

    it("gives the winner 100 and the loser 0 on the river", () => {
        expect(exactShowdownWinPercentages(
            [["AH", "AD"], ["KS", "KC"]],
            river,
            GameVariant.TEXAS_HOLDEM
        )).toEqual([100, 0]);
    });

    it("splits a chop equally", () => {
        expect(exactShowdownWinPercentages(
            [["AH", "KD"], ["AS", "KC"]],
            ["2C", "7D", "9S", "JC", "4H"],
            GameVariant.TEXAS_HOLDEM
        )).toEqual([50, 50]);
    });

    it("splits only the tied winners in a three-way pot", () => {
        expect(exactShowdownWinPercentages(
            [["AH", "AD"], ["AS", "AC"], ["KS", "KC"]],
            ["2H", "7D", "9S", "JC", "4C"],
            GameVariant.TEXAS_HOLDEM
        )).toEqual([50, 50, 0]);
    });

    it("returns null until the board is complete", () => {
        expect(exactShowdownWinPercentages([["AH", "AD"], ["KS", "KC"]], river.slice(0, 4), GameVariant.TEXAS_HOLDEM)).toBeNull();
        expect(exactShowdownWinPercentages([["AH", "AD"]], river, GameVariant.TEXAS_HOLDEM)).toBeNull();
    });

    it("scores an Omaha board with the two-plus-three rule and shares that sum to 100", () => {
        const shares = exactShowdownWinPercentages(
            [
                ["AH", "KH", "QH", "JH"],
                ["9S", "9D", "5C", "6C"]
            ],
            ["2C", "3D", "4S", "7H", "8C"],
            GameVariant.OMAHA
        );
        expect(shares).not.toBeNull();
        expect(shares?.reduce((sum, share) => sum + share, 0)).toBe(100);
    });
});
