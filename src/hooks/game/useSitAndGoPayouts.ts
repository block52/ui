import { useMemo, useRef } from "react";
import { GameFormat } from "@block52/poker-vm-sdk";
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { useGameData } from "../../context/gameState/GameDataContext";
import { useGameMeta } from "../../context/gameState/GameMetaContext";
import { hasElements } from "../../utils/guards";

export interface SitAndGoPayoutPlace {
    place: number;
    payout: string;
}

export interface SitAndGoPayoutsReturn {
    isSitAndGo: boolean;
    prizePool: string | null;
    places: SitAndGoPayoutPlace[];
}

const EMPTY: SitAndGoPayoutsReturn = { isSitAndGo: false, prizePool: null, places: [] };

type Payouts = TexasHoldemStateDTO["payouts"];

/**
 * The Sit & Go payout structure, as the PVM authored it (#513/#514 made
 * `TexasHoldemStateDTO.payouts` the authority; there is deliberately no second
 * calculator here — this is a passthrough).
 *
 * ui#659: it is a passthrough of COMMITTED state only. The render track shows
 * the relay's optimistic frames too — a projection of pending mempool actions —
 * and re-reading the payout structure from those made first place alternate
 * between $0.20 and $0.18 at an unchanged hand and action count, because the
 * two producers answered differently. A pending action cannot change anyone's
 * entitlement, so a projection is never a reason to restate the prize pool:
 * hold the last committed answer until committed state supersedes it.
 *
 * This removes the flicker. It does NOT settle which of the two figures is
 * correct — that is a producer-side question and stays open upstream.
 */
export const useSitAndGoPayouts = (): SitAndGoPayoutsReturn => {
    const { gameState, isOptimistic } = useGameData();
    const { gameFormat } = useGameMeta();

    // Derived during render on purpose: the committed answer has to be
    // available in the same pass that an optimistic frame arrives, or the
    // panel blanks for a frame instead of holding steady.
    const committedPayoutsRef = useRef<Payouts>(undefined);
    if (!isOptimistic) {
        committedPayoutsRef.current = gameState?.payouts;
    }
    const payouts: Payouts = isOptimistic ? committedPayoutsRef.current : gameState?.payouts;

    return useMemo(() => {
        if (gameFormat !== GameFormat.SIT_AND_GO) return EMPTY;

        if (!hasElements(payouts)) {
            return { isSitAndGo: true, prizePool: null, places: [] };
        }

        const prizePool = payouts.reduce((sum, p) => sum + BigInt(p.amount), 0n);
        if (prizePool <= 0n) {
            return { isSitAndGo: true, prizePool: null, places: [] };
        }

        const places: SitAndGoPayoutPlace[] = payouts.map(p => ({
            place: p.place,
            payout: p.amount
        }));

        return {
            isSitAndGo: true,
            prizePool: prizePool.toString(),
            places
        };
    }, [gameFormat, payouts]);
};
