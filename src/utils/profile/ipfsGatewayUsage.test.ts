/**
 * A lint-style guard for ui#625.
 *
 * The gateway is configuration, not a constant to be sprinkled through the
 * source. The original bug existed in TWO copies of the same helper, so a
 * third copy appearing is the failure mode worth failing a build over: the
 * only place shipped code may name a gateway host is the default list in
 * `ipfs.ts`.
 *
 * Comments and tests are exempt — they have to be able to name ipfs.io to
 * explain the bug and to prove already-registered avatars still resolve.
 */
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative } from "path";

const SRC = join(__dirname, "..", "..");

/** The one module allowed to name a gateway in code. */
const GATEWAY_LIST_MODULE = join("utils", "profile", "ipfs.ts");

/** Gateway hosts that must not be hardcoded anywhere else. */
const GATEWAY_HOSTS = [/ipfs\.io/, /dweb\.link/, /w3s\.link/];

/**
 * Drop block and line comments before matching. The `[^:]` matters: a naive
 * `//` rule eats the slashes in `https://…` and silently exempts the very
 * string we are hunting for.
 */
const stripComments = (source: string): string =>
    source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");

const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            return entry === "node_modules" ? [] : sourceFiles(full);
        }
        return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [full] : [];
    });

describe("IPFS gateway usage", () => {
    it("names a gateway host only in the configured list", () => {
        const offenders = sourceFiles(SRC)
            .map(file => ({ rel: relative(SRC, file), code: stripComments(readFileSync(file, "utf8")) }))
            .filter(({ rel }) => rel !== GATEWAY_LIST_MODULE)
            .filter(({ code }) => GATEWAY_HOSTS.some(host => host.test(code)))
            .map(({ rel }) => rel);

        expect(offenders).toEqual([]);
    });

    it("actually catches a hardcoded gateway", () => {
        // Guard the guard: a rule that cannot fail is not a rule.
        expect(GATEWAY_HOSTS.some(host => host.test(stripComments('const url = "https://ipfs.io/ipfs/" + cid;')))).toBe(true);
        expect(GATEWAY_HOSTS.some(host => host.test(stripComments("// we used to use ipfs.io here")))).toBe(false);
    });
});
