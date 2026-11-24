import { startCountdownText } from "./tournamentStart";

describe("startCountdownText", () => {
    const START = 1_800_000_000_000;

    it("counts down to the start", () => {
        expect(startCountdownText(START, START - 272_000)).toBe("4:32");
        expect(startCountdownText(START, START - 5_000)).toBe("0:05");
        expect(startCountdownText(START, START - 3_725_000)).toBe("1:02:05");
    });

    it("says Starting once the time has passed", () => {
        expect(startCountdownText(START, START)).toBe("Starting…");
        expect(startCountdownText(START, START + 30_000)).toBe("Starting…");
    });
});
