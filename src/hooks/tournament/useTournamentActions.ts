import { useCallback, useState } from "react";
import { useNetwork } from "../../context/NetworkContext";
import { getTournamentTxClient, type CreateTournamentParams } from "../../utils/tournamentTx";
import { hasValue } from "../../utils/guards";

export interface UseTournamentActionsResult {
    busy: boolean;
    error: string | null;
    clearError: () => void;
    register: (tournamentId: string) => Promise<boolean>;
    unregister: (tournamentId: string) => Promise<boolean>;
    create: (params: CreateTournamentParams) => Promise<string | null>;
}

const messageOf = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Register, unregister and create, through the tournament transaction client
 * (utils/tournamentTx) on the current network. The chain's own error is shown as it comes.
 */
export const useTournamentActions = (onDone: () => Promise<void> | void): UseTournamentActionsResult => {
    const { currentNetwork } = useNetwork();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(
        async <T,>(action: () => Promise<T>): Promise<T | null> => {
            setBusy(true);
            setError(null);
            try {
                const result = await action();
                await onDone();
                return result;
            } catch (err) {
                console.error("Tournament transaction failed:", err);
                setError(messageOf(err));
                return null;
            } finally {
                setBusy(false);
            }
        },
        [onDone]
    );

    const register = useCallback(async (id: string) => hasValue(await run(() => getTournamentTxClient(currentNetwork).registerTournament(id))), [run, currentNetwork]);
    const unregister = useCallback(async (id: string) => hasValue(await run(() => getTournamentTxClient(currentNetwork).unregisterTournament(id))), [run, currentNetwork]);
    const create = useCallback(
        async (params: CreateTournamentParams) => (await run(() => getTournamentTxClient(currentNetwork).createTournament(params)))?.tournamentId ?? null,
        [run, currentNetwork]
    );
    const clearError = useCallback(() => setError(null), []);

    return { busy, error, clearError, register, unregister, create };
};
