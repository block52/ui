import {
    sessionsReducer,
    emptySessions,
    canOpenMore,
    MAX_OPEN_TABLES,
    SessionsState,
    TableStatus
} from "./sessionsModel";

const open = (state: SessionsState, id: string, name?: string): SessionsState =>
    sessionsReducer(state, { type: "OPEN", id, name });

const withTables = (...ids: string[]): SessionsState => ids.reduce((s, id) => open(s, id), emptySessions);

const status = (over: Partial<TableStatus> = {}): TableStatus => ({ isMyTurn: false, holeCards: [], ...over });

describe("sessionsReducer — OPEN", () => {
    it("opens a table and makes it active", () => {
        const s = open(emptySessions, "0xA", "Alpha");
        expect(s.openTables).toEqual([{ id: "0xA", name: "Alpha" }]);
        expect(s.activeId).toBe("0xA");
    });

    it("re-opening an open table just focuses it, no duplicate", () => {
        const s = open(withTables("0xA", "0xB"), "0xA");
        expect(s.openTables.map(t => t.id)).toEqual(["0xA", "0xB"]);
        expect(s.activeId).toBe("0xA");
    });

    it("caps at MAX_OPEN_TABLES and ignores further opens", () => {
        let s = emptySessions;
        for (let i = 0; i < MAX_OPEN_TABLES; i++) s = open(s, `0x${i}`);
        expect(canOpenMore(s)).toBe(false);
        const after = open(s, "0xEXTRA");
        expect(after.openTables).toHaveLength(MAX_OPEN_TABLES);
        expect(after.openTables.some(t => t.id === "0xEXTRA")).toBe(false);
    });
});

describe("sessionsReducer — CLOSE", () => {
    it("removes a table and clears its status", () => {
        let s = withTables("0xA", "0xB");
        s = sessionsReducer(s, { type: "REPORT", id: "0xA", status: status({ isMyTurn: true }) });
        s = sessionsReducer(s, { type: "CLOSE", id: "0xA" });
        expect(s.openTables.map(t => t.id)).toEqual(["0xB"]);
        expect(s.statusById["0xA"]).toBeUndefined();
    });

    it("closing the active table falls back to the last remaining", () => {
        const s = sessionsReducer(withTables("0xA", "0xB", "0xC"), { type: "CLOSE", id: "0xC" });
        expect(s.activeId).toBe("0xB");
    });

    it("closing the last table leaves no active", () => {
        const s = sessionsReducer(withTables("0xA"), { type: "CLOSE", id: "0xA" });
        expect(s.activeId).toBeNull();
        expect(s.openTables).toHaveLength(0);
    });

    it("closing a non-active table keeps the active one", () => {
        let s = withTables("0xA", "0xB", "0xC");
        s = sessionsReducer(s, { type: "SET_ACTIVE", id: "0xB" });
        s = sessionsReducer(s, { type: "CLOSE", id: "0xA" });
        expect(s.activeId).toBe("0xB");
    });
});

describe("sessionsReducer — SET_ACTIVE", () => {
    it("focuses an open table", () => {
        const s = sessionsReducer(withTables("0xA", "0xB"), { type: "SET_ACTIVE", id: "0xA" });
        expect(s.activeId).toBe("0xA");
    });
    it("ignores a table that is not open", () => {
        const s = sessionsReducer(withTables("0xA"), { type: "SET_ACTIVE", id: "0xZ" });
        expect(s.activeId).toBe("0xA");
    });
});

describe("sessionsReducer — REPORT", () => {
    it("stores live status for an open table", () => {
        const s = sessionsReducer(withTables("0xA"), {
            type: "REPORT",
            id: "0xA",
            status: status({ isMyTurn: true, holeCards: ["AS", "KH"], name: "Alpha" })
        });
        expect(s.statusById["0xA"]).toEqual({ isMyTurn: true, holeCards: ["AS", "KH"], name: "Alpha" });
    });

    it("ignores reports for tables that are not open", () => {
        const s = sessionsReducer(withTables("0xA"), { type: "REPORT", id: "0xZ", status: status({ isMyTurn: true }) });
        expect(s.statusById["0xZ"]).toBeUndefined();
    });

    it("keeps a previously learned name when a later report omits it", () => {
        let s = sessionsReducer(withTables("0xA"), { type: "REPORT", id: "0xA", status: status({ name: "Alpha" }) });
        s = sessionsReducer(s, { type: "REPORT", id: "0xA", status: status({ isMyTurn: true }) });
        expect(s.statusById["0xA"].name).toBe("Alpha");
    });

    it("mirrors a learned name onto the open-table entry (survives reload)", () => {
        const s = sessionsReducer(withTables("0xA"), { type: "REPORT", id: "0xA", status: status({ name: "Alpha" }) });
        expect(s.openTables.find(t => t.id === "0xA")?.name).toBe("Alpha");
    });
});

describe("sessionsReducer — HYDRATE", () => {
    it("restores tables and a valid active id, with empty live status", () => {
        const s = sessionsReducer(emptySessions, {
            type: "HYDRATE",
            openTables: [{ id: "0xA" }, { id: "0xB" }],
            activeId: "0xB"
        });
        expect(s.openTables.map(t => t.id)).toEqual(["0xA", "0xB"]);
        expect(s.activeId).toBe("0xB");
        expect(s.statusById).toEqual({});
    });

    it("trims persisted tables to the cap and defaults active to the first", () => {
        const many = Array.from({ length: 7 }, (_, i) => ({ id: `0x${i}` }));
        const s = sessionsReducer(emptySessions, { type: "HYDRATE", openTables: many, activeId: "0xZZ" });
        expect(s.openTables).toHaveLength(MAX_OPEN_TABLES);
        expect(s.activeId).toBe("0x0");
    });

    describe("MOVE", () => {
        const ids = (st: SessionsState) => st.openTables.map(t => t.id);
        const three = ["a", "b", "c"].reduce((st, id) => sessionsReducer(st, { type: "OPEN", id }), emptySessions);

        it("moves a table forward and back, keeping the active table", () => {
            expect(ids(sessionsReducer(three, { type: "MOVE", id: "a", toIndex: 2 }))).toEqual(["b", "c", "a"]);
            const back = sessionsReducer(three, { type: "MOVE", id: "c", toIndex: 0 });
            expect(ids(back)).toEqual(["c", "a", "b"]);
            expect(back.activeId).toBe("c");
        });

        it("swaps two tables", () => {
            const two = sessionsReducer(sessionsReducer(emptySessions, { type: "OPEN", id: "x" }), { type: "OPEN", id: "y" });
            expect(ids(sessionsReducer(two, { type: "MOVE", id: "x", toIndex: 1 }))).toEqual(["y", "x"]);
        });

        it("clamps the index and ignores unknown or no-op moves", () => {
            expect(ids(sessionsReducer(three, { type: "MOVE", id: "a", toIndex: 99 }))).toEqual(["b", "c", "a"]);
            expect(sessionsReducer(three, { type: "MOVE", id: "zzz", toIndex: 0 })).toBe(three);
            expect(sessionsReducer(three, { type: "MOVE", id: "b", toIndex: 1 })).toBe(three);
        });
    });
});
