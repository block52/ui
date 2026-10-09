# Theming

Two themes, dark (default) and light. The game table (`/table/*`, except `/table/admin`) is always dark: felt, chips and suits are not themed.

## How it works

- `src/styles/theme.css` declares colour tokens as space-separated RGB channels on `:root` (dark) and overrides them on `:root[data-theme="light"]`.
- `tailwind.config.js` maps them to utilities, so opacity works (`bg-surface-card/60`).
- `ThemeProvider` / `useTheme` (`context/ThemeContext.tsx`) set `data-theme` on `<html>` and persist the choice in `localStorage` under `b52-theme`. `index.html` applies it before first paint. Logic lives in `utils/theme.ts`.
- `ThemeToggle` (`components/ui`) switches themes and hides itself on dark-only routes.
- The accent follows `VITE_BRAND_COLOR_PRIMARY` through `utils/colorConfig.generateCSSVariables()`, which also injects light overrides for the legacy `--ui-*` / `--brand-secondary` variables.

## Tokens

| Token (Tailwind) | Dark | Light | Use |
|------------------|------|-------|-----|
| `surface-page` | 18 19 28 | 246 246 250 | Page background |
| `surface-card` | 22 23 34 | 255 255 255 | Cards, modals |
| `surface-raised` | 28 30 43 | 241 242 247 | Inputs, inset rows |
| `surface-hover` | 35 38 54 | 233 234 242 | Hover fill |
| `line` / `line-strong` | 38 41 56 / 44 47 69 | 227 228 238 / 208 210 224 | Borders, dividers |
| `ink` | 245 245 247 | 20 21 31 | Titles, primary text |
| `ink-body` | 228 228 234 | 38 40 56 | Body text |
| `ink-soft` | 180 182 200 | 74 77 99 | Secondary text |
| `ink-muted` | 142 144 166 | 107 111 134 | Captions, placeholders |
| `overlay` | 0 0 0 | 20 21 31 | Modal backdrop (`bg-overlay/70`) |
| `brand` / `brand-light` | brand colour / 35% toward white | brand colour / 30% toward black | Accent, focus ring |

## Rules

- Use tokens (`bg-surface-card`, `text-ink-muted`, `border-line`) or `rgb(var(--surface-card))` in CSS modules. No raw hex for surfaces, borders or text.
- White text is only for text on `bg-brand` or on imagery.
- `text-emerald-400`, `text-red-400`, `text-amber-300` and similar status colours are remapped to darker shades in light mode by `theme.css`; use those shades rather than inventing new ones.
- Use `dark:` / `light` variants only when a token cannot express it (`dark:` matches `[data-theme="dark"]`).
- Interactive elements share `focusRing` from `components/ui`.
- Adding a token: declare it in both blocks of `theme.css`, then add it to `tailwind.config.js`.
