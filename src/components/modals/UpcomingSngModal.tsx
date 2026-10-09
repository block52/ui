import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../common";
import { ModalFooter } from "./ModalFooter";
import { PillButton, pillClass } from "../ui/PillButton";
import { hasElements } from "../../utils/guards";
import { STORAGE_KEYS } from "../../constants/storageKeys";
import { useSngSchedule } from "../../hooks/useSngSchedule";
import { getUpcomingSngs, formatCountdown, formatUtcLabel, formatLocalLabel } from "../../utils/sngSchedule";

/** How many upcoming tournaments the modal lists. */
const UPCOMING_COUNT = 2;

/**
 * UpcomingSngModal — a "welcome" modal shown once per browser when a visitor
 * first lands on the home page. It lists the next {@link UPCOMING_COUNT}
 * recurring Sit & Go tournaments (pulled from the remote JSON schedule),
 * showing each start time in UTC with a live countdown to the viewer's local
 * time, plus a link to register.
 *
 * The modal self-gates: it renders nothing until the schedule has loaded and
 * only while the viewer hasn't dismissed it before.
 */
const UpcomingSngModal: React.FC = () => {
    // Seed the dismissed flag lazily from localStorage so returning visitors
    // never see the modal (until they clear storage).
    const [dismissed, setDismissed] = useState<boolean>(() => localStorage.getItem(STORAGE_KEYS.seenUpcomingSngModal) === "true");

    // Skip the network request entirely if the viewer has already dismissed it.
    const { tournaments, isLoading, error } = useSngSchedule(!dismissed);

    // Live "now" tick so the countdowns update every second while open.
    const [now, setNow] = useState<Date>(() => new Date());

    // Resolve the next occurrences once the schedule arrives. Recomputed only
    // when the schedule changes — not every tick — so the list stays stable.
    const upcoming = useMemo(() => {
        if (!hasElements(tournaments)) return [];
        return getUpcomingSngs(tournaments, new Date(), UPCOMING_COUNT);
    }, [tournaments]);

    const isOpen = !dismissed && !isLoading && !error && hasElements(upcoming);

    useEffect(() => {
        if (!isOpen) return;
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, [isOpen]);

    const handleClose = () => {
        localStorage.setItem(STORAGE_KEYS.seenUpcomingSngModal, "true");
        setDismissed(true);
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title="Upcoming Sit & Go Tournaments"
            subtitle="Times in UTC, with a live countdown to your local time."
            titleIcon={<TrophyIcon />}
            widthClass="w-[460px]"
        >
            <ul className="m-0 p-0 list-none flex flex-col gap-3">
                {upcoming.map((sng, index) => {
                    const msRemaining = sng.nextStart.getTime() - now.getTime();
                    return (
                        <li key={sng.id} className="bg-surface-raised border border-line rounded-2xl p-4 flex flex-col gap-3">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="m-0 text-ink text-base font-semibold break-words">{sng.name}</p>
                                    <p className="m-0 mt-1 text-ink-muted text-xs tabular-nums">{formatUtcLabel(sng.nextStart)}</p>
                                    <p className="m-0 text-ink-muted text-xs tabular-nums">Your time: {formatLocalLabel(sng.nextStart)}</p>
                                </div>
                                <span className="shrink-0 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-semibold tabular-nums">
                                    {sng.buyIn}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div className="px-3 py-2 rounded-xl bg-surface-card border border-line">
                                    <p className="m-0 text-ink-muted text-[10px] uppercase tracking-[0.08em]">Starts in</p>
                                    <p className="m-0 text-brand-light text-sm font-mono font-medium tabular-nums">
                                        {formatCountdown(msRemaining)}
                                    </p>
                                </div>
                                <a
                                    href={sng.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={pillClass(index === 0 ? "primary" : "outline", "md", "shrink-0")}
                                >
                                    Register
                                </a>
                            </div>
                        </li>
                    );
                })}
            </ul>

            <ModalFooter>
                <PillButton variant="ghost" onClick={handleClose} className="w-full">
                    Close
                </PillButton>
            </ModalFooter>
        </Modal>
    );
};

const TrophyIcon: React.FC = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3" />
    </svg>
);

export default UpcomingSngModal;
