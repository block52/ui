import { PlayerStatus } from "@block52/poker-vm-sdk";
import { hasFoldedOrMucked } from "./playerStatus";

describe("hasFoldedOrMucked", () => {
    it("treats a mucked seat exactly like a folded one (engine v1.0.18, poker-vm#2586)", () => {
        expect(hasFoldedOrMucked(PlayerStatus.FOLDED)).toBe(true);
        expect(hasFoldedOrMucked(PlayerStatus.MUCKED)).toBe(true);
        expect(hasFoldedOrMucked("mucked")).toBe(true);
    });

    it("is false for every in-hand and idle status, and for a missing one", () => {
        for (const status of [PlayerStatus.ACTIVE, PlayerStatus.ALL_IN, PlayerStatus.SHOWING, PlayerStatus.SITTING_OUT, PlayerStatus.BUSTED, PlayerStatus.SEATED]) {
            expect(hasFoldedOrMucked(status)).toBe(false);
        }
        expect(hasFoldedOrMucked(undefined)).toBe(false);
        expect(hasFoldedOrMucked(null)).toBe(false);
    });
});
