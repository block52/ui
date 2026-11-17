import React, { useEffect, useMemo, useState } from "react";
import { Modal } from "../common";
import { hasElements } from "@block52/poker-ui-core/utils/guards";
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
            titleIcon="🏆"
            widthClass="w-[460px]"
            patternId="hexagons-upcoming-sng"
            scrollable={false}
        >
            <p className="text-gray-400 text-xs mb-4">
                Grab your seat at the next scheduled Sit &amp; Go. Times are shown in UTC with a live countdown to your local
                time.
            </p>

            <div className="space-y-3">
                {upcoming.map(sng => {
                    const msRemaining = sng.nextStart.getTime() - now.getTime();
                    return (
                        <div
                            key={sng.id}
                            className="bg-gray-900/50 rounded-lg p-4 border border-gray-700 flex flex-col gap-3"
                        >
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-white text-base font-semibold">{sng.name}</p>
                                    <p className="text-gray-400 text-xs mt-0.5">{formatUtcLabel(sng.nextStart)}</p>
                                    <p className="text-gray-500 text-[11px]">Your time: {formatLocalLabel(sng.nextStart)}</p>
                                </div>
                                <span className="shrink-0 bg-green-900/40 text-green-300 text-sm font-bold px-3 py-1 rounded-lg border border-green-700/50">
                                    {sng.buyIn}
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-gray-500 text-[10px] uppercase tracking-wide">Starts in</p>
                                    <p className="text-blue-300 text-sm font-mono font-medium tabular-nums">
                                        {formatCountdown(msRemaining)}
                                    </p>
                                </div>
                                <a
                                    href={sng.link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                                >
                                    Register
                                </a>
                            </div>
                        </div>
                    );
                })}
            </div>

            <button
                onClick={handleClose}
                className="w-full mt-5 px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors"
            >
                Close
            </button>
        </Modal>
    );
};

export default UpcomingSngModal;
