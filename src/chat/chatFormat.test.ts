import { senderLabel, relativeTime } from "./chatFormat";

describe("senderLabel", () => {
    it('returns "You" for own messages', () => {
        expect(senderLabel("b521abcdef0000000000a9d7", true)).toBe("You");
    });
    it("abbreviates a long wallet address", () => {
        expect(senderLabel("b521abcdef0000000000a9d7", false)).toBe("b521a…a9d7");
    });
    it("leaves a short label as-is", () => {
        expect(senderLabel("Nick", false)).toBe("Nick");
    });
    it('falls back to "Player" with no sender', () => {
        expect(senderLabel(undefined, false)).toBe("Player");
    });
});

describe("relativeTime", () => {
    const now = 1_000_000_000_000;
    it('"now" under 10s', () => {
        expect(relativeTime(now - 3000, now)).toBe("now");
    });
    it("seconds, minutes, hours", () => {
        expect(relativeTime(now - 30_000, now)).toBe("30s");
        expect(relativeTime(now - 5 * 60_000, now)).toBe("5m");
        expect(relativeTime(now - 3 * 3_600_000, now)).toBe("3h");
    });
});
