import type { ResultDTO } from "@block52/poker-vm-sdk";
import { finisherResult } from "./tournamentResult";

const ME = "b521rzpgz9rcmg9t383kyal6ufmzvarhkfx9aazncg";

const result = (place: number, playerId: string, payout: string): ResultDTO => ({ place, playerId, payout }) as ResultDTO;

describe("finisherResult", () => {
    it("is null while the wallet has no result", () => {
        expect(finisherResult(undefined, ME)).toBeNull();
        expect(finisherResult([], ME)).toBeNull();
        expect(finisherResult([result(5, "b521other", "0")], ME)).toBeNull();
        expect(finisherResult([result(1, ME, "1")], undefined)).toBeNull();
    });

    it("finds the wallet's place and prize, matching the address case-insensitively", () => {
        expect(finisherResult([result(2, ME.toUpperCase(), "6561000")], ME)).toEqual({ place: 2, payout: "6561000", isWinner: false });
    });

    it("marks first place as the winner", () => {
        expect(finisherResult([result(1, ME, "9720000"), result(2, "b521other", "6561000")], ME)).toEqual({
            place: 1,
            payout: "9720000",
            isWinner: true
        });
    });

    it("gives a player who busted with others the shared place and no prize", () => {
        const results = [result(13, ME, "0"), result(13, "b521other", "0")];
        expect(finisherResult(results, ME)).toEqual({ place: 13, payout: "0", isWinner: false });
    });
});
