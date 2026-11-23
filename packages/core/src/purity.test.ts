import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

/**
 * The core is shared with block52/desktop, so it must stay headless: no React,
 * no router/wallet libraries, no reaching back into the web app, and no browser
 * storage or `import.meta`. Inject those from the app instead (see
 * GameMessageBus `getLocalAddress` / `getReducedMotion`). Shared guards and
 * helpers come from `@block52/ui-sdk/helpers`, which has no React or motion
 * peer; the package root is the component library and stays out.
 */
const FORBIDDEN_IMPORT = /from\s+["'](react|react-dom|react-router-dom|wagmi|viem|@reown\/[^"']*|@metamask\/[^"']*|framer-motion|motion|react-icons[^"']*)["']/;
const UI_SDK_OUTSIDE_HELPERS = /from\s+["']@block52\/ui-sdk(?!\/helpers["'])[^"']*["']/;
const REACHES_OUT = /from\s+["'](\.\.\/)+(components|context|hooks\/(?!player\/closingBetClock)|pages)\b/;
const BROWSER_STATE = /\b(localStorage|sessionStorage|import\.meta)\b/;

function sources(dir: string): string[] {
    return readdirSync(dir).flatMap(name => {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) return sources(p);
        return p.endsWith(".ts") && !p.endsWith(".test.ts") ? [p] : [];
    });
}

describe("poker-ui-core stays headless", () => {
    const files = sources(__dirname);

    it("finds the core sources", () => {
        expect(files.length).toBeGreaterThan(50);
    });

    it.each(files.map(f => [f.slice(__dirname.length + 1), f]))("%s has no UI, app or browser-state dependency", (_name, file) => {
        const code = readFileSync(file, "utf8")
            .split("\n")
            .filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line))
            .join("\n");
        expect(code).not.toMatch(FORBIDDEN_IMPORT);
        expect(code).not.toMatch(UI_SDK_OUTSIDE_HELPERS);
        expect(code).not.toMatch(REACHES_OUT);
        expect(code).not.toMatch(BROWSER_STATE);
    });
});
