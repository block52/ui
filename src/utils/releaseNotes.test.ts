import {
    countChangesByKind,
    formatReleaseDate,
    formatReleaseDateShort,
    groupReleasesByMonth,
    isStructuredRelease,
    parseChangeRefs,
    parseReleaseDate,
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
    it("parses a calendar day without timezone drift", () => {
        expect(parseReleaseDate("2026-10-07")).toEqual({ year: 2026, month: 10, day: 7 });
        expect(formatReleaseDate("2026-10-07")).toBe("October 7, 2026");
        expect(formatReleaseDateShort("2026-09-23")).toBe("Sep 23, 2026");
    });

    it("throws on a malformed date instead of guessing", () => {
        expect(() => parseReleaseDate("Oct 7")).toThrow(/YYYY-MM-DD/);
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
