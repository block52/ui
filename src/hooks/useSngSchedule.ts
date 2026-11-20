import { useEffect, useState } from "react";
import { parseSngSchedule, type SngTournament } from "@block52/ui-sdk/helpers";

/**
 * URL of the recurring Sit & Go schedule JSON. Defaults to the raw GitHub copy
 * on `main` so the schedule can be edited in the repo and picked up live
 * without a redeploy. Override with `VITE_SNG_SCHEDULE_URL` (e.g. to point at a
 * feature branch, or the local `/sng-schedule.json` bundled in `public/`).
 */
const SCHEDULE_URL =
    import.meta.env.VITE_SNG_SCHEDULE_URL || "https://raw.githubusercontent.com/block52/ui/main/public/sng-schedule.json";

interface UseSngScheduleResult {
    tournaments: SngTournament[];
    isLoading: boolean;
    error: string | null;
}

/**
 * Fetch and validate the weekly recurring Sit & Go schedule.
 *
 * Fetching is gated by `enabled` so the request is skipped entirely when the
 * caller already knows it won't need the data (e.g. the welcome modal has
 * already been dismissed this browser).
 */
export const useSngSchedule = (enabled: boolean = true): UseSngScheduleResult => {
    const [tournaments, setTournaments] = useState<SngTournament[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(enabled);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(SCHEDULE_URL, { signal: controller.signal });
                if (!response.ok) {
                    throw new Error(`Failed to fetch SNG schedule: ${response.status}`);
                }
                const raw = await response.json();
                setTournaments(parseSngSchedule(raw));
            } catch (err) {
                if (err instanceof DOMException && err.name === "AbortError") return;
                console.error("Failed to load SNG schedule:", err);
                setError(err instanceof Error ? err.message : "Unknown error loading SNG schedule");
                setTournaments([]);
            } finally {
                setIsLoading(false);
            }
        };

        load();
        return () => controller.abort();
    }, [enabled]);

    return { tournaments, isLoading, error };
};
