/**
 * Pure helpers for the Tech Notes page (release notes JSON from block52/cards).
 *
 * The page renders one release expanded, an archive grouped by month, and a
 * per-kind change list whose trailing PR references (`(ui#719)`,
 * `(poker-vm#2636)`) are split out of the text and linked to GitHub.
 */

/** One release as published in release-notes.json. */
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

export interface ReleaseChange {
    kind: ChangeKind;
    text: string;
}

export interface ChangeRef {
    /** As written, e.g. `ui#719` or `#2614`. */
    label: string;
    /** Repo under the block52 org, when the reference names one. */
    repo?: string;
    number: number;
    /** GitHub link; absent when the repo is not named (a bare `#n` is ambiguous). */
    url?: string;
}

export const GITHUB_ORG_URL = "https://github.com/block52";

/** Change kinds in display order, with their JSON field. */
export const CHANGE_KINDS: ReadonlyArray<{ kind: ChangeKind; field: "features" | "bugFixes" | "improvements" | "tests" }> = [
    { kind: "feature", field: "features" },
    { kind: "bugFix", field: "bugFixes" },
    { kind: "improvement", field: "improvements" },
    { kind: "test", field: "tests" }
];

/** Flatten a release's structured lists into one ordered change list. */
export function releaseChanges(note: ReleaseNote): ReleaseChange[] {
    return CHANGE_KINDS.flatMap(({ kind, field }) => (note[field] ?? []).map(text => ({ kind, text })));
}

/** True when the release uses the structured lists rather than a free-form body. */
export function isStructuredRelease(note: ReleaseNote): boolean {
    return [note.highlights, note.features, note.bugFixes, note.improvements, note.tests].some(list => list !== undefined);
}

/** Count changes per kind. Every kind is present in the result (0 when absent). */
export function countChangesByKind(changes: ReadonlyArray<ReleaseChange>): Record<ChangeKind, number> {
    const counts: Record<ChangeKind, number> = { feature: 0, bugFix: 0, improvement: 0, test: 0 };
    for (const change of changes) counts[change.kind] += 1;
    return counts;
}

const REF_PATTERN = /^(?:([a-z0-9][a-z0-9._-]*))?#(\d+)$/i;
const TRAILING_GROUP = /\s*\(([^()]*)\)\s*$/;

/**
 * Split trailing PR/issue references out of a change line.
 *
 * Only a final parenthetical made up entirely of references is taken
 * (`"... (ui#719)"`, `"... (#676, #668)"`); any other parenthetical stays in
 * the text. Repo-qualified refs link to `github.com/block52/<repo>/issues/<n>`
 * (GitHub redirects that to the PR when it is one).
 */
export function parseChangeRefs(line: string): { text: string; refs: ChangeRef[] } {
    const match = TRAILING_GROUP.exec(line);
    if (!match) return { text: line, refs: [] };

    const parts = match[1].split(",").map(part => part.trim());
    const refs: ChangeRef[] = [];
    for (const part of parts) {
        const ref = REF_PATTERN.exec(part);
        if (!ref) return { text: line, refs: [] };
        const repo = ref[1];
        const number = Number(ref[2]);
        refs.push(repo ? { label: part, repo, number, url: `${GITHUB_ORG_URL}/${repo}/issues/${number}` } : { label: part, number });
    }
    return { text: line.slice(0, match.index).trimEnd(), refs };
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * Parse a release `YYYY-MM-DD` date as a calendar day.
 * (Not via `new Date(iso)`, which reads it as UTC midnight and shows the
 * previous day west of Greenwich.)
 */
export function parseReleaseDate(iso: string): { year: number; month: number; day: number } {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
    if (!match) throw new Error(`Release date "${iso}" is not YYYY-MM-DD`);
    return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

/** `October 7, 2026` */
export function formatReleaseDate(iso: string): string {
    const { year, month, day } = parseReleaseDate(iso);
    return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** `Oct 7, 2026` */
export function formatReleaseDateShort(iso: string): string {
    const { year, month, day } = parseReleaseDate(iso);
    return `${MONTHS[month - 1].slice(0, 3)} ${day}, ${year}`;
}

export interface ReleaseMonthGroup {
    /** `October 2026` */
    label: string;
    items: Array<{ note: ReleaseNote; day: number }>;
}

/** Group releases by calendar month, keeping the input order. */
export function groupReleasesByMonth(notes: ReadonlyArray<ReleaseNote>): ReleaseMonthGroup[] {
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
}
