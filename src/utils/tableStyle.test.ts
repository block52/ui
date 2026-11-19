import {
    BLOCKCHAIN_POKER_CARD_BACK,
    BLOCKCHAIN_POKER_FELT_LOGO,
    TABLE_STYLE_LABELS,
    TABLE_STYLE_OPTIONS,
    cardBackStyleForTheme,
    feltLogoForTheme,
    isTableStyleOption,
    nextTableStyle,
    resolveDefaultTableStyle
} from "./tableStyle";

describe("tableStyle", () => {
    it("lists every appearance in toggle order, ending with Blockchain Poker after Nouns", () => {
        expect(TABLE_STYLE_OPTIONS).toEqual(["modern", "classic", "nouns", "blockchainpoker"]);
        expect(TABLE_STYLE_LABELS.blockchainpoker).toBe("Blockchain Poker");
    });

    it("cycles modern → classic → nouns → blockchainpoker → modern", () => {
        expect(nextTableStyle("modern")).toBe("classic");
        expect(nextTableStyle("classic")).toBe("nouns");
        expect(nextTableStyle("nouns")).toBe("blockchainpoker");
        expect(nextTableStyle("blockchainpoker")).toBe("modern");
    });

    it("accepts known appearance ids and rejects anything else", () => {
        expect(isTableStyleOption("blockchainpoker")).toBe(true);
        expect(isTableStyleOption("modern")).toBe(true);
        expect(isTableStyleOption("unknown")).toBe(false);
        expect(isTableStyleOption(undefined)).toBe(false);
        expect(isTableStyleOption("")).toBe(false);
    });

    it("reads a valid VITE_TABLE_STYLE and falls back to modern otherwise", () => {
        expect(resolveDefaultTableStyle("blockchainpoker")).toBe("blockchainpoker");
        expect(resolveDefaultTableStyle("nouns")).toBe("nouns");
        expect(resolveDefaultTableStyle("")).toBe("modern");
        expect(resolveDefaultTableStyle(undefined)).toBe("modern");
        expect(resolveDefaultTableStyle("neon")).toBe("modern");
    });

    it("selects the Blockchain Poker felt logo by appearance, not the club logo", () => {
        expect(feltLogoForTheme("blockchainpoker", "/poker.svg")).toBe(BLOCKCHAIN_POKER_FELT_LOGO);
        expect(feltLogoForTheme("modern", "/poker.svg")).toBe("/poker.svg");
        expect(feltLogoForTheme("nouns", "/custom.png")).toBe("/custom.png");
    });

    it("selects the Blockchain Poker card-back token only for that appearance", () => {
        expect(cardBackStyleForTheme("blockchainpoker", "default")).toBe("blockchainpoker");
        expect(cardBackStyleForTheme("blockchainpoker", "https://example.com/back.svg")).toBe("blockchainpoker");
        expect(cardBackStyleForTheme("modern", "default")).toBe("default");
        expect(cardBackStyleForTheme("classic", "legacy")).toBe("legacy");
        expect(BLOCKCHAIN_POKER_CARD_BACK).toBe("/appearances/blockchain-poker/card-back-charcoal.svg");
    });
});
