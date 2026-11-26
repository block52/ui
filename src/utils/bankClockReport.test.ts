import { bankSpentData, setBankClockStart, withBankSpentData } from "./bankClockReport";

describe("bankClockReport (ui#944)", () => {
    afterEach(() => setBankClockStart("t1", null));

    it("reports nothing with no bank in play", () => {
        expect(bankSpentData("t1", 5_000)).toBeUndefined();
    });

    it("reports nothing while the player's own clock is still running", () => {
        setBankClockStart("t1", 10_000);
        expect(bankSpentData("t1", 9_000)).toBeUndefined();
    });

    it("reports what the countdown has spent of the bank", () => {
        setBankClockStart("t1", 10_000);
        expect(bankSpentData("t1", 14_000)).toBe("bankSpentMs=4000");
    });

    it("keeps each table separate, and clears", () => {
        setBankClockStart("t1", 10_000);
        expect(bankSpentData("t2", 14_000)).toBeUndefined();
        setBankClockStart("t1", null);
        expect(bankSpentData("t1", 14_000)).toBeUndefined();
    });

    it("merges with data the action already carries", () => {
        expect(withBankSpentData(undefined, undefined)).toBeUndefined();
        expect(withBankSpentData("seat=1", undefined)).toBe("seat=1");
        expect(withBankSpentData(undefined, "bankSpentMs=1")).toBe("bankSpentMs=1");
        expect(withBankSpentData("seat=1", "bankSpentMs=1")).toBe("seat=1&bankSpentMs=1");
    });
});
