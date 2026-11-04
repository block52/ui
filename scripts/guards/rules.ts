/**
 * Hand-written null/empty/length checks that UI Architecture Commandment 8
 * (CLAUDE.md) says go through `src/utils/guards.ts` instead.
 *
 * Pure and dependency-free so `check-guards.ts` can run under plain Node (no
 * `yarn install`) and Jest can test it.
 */

export interface GuardRule {
    pattern: RegExp;
    use: string;
}

export interface AddedLine {
    file: string;
    line: number;
    text: string;
}

export interface GuardViolation extends AddedLine {
    found: string;
    use: string;
}

/** Ends a line that genuinely needs the raw check. */
export const ESCAPE_COMMENT = "// guards-ok";

export const GUARD_RULES: readonly GuardRule[] = [
    { pattern: /\.length\s*(>|!==?)\s*0\b|\.length\s*>=\s*1\b/, use: "hasElements(x) for arrays, hasContent(x) for strings" },
    { pattern: /\.length\s*(===?\s*0|<\s*1)\b|!\s*[\w$.?\]\[]+\.length\b(?!\s*[<>=!])/, use: "isEmpty(x) for arrays, isBlank(x) for strings" },
    { pattern: /\.trim\(\)\s*(===?|!==?)\s*(""|''|``)/, use: "isBlank(x) / hasContent(x)" },
    { pattern: /!==?\s*(null|undefined)\b|\b(null|undefined)\s*!==?/, use: "hasValue(x)" },
    { pattern: /[^=!]===?\s*(null|undefined)\b|\b(null|undefined)\s*===?[^=]/, use: "isNullish(x)" }
];

/** Source files the rule covers: app code, not tests, mocks or the guards themselves. */
export function isCheckedFile(file: string): boolean {
    return (
        /^src\/.*\.tsx?$/.test(file) &&
        !/\.test\.tsx?$/.test(file) &&
        !file.endsWith(".d.ts") &&
        !file.startsWith("src/__mocks__/") &&
        file !== "src/utils/guards.ts"
    );
}

/**
 * The added lines of a `git diff --unified=0` in the files the rule covers,
 * with their new-file line numbers.
 */
export function parseAddedLines(diff: string): AddedLine[] {
    const added: AddedLine[] = [];
    let file: string | null = null;
    let line = 0;
    for (const raw of diff.split("\n")) {
        if (raw.startsWith("+++ ")) {
            file = raw.startsWith("+++ b/") ? raw.slice("+++ b/".length) : null;
            continue;
        }
        const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
        if (hunk) {
            line = Number(hunk[1]);
            continue;
        }
        if (raw.startsWith("+") && file !== null) {
            if (isCheckedFile(file)) {
                added.push({ file, line, text: raw.slice(1) });
            }
            line++;
        }
    }
    return added;
}

/** A comment line, which may quote the patterns while explaining them. */
function isCommentLine(text: string): boolean {
    return /^\s*(\/\/|\/\*|\*)/.test(text);
}

/** The first rule each added line breaks, skipping comments and escaped lines. */
export function findGuardViolations(diff: string): GuardViolation[] {
    const violations: GuardViolation[] = [];
    for (const added of parseAddedLines(diff)) {
        if (isCommentLine(added.text) || added.text.trimEnd().endsWith(ESCAPE_COMMENT)) continue;
        for (const rule of GUARD_RULES) {
            const match = rule.pattern.exec(added.text);
            if (match) {
                violations.push({ ...added, found: match[0].trim(), use: rule.use });
                break;
            }
        }
    }
    return violations;
}
