import { LegalActionDTO } from "@block52/poker-vm-sdk";
import { hasHandDecision } from "./TableStatusReporter";

const legal = (...actions: string[]): LegalActionDTO[] =>
    actions.map((action, index) => ({ action, min: "0", max: "0", index }) as unknown as LegalActionDTO);

describe("hasHandDecision", () => {
    it("is false between hands, when only sit-in / sit-out / leave are offered", () => {
        expect(hasHandDecision(legal("sit-in", "sit-in-and-wait", "leave"))).toBe(false);
        expect(hasHandDecision(legal("sit-out", "leave"))).toBe(false);
        expect(hasHandDecision([])).toBe(false);
    });

    it("is true for a betting decision", () => {
        expect(hasHandDecision(legal("fold", "call", "raise", "sit-out", "leave"))).toBe(true);
        expect(hasHandDecision(legal("check", "bet"))).toBe(true);
    });

    it("is true when a blind is waiting to be posted", () => {
        expect(hasHandDecision(legal("post-small-blind", "sit-out", "leave"))).toBe(true);
    });
});
