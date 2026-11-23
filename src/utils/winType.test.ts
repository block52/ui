import { GameVariant, PlayerActionType, PlayerStatus, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { getWinType, withWinnerDescriptions } from "@block52/poker-ui-core/utils/winnerDescriptions";
import { winnerBannerText } from "./winnerBanner";

const board = ["7H", "KC", "9S", "2D", "4C"];

type P = { address: string; seat: number; status: PlayerStatus; holeCards?: string[] };

function state(players: P[], winners: TexasHoldemStateDTO["winners"], actions: Array<{ playerId: string; action: string }> = []): TexasHoldemStateDTO {
    return {
        handNumber: 3,
        communityCards: board,
        players,
        winners,
        previousActions: actions.map((a, i) => ({ ...a, seat: 0, amount: "", round: "showdown", index: i, timestamp: 0 }))
    } as unknown as TexasHoldemStateDTO;
}

const win = (address: string, seat: number, amount = "400", cards?: string[]) => ({ address, seat, amount, cards, name: undefined, description: undefined });

/** What the banner shows for a processed state (seat + win type + hand). */
function banner(s: TexasHoldemStateDTO): string | null {
    const out = withWinnerDescriptions(s);
    return winnerBannerText(
        out.winners.map(w => ({ seat: w.seat, formattedAmount: "4.00", description: w.description, handName: w.name, winType: getWinType(w) }))
    );
}

describe("uncontested only when everyone folded", () => {
    it("everyone folds: uncontested, no hand (even though the hero's own cards are visible)", () => {
        const s = state(
            [
                { address: "b521a", seat: 1, status: PlayerStatus.ACTIVE, holeCards: ["7S", "7D"] },
                { address: "b521b", seat: 2, status: PlayerStatus.FOLDED, holeCards: ["X", "X"] }
            ],
            [win("b521a", 1)],
            [{ playerId: "b521b", action: PlayerActionType.FOLD }]
        );
        const out = withWinnerDescriptions(s);
        expect(getWinType(out.winners[0])).toBe("uncontested");
        expect(out.winners[0].description).toBeUndefined();
        expect(banner(s)).toBe("Seat 1 wins the $4.00 pot");
    });

    it("showdown where the winner shows and the rest muck: won with <hand>", () => {
        const s = state(
            [
                { address: "b521a", seat: 1, status: PlayerStatus.SHOWING, holeCards: ["7S", "7D"] },
                { address: "b521b", seat: 2, status: PlayerStatus.MUCKED, holeCards: ["X", "X"] },
                { address: "b521c", seat: 3, status: PlayerStatus.MUCKED, holeCards: ["X", "X"] }
            ],
            [win("b521a", 1)],
            [
                { playerId: "b521a", action: PlayerActionType.SHOW },
                { playerId: "b521b", action: PlayerActionType.MUCK },
                { playerId: "b521c", action: PlayerActionType.MUCK }
            ]
        );
        const out = withWinnerDescriptions(s);
        expect(getWinType(out.winners[0])).toBe("showdown");
        expect(out.winners[0].description).toBe("Set of Sevens");
        expect(out.winners[0].cards).toHaveLength(5);
        expect(banner(s)).toBe("Seat 1 wins the $4.00 pot with Set of Sevens");
    });

    it("a SHOW action alone (seat status already moved on) still counts as revealed", () => {
        const s = state(
            [{ address: "b521a", seat: 1, status: PlayerStatus.ACTIVE, holeCards: ["7S", "7D"] }],
            [win("b521a", 1)],
            [{ playerId: "b521a", action: PlayerActionType.SHOW }, { playerId: "b521b", action: PlayerActionType.MUCK }]
        );
        expect(banner(s)).toBe("Seat 1 wins the $4.00 pot with Set of Sevens");
    });

    it("showdown where all show: won with <hand> (engine-supplied cards, unchanged)", () => {
        const s = state(
            [
                { address: "b521a", seat: 1, status: PlayerStatus.SHOWING, holeCards: ["7S", "7D"] },
                { address: "b521b", seat: 2, status: PlayerStatus.SHOWING, holeCards: ["KD", "3C"] }
            ],
            [win("b521a", 1, "400", ["KC", "9S", "7S", "7D", "7H"])],
            [
                { playerId: "b521a", action: PlayerActionType.SHOW },
                { playerId: "b521b", action: PlayerActionType.SHOW }
            ]
        );
        expect(banner(s)).toBe("Seat 1 wins the $4.00 pot with Set of Sevens");
    });

    it("split pot is unchanged", () => {
        const s = state(
            [
                { address: "b521a", seat: 1, status: PlayerStatus.SHOWING, holeCards: ["AS", "QD"] },
                { address: "b521b", seat: 2, status: PlayerStatus.SHOWING, holeCards: ["AD", "QC"] }
            ],
            [win("b521a", 1, "200", ["AS", "KC", "QD", "9S", "7H"]), win("b521b", 2, "200", ["AD", "KC", "QC", "9S", "7H"])]
        );
        const out = withWinnerDescriptions(s);
        expect(out.winners.map(w => getWinType(w))).toEqual(["showdown", "showdown"]);
        expect(banner(s)).toMatch(/^Split pot/);
    });

    it("uses the table variant: an Omaha winner plays exactly two hole cards", () => {
        const s = state(
            [{ address: "b521a", seat: 1, status: PlayerStatus.SHOWING, holeCards: ["7S", "7D", "7C", "AS"] }],
            [win("b521a", 1)],
            [{ playerId: "b521a", action: PlayerActionType.SHOW }, { playerId: "b521b", action: PlayerActionType.MUCK }]
        );
        // Three hole sevens + the board's 7H would be quads if Hold'em rules applied.
        expect(withWinnerDescriptions(s, GameVariant.OMAHA).winners[0].description).toBe("Set of Sevens");
    });
});
