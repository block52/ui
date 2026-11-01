import { ESCAPE_COMMENT, findGuardViolations, isCheckedFile, parseAddedLines } from "./rules";

/** A one-file `git diff --unified=0` adding `lines` at line `start`. */
const diffOf = (file: string, lines: string[], start = 10): string =>
    [
        `diff --git a/${file} b/${file}`,
        `--- a/${file}`,
        `+++ b/${file}`,
        `@@ -${start - 1},0 +${start},${lines.length} @@`,
        ...lines.map(l => `+${l}`)
    ].join("\n");

const usesFor = (line: string): string[] => findGuardViolations(diffOf("src/hooks/useThing.ts", [line])).map(v => v.use);

describe("isCheckedFile", () => {
    it("covers app source", () => {
        expect(isCheckedFile("src/hooks/useThing.ts")).toBe(true);
        expect(isCheckedFile("src/components/Seat.tsx")).toBe(true);
    });

    it("skips tests, mocks, declarations, the guards and anything outside src", () => {
        expect(isCheckedFile("src/utils/thing.test.ts")).toBe(false);
        expect(isCheckedFile("src/components/Seat.test.tsx")).toBe(false);
        expect(isCheckedFile("src/__mocks__/wagmi.ts")).toBe(false);
        expect(isCheckedFile("src/vite-env.d.ts")).toBe(false);
        expect(isCheckedFile("src/utils/guards.ts")).toBe(false);
        expect(isCheckedFile("scripts/check-guards.ts")).toBe(false);
        expect(isCheckedFile("packages/e2e/tests/a.ts")).toBe(false);
    });
});

describe("parseAddedLines", () => {
    it("numbers added lines from each hunk's new-file start", () => {
        const diff = [
            "diff --git a/src/a.ts b/src/a.ts",
            "--- a/src/a.ts",
            "+++ b/src/a.ts",
            "@@ -3 +3 @@",
            "-old",
            "+first",
            "@@ -20,0 +21,2 @@",
            "+second",
            "+third"
        ].join("\n");
        expect(parseAddedLines(diff)).toEqual([
            { file: "src/a.ts", line: 3, text: "first" },
            { file: "src/a.ts", line: 21, text: "second" },
            { file: "src/a.ts", line: 22, text: "third" }
        ]);
    });

    it("ignores deleted files and unchecked files", () => {
        const deleted = ["diff --git a/src/a.ts b/src/a.ts", "--- a/src/a.ts", "+++ /dev/null", "@@ -1 +0,0 @@", "-x !== null"].join("\n");
        expect(parseAddedLines(deleted)).toEqual([]);
        expect(parseAddedLines(diffOf("src/a.test.ts", ["x !== null"]))).toEqual([]);
    });
});

describe("findGuardViolations", () => {
    it.each([
        ["if (arr && arr.length > 0) {", "hasElements"],
        ["if (arr?.length !== 0) {", "hasElements"],
        ["const any = list.length >= 1;", "hasElements"],
        ["if (arr.length === 0) return;", "isEmpty"],
        ["if (!player.holeCards.length) return;", "isEmpty"],
        ["if (name.trim() === \"\") return;", "isBlank"],
        ["if (value !== null && value !== undefined) {", "hasValue"],
        ["return x != null;", "hasValue"],
        ["if (value === null || value === undefined) {", "isNullish"],
        ["if (x == null) return;", "isNullish"]
    ])("flags %s", (line, guard) => {
        const uses = usesFor(line);
        expect(uses).toHaveLength(1);
        expect(uses[0]).toContain(guard);
    });

    it.each([
        ["if (hasElements(arr)) {"],
        ["if (cards.length === 2) {"],
        ["if (stack.length > 10) {"],
        ["const n = arr.length;"],
        ["if (typeof window === \"undefined\") return false;"],
        ["const value: string | null = null;"],
        ["let x: number | undefined;"],
        ["// arr && arr.length > 0 is what the guard replaces"],
        ["     * value !== null && value !== undefined"],
        [`if (ref.current === null) return; ${ESCAPE_COMMENT}`]
    ])("leaves %s alone", line => {
        expect(usesFor(line)).toEqual([]);
    });

    it("reports file, line, the matched text and the guard to use", () => {
        const diff = diffOf("src/components/Seat.tsx", ["const a = 1;", "if (seat !== undefined) {"], 40);
        expect(findGuardViolations(diff)).toEqual([
            {
                file: "src/components/Seat.tsx",
                line: 41,
                text: "if (seat !== undefined) {",
                found: "!== undefined",
                use: "hasValue(x)"
            }
        ]);
    });

    it("reports each line once even when it breaks several rules", () => {
        expect(usesFor("if (a !== null && a.length > 0) {")).toHaveLength(1);
    });
});
