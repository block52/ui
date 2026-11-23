# @block52/poker-ui-core

Headless poker UI logic shared by `block52/ui` and `block52/desktop`: pure TypeScript, **no React, no CSS, no DOM**.

- Import by path: `import { ... } from "@block52/poker-ui-core/utils/formatUtils"` (`types` is the one directory import: `@block52/poker-ui-core/types`).
- Source layout mirrors the old `ui/src` paths (`utils/`, `constants/`, `types/`, `config/`, `bus/timing`, `hooks/player/closingBetClock`).
- Inside this repo the alias resolves to `packages/core/src` (tsconfig `paths`, Vite alias, Jest `moduleNameMapper`), so nothing needs a build. `yarn build` emits `dist/` (ESM + `.d.ts`) for publishing; consumers must use a bundler (extensionless relative imports).
- Tests live next to the code and run with the root Jest (`yarn test`).
- Peer dependencies: `@block52/poker-vm-sdk`, and `@block52/ui-sdk` for the shared guards and helpers. Core imports only its `@block52/ui-sdk/helpers` subpath, which has no React or motion peer; the package root (the component library) is off limits.

## Adding a module
It belongs here if it is pure (no `window`/`document`/`localStorage`/`import.meta`/React) and everything it imports is also here, `@block52/ui-sdk/helpers` or an npm package. Move it with `git mv` into `packages/core/src/<same path>` and rewrite importers to the package path.

Tracking issue: block52/ui#1001. The bus (`bus/`) is here; it takes the local address and reduced-motion preference by injection (`getLocalAddress`, `getReducedMotion`). `purity.test.ts` fails the build if React, app imports or browser storage creep in. Next: publishing and the desktop adoption.
