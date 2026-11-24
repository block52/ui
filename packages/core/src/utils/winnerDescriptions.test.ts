import { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { withWinnerDescriptions } from "./winnerDescriptions";

const board = ["7H", "KC", "9S", "2D", "4C"];

function stateWith(winners: TexasHoldemStateDTO["winners"], communityCards: string[] = board): TexasHoldemStateDTO {
    return { handNumber: 7, communityCards, winners } as TexasHoldemStateDTO;
}

describe("withWinnerDescriptions (poker-vm#2721)", () => {
    it("fills name and description for a showdown winner from cards and board", () => {
        const state = stateWith([{ address: "b521a", seat: 2, amount: "400", cards: ["KC", "9S", "7S", "7D", "7H"], name: undefined, description: undefined }]);
        const out = withWinnerDescriptions(state);
        expect(out.winners[0].description).toBe("Set of Sevens");
        expect(out.winners[0].name).toBe("Set of Sevens");
        expect(out.handNumber).toBe(7);
    });

    it("tells trips from a set using the board", () => {
        const state = stateWith(
            [{ address: "b521a", seat: 2, amount: "400", cards: ["AD", "KC", "7S", "7H", "7C"], name: undefined, description: undefined }],
            ["7H", "7C", "KC", "9S", "2D"]
        );
        expect(withWinnerDescriptions(state).winners[0].description).toBe("Trip Sevens");
    });

    it("leaves an uncontested winner without a description", () => {
        const state = stateWith([{ address: "b521b", seat: 4, amount: "150", cards: undefined, name: undefined, description: undefined }]);
        expect(withWinnerDescriptions(state).winners[0].description).toBeUndefined();
    });

    it("does not modify the input state", () => {
        const state = stateWith([{ address: "b521a", seat: 2, amount: "400", cards: ["KC", "9S", "7S", "7D", "7H"], name: undefined, description: undefined }]);
        withWinnerDescriptions(state);
        expect(state.winners[0].description).toBeUndefined();
    });

    it("returns a state with no winners unchanged", () => {
        const empty = stateWith([]);
        expect(withWinnerDescriptions(empty)).toBe(empty);
        const missing = { handNumber: 3 } as TexasHoldemStateDTO;
        expect(withWinnerDescriptions(missing)).toBe(missing);
    });
});
