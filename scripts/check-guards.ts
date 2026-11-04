/**
 * yarn check:guards — fails when the lines this branch adds use a hand-written
 * null/empty/length check instead of a guard (CLAUDE.md, UI Architecture
 * Commandment 8). Only added lines are checked, so existing code doesn't fail.
 *
 * Compares the working tree (committed and uncommitted changes) with its merge
 * base against GUARDS_BASE, default origin/main. Runs under plain Node 24.
 */
import { execFileSync } from "node:child_process";
import { ESCAPE_COMMENT, findGuardViolations } from "./guards/rules.ts";

const base = process.env.GUARDS_BASE ?? "origin/main";
const git = (...args: string[]): string => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const mergeBase = git("merge-base", base, "HEAD").trim();
const diff = git("diff", "--unified=0", "--no-color", "--no-ext-diff", mergeBase, "--", "src/*.ts", "src/*.tsx");
const violations = findGuardViolations(diff);

if (violations.length === 0) {
    console.log(`check:guards: no hand-written null/empty checks added since ${base}.`);
    process.exit(0);
}

for (const v of violations) {
    console.log(`${v.file}:${v.line}  ${v.found}  → use ${v.use}`);
    if (process.env.GITHUB_ACTIONS) {
        console.log(`::error file=${v.file},line=${v.line}::Use ${v.use} from src/utils/guards.ts (CLAUDE.md Commandment 8)`);
    }
}
console.log(
    `\n${violations.length} hand-written check(s). Use the guards in src/utils/guards.ts (CLAUDE.md, UI Architecture Commandment 8).` +
        `\nIf the raw check is genuinely needed, end the line with \`${ESCAPE_COMMENT}\`.`
);
process.exit(1);
