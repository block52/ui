/*
 * ESLint is parked — see https://github.com/block52/ui/issues/601
 *
 * TypeScript 7.0 removed the public programmatic Compiler API that
 * typescript-eslint is built on. The `typescript` package root export is now a
 * version stub (`version`, `versionMajorMinor`); the compiler API moved behind
 * `typescript/unstable/*` subpaths for the Go port. So @typescript-eslint/
 * typescript-estree throws at MODULE LOAD reading `ts.Extension.Cjs`, before
 * ESLint sees a single file:
 *
 *   TypeError: Cannot read properties of undefined (reading 'Cjs')
 *       at node_modules/@typescript-eslint/typescript-estree/dist/create-program/shared.js:59
 *
 * No published typescript-eslint supports TS 7 — 8.70.0 declares
 * `typescript: ">=4.8.4 <6.1.0"` — and upstream #12518 is closed as not
 * planned. The stable API is expected in TypeScript 7.1.
 *
 * This shim exists so `yarn lint` explains itself instead of crashing with a
 * stack trace that looks like a broken checkout.
 *
 * TO RESTORE, once typescript-eslint supports TS 7 (or if we pin TS back to
 * 6.x), put these back in package.json and delete this file:
 *
 *   "dev:lint":  "eslint . --fix && vite --host 0.0.0.0 --port 5173",
 *   "lint":      "eslint .",
 *   "lint:fix":  "eslint . --fix",
 *   "lint:warn": "eslint . --fix --max-warnings=100",
 */
console.error(`
  Linting is unavailable on this branch.

  ESLint cannot run against TypeScript 7: TS 7 removed the programmatic
  Compiler API that typescript-eslint depends on, and no published version
  of typescript-eslint supports it.

  Details, options and status: https://github.com/block52/ui/issues/601

  Unaffected, if that is what you were checking:
    yarn test     tests run on babel-jest, not the TS compiler API
    yarn build    tsc -b uses the native CLI and works fine
`);

// Exit non-zero: nothing was linted, and callers should not read this as a pass.
process.exit(1);
