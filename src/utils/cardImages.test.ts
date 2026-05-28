import {
    getCardImageUrl,
    getCardBackUrl,
    getChipImageUrl,
    getGenericChipImageUrl,
    getSoundUrl,
    getDealerImageUrl,
    preloadCardImages,
    preloadAllCards
} from "./cardImages";

// Jest's moduleNameMapper rewrites all *.svg imports to "test-file-stub" (see jest.config.cjs).
// All bundled card / card-back helpers return that stub in the test environment.
const BUNDLED_SVG = "test-file-stub";

// Non-critical assets (chips, sounds, dealer) are still served from a CDN — jsDelivr,
// against the block52/cards GitHub repo. raw.githubusercontent.com is not a CDN and was
// the source of the intermittent load failures we moved away from.
const CDN_BASE = "https://cdn.jsdelivr.net/gh/block52/cards@main";

describe("cardImages", () => {
    describe("getChipImageUrl", () => {
        it("should return correct chip image URL", () => {
            expect(getChipImageUrl("chip.svg")).toBe(`${CDN_BASE}/chips/chip.svg`);
        });

        it("should return correct chip image URL for 25chip.svg", () => {
            expect(getChipImageUrl("25chip.svg")).toBe(`${CDN_BASE}/chips/25chip.svg`);
        });
    });

    describe("getGenericChipImageUrl", () => {
        it("should return correct generic chip image URL", () => {
            expect(getGenericChipImageUrl()).toBe(`${CDN_BASE}/chips/chip.svg`);
        });
    });

    describe("getSoundUrl", () => {
        it("should return correct sound URL", () => {
            expect(getSoundUrl("bet.mp3")).toBe(`${CDN_BASE}/sounds/bet.mp3`);
        });
    });

    describe("getDealerImageUrl", () => {
        it("should return correct dealer image URL", () => {
            expect(getDealerImageUrl()).toBe(`${CDN_BASE}/dealer.svg`);
        });
    });

    describe("getCardBackUrl", () => {
        it("should return default card back when no style specified", () => {
            expect(getCardBackUrl()).toBe(BUNDLED_SVG);
        });

        it("should return default card back when style is 'default'", () => {
            expect(getCardBackUrl("default")).toBe(BUNDLED_SVG);
        });

        it("should return Block52 branded card back when style is 'block52'", () => {
            expect(getCardBackUrl("block52")).toBe(BUNDLED_SVG);
        });

        it("should return legacy card back when style is 'legacy'", () => {
            expect(getCardBackUrl("legacy")).toBe(BUNDLED_SVG);
        });

        it("should return custom card back when style is 'custom'", () => {
            expect(getCardBackUrl("custom")).toBe(BUNDLED_SVG);
        });

        it("should return custom URL when provided", () => {
            const customUrl = "https://example.com/my-card-back.svg";
            expect(getCardBackUrl(customUrl)).toBe(customUrl);
        });

        it("should handle club-specific branded URLs", () => {
            const clubUrl = "https://texashodl.net/brand/card-back.svg";
            expect(getCardBackUrl(clubUrl)).toBe(clubUrl);
        });
    });

    describe("getCardImageUrl", () => {
        it("should return bundled URL for Ace of Spades", () => {
            expect(getCardImageUrl("AS")).toBe(BUNDLED_SVG);
        });

        it("should return bundled URL for Ten of Clubs", () => {
            expect(getCardImageUrl("TC")).toBe(BUNDLED_SVG);
        });

        it("should return bundled URL for King of Hearts", () => {
            expect(getCardImageUrl("KH")).toBe(BUNDLED_SVG);
        });

        it("should return bundled URL for 2 of Diamonds", () => {
            expect(getCardImageUrl("2D")).toBe(BUNDLED_SVG);
        });

        it("should return card back for empty string", () => {
            expect(getCardImageUrl("")).toBe(BUNDLED_SVG);
        });

        it("should return card back for question marks", () => {
            expect(getCardImageUrl("??")).toBe(BUNDLED_SVG);
        });

        it("should return card back for undefined", () => {
            expect(getCardImageUrl(undefined as any)).toBe(BUNDLED_SVG);
        });

        it("should return card back for null", () => {
            expect(getCardImageUrl(null as any)).toBe(BUNDLED_SVG);
        });

        it("should return card back for unknown card code", () => {
            // Falls through to the default back — unknown codes should never render a broken image.
            expect(getCardImageUrl("ZZ")).toBe(BUNDLED_SVG);
        });

        it("should resolve all 52 ranks × suits without throwing", () => {
            const suits = ["C", "D", "H", "S"];
            const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
            for (const r of ranks) {
                for (const s of suits) {
                    expect(getCardImageUrl(`${r}${s}`)).toBe(BUNDLED_SVG);
                }
            }
        });
    });

    describe("preloadCardImages", () => {
        beforeEach(() => {
            global.Image = class {
                src = "";
            } as any;
        });

        it("should not throw for an array of codes", () => {
            expect(() => preloadCardImages(["AS", "KH", "QD", "JC"])).not.toThrow();
        });

        it("should handle empty array", () => {
            expect(() => preloadCardImages([])).not.toThrow();
        });

        it("should handle single card", () => {
            expect(() => preloadCardImages(["AS"])).not.toThrow();
        });
    });

    describe("preloadAllCards", () => {
        beforeEach(() => {
            global.Image = class {
                src = "";
            } as any;
        });

        it("should preload all 52 cards plus back", () => {
            expect(() => preloadAllCards()).not.toThrow();
        });
    });
});
