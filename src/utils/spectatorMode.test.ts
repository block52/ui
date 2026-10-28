import { isSpectatorPath, buildWatchUrl, WATCH_PATH_PREFIX } from "./spectatorMode";

describe("spectatorMode", () => {
    describe("isSpectatorPath", () => {
        it("is true for a /watch/:id route", () => {
            expect(isSpectatorPath("/watch/b52abc123")).toBe(true);
        });

        it("is false for the play route /table/:id", () => {
            expect(isSpectatorPath("/table/b52abc123")).toBe(false);
        });

        it("is false for unrelated routes", () => {
            expect(isSpectatorPath("/")).toBe(false);
            expect(isSpectatorPath("/wallet")).toBe(false);
            expect(isSpectatorPath("/watchlist")).toBe(false); // must match the slash, not a prefix word
        });
    });

    describe("buildWatchUrl", () => {
        it("joins origin + prefix + encoded id", () => {
            expect(buildWatchUrl("https://x.io", "b52abc123")).toBe("https://x.io/watch/b52abc123");
        });

        it("encodes URL-sensitive ids", () => {
            expect(buildWatchUrl("https://x.io", "a/b?c")).toBe(`https://x.io${WATCH_PATH_PREFIX}a%2Fb%3Fc`);
        });
    });
});
