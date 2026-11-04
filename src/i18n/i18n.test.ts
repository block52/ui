import { en } from "./en";
import { LANGUAGES, matchBrowserLanguage, isLanguageCode } from "./languages";
import { getLanguage, readSavedLanguage, setLanguage, subscribeToLanguage, t } from "./index";

const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();

describe("language list", () => {
    it("has 16 languages with unique codes", () => {
        expect(LANGUAGES).toHaveLength(16);
        expect(new Set(LANGUAGES.map(l => l.code)).size).toBe(16);
    });

    it("recognises only supported codes", () => {
        expect(isLanguageCode("de")).toBe(true);
        expect(isLanguageCode("xx")).toBe(false);
        expect(isLanguageCode(null)).toBe(false);
        expect(isLanguageCode(undefined)).toBe(false);
    });
});

describe("matchBrowserLanguage", () => {
    it("matches on the base language", () => {
        expect(matchBrowserLanguage(["de-AT"])).toBe("de");
        expect(matchBrowserLanguage(["PT-br"])).toBe("pt");
    });

    it("takes the first one we support", () => {
        expect(matchBrowserLanguage(["xx", "ko-KR", "de"])).toBe("ko");
    });

    it("falls back to English", () => {
        expect(matchBrowserLanguage(["xx"])).toBe("en");
        expect(matchBrowserLanguage([])).toBe("en");
    });
});

describe("translations", () => {
    const others = LANGUAGES.map(l => l.code).filter(code => code !== "en");

    it.each(others)("%s has exactly the English keys, filled in, with the same placeholders", async code => {
        const { default: strings } = await import(`./locales/${code}`);
        expect(Object.keys(strings).sort()).toEqual(Object.keys(en).sort());
        for (const key of Object.keys(en) as (keyof typeof en)[]) {
            expect(strings[key].trim()).not.toBe("");
            expect(placeholders(strings[key])).toEqual(placeholders(en[key]));
        }
    });
});

describe("t and setLanguage", () => {
    afterEach(async () => {
        await setLanguage("en");
        localStorage.clear();
    });

    it("fills in placeholders", () => {
        expect(t("status.seatedAt", { seat: 4 })).toBe("You are seated at position 4");
    });

    it("leaves an unknown placeholder alone", () => {
        expect(t("status.seatedAt")).toBe("You are seated at position {seat}");
    });

    it("switches language, saves it and tells subscribers", async () => {
        const listener = jest.fn();
        const unsubscribe = subscribeToLanguage(listener);
        await setLanguage("de");
        unsubscribe();
        expect(getLanguage()).toBe("de");
        expect(t("panel.settings")).toBe("Einstellungen");
        expect(document.documentElement.lang).toBe("de");
        expect(localStorage.getItem("b52.language")).toBe("de");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("the last choice wins when two load at once", async () => {
        await Promise.all([setLanguage("de"), setLanguage("es")]);
        expect(getLanguage()).toBe("es");
    });

    it("reads the saved choice, ignoring a bad value", () => {
        localStorage.setItem("b52.language", "ja");
        expect(readSavedLanguage()).toBe("ja");
        localStorage.setItem("b52.language", "klingon");
        expect(readSavedLanguage()).toBe("en");
    });
});

describe("pot names", () => {
    afterAll(() => setLanguage("en"));

    it("translates each kind of pot and keeps the side pot's number", async () => {
        const { potLabelText } = await import("../utils/potTextUtils");
        expect(potLabelText("Side Pot 2")).toBe("Side Pot 2");
        await setLanguage("de");
        expect(potLabelText("Total Pot")).toBe("Gesamtpot");
        expect(potLabelText("Main Pot")).toBe("Hauptpot");
        expect(potLabelText("Side Pot")).toBe("Sidepot");
        expect(potLabelText("Side Pot 2")).toBe("Sidepot 2");
        expect(potLabelText("Pot")).toBe("Pot");
    });
});
