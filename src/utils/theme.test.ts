import { DEFAULT_THEME, isDarkOnlyRoute, parseStoredTheme, resolveTheme } from "./theme";

describe("parseStoredTheme", () => {
    it("accepts the two known themes", () => {
        expect(parseStoredTheme("light")).toBe("light");
        expect(parseStoredTheme("dark")).toBe("dark");
    });

    it("rejects missing or corrupted values", () => {
        expect(parseStoredTheme(null)).toBeNull();
        expect(parseStoredTheme("")).toBeNull();
        expect(parseStoredTheme("Light")).toBeNull();
        expect(parseStoredTheme("system")).toBeNull();
    });
});

describe("isDarkOnlyRoute", () => {
    it("is true for game tables", () => {
        expect(isDarkOnlyRoute("/table/0xabc")).toBe(true);
    });

    it("is false for the legacy table admin page and ordinary pages", () => {
        expect(isDarkOnlyRoute("/table/admin")).toBe(false);
        expect(isDarkOnlyRoute("/")).toBe(false);
        expect(isDarkOnlyRoute("/admin/tables")).toBe(false);
        expect(isDarkOnlyRoute("/tablet")).toBe(false);
    });
});

describe("resolveTheme", () => {
    it("follows the preference on ordinary pages", () => {
        expect(resolveTheme("light", "/explorer")).toBe("light");
        expect(resolveTheme("dark", "/explorer")).toBe("dark");
    });

    it("forces dark on game tables whatever the preference", () => {
        expect(resolveTheme("light", "/table/0xabc")).toBe("dark");
    });

    it("defaults to dark", () => {
        expect(DEFAULT_THEME).toBe("dark");
    });
});
