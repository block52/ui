import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCometRpcApiFactory, useCosmosApi } from "../../context/CosmosApiContext";
import { useNetwork } from "../../context/NetworkContext";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { httpErrorMessage } from "../../apis/HTTPClient";
import {
    TOURNAMENT_CREATED_QUERY,
    buildTournamentCard,
    parseTournamentResponse,
    sortTournamentCards,
    tournamentIdsFromTxSearch,
    type TournamentLobbyCard,
    type TournamentRecord
} from "../../utils/tournamentLobby";
import { isNullish } from "../../utils/guards";

/** How often the lobby re-reads the chain. */
export const TOURNAMENT_LOBBY_POLL_MS = 5000;

/** The newest tournaments the lobby lists (the interim discovery query, see utils/tournamentLobby). */
export const TOURNAMENT_LOBBY_LIMIT = 50;

/** A ticking clock for countdowns and the register cut-off. */
export const useNow = (intervalMs: number): number => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), intervalMs);
        return () => clearInterval(id);
    }, [intervalMs]);
    return now;
};

export interface UseTournamentLobbyResult {
    cards: TournamentLobbyCard[];
    viewer: string | undefined;
    isLoading: boolean;
    error: string | null;
    /** Tournaments whose state could not be read or parsed; the rest still show. */
    failedCount: number;
    refresh: () => Promise<void>;
}

/**
 * The lobby's tournaments: discovers them from the chain's `tournament_created`
 * events, reads each one's state, and keeps the cards fresh. Owns nothing else; the
 * table-page hook (useTournament) is separate.
 */
export const useTournamentLobby = (): UseTournamentLobbyResult => {
    const { currentNetwork } = useNetwork();
    const cosmosApi = useCosmosApi();
    const cometRpcApiFactory = useCometRpcApiFactory();
    const [records, setRecords] = useState<TournamentRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [failedCount, setFailedCount] = useState(0);
    const requestSeq = useRef(0);
    const now = useNow(1000);
    const viewer = getCosmosAddress() ?? undefined;

    const refresh = useCallback(async () => {
        const seq = ++requestSeq.current;
        try {
            const rpc = cometRpcApiFactory(currentNetwork.rpc);
            const found = tournamentIdsFromTxSearch(await rpc.txSearch(TOURNAMENT_CREATED_QUERY, TOURNAMENT_LOBBY_LIMIT, "desc"));
            const settled = await Promise.allSettled(found.map(async id => parseTournamentResponse(await cosmosApi.getTournament(id))));
            if (seq !== requestSeq.current) return;
            const ok: TournamentRecord[] = [];
            let failed = 0;
            for (const r of settled) {
                if (r.status === "fulfilled") ok.push(r.value);
                else failed++;
            }
            setRecords(ok);
            setFailedCount(failed);
            setError(null);
        } catch (err) {
            if (seq !== requestSeq.current) return;
            setError(httpErrorMessage(err, "Could not load tournaments"));
        } finally {
            if (seq === requestSeq.current) setIsLoading(false);
        }
    }, [cometRpcApiFactory, cosmosApi, currentNetwork.rpc]);

    useEffect(() => {
        setIsLoading(true);
        refresh();
        const id = setInterval(refresh, TOURNAMENT_LOBBY_POLL_MS);
        return () => {
            clearInterval(id);
            requestSeq.current++;
        };
    }, [refresh]);

    const cards = useMemo(() => sortTournamentCards(records.map(r => buildTournamentCard(r, isNullish(viewer) ? undefined : viewer, now))), [records, viewer, now]);

    return { cards, viewer, isLoading, error, failedCount, refresh };
};
