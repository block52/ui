import {
    MAX_PLAYER_NOTE_LENGTH,
    PLAYER_NOTE_TAGS,
    buildPlayerNote,
    describePlayerNote,
    getPlayerNoteTag,
    isPlayerNoteDraftChanged,
    isPlayerNoteEmpty,
    isPlayerNoteTagId,
    normalizeNoteAddress,
    parsePlayerNotesStore,
    placeNotesPanel,
    playerNotesStorageKey,
    serializePlayerNotesStore,
    sortPlayerNoteTags,
    summarizeSeatTags,
    togglePlayerNoteTag,
    upsertPlayerNote,
    type PlayerNote
} from "./playerNotes";

const note = (text: string, tags: PlayerNote["tags"] = []): PlayerNote => ({ text, tags, updatedAt: 1 });

describe("PLAYER_NOTE_TAGS", () => {
    it("has unique ids and an icon and label for each", () => {
        const ids = PLAYER_NOTE_TAGS.map(t => t.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const tag of PLAYER_NOTE_TAGS) {
            expect(tag.icon.length).toBeGreaterThan(0);
            expect(tag.label.length).toBeGreaterThan(0);
        }
    });

    it("covers the tags the user asked for", () => {
        expect(PLAYER_NOTE_TAGS.map(t => t.id)).toEqual(expect.arrayContaining(["tight", "loose", "aggressive", "weak", "fish", "shark"]));
    });

    it("looks a tag up by id and throws on an unknown one", () => {
        expect(getPlayerNoteTag("fish").icon).toBe("🐟");
        expect(() => getPlayerNoteTag("nope" as never)).toThrow("Unknown player note tag");
    });
});

describe("isPlayerNoteTagId", () => {
    it.each(["fish", "shark", "tilter"])("accepts %s", id => expect(isPlayerNoteTagId(id)).toBe(true));
    it.each(["", "Fish", "donkey", 3, null, undefined])("rejects %s", id => expect(isPlayerNoteTagId(id)).toBe(false));
});

describe("sortPlayerNoteTags / togglePlayerNoteTag", () => {
    it("orders tags as the picker does, drops duplicates and unknown ids", () => {
        expect(sortPlayerNoteTags(["aggressive", "fish", "fish", "bogus"])).toEqual(["fish", "aggressive"]);
    });

    it("adds a missing tag in picker order", () => {
        expect(togglePlayerNoteTag(["aggressive"], "tight")).toEqual(["tight", "aggressive"]);
    });

    it("removes a present tag", () => {
        expect(togglePlayerNoteTag(["tight", "aggressive"], "tight")).toEqual(["aggressive"]);
    });
});

describe("isPlayerNoteEmpty / buildPlayerNote", () => {
    it.each([null, undefined])("treats %s as empty", value => expect(isPlayerNoteEmpty(value)).toBe(true));

    it("treats whitespace-only text with no tags as empty", () => {
        expect(isPlayerNoteEmpty(note("   \n "))).toBe(true);
    });

    it("is not empty with text or with a tag", () => {
        expect(isPlayerNoteEmpty(note("calls 3-bets light"))).toBe(false);
        expect(isPlayerNoteEmpty(note("", ["fish"]))).toBe(false);
    });

    it("trims and caps the text, cleans the tags and stamps the time", () => {
        const built = buildPlayerNote(`  ${"x".repeat(MAX_PLAYER_NOTE_LENGTH + 50)}  `, ["shark", "fish", "x"], 42);
        expect(built.text.length).toBe(MAX_PLAYER_NOTE_LENGTH);
        expect(built.tags).toEqual(["fish", "shark"]);
        expect(built.updatedAt).toBe(42);
    });
});

describe("storage record", () => {
    it("builds one key per viewer, case-insensitive", () => {
        expect(playerNotesStorageKey(" B521ABC ")).toBe("player_notes:v1:b521abc");
        expect(normalizeNoteAddress("B521ABC")).toBe("b521abc");
    });

    it("round-trips through serialize and parse", () => {
        const book = { b521one: note("limps a lot", ["fish", "passive"]) };
        expect(parsePlayerNotesStore(serializePlayerNotesStore(book))).toEqual(book);
    });

    it.each([null, "", "not json", "[]", JSON.stringify({ version: 2, notes: {} }), JSON.stringify({ version: 1, notes: [] })])(
        "reads %s as an empty book",
        raw => expect(parsePlayerNotesStore(raw)).toEqual({})
    );

    it("drops malformed and empty entries, unknown tags, and lower-cases addresses", () => {
        const raw = JSON.stringify({
            version: 1,
            notes: {
                B521KEEP: { text: "ok", tags: ["fish", "made-up"], updatedAt: 5 },
                b521empty: { text: "  ", tags: [] },
                b521junk: "nope",
                b521tagsonly: { tags: ["shark"] }
            }
        });
        expect(parsePlayerNotesStore(raw)).toEqual({
            b521keep: { text: "ok", tags: ["fish"], updatedAt: 5 },
            b521tagsonly: { text: "", tags: ["shark"], updatedAt: 0 }
        });
    });
});

describe("upsertPlayerNote", () => {
    it("sets a note under the lower-cased address without mutating the input", () => {
        const before = {};
        const after = upsertPlayerNote(before, "B521X", note("tilts", ["tilter"]));
        expect(after).toEqual({ b521x: note("tilts", ["tilter"]) });
        expect(before).toEqual({});
    });

    it("removes the entry when the note is empty", () => {
        const after = upsertPlayerNote({ b521x: note("old", ["fish"]) }, "b521x", note("", []));
        expect(after).toEqual({});
    });
});

describe("summarizeSeatTags / describePlayerNote", () => {
    it("shows nothing for no note", () => {
        expect(summarizeSeatTags(null)).toEqual({ icons: [], hiddenCount: 0, hasText: false });
        expect(describePlayerNote(null)).toBe("");
    });

    it("shows up to the limit and counts the rest", () => {
        const summary = summarizeSeatTags(note("", ["fish", "loose", "aggressive", "bluffer", "tilter"]), 3);
        expect(summary.icons.map(t => t.id)).toEqual(["fish", "loose", "aggressive"]);
        expect(summary.hiddenCount).toBe(2);
        expect(summary.hasText).toBe(false);
    });

    it("flags note text with no tags", () => {
        expect(summarizeSeatTags(note("never folds the river"))).toEqual({ icons: [], hiddenCount: 0, hasText: true });
    });

    it("describes tags then a preview of the text", () => {
        expect(describePlayerNote(note("abcdef", ["tight", "aggressive"]), 3)).toBe("Tight, Aggressive\nabc…");
        expect(describePlayerNote(note("", ["fish"]))).toBe("Fish");
        expect(describePlayerNote(note("short"))).toBe("short");
    });
});

describe("placeNotesPanel", () => {
    const viewport = { width: 1280, height: 800 };
    const panel = { width: 360, height: 420 };

    it("opens to the right of the seat when it fits", () => {
        const p = placeNotesPanel({ left: 100, top: 300, width: 160, height: 140 }, viewport, panel);
        expect(p.left).toBe(272);
        expect(p.top).toBe(160);
        expect(p.origin).toBe("left 210px");
    });

    it("opens to the left when the right side is too narrow", () => {
        const p = placeNotesPanel({ left: 1000, top: 300, width: 160, height: 140 }, viewport, panel);
        expect(p.left).toBe(1000 - 12 - 360);
        expect(p.origin.startsWith("right")).toBe(true);
    });

    it("centres on a screen too narrow for either side", () => {
        const p = placeNotesPanel({ left: 100, top: 300, width: 160, height: 140 }, { width: 400, height: 812 }, panel);
        expect(p.left).toBe(20);
        expect(p.origin.startsWith("center")).toBe(true);
    });

    it("keeps the panel inside the viewport vertically", () => {
        expect(placeNotesPanel({ left: 100, top: 0, width: 160, height: 40 }, viewport, panel).top).toBe(8);
        expect(placeNotesPanel({ left: 100, top: 760, width: 160, height: 40 }, viewport, panel).top).toBe(800 - 420 - 8);
    });
});

describe("isPlayerNoteDraftChanged", () => {
    it("is unchanged for an empty draft with no note", () => {
        expect(isPlayerNoteDraftChanged(null, "  ", [])).toBe(false);
    });

    it("is unchanged when only whitespace or tag order differs", () => {
        expect(isPlayerNoteDraftChanged(note("nit", ["tight", "passive"]), " nit ", ["passive", "tight"])).toBe(false);
    });

    it("is changed when the text or tags differ", () => {
        expect(isPlayerNoteDraftChanged(note("nit", ["tight"]), "nit!", ["tight"])).toBe(true);
        expect(isPlayerNoteDraftChanged(note("nit", ["tight"]), "nit", [])).toBe(true);
        expect(isPlayerNoteDraftChanged(null, "", ["fish"])).toBe(true);
    });
});
