import { tableTitle } from "./tableTitle";

const TOURNAMENT = "0xface4d5c131b7d806a87883d234dd1929a296c5e01b904e293d24dbe2eada97e";

describe("tableTitle", () => {
    it("shows the short tournament id and table number for a tournament table", () => {
        expect(tableTitle(`${TOURNAMENT}-t1`)).toBe("Table face/1");
        expect(tableTitle(`${TOURNAMENT}-t12`)).toBe("Table face/12");
    });

    it("lowercases the short id", () => {
        expect(tableTitle("0xAE78AAAA-t3")).toBe("Table ae78/3");
    });

    it("prefers the table's own name", () => {
        expect(tableTitle(`${TOURNAMENT}-t1`, "Friday Turbo")).toBe("Friday Turbo");
    });

    it("keeps the last five characters of any other table id", () => {
        expect(tableTitle("0xabcdef0123456789")).toBe("Table 56789");
    });

    it("does not mistake a lookalike id for a tournament table", () => {
        expect(tableTitle("0xnothex-t1")).toBe("Table ex-t1");
        expect(tableTitle("0xabc-t")).toBe("Table abc-t");
    });

    it("renders an empty title while the id is not known", () => {
        expect(tableTitle(undefined)).toBe("Table ");
        expect(tableTitle("")).toBe("Table ");
    });
});
