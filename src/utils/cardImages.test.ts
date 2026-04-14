import {
    getCardImageUrl,
    getCardBackUrl,
    getChipImageUrl,
    getDealerImageUrl,
    preloadCardImages,
    preloadAllCards
} from "./cardImages";

describe("cardImages", () => {
    const CDN_BASE = "https://cdn.jsdelivr.net/gh/block52/cards@main";

    describe("getChipImageUrl", () => {
        it("should return correct chip image URL", () => {
            expect(getChipImageUrl()).toBe(`${CDN_BASE}/chip.svg`);
        });
    });

    describe("getDealerImageUrl", () => {
        it("should return correct dealer image URL", () => {
            expect(getDealerImageUrl()).toBe(`${CDN_BASE}/dealer.svg`);
        });
    });

    describe("getCardBackUrl", () => {
        it("should return default card back when no style specified", () => {
            expect(getCardBackUrl()).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should return default card back when style is 'default'", () => {
            expect(getCardBackUrl("default")).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should return Block52 branded card back when style is 'block52'", () => {
            expect(getCardBackUrl("block52")).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should return legacy card back when style is 'legacy'", () => {
            expect(getCardBackUrl("legacy")).toBe(`${CDN_BASE}/Back.svg`);
        });

        it("should return custom card back when style is 'custom'", () => {
            expect(getCardBackUrl("custom")).toBe(`${CDN_BASE}/BackCustom.svg`);
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
        it("should return correct URL for Ace of Spades", () => {
            expect(getCardImageUrl("AS")).toBe(`${CDN_BASE}/AS.svg`);
        });

        it("should return correct URL for Ten of Clubs", () => {
            expect(getCardImageUrl("TC")).toBe(`${CDN_BASE}/TC.svg`);
        });

        it("should return correct URL for King of Hearts", () => {
            expect(getCardImageUrl("KH")).toBe(`${CDN_BASE}/KH.svg`);
        });

        it("should return correct URL for 2 of Diamonds", () => {
            expect(getCardImageUrl("2D")).toBe(`${CDN_BASE}/2D.svg`);
        });

        it("should return card back for empty string", () => {
            expect(getCardImageUrl("")).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should return card back for question marks", () => {
            expect(getCardImageUrl("??")).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should return card back for undefined", () => {
            expect(getCardImageUrl(undefined as any)).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should return card back for null", () => {
            expect(getCardImageUrl(null as any)).toBe(`${CDN_BASE}/b52CardBack.svg`);
        });

        it("should handle all suits", () => {
            expect(getCardImageUrl("AC")).toBe(`${CDN_BASE}/AC.svg`);
            expect(getCardImageUrl("AD")).toBe(`${CDN_BASE}/AD.svg`);
            expect(getCardImageUrl("AH")).toBe(`${CDN_BASE}/AH.svg`);
            expect(getCardImageUrl("AS")).toBe(`${CDN_BASE}/AS.svg`);
        });

        it("should handle all ranks", () => {
            const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
            ranks.forEach(rank => {
                expect(getCardImageUrl(`${rank}S`)).toBe(`${CDN_BASE}/${rank}S.svg`);
            });
        });
    });

    describe("preloadCardImages", () => {
        beforeEach(() => {
            global.Image = class {
                src = "";
            } as any;
        });

        it("should create Image objects for each card code", () => {
            const cardCodes = ["AS", "KH", "QD", "JC"];
            preloadCardImages(cardCodes);
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

        it("should include all suits and ranks", () => {
            const suits = ["C", "D", "H", "S"];
            const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];

            expect(suits.length * ranks.length).toBe(52);
        });
    });
});
