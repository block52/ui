/** Pure helpers for the Tech Notes page (release notes JSON from block52/cards). */

export interface ReleaseNote {
    id: string;
    /** Calendar date, `YYYY-MM-DD`. */
    date: string;
    title: string;
    version?: string;
    tags: string[];
    highlights?: string[];
    features?: string[];
    bugFixes?: string[];
    improvements?: string[];
    tests?: string[];
    /** Free-form text for older, unstructured notes. */
    body?: string;
}

export type ChangeKind = "feature" | "bugFix" | "improvement" | "test";

interface ReleaseChange {
    kind: ChangeKind;
    text: string;
}

interface ChangeRef {
    /** As written, e.g. `ui#719` or `#2614`. */
    label: string;
    /** Repo under the block52 org, when the reference names one. */
    repo?: string;
    number: number;
    /** GitHub link; absent when the repo is not named (a bare `#n` is ambiguous). */
    url?: string;
}

const GITHUB_ORG_URL = "https://github.com/block52";

const CHANGE_KINDS: ReadonlyArray<{ kind: ChangeKind; field: "features" | "bugFixes" | "improvements" | "tests" }> = [
    { kind: "feature", field: "features" },
    { kind: "bugFix", field: "bugFixes" },
    { kind: "improvement", field: "improvements" },
    { kind: "test", field: "tests" }
];

export const releaseChanges = (note: ReleaseNote): ReleaseChange[] =>
    CHANGE_KINDS.flatMap(({ kind, field }) => (note[field] ?? []).map(text => ({ kind, text })));

export const isStructuredRelease = (note: ReleaseNote): boolean =>
    [note.highlights, note.features, note.bugFixes, note.improvements, note.tests].some(list => list !== undefined);

export const countChangesByKind = (changes: ReadonlyArray<ReleaseChange>): Record<ChangeKind, number> => {
    const counts: Record<ChangeKind, number> = { feature: 0, bugFix: 0, improvement: 0, test: 0 };
    for (const change of changes) counts[change.kind] += 1;
    return counts;
};

const REF_PATTERN = /^(?:([a-z0-9][a-z0-9._-]*))?#(\d+)$/i;
const TRAILING_GROUP = /\(([^()]*)\)$/;

/**
 * Split a trailing parenthetical made up entirely of PR/issue references out of
 * a change line. Repo-qualified refs link to `github.com/block52/<repo>/issues/<n>`.
 */
export const parseChangeRefs = (line: string): { text: string; refs: ChangeRef[] } => {
    const trimmed = line.trimEnd();
    const match = TRAILING_GROUP.exec(trimmed);
    if (!match) return { text: line, refs: [] };

    const refs: ChangeRef[] = [];
    for (const part of match[1].split(",").map(item => item.trim())) {
        const ref = REF_PATTERN.exec(part);
        if (!ref) return { text: line, refs: [] };
        const repo = ref[1];
        const number = Number(ref[2]);
        refs.push(repo ? { label: part, repo, number, url: `${GITHUB_ORG_URL}/${repo}/issues/${number}` } : { label: part, number });
    }
    return { text: trimmed.slice(0, match.index).trimEnd(), refs };
};

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Not `new Date(iso)`: that reads the date as UTC midnight and shows the previous day west of Greenwich.
const parseReleaseDate = (iso: string): { year: number; month: number; day: number } => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) throw new Error(`Release date "${iso}" is not YYYY-MM-DD`);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (month < 1 || month > 12) throw new Error(`Release date "${iso}" has month ${month}, expected 1-12`);
    if (day < 1 || day > 31) throw new Error(`Release date "${iso}" has day ${day}, expected 1-31`);
    return { year: Number(match[1]), month, day };
};

export const formatReleaseDate = (iso: string): string => {
    const { year, month, day } = parseReleaseDate(iso);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
};

export const formatReleaseDateShort = (iso: string): string => {
    const { year, month, day } = parseReleaseDate(iso);
    return `${MONTHS[month - 1].slice(0, 3)} ${day}, ${year}`;
};

interface ReleaseMonthGroup {
    /** `October 2026` */
    label: string;
    items: Array<{ note: ReleaseNote; day: number }>;
}

export const groupReleasesByMonth = (notes: ReadonlyArray<ReleaseNote>): ReleaseMonthGroup[] => {
    const groups: ReleaseMonthGroup[] = [];
    for (const note of notes) {
        const { year, month, day } = parseReleaseDate(note.date);
        const label = `${MONTHS[month - 1]} ${year}`;
        let group = groups[groups.length - 1];
        if (!group || group.label !== label) {
            group = { label, items: [] };
            groups.push(group);
        }
        group.items.push({ note, day });
    }
    return groups;
};

const LIST_FIELDS = ["highlights", "features", "bugFixes", "improvements", "tests"] as const;

const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every(item => typeof item === "string");

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** Returns why a payload entry is not a usable release note, or null when it is one. */
const releaseNoteProblem = (entry: unknown): string | null => {
    if (!isRecord(entry)) return "not an object";
    if (typeof entry.id !== "string" || entry.id === "") return "id is not a non-empty string";
    if (typeof entry.title !== "string") return "title is not a string";
    if (typeof entry.date !== "string") return "date is not a string";
    try {
        parseReleaseDate(entry.date);
    } catch (err) {
        return err instanceof Error ? err.message : "date is invalid";
    }
    if (!isStringArray(entry.tags)) return "tags is not an array of strings";
    for (const field of LIST_FIELDS) {
        if (entry[field] !== undefined && !isStringArray(entry[field])) return `${field} is not an array of strings`;
    }
    if (entry.version !== undefined && typeof entry.version !== "string") return "version is not a string";
    if (entry.body !== undefined && typeof entry.body !== "string") return "body is not a string";
    return null;
};

const isReleaseNote = (entry: unknown): entry is ReleaseNote => releaseNoteProblem(entry) === null;

/** Keeps the well-formed release notes of a fetched payload and reports one message per skipped entry. */
export const parseReleaseNotes = (payload: unknown): { notes: ReleaseNote[]; skipped: string[] } => {
    if (!Array.isArray(payload)) throw new Error("Release notes payload is not an array");
    const notes: ReleaseNote[] = [];
    const skipped: string[] = [];
    payload.forEach((entry: unknown, index) => {
        if (isReleaseNote(entry)) notes.push(entry);
        else skipped.push(`entry ${index}: ${releaseNoteProblem(entry)}`);
    });
    return { notes, skipped };
};
