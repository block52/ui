import { useEffect, useMemo, useSyncExternalStore } from "react";
import { ActionDTO } from "@block52/poker-vm-sdk";
import { useGameData } from "../../context/gameState/GameDataContext";
import { applyPotHoldback, closingBetPhase, deriveClosingBets, type ClosingBetPhase } from "../../utils/closingBets";
import { getClosingClock, subscribeClosingClock, syncClosingClock } from "./closingBetClock";

export interface ClosingBetPresentation {
    phase: ClosingBetPhase;
    chipsByAddress: ReadonlyMap<string, string>;
    actionBySeat: ReadonlyMap<number, ActionDTO>;
    pots: string[];
    totalPot: string | undefined;
}

const NO_CHIPS: ReadonlyMap<string, string> = new Map();
const NO_ACTIONS: ReadonlyMap<number, ActionDTO> = new Map();

/**
 * The closing-bet chips, the pot with those chips held out, and the action
 * each seat should keep labelled. Shared clock, so the pile, the pot and the
 * label move together.
 */
export function useClosingBetPresentation(): ClosingBetPresentation {
    const { gameState } = useGameData();
    const clock = useSyncExternalStore(subscribeClosingClock, getClosingClock, getClosingClock);

    const view = useMemo(() => deriveClosingBets({
        round: gameState?.round,
        nextToAct: gameState?.nextToAct,
        winners: gameState?.winners,
        players: gameState?.players ?? [],
        previousActions: gameState?.previousActions ?? []
    }), [gameState]);

    const handToken = gameState ? String(gameState.handNumber) : "";
    useEffect(() => {
        syncClosingClock(view.key, view.collectedIntoPot, handToken);
    }, [view.key, view.collectedIntoPot, handToken]);

    return useMemo(() => {
        const phase = closingBetPhase(view, clock);
        const pots = Array.isArray(gameState?.pots) ? gameState.pots : [];
        const totalPot = gameState?.totalPot;
        if (phase === "off") {
            return { phase, chipsByAddress: NO_CHIPS, actionBySeat: NO_ACTIONS, pots, totalPot };
        }
        const chipsByAddress = new Map<string, string>();
        const actionBySeat = new Map<number, ActionDTO>();
        for (const draw of view.draws) {
            chipsByAddress.set(draw.address, draw.amount);
            actionBySeat.set(draw.seat, draw.action);
        }
        const held = applyPotHoldback(pots, totalPot, view.potHoldback);
        return { phase, chipsByAddress, actionBySeat, pots: held.pots, totalPot: held.totalPot };
    }, [view, clock, gameState]);
}
