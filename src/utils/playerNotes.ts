/**
 * Player notes and tags (ui#947): private notes a viewer keeps on other
 * players, plus preset tags (fish, shark, tight, loose…) whose icons sit next to
 * that player's seat pill.
 *
 * Notes are private to the viewer, so they live in this browser's localStorage,
 * one record per viewer wallet, keyed by the noted player's address. They follow
 * the player across tables because the key is the address, not the seat.
 */
import { hasContent, hasElements, isRecord } from "./guards";

export type PlayerNoteTagId =
    | "fish"
    | "whale"
    | "shark"
    | "tight"
    | "loose"
    | "aggressive"
    | "passive"
    | "station"
    | "weak"
    | "maniac"
    | "bluffer"
    | "tilter";

export type PlayerNoteTag = {
    id: PlayerNoteTagId;
    icon: string;
    label: string;
    description: string;
};

/** The preset tags, in the order the picker shows them. */
export const PLAYER_NOTE_TAGS: readonly PlayerNoteTag[] = [
    { id: "fish", icon: "🐟", label: "Fish", description: "Recreational player, makes big mistakes" },
    { id: "whale", icon: "🐋", label: "Whale", description: "Recreational player with deep pockets, plays big" },
    { id: "shark", icon: "🦈", label: "Shark", description: "Strong winning player, be careful" },
    { id: "tight", icon: "🪨", label: "Tight", description: "Rock / nit, plays only premium hands" },
    { id: "loose", icon: "🎲", label: "Loose", description: "Plays lots of hands" },
    { id: "aggressive", icon: "🔥", label: "Aggressive", description: "Bets and raises a lot" },
    { id: "passive", icon: "🐢", label: "Passive", description: "Checks and calls, rarely raises" },
    { id: "station", icon: "📞", label: "Calling station", description: "Calls down light, won't fold" },
    { id: "weak", icon: "🐣", label: "Weak", description: "Folds to pressure" },
    { id: "maniac", icon: "💣", label: "Maniac", description: "Raises and re-raises almost anything" },
    { id: "bluffer", icon: "🎭", label: "Bluffer", description: "Bluffs often" },
    { id: "tilter", icon: "😡", label: "Tilts", description: "Goes on tilt after losing a pot" }
];

const TAG_BY_ID: ReadonlyMap<string, PlayerNoteTag> = new Map(PLAYER_NOTE_TAGS.map(tag => [tag.id, tag]));

/** Longest note text kept, so one runaway paste can't fill localStorage. */
export const MAX_PLAYER_NOTE_LENGTH = 2000;

/** How many tag icons the seat shows before collapsing the rest into "+N". */
export const MAX_SEAT_TAG_ICONS = 3;

export type PlayerNote = {
    text: string;
    tags: PlayerNoteTagId[];
    updatedAt: number;
};

type PlayerNotesStoreV1 = {
    version: 1;
    notes: Record<string, PlayerNote>;
};

export const PLAYER_NOTES_STORAGE_PREFIX = "player_notes:v1";

/** Owner key used when no wallet is connected (a spectator). */
export const GUEST_NOTES_OWNER = "guest";

export const normalizeNoteAddress = (address: string): string => address.trim().toLowerCase();

export const playerNotesStorageKey = (owner: string): string => `${PLAYER_NOTES_STORAGE_PREFIX}:${normalizeNoteAddress(owner)}`;

export const isPlayerNoteTagId = (value: unknown): value is PlayerNoteTagId => typeof value === "string" && TAG_BY_ID.has(value);

export const getPlayerNoteTag = (id: PlayerNoteTagId): PlayerNoteTag => {
    const tag = TAG_BY_ID.get(id);
    if (!tag) throw new Error(`Unknown player note tag: ${id}`);
    return tag;
};

/** Tags in picker order, deduplicated, unknown ids dropped. */
export const sortPlayerNoteTags = (tags: readonly string[]): PlayerNoteTagId[] =>
    PLAYER_NOTE_TAGS.filter(tag => tags.includes(tag.id)).map(tag => tag.id);

/** Adds the tag if it is missing, removes it if present. Keeps picker order. */
export const togglePlayerNoteTag = (tags: readonly PlayerNoteTagId[], id: PlayerNoteTagId): PlayerNoteTagId[] =>
    tags.includes(id) ? tags.filter(t => t !== id) : sortPlayerNoteTags([...tags, id]);

/** A note with no text and no tags is the same as no note. */
export const isPlayerNoteEmpty = (note: Pick<PlayerNote, "text" | "tags"> | null | undefined): boolean =>
    !note || (!hasContent(note.text.trim()) && !hasElements(note.tags));

/** Trims and caps the text and cleans the tags, ready to save. */
export const buildPlayerNote = (text: string, tags: readonly string[], now: number): PlayerNote => ({
    text: text.trim().slice(0, MAX_PLAYER_NOTE_LENGTH),
    tags: sortPlayerNoteTags(tags),
    updatedAt: now
});

const parsePlayerNote = (value: unknown): PlayerNote | null => {
    if (!isRecord(value)) return null;
    const text = typeof value.text === "string" ? value.text : "";
    const tags = Array.isArray(value.tags) ? value.tags.filter(isPlayerNoteTagId) : [];
    const updatedAt = typeof value.updatedAt === "number" ? value.updatedAt : 0;
    const note = buildPlayerNote(text, tags, updatedAt);
    return isPlayerNoteEmpty(note) ? null : note;
};

/** Parses a stored record. Anything malformed comes back as an empty book. */
export const parsePlayerNotesStore = (raw: string | null): Record<string, PlayerNote> => {
    if (!hasContent(raw)) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.notes)) return {};
        const notes: Record<string, PlayerNote> = {};
        for (const [address, value] of Object.entries(parsed.notes)) {
            const note = parsePlayerNote(value);
            if (note) notes[normalizeNoteAddress(address)] = note;
        }
        return notes;
    } catch {
        return {};
    }
};

export const serializePlayerNotesStore = (notes: Record<string, PlayerNote>): string => {
    const store: PlayerNotesStoreV1 = { version: 1, notes };
    return JSON.stringify(store);
};

/**
 * Returns a new book with the note for `address` set, or removed when the
 * note is empty (so clearing every tag and the text deletes the entry).
 */
export const upsertPlayerNote = (
    notes: Record<string, PlayerNote>,
    address: string,
    note: PlayerNote
): Record<string, PlayerNote> => {
    const key = normalizeNoteAddress(address);
    const next = { ...notes };
    if (isPlayerNoteEmpty(note)) {
        delete next[key];
    } else {
        next[key] = note;
    }
    return next;
};

export type SeatTagSummary = {
    icons: PlayerNoteTag[];
    hiddenCount: number;
    hasText: boolean;
};

/** What the seat shows: the first few tag icons, a "+N" count, and whether there is note text. */
export const summarizeSeatTags = (note: PlayerNote | null | undefined, maxIcons: number = MAX_SEAT_TAG_ICONS): SeatTagSummary => {
    if (isPlayerNoteEmpty(note) || !note) return { icons: [], hiddenCount: 0, hasText: false };
    const tags = note.tags.map(getPlayerNoteTag);
    return {
        icons: tags.slice(0, maxIcons),
        hiddenCount: Math.max(0, tags.length - maxIcons),
        hasText: hasContent(note.text)
    };
};

/** Hover text for the seat icons: tag labels, then the start of the note. */
export const describePlayerNote = (note: PlayerNote | null | undefined, previewLength: number = 140): string => {
    if (isPlayerNoteEmpty(note) || !note) return "";
    const labels = note.tags.map(id => getPlayerNoteTag(id).label).join(", ");
    const text = note.text.length > previewLength ? `${note.text.slice(0, previewLength)}…` : note.text;
    return [labels, text].filter(part => hasContent(part)).join("\n");
};

export type NotesPanelPlacement = {
    left: number;
    top: number;
    /** CSS transform-origin, so the panel grows out of the seat. */
    origin: string;
};

type Rect = { left: number; top: number; width: number; height: number };

/**
 * Where the notes panel opens: beside the seat (right if it fits, else left),
 * vertically centred on it, kept inside the viewport with a margin. On a
 * screen too narrow for either side it centres horizontally.
 */
export const placeNotesPanel = (
    seat: Rect,
    viewport: { width: number; height: number },
    panel: { width: number; height: number },
    gap: number = 12,
    margin: number = 8
): NotesPanelPlacement => {
    const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), Math.max(min, max));
    const seatRight = seat.left + seat.width;
    const seatMidY = seat.top + seat.height / 2;
    const fitsRight = seatRight + gap + panel.width + margin <= viewport.width;
    const fitsLeft = seat.left - gap - panel.width - margin >= 0;

    let left: number;
    let originX: string;
    if (fitsRight) {
        left = seatRight + gap;
        originX = "left";
    } else if (fitsLeft) {
        left = seat.left - gap - panel.width;
        originX = "right";
    } else {
        left = clamp((viewport.width - panel.width) / 2, margin, viewport.width - panel.width - margin);
        originX = "center";
    }

    const top = clamp(seatMidY - panel.height / 2, margin, viewport.height - panel.height - margin);
    const originY = clamp(seatMidY - top, 0, panel.height);
    return { left, top, origin: `${originX} ${Math.round(originY)}px` };
};

/** True when the draft in the panel differs from the saved note (so a stray click outside won't lose it). */
export const isPlayerNoteDraftChanged = (saved: PlayerNote | null | undefined, text: string, tags: readonly string[]): boolean => {
    const draft = buildPlayerNote(text, tags, 0);
    const savedText = saved ? saved.text : "";
    const savedTags = saved ? saved.tags : [];
    return draft.text !== savedText || draft.tags.join(",") !== savedTags.join(",");
};
