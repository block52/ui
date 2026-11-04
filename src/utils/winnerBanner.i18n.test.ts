import { setLanguage } from "../i18n";
import { winnerBannerText } from "./winnerBanner";

describe("winnerBannerText in another language", () => {
    beforeAll(() => setLanguage("de"));
    afterAll(() => setLanguage("en"));

    it("translates the wording and keeps the amount and the engine's hand", () => {
        expect(winnerBannerText([{ seat: 3, formattedAmount: "12.50", winType: "showdown", description: "Full House" }])).toBe("Platz 3 gewinnt den Pot von $12.50 mit Full House");
    });

    it("translates a split pot", () => {
        expect(winnerBannerText([{ seat: 3, formattedAmount: "6" }, { seat: 5, formattedAmount: "6" }])).toBe("Geteilter Pot – Platz 3 $6 · Platz 5 $6");
    });
});
