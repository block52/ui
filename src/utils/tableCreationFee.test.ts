import { GameFormat } from "@block52/poker-vm-sdk";
import { computeTableCreationFeeMicro } from "./tableCreationFee";

// Values must match pokerchain x/poker/types/creation_fee_test.go (#378).
describe("computeTableCreationFeeMicro", () => {
    it("cash: 10 × big blind", () => {
        expect(computeTableCreationFeeMicro(GameFormat.CASH, 0.01, 0.02, 0.4, undefined)).toBe(200_000n); // $0.20
        expect(computeTableCreationFeeMicro(GameFormat.CASH, 0.05, 0.1, 2, undefined)).toBe(1_000_000n); // $1.00
    });

    it("sit & go: 10 BB at the buy-in's chip price", () => {
        // The live debit on 23 Sep, block 313,311: $1, 1,500 stack, 25/50 → 333,333.
        expect(computeTableCreationFeeMicro(GameFormat.SIT_AND_GO, 25, 50, 1, 1500)).toBe(333_333n);
        expect(computeTableCreationFeeMicro(GameFormat.SIT_AND_GO, 25, 50, 10, 1500)).toBe(3_333_333n);
    });

    it("tournament is priced like a sit & go", () => {
        expect(computeTableCreationFeeMicro(GameFormat.TOURNAMENT, 50, 100, 1, 3000)).toBe(333_333n);
    });

    it("returns null when the chain would reject it", () => {
        expect(computeTableCreationFeeMicro(GameFormat.CASH, 0, 0, 1, undefined)).toBeNull();
        expect(computeTableCreationFeeMicro(GameFormat.SIT_AND_GO, 25, 50, 1, 0)).toBeNull();
        expect(computeTableCreationFeeMicro(GameFormat.SIT_AND_GO, 25, 50, 1, undefined)).toBeNull();
    });
});
