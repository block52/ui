import js from "@eslint/js"
import globals from "globals"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import tseslint from "typescript-eslint"

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "quotes": ["error", "double"],
      "semi": ["error", "always"],
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_" }],
      "@typescript-eslint/no-unused-expressions": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/exhaustive-deps": "warn",
      "no-console": ["warn", { "allow": ["error"] }],
      // React Compiler diagnostics (eslint-plugin-react-hooks v7) ship as `error`
      // in its recommended set, but this codebase predates them — they are
      // advisory/perf signals, not correctness bugs. Keep them as warnings so
      // they surface without failing the build; promote back to error once the
      // flagged patterns are refactored. See docs/plans/2026_07_11_action_feedback_ux.md.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/set-state-in-render": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/component-hook-factories": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/globals": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/config": "warn",
      "react-hooks/gating": "warn",
      // ESLint 10 built-in; the app's tsconfig targets ES2020 (no ErrorOptions
      // `cause`), so the idiomatic fix doesn't compile — keep as a warning until
      // the lib target is bumped.
      "preserve-caught-error": "warn",
    },
  },
)
