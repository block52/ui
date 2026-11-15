import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ResultDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { AUTO_DEAL_DEFER_POLL_MS, MAX_AUTO_DEAL_DEFER_MS, RECORD_FINISH_SETTLE_MS } from "../../bus/timing";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { isTournamentFormat } from "../../utils/gameFormatUtils";
import { finishPhaseAt, hasNewFinisher, hasNewResults, nextFinishPhaseAtMs, tournamentFinishOf, type FinishPhase, type TournamentFinish } from "../../utils/tournamentFinish";
import { hasValue, isNullish } from "../../utils/guards";

export interface TournamentFinishMoment {
    /** null when no finish is being shown (including a table opened after the finish). */
    phase: FinishPhase | null;
    /** Winner / runner-up / winning hand while the tournament-winner moment is up. */
    finish: TournamentFinish | null;
}

const IDLE: TournamentFinishMoment = { phase: null, finish: null };

/**
 * Paces a tournament finish on the RENDERED track (ui#874).
 *
 * Watches committed bus items. When a commit adds a finisher to `results[]`
 * live — after the bus has already paced the deciding hand's run-out (ui#873) —
 * it holds the results / busted modals for the deciding hand's result beat
 * (`showdown`: the winning hand named, the pot moving), then, if that hand
 * ended the tournament, for the tournament-winner moment (`winner`), then lets
 * them through (`done`). A table opened after the finish has no live
 * transition, so its modal shows at once.
 */
export function useTournamentFinishMoment(recordResults?: ResultDTO[]): TournamentFinishMoment {
    const { latestItem, isPlayingSuspense } = useGameEventsContext();
    const prevSnapshotRef = useRef<TexasHoldemStateDTO | undefined>(undefined);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [moment, setMoment] = useState<TournamentFinishMoment>(IDLE);

    // Layout effect: the commit that adds the result also re-renders the
    // results modal, so the hold must be in place before that frame paints.
    useLayoutEffect(() => {
        if (!latestItem || latestItem.classified.kind !== "state") {
            return;
        }
        const { snapshot, format } = latestItem.classified;
        const prev = prevSnapshotRef.current;
        prevSnapshotRef.current = snapshot;
        if (!isTournamentFormat(format) || !hasNewFinisher(prev, snapshot)) {
            return;
        }

        const finish = tournamentFinishOf(snapshot);
        const tournamentOver = hasValue(finish);
        const startedAt = Date.now();
        const advance = () => {
            const elapsed = Date.now() - startedAt;
            const phase = finishPhaseAt(elapsed, tournamentOver);
            setMoment({ phase, finish });
            const nextAt = nextFinishPhaseAtMs(elapsed, tournamentOver);
            timerRef.current = isNullish(nextAt) ? null : setTimeout(advance, Math.max(0, nextAt - elapsed));
        };
        if (hasValue(timerRef.current)) {
            clearTimeout(timerRef.current);
        }
        advance();
    }, [latestItem]);

    // A multi-table tournament's results live on the polled tournament record, not
    // on the table snapshot, so a bust-out can arrive before the table has even
    // ingested the hand behind it (ui#994). Hold at once, give the table
    // RECORD_FINISH_SETTLE_MS to catch up, wait for any run-out still playing,
    // then give the deciding hand its result beat.
    const prevRecordRef = useRef<ResultDTO[] | undefined>(undefined);
    useLayoutEffect(() => {
        const prev = prevRecordRef.current;
        prevRecordRef.current = recordResults;
        if (!hasNewResults(prev, recordResults)) {
            return;
        }
        if (hasValue(timerRef.current)) {
            clearTimeout(timerRef.current);
        }
        setMoment({ phase: "showdown", finish: null });
        const detectedAt = Date.now();
        const startBeat = () => {
            const startedAt = Date.now();
            const advance = () => {
                const elapsed = Date.now() - startedAt;
                setMoment({ phase: finishPhaseAt(elapsed, false), finish: null });
                const nextAt = nextFinishPhaseAtMs(elapsed, false);
                timerRef.current = isNullish(nextAt) ? null : setTimeout(advance, Math.max(0, nextAt - elapsed));
            };
            advance();
        };
        const waitForRunout = () => {
            const waited = Date.now() - detectedAt;
            if (isPlayingSuspense() && waited < MAX_AUTO_DEAL_DEFER_MS) {
                timerRef.current = setTimeout(waitForRunout, AUTO_DEAL_DEFER_POLL_MS);
                return;
            }
            startBeat();
        };
        timerRef.current = setTimeout(waitForRunout, RECORD_FINISH_SETTLE_MS);
    }, [recordResults, isPlayingSuspense]);

    useEffect(
        () => () => {
            if (hasValue(timerRef.current)) {
                clearTimeout(timerRef.current);
            }
        },
        []
    );

    return moment;
}
