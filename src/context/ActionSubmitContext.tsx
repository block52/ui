/**
 * ActionSubmitContext — the React coupling layer over ActionSubmitController.
 *
 * Follows the Context → Provider → Hook pattern (7 Commandments #3). The
 * controller is framework-free; this file is the only place it touches React:
 * it instantiates one controller per app, feeds it the logical track (with
 * provenance), gives it the tx-by-hash query and our address, wires failures
 * to a toast, and re-renders consumers on busy-state changes.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FC, type ReactNode } from "react";
import { toast } from "react-toastify";
import { ActionSubmitController } from "../submit/ActionSubmitController";
import type { ControllerSnapshot, SubmitActionRequest, SubmitError, SubmitNotice, TxVerdict } from "../submit/types";
import { parseTxVerdict } from "../submit/txVerdict";
import { getLatestGameState, subscribeLatestGameState } from "../hooks/playerActions/transportAction";
import { clearSigningClientCache } from "../utils/cosmos/client";
import { getCosmosAddressSync } from "../utils/cosmosAccountUtils";
import { useCosmosApi } from "./CosmosApiContext";
import type { CosmosApi } from "../apis/Api";

const ActionSubmitContext = createContext<ActionSubmitController>(null as unknown as ActionSubmitController);

export const ActionSubmitProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // The REST client follows the selected network; the controller is created
    // once, so it reads the current client through a ref at lookup time.
    const cosmosApi = useCosmosApi();
    const apiRef = useRef<CosmosApi>(cosmosApi);
    apiRef.current = cosmosApi;

    // One controller for the app, created eagerly so it exists before any child
    // effect can submit. Reads the logical track (never the render track).
    const controllerRef = useRef<ActionSubmitController | null>(null);
    if (controllerRef.current === null) {
        controllerRef.current = new ActionSubmitController({
            getState: getLatestGameState,
            getLocalAddress: getCosmosAddressSync,
            onError: (error: SubmitError) => toast.error(error.message),
            onNotice: (notice: SubmitNotice) => toast.warn(notice.message),
            clearSigningCache: clearSigningClientCache,
            // `null` = no verdict yet: not in a block (404) or the query failed.
            // Bounded by the controller's verdict window, so a dead REST endpoint
            // costs a few failed polls, never a stuck job.
            lookupTx: async (hash: string): Promise<TxVerdict | null> => {
                try {
                    return parseTxVerdict(await apiRef.current.getTx(hash), hash);
                } catch {
                    return null;
                }
            }
        });
    }

    // Push every logical-track snapshot — with its provenance — into the
    // controller so a job settles on OUR recorded action, and a mempool
    // projection releases busy without being mistaken for a confirmation.
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller) {
            return;
        }
        return subscribeLatestGameState((snapshot, meta) => controller.onGameState(snapshot, meta));
    }, []);

    return <ActionSubmitContext.Provider value={controllerRef.current}>{children}</ActionSubmitContext.Provider>;
};

export interface UseActionSubmit {
    submit: (request: SubmitActionRequest) => void;
    /** The in-flight action's label, or null when idle. */
    loadingAction: string | null;
    isBusy: boolean;
    lastError: SubmitError | null;
}

export const useActionSubmit = (): UseActionSubmit => {
    const controller = useContext(ActionSubmitContext);
    const [snapshot, setSnapshot] = useState<ControllerSnapshot>(() => controller.getSnapshot());

    useEffect(() => {
        // Sync once on mount in case the controller changed between render and
        // effect, then subscribe for subsequent changes.
        setSnapshot(controller.getSnapshot());
        return controller.subscribe(setSnapshot);
    }, [controller]);

    const submit = useCallback((request: SubmitActionRequest) => controller.submit(request), [controller]);

    return {
        submit,
        loadingAction: snapshot.loadingAction,
        isBusy: snapshot.status === "busy",
        lastError: snapshot.lastError
    };
};
