import { useMemo } from "react";
import { GameFormat } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { hasContent, hasValue } from "../../utils/guards";

export interface SitAndGoPayoutPlace {
    place: number;
    percentBasisPoints: number;
    payout: string;
}

export interface SitAndGoPayoutsReturn {
    isSitAndGo: boolean;
    prizePool: string | null;
    places: SitAndGoPayoutPlace[];
}

// Single-table SNG payout curves (basis points, sum to 10000).
// Indexed by maxPlayers; covers the common single-table seat counts.
const PAYOUT_CURVES: Record<number, number[]> = {
    2: [10000],
    3: [7000, 3000],
    4: [7000, 3000],
    5: [6500, 3500],
    6: [6500, 3500],
    7: [5000, 3000, 2000],
    8: [5000, 3000, 2000],
    9: [5000, 3000, 2000],
    10: [5000, 3000, 2000]
};

const EMPTY: SitAndGoPayoutsReturn = { isSitAndGo: false, prizePool: null, places: [] };

export const useSitAndGoPayouts = (): SitAndGoPayoutsReturn => {
    const { gameState, gameFormat } = useGameStateContext();

    return useMemo(() => {
        if (gameFormat !== GameFormat.SIT_AND_GO) return EMPTY;

        const options = gameState?.gameOptions;
        const minBuyIn = options?.minBuyIn;
        const maxPlayers = options?.maxPlayers;
        if (!hasContent(minBuyIn) || !hasValue(maxPlayers)) {
            return { isSitAndGo: true, prizePool: null, places: [] };
        }

        const curve = PAYOUT_CURVES[maxPlayers];
        if (!hasValue(curve)) {
            return { isSitAndGo: true, prizePool: null, places: [] };
        }

        const buyIn = BigInt(minBuyIn);
        const prizePool = buyIn * BigInt(maxPlayers);

        const places: SitAndGoPayoutPlace[] = curve.map((bp, index) => ({
            place: index + 1,
            percentBasisPoints: bp,
            payout: ((prizePool * BigInt(bp)) / 10000n).toString()
        }));

        return {
            isSitAndGo: true,
            prizePool: prizePool.toString(),
            places
        };
    }, [gameFormat, gameState?.gameOptions]);
};
