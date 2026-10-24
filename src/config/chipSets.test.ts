import { CHIP_STYLES, CHIP_DENOMINATION_CONFIG, DEFAULT_CHIP_STYLE_ID, findChipStyle } from "./chipSets";
import { getChipSet } from "../constants/chips";

describe("chip set config (ui#842)", () => {
    it("has unique style ids and a default that exists", () => {
        const ids = CHIP_STYLES.map(s => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(DEFAULT_CHIP_STYLE_ID);
    });

    it("defaults to marble, with flat notched chips as the alternative", () => {
        expect(findChipStyle(null)).toMatchObject({ id: "marble", dir: "marble-pearl", ext: "webp" });
        expect(findChipStyle("notched")).toMatchObject({ dir: "notched", ext: "svg" });
    });

    it("an unknown style id falls back to the default", () => {
        expect(findChipStyle("holographic").id).toBe(DEFAULT_CHIP_STYLE_ID);
        expect(getChipSet("holographic", false)).toBe(getChipSet(DEFAULT_CHIP_STYLE_ID, false));
    });

    it("lists denominations largest first, with unique image names", () => {
        const values = CHIP_DENOMINATION_CONFIG.map(d => d.value);
        expect([...values].sort((a, b) => b - a)).toEqual(values);
        const files = CHIP_DENOMINATION_CONFIG.map(d => d.file);
        expect(new Set(files).size).toBe(files.length);
    });

    it("builds every style's sets from the config: 17 cash chips, 12 tournament chips", () => {
        for (const style of CHIP_STYLES) {
            const cash = getChipSet(style.id, false);
            const tournament = getChipSet(style.id, true);
            expect(cash).toHaveLength(17);
            expect(tournament).toHaveLength(12);
            expect(cash[0].file).toBe(`${style.dir}/cash/5000000chip.${style.ext}`);
            expect(tournament.every(d => d.file.startsWith(`${style.dir}/tournament/`) && d.value >= 1)).toBe(true);
        }
    });
});
