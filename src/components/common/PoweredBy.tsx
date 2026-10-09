import React from "react";

/**
 * "Powered by Block52" mark for the end of a page. Sits in the flow (never fixed, so it
 * cannot cover content) and `mt-auto` pushes it to the bottom of a flex-column page
 * that is at least one screen tall.
 */
export const PoweredBy: React.FC = () => (
    <footer className="mt-auto pt-10 pb-6 flex flex-col items-center gap-1 opacity-40 pointer-events-none select-none">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-soft">Powered by</span>
        <img src="/block52.png" alt="Block52" className="h-5 w-auto object-contain invert dark:invert-0" />
    </footer>
);
