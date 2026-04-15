import { PlayerStatus } from "@block52/poker-vm-sdk";
import { shouldShowChips } from "./chipUtils";

describe("shouldShowChips", () => {
    it("returns true for ACTIVE players", () => {
        expect(shouldShowChips(PlayerStatus.ACTIVE)).toBe(true);
    });

    it("returns true for ALL_IN players", () => {
        expect(shouldShowChips(PlayerStatus.ALL_IN)).toBe(true);
    });

    it("returns true for FOLDED players", () => {
        expect(shouldShowChips(PlayerStatus.FOLDED)).toBe(true);
    });

    it("returns false for SITTING_OUT players", () => {
        expect(shouldShowChips(PlayerStatus.SITTING_OUT)).toBe(false);
    });

    it("returns false for ELIMINATED players", () => {
        expect(shouldShowChips(PlayerStatus.ELIMINATED)).toBe(false);
    });

    it("returns false for NOT_ACTING players", () => {
        expect(shouldShowChips(PlayerStatus.NOT_ACTING)).toBe(false);
    });
});
