import { useMemo } from "react";
import { GameFormat } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
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

export const useSitAndGoPayouts = (): SitAndGoPayoutsReturn => {
    const { gameState, gameFormat } = useGameStateContext();

    return useMemo(() => {
        if (gameFormat !== GameFormat.SIT_AND_GO) return EMPTY;

        const payouts = gameState?.payouts;
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
    }, [gameFormat, gameState?.payouts]);
};
