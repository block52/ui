import { useCallback, useState } from "react";
import { getTournamentTxClient, isSdkGapError, type CreateTournamentParams } from "../../utils/tournamentTx";

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
 * (utils/tournamentTx). The chain's own error is shown as it comes; the only message
 * written here is the SDK-gap one, which says what is missing.
 */
export const useTournamentActions = (onDone: () => Promise<void> | void): UseTournamentActionsResult => {
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
                if (!isSdkGapError(err)) console.error("Tournament transaction failed:", err);
                setError(messageOf(err));
                return null;
            } finally {
                setBusy(false);
            }
        },
        [onDone]
    );

    const register = useCallback(async (id: string) => (await run(() => getTournamentTxClient().registerTournament(id))) !== null, [run]);
    const unregister = useCallback(async (id: string) => (await run(() => getTournamentTxClient().unregisterTournament(id))) !== null, [run]);
    const create = useCallback(
        async (params: CreateTournamentParams) => (await run(() => getTournamentTxClient().createTournament(params)))?.tournamentId ?? null,
        [run]
    );
    const clearError = useCallback(() => setError(null), []);

    return { busy, error, clearError, register, unregister, create };
};
