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

describe("cardImages", () => {
    const GITHUB_CDN_BASE = "https://raw.githubusercontent.com/block52/cards/main";


    describe("getChipImageUrl", () => {
        it("should return correct chip image URL", () => {
            expect(getChipImageUrl("chip.svg")).toBe(`${GITHUB_CDN_BASE}/chips/chip.svg`);
        });

        it("should return correct chip image URL for 25chip.svg", () => {
            expect(getChipImageUrl("25chip.svg")).toBe(`${GITHUB_CDN_BASE}/chips/25chip.svg`);
        });
    });

    describe("getGenericChipImageUrl", () => {
        it("should return correct generic chip image URL", () => {
            expect(getGenericChipImageUrl()).toBe(`${GITHUB_CDN_BASE}/chips/chip.svg`);
        });
    });

    describe("getSoundUrl", () => {
        it("should return correct sound URL", () => {
            expect(getSoundUrl("bet.mp3")).toBe(`${GITHUB_CDN_BASE}/sounds/bet.mp3`);
        });
    });

    describe("getDealerImageUrl", () => {
        it("should return correct dealer image URL", () => {
            expect(getDealerImageUrl()).toBe(`${GITHUB_CDN_BASE}/dealer.svg`);
        });
    });

    describe("getCardBackUrl", () => {
        it("should return default card back when no style specified", () => {
            expect(getCardBackUrl()).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should return default card back when style is 'default'", () => {
            expect(getCardBackUrl("default")).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should return Block52 branded card back when style is 'block52'", () => {
            expect(getCardBackUrl("block52")).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should return legacy card back when style is 'legacy'", () => {
            expect(getCardBackUrl("legacy")).toBe(`${GITHUB_CDN_BASE}/Back.svg`);
        });

        it("should return custom card back when style is 'custom'", () => {
            expect(getCardBackUrl("custom")).toBe(`${GITHUB_CDN_BASE}/BackCustom.svg`);
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
            expect(getCardImageUrl("AS")).toBe(`${GITHUB_CDN_BASE}/AS.svg`);
        });

        it("should return correct URL for Ten of Clubs", () => {
            expect(getCardImageUrl("TC")).toBe(`${GITHUB_CDN_BASE}/TC.svg`);
        });

        it("should return correct URL for King of Hearts", () => {
            expect(getCardImageUrl("KH")).toBe(`${GITHUB_CDN_BASE}/KH.svg`);
        });

        it("should return correct URL for 2 of Diamonds", () => {
            expect(getCardImageUrl("2D")).toBe(`${GITHUB_CDN_BASE}/2D.svg`);
        });

        it("should return card back for empty string", () => {
            expect(getCardImageUrl("")).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should return card back for question marks", () => {
            expect(getCardImageUrl("??")).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should return card back for undefined", () => {
            expect(getCardImageUrl(undefined as any)).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should return card back for null", () => {
            expect(getCardImageUrl(null as any)).toBe(`${GITHUB_CDN_BASE}/b52CardBack.svg`);
        });

        it("should handle all suits", () => {
            expect(getCardImageUrl("AC")).toBe(`${GITHUB_CDN_BASE}/AC.svg`);
            expect(getCardImageUrl("AD")).toBe(`${GITHUB_CDN_BASE}/AD.svg`);
            expect(getCardImageUrl("AH")).toBe(`${GITHUB_CDN_BASE}/AH.svg`);
            expect(getCardImageUrl("AS")).toBe(`${GITHUB_CDN_BASE}/AS.svg`);
        });

        it("should handle all ranks", () => {
            const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
            ranks.forEach(rank => {
                expect(getCardImageUrl(`${rank}S`)).toBe(`${GITHUB_CDN_BASE}/${rank}S.svg`);
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
