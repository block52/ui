import {
    countChangesByKind,
    formatReleaseDate,
    formatReleaseDateShort,
    groupReleasesByMonth,
    isStructuredRelease,
    parseChangeRefs,
    parseReleaseNotes,
    releaseChanges,
    type ReleaseNote
} from "./releaseNotes";

const note = (overrides: Partial<ReleaseNote>): ReleaseNote => ({ id: "n", date: "2026-10-07", title: "t", tags: [], ...overrides });

describe("parseChangeRefs", () => {
    it("splits a repo-qualified ref and links it to the block52 repo", () => {
        expect(parseChangeRefs("/nodes self-service node portal (ui#719)")).toEqual({
            text: "/nodes self-service node portal",
            refs: [{ label: "ui#719", repo: "ui", number: 719, url: "https://github.com/block52/ui/issues/719" }]
        });
    });

    it("handles hyphenated repo names", () => {
        const { refs } = parseChangeRefs("Builder (poker-vm#2636)");
        expect(refs[0].url).toBe("https://github.com/block52/poker-vm/issues/2636");
    });

    it("keeps bare #n refs unlinked since the repo is unknown", () => {
        expect(parseChangeRefs("Buy-ins as USDC (#676, #668)")).toEqual({
            text: "Buy-ins as USDC",
            refs: [
                { label: "#676", number: 676 },
                { label: "#668", number: 668 }
            ]
        });
    });

    it("leaves a non-reference parenthetical in the text", () => {
        expect(parseChangeRefs("Auto actions latch (on submission)")).toEqual({ text: "Auto actions latch (on submission)", refs: [] });
        expect(parseChangeRefs("Mixed (ui#1, see notes)")).toEqual({ text: "Mixed (ui#1, see notes)", refs: [] });
    });

    it("leaves text without a trailing group alone", () => {
        expect(parseChangeRefs("No refs here")).toEqual({ text: "No refs here", refs: [] });
        expect(parseChangeRefs("Mid (ui#1) text")).toEqual({ text: "Mid (ui#1) text", refs: [] });
    });
});

describe("dates", () => {
    it("formats a calendar day without timezone drift", () => {
        expect(formatReleaseDate("2026-10-07")).toBe("October 7, 2026");
        expect(formatReleaseDateShort("2026-09-23")).toBe("Sep 23, 2026");
    });

    it("throws on a malformed date instead of guessing", () => {
        expect(() => formatReleaseDate("Oct 7")).toThrow(/YYYY-MM-DD/);
    });

    it("throws on an out-of-range month or day", () => {
        expect(() => formatReleaseDate("2026-13-05")).toThrow(/month/);
        expect(() => formatReleaseDateShort("2026-00-05")).toThrow(/month/);
        expect(() => formatReleaseDate("2026-10-32")).toThrow(/day/);
        expect(() => formatReleaseDate("2026-10-00")).toThrow(/day/);
    });
});

describe("parseChangeRefs on hostile input", () => {
    it("handles a long whitespace run in linear time", () => {
        const started = Date.now();
        expect(parseChangeRefs(" ".repeat(60000) + "x").refs).toEqual([]);
        expect(parseChangeRefs("text (ui#1)" + " ".repeat(60000)).refs).toHaveLength(1);
        expect(Date.now() - started).toBeLessThan(500);
    });
});

describe("parseReleaseNotes", () => {
    it("keeps valid notes and reports each skipped entry", () => {
        const { notes, skipped } = parseReleaseNotes([
            note({ id: "ok" }),
            note({ id: "bad-month", date: "2026-13-05" }),
            { id: "no-tags", date: "2026-10-07", title: "t" },
            { id: "bad-list", date: "2026-10-07", title: "t", tags: [], features: "x" },
            "nope",
            null
        ]);
        expect(notes.map(n => n.id)).toEqual(["ok"]);
        expect(skipped).toHaveLength(5);
        expect(skipped[0]).toMatch(/entry 1.*month/);
        expect(skipped[1]).toMatch(/tags/);
        expect(skipped[2]).toMatch(/features/);
    });

    it("rejects a payload that is not an array", () => {
        expect(() => parseReleaseNotes({ notes: [] })).toThrow(/not an array/);
    });
});

describe("groupReleasesByMonth", () => {
    it("groups consecutive releases by month in input order", () => {
        const groups = groupReleasesByMonth([
            note({ id: "a", date: "2026-10-07" }),
            note({ id: "b", date: "2026-09-23" }),
            note({ id: "c", date: "2026-09-16" })
        ]);
        expect(groups.map(g => g.label)).toEqual(["October 2026", "September 2026"]);
        expect(groups[1].items.map(i => [i.note.id, i.day])).toEqual([
            ["b", 23],
            ["c", 16]
        ]);
    });

    it("returns nothing for no releases", () => {
        expect(groupReleasesByMonth([])).toEqual([]);
    });
});

describe("releaseChanges / counts", () => {
    it("flattens kinds in display order and counts them", () => {
        const changes = releaseChanges(note({ features: ["f1"], bugFixes: ["b1", "b2"], improvements: [], tests: ["t1"] }));
        expect(changes).toEqual([
            { kind: "feature", text: "f1" },
            { kind: "bugFix", text: "b1" },
            { kind: "bugFix", text: "b2" },
            { kind: "test", text: "t1" }
        ]);
        expect(countChangesByKind(changes)).toEqual({ feature: 1, bugFix: 2, improvement: 0, test: 1 });
    });

    it("tells structured releases from free-form ones", () => {
        expect(isStructuredRelease(note({ features: [] }))).toBe(true);
        expect(isStructuredRelease(note({ body: "text" }))).toBe(false);
    });
});
