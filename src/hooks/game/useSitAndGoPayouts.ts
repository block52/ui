import { useMemo } from "react";
import { GameFormat } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../context/GameStateContext";
import { hasElements, hasValue } from "../../utils/guards";

export interface SitAndGoPayoutPlace {
    place: number;
    percent: number;
    payout: string;
}

export interface SitAndGoPayoutsReturn {
    isSitAndGo: boolean;
    prizePool: string | null;
    places: SitAndGoPayoutPlace[];
}

const EMPTY: SitAndGoPayoutsReturn = { isSitAndGo: false, prizePool: null, places: [] };

const getPercentStructure = (maxPlayers: number): number[] => {
    if (maxPlayers <= 2) return [100];
    if (maxPlayers <= 7) return [60, 40];
    return [50, 30, 20];
};

export const useSitAndGoPayouts = (): SitAndGoPayoutsReturn => {
    const { gameState, gameFormat } = useGameStateContext();

    return useMemo(() => {
        if (gameFormat !== GameFormat.SIT_AND_GO) return EMPTY;

        const gameOptions = gameState?.gameOptions;
        if (!gameOptions || !hasValue(gameOptions.minBuyIn) || !hasValue(gameOptions.maxPlayers)) {
            return { isSitAndGo: true, prizePool: null, places: [] };
        }

        const buyIn = BigInt(gameOptions.minBuyIn);
        const maxPlayers = gameOptions.maxPlayers;
        const prizePool = BigInt(maxPlayers) * buyIn;
        if (prizePool <= 0n || maxPlayers <= 0) {
            return { isSitAndGo: true, prizePool: null, places: [] };
        }

        const percentages = getPercentStructure(maxPlayers);
        if (!hasElements(percentages)) return { isSitAndGo: true, prizePool: null, places: [] };

        const payouts = percentages.map(percent => (prizePool * BigInt(percent)) / 100n);
        const distributed = payouts.reduce((sum, amount) => sum + amount, 0n);
        const remainder = prizePool - distributed;
        if (remainder > 0n) {
            payouts[0] += remainder;
        }

        const places: SitAndGoPayoutPlace[] = percentages.map((percent, index) => ({
            place: index + 1,
            percent,
            payout: payouts[index].toString()
        }));

        return {
            isSitAndGo: true,
            prizePool: prizePool.toString(),
            places
        };
    }, [gameFormat, gameState?.gameOptions]);
};
