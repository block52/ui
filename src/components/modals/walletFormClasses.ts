/**
 * Shared Tailwind class strings for the wallet money modals (Deposit,
 * Withdraw, Send) so their fields, notices and option cards look identical.
 */

/** Uppercase muted field label. */
export const fieldLabelClass = "block mb-2 text-xs font-medium uppercase tracking-[0.08em] text-ink-muted";

/** Text input on surface-raised with a brand focus ring. */
export const fieldInputClass =
    "w-full h-12 px-4 rounded-xl bg-surface-raised border border-line text-ink placeholder:text-ink-muted/70 focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/40 transition-colors";

/** Large tabular-nums amount input. Leave room on the right for a MAX pill with `pr-20`. */
export const amountInputClass = `${fieldInputClass} h-14 text-2xl font-semibold tabular-nums`;

/** Small outline pill placed inside an amount input (MAX, presets). */
export const inlinePillClass =
    "h-10 sm:h-8 px-3 rounded-full border border-line-strong text-xs font-semibold text-ink-soft hover:text-ink hover:bg-surface-hover transition-colors";

/** Read-only value row / box on surface-raised. */
export const insetBoxClass = "px-4 py-3 rounded-xl bg-surface-raised border border-line";

/** Selectable option card (deposit method, token). */
export const optionCardClass = (selected: boolean): string =>
    `p-3 rounded-xl border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-light ${
        selected ? "border-brand bg-brand/10" : "border-line bg-surface-raised hover:border-line-strong"
    }`;

/** Tinted notice boxes. */
export const noticeClass = {
    info: "p-3 rounded-xl border border-brand/25 bg-brand/10 text-ink-soft text-xs leading-relaxed",
    warning: "p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs leading-relaxed",
    success: "p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-sm",
    error: "p-3 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm"
} as const;
