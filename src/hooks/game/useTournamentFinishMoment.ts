import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useGameEventsContext } from "../../context/gameState/GameEventsContext";
import { isTournamentFormat } from "../../utils/gameFormatUtils";
import { finishPhaseAt, hasNewFinisher, nextFinishPhaseAtMs, tournamentFinishOf, type FinishPhase, type TournamentFinish } from "../../utils/tournamentFinish";

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
export function useTournamentFinishMoment(): TournamentFinishMoment {
    const { latestItem } = useGameEventsContext();
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
        const tournamentOver = finish !== null;
        const startedAt = Date.now();
        const advance = () => {
            const elapsed = Date.now() - startedAt;
            const phase = finishPhaseAt(elapsed, tournamentOver);
            setMoment({ phase, finish });
            const nextAt = nextFinishPhaseAtMs(elapsed, tournamentOver);
            timerRef.current = nextAt === null ? null : setTimeout(advance, Math.max(0, nextAt - elapsed));
        };
        if (timerRef.current !== null) {
            clearTimeout(timerRef.current);
        }
        advance();
    }, [latestItem]);

    useEffect(
        () => () => {
            if (timerRef.current !== null) {
                clearTimeout(timerRef.current);
            }
        },
        []
    );

    return moment;
}
