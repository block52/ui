import { compareLastActive, latestTimestamp } from "./accountActivity";

describe("accountActivity", () => {
    describe("latestTimestamp", () => {
        it("returns the most recent of several timestamps", () => {
            expect(latestTimestamp(["2026-10-01T00:00:00Z", "2026-10-08T04:30:52Z", "2026-09-30T12:00:00Z"])).toBe("2026-10-08T04:30:52Z");
        });

        it("ignores missing timestamps", () => {
            expect(latestTimestamp([undefined, "2026-10-01T00:00:00Z", undefined])).toBe("2026-10-01T00:00:00Z");
        });

        it("ignores unparseable timestamps", () => {
            expect(latestTimestamp(["not a date", "2026-10-01T00:00:00Z"])).toBe("2026-10-01T00:00:00Z");
        });

        it("returns null when there is no timestamp", () => {
            expect(latestTimestamp([])).toBeNull();
            expect(latestTimestamp([undefined, undefined])).toBeNull();
        });
    });

    describe("compareLastActive", () => {
        const older = "2026-10-01T00:00:00Z";
        const newer = "2026-10-08T00:00:00Z";

        it("puts the most recent first when descending", () => {
            expect([older, newer].sort((a, b) => compareLastActive(a, b, "desc"))).toEqual([newer, older]);
        });

        it("puts the oldest first when ascending", () => {
            expect([newer, older].sort((a, b) => compareLastActive(a, b, "asc"))).toEqual([older, newer]);
        });

        it("puts accounts with no activity last in either order", () => {
            expect([null, newer, older].sort((a, b) => compareLastActive(a, b, "desc"))).toEqual([newer, older, null]);
            expect([null, newer, older].sort((a, b) => compareLastActive(a, b, "asc"))).toEqual([older, newer, null]);
        });

        it("treats two accounts with no activity as equal", () => {
            expect(compareLastActive(null, null, "desc")).toBe(0);
        });
    });
});
