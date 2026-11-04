import type { ResultDTO, TexasHoldemStateDTO, WinnerDTO } from "@block52/poker-vm-sdk";
import { finishPhaseAt, hasNewFinisher, holdsResultModals, nextFinishPhaseAtMs, ordinalPlace, tournamentFinishOf, winnerMomentText } from "./tournamentFinish";
import { FINISH_SHOWDOWN_HOLD_MS, TOURNAMENT_WINNER_MOMENT_MS } from "../bus/timing";

const ALICE = "b521alice";
const BOB = "b521bob";

function state(results: ResultDTO[], winners: Partial<WinnerDTO>[] = []): TexasHoldemStateDTO {
    return {
        players: [
            { address: ALICE, seat: 2 },
            { address: BOB, seat: 5 }
        ],
        results,
        winners
    } as unknown as TexasHoldemStateDTO;
}

const FINAL = state(
    [
        { place: 2, playerId: BOB, payout: "3000000" },
        { place: 1, playerId: ALICE, payout: "7000000" }
    ],
    [{ address: ALICE, description: "Two Pair, Kings and Sevens" }]
);

describe("tournamentFinishOf (ui#874)", () => {
    it("is null while the tournament is still running", () => {
        expect(tournamentFinishOf(state([]))).toBeNull();
        expect(tournamentFinishOf(state([{ place: 3, playerId: "b521carol", payout: "0" }]))).toBeNull();
        expect(tournamentFinishOf(undefined)).toBeNull();
    });

    it("names the winner, runner-up and winning hand", () => {
        expect(tournamentFinishOf(FINAL)).toEqual({
            winner: { place: 1, address: ALICE, seat: 2, payout: "7000000" },
            runnerUp: { place: 2, address: BOB, seat: 5, payout: "3000000" },
            winningHand: "Two Pair, Kings and Sevens"
        });
    });

    it("has no winning hand when the deciding pot was not shown down", () => {
        expect(tournamentFinishOf(state(FINAL.results, [{ address: ALICE, description: "" }]))?.winningHand).toBeNull();
    });

    it("keeps a finisher who has left the roster, without a seat", () => {
        const s = { ...FINAL, players: [] } as unknown as TexasHoldemStateDTO;
        expect(tournamentFinishOf(s)?.winner.seat).toBeNull();
    });
});

describe("hasNewFinisher (ui#874)", () => {
    it("fires when a commit adds a finisher", () => {
        expect(hasNewFinisher(state([]), FINAL)).toBe(true);
        expect(hasNewFinisher(state([{ place: 2, playerId: BOB, payout: "3000000" }]), FINAL)).toBe(true);
    });

    it("does not fire for a table opened after the finish, or for a repeat frame", () => {
        expect(hasNewFinisher(undefined, FINAL)).toBe(false);
        expect(hasNewFinisher(FINAL, FINAL)).toBe(false);
        expect(hasNewFinisher(state([]), state([]))).toBe(false);
    });
});

describe("finish phases (ui#874)", () => {
    it("shows the deciding hand, then the winner moment, then lets the modal through", () => {
        expect(finishPhaseAt(0, true)).toBe("showdown");
        expect(finishPhaseAt(FINISH_SHOWDOWN_HOLD_MS, true)).toBe("winner");
        expect(finishPhaseAt(FINISH_SHOWDOWN_HOLD_MS + TOURNAMENT_WINNER_MOMENT_MS, true)).toBe("done");
    });

    it("skips the winner moment for a mid-tournament bust-out", () => {
        expect(finishPhaseAt(0, false)).toBe("showdown");
        expect(finishPhaseAt(FINISH_SHOWDOWN_HOLD_MS, false)).toBe("done");
    });

    it("schedules each next phase and stops when done", () => {
        expect(nextFinishPhaseAtMs(0, true)).toBe(FINISH_SHOWDOWN_HOLD_MS);
        expect(nextFinishPhaseAtMs(FINISH_SHOWDOWN_HOLD_MS, true)).toBe(FINISH_SHOWDOWN_HOLD_MS + TOURNAMENT_WINNER_MOMENT_MS);
        expect(nextFinishPhaseAtMs(FINISH_SHOWDOWN_HOLD_MS, false)).toBeNull();
    });

    it("holds result modals only while the finish is on screen", () => {
        expect(holdsResultModals("showdown")).toBe(true);
        expect(holdsResultModals("winner")).toBe(true);
        expect(holdsResultModals("done")).toBe(false);
        expect(holdsResultModals(null)).toBe(false);
    });
});

describe("winnerMomentText (ui#874)", () => {
    const dollars = (micro: string) => (Number(micro) / 1_000_000).toFixed(2);
    const truncate = (a: string) => a.slice(0, 6);

    it("names the winner, prize, hand and runner-up", () => {
        expect(winnerMomentText(tournamentFinishOf(FINAL)!, dollars, truncate)).toEqual({
            headline: "Seat 2 wins the tournament!",
            hand: "with Two Pair, Kings and Sevens",
            prize: "$7.00",
            runnerUp: "Seat 5 finished 2nd · $3.00"
        });
    });

    it("omits an unpaid prize and falls back to the address without a seat", () => {
        const finish = tournamentFinishOf(
            state([
                { place: 1, playerId: "b521gone", payout: "0" },
                { place: 2, playerId: BOB, payout: "0" }
            ])
        )!;
        const text = winnerMomentText(finish, dollars, truncate);
        expect(text.headline).toBe("b521go wins the tournament!");
        expect(text.prize).toBeNull();
        expect(text.hand).toBeNull();
        expect(text.runnerUp).toBe("Seat 5 finished 2nd");
    });

    it("spells places", () => {
        expect([1, 2, 3, 4, 9].map(ordinalPlace)).toEqual(["1st", "2nd", "3rd", "4th", "9th"]);
    });
});
