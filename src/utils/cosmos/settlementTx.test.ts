import { finishingOrderFromState } from "./settlementTx";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";

describe("finishingOrderFromState (pokerchain#229)", () => {
    it("returns [] when the game has no results (not finalized)", () => {
        expect(finishingOrderFromState(undefined)).toEqual([]);
        expect(finishingOrderFromState({ results: [] } as unknown as TexasHoldemStateDTO)).toEqual([]);
    });

    it("returns addresses in place-1-first order regardless of results[] order", () => {
        const state = {
            results: [
                { place: 3, playerId: "b52third", payout: "0" },
                { place: 1, playerId: "b52winner", payout: "300" },
                { place: 2, playerId: "b52second", payout: "0" }
            ]
        } as unknown as TexasHoldemStateDTO;
        expect(finishingOrderFromState(state)).toEqual(["b52winner", "b52second", "b52third"]);
    });
});
