import { PlayerDTO, PlayerStatus, TexasHoldemRound, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { describeShownHand, getBeatenHandDescription, getShowdownSummaryLines } from "./showdownSummary";
import { WinnerInfo } from "../types/index";

const WINNER_ADDRESS = "b521qypqxpq9qcrsszg2pvxq6rs0zqg3yyc5z5tpwxqer";
const LOSER_ADDRESS = "b521qz4sdj8gfx9w9r8h8xvnkkl0xhucqhqv39gtr7";
const OTHER_ADDRESS = "b521qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq";

const player = (seat: number, address: string, status: PlayerStatus, holeCards?: string[]): PlayerDTO =>
    ({
        address,
        seat,
        stack: "0",
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards,
        status,
        lastAction: undefined,
        legalActions: [],
        sumOfBets: "0",
        timeout: 0,
        signature: ""
    }) as PlayerDTO;

const state = (players: PlayerDTO[], communityCards: string[]): TexasHoldemStateDTO =>
    ({ players, communityCards, round: TexasHoldemRound.END }) as unknown as TexasHoldemStateDTO;

const winner = (overrides: Partial<WinnerInfo> = {}): WinnerInfo => ({
    seat: 3,
    address: WINNER_ADDRESS,
    amount: "400000",
    formattedAmount: "$0.40",
    winType: "showdown",
    description: "Two Pair, Aces and Kings",
    ...overrides
});

const BOARD = ["AH", "KD", "7C", "2H", "9S"];

describe("describeShownHand", () => {
    it("evaluates revealed cards into a description with a score", () => {
        const hand = describeShownHand(["AS", "AD"], BOARD);
        expect(hand).not.toBeNull();
        expect(typeof hand!.description).toBe("string");
        expect(hand!.description.length).toBeGreaterThan(0);
        expect(typeof hand!.score).toBe("number");
    });

    it("returns null for masked or missing hole cards", () => {
        expect(describeShownHand(["X", "X"], BOARD)).toBeNull();
        expect(describeShownHand(undefined, BOARD)).toBeNull();
        expect(describeShownHand(["AS"], BOARD)).toBeNull();
    });
});

describe("getBeatenHandDescription", () => {
    const winners = [winner()];

    it("returns the strongest REVEALED losing hand", () => {
        const pairLoser = player(5, LOSER_ADDRESS, PlayerStatus.SHOWING, ["KS", "KC"]); // trips kings on this board
        const weakLoser = player(6, OTHER_ADDRESS, PlayerStatus.SHOWING, ["3D", "4D"]);
        const gameState = state([player(3, WINNER_ADDRESS, PlayerStatus.SHOWING, ["AS", "AD"]), pairLoser, weakLoser], BOARD);

        const expected = describeShownHand(["KS", "KC"], BOARD)!.description;
        expect(getBeatenHandDescription(gameState, winners)).toBe(expected);
    });

    it("never leaks a FOLDED player's visible cards (the hero's own snapshot)", () => {
        const foldedHero = player(5, LOSER_ADDRESS, PlayerStatus.FOLDED, ["KS", "KC"]);
        const gameState = state([player(3, WINNER_ADDRESS, PlayerStatus.SHOWING, ["AS", "AD"]), foldedHero], BOARD);

        expect(getBeatenHandDescription(gameState, winners)).toBeNull();
    });

    it("accepts ALL_IN reveals (all-in runouts) and ignores winners themselves", () => {
        const allInLoser = player(5, LOSER_ADDRESS, PlayerStatus.ALL_IN, ["KS", "KC"]);
        const gameState = state([player(3, WINNER_ADDRESS, PlayerStatus.ALL_IN, ["AS", "AD"]), allInLoser], BOARD);

        const expected = describeShownHand(["KS", "KC"], BOARD)!.description;
        expect(getBeatenHandDescription(gameState, winners)).toBe(expected);
    });

    it("returns null when nothing was revealed", () => {
        const gameState = state([player(3, WINNER_ADDRESS, PlayerStatus.SHOWING, ["AS", "AD"]), player(5, LOSER_ADDRESS, PlayerStatus.MUCKED, ["X", "X"])], BOARD);
        expect(getBeatenHandDescription(gameState, winners)).toBeNull();
    });
});

describe("getShowdownSummaryLines", () => {
    it("builds 'won with X over Y' for a showdown with a revealed loser", () => {
        const gameState = state(
            [player(3, WINNER_ADDRESS, PlayerStatus.SHOWING, ["AS", "AD"]), player(5, LOSER_ADDRESS, PlayerStatus.SHOWING, ["KS", "KC"])],
            BOARD
        );
        const beaten = describeShownHand(["KS", "KC"], BOARD)!.description;

        expect(getShowdownSummaryLines(gameState, [winner()])).toEqual([
            `Seat 3 won with Two Pair, Aces and Kings over ${beaten} — $0.40`
        ]);
    });

    it("omits the over-clause when no losing hand was revealed", () => {
        const gameState = state([player(3, WINNER_ADDRESS, PlayerStatus.SHOWING, ["AS", "AD"])], BOARD);
        expect(getShowdownSummaryLines(gameState, [winner()])).toEqual(["Seat 3 won with Two Pair, Aces and Kings — $0.40"]);
    });

    it("labels uncontested wins without a hand", () => {
        const gameState = state([player(2, WINNER_ADDRESS, PlayerStatus.ACTIVE)], []);
        const uncontested = winner({ seat: 2, winType: "uncontested", description: undefined, formattedAmount: "$0.10" });
        expect(getShowdownSummaryLines(gameState, [uncontested])).toEqual(["Seat 2 wins $0.10 (uncontested)"]);
    });

    it("returns no lines without winners", () => {
        expect(getShowdownSummaryLines(state([], []), null)).toEqual([]);
        expect(getShowdownSummaryLines(state([], []), [])).toEqual([]);
    });
});
