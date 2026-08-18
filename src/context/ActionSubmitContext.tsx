/**
 * ActionSubmitContext — the React coupling layer over ActionSubmitController.
 *
 * Follows the Context → Provider → Hook pattern (7 Commandments #3). The
 * controller is framework-free; this file is the only place it touches React:
 * it instantiates one controller per app, feeds it the logical track, wires
 * failures to a toast, and re-renders consumers on busy-state changes.
 */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FC, type ReactNode } from "react";
import { toast } from "react-toastify";
import { ActionSubmitController } from "../submit/ActionSubmitController";
import type { ControllerSnapshot, SubmitActionRequest, SubmitError } from "../submit/types";
import { getLatestGameState, subscribeLatestGameState } from "../hooks/playerActions/transportAction";
import { clearSigningClientCache } from "../utils/cosmos/client";

const ActionSubmitContext = createContext<ActionSubmitController>(null as unknown as ActionSubmitController);

export const ActionSubmitProvider: FC<{ children: ReactNode }> = ({ children }) => {
    // One controller for the app, created eagerly so it exists before any child
    // effect can submit. Reads the logical track (never the render track).
    const controllerRef = useRef<ActionSubmitController | null>(null);
    if (controllerRef.current === null) {
        controllerRef.current = new ActionSubmitController({
            getState: getLatestGameState,
            onError: (error: SubmitError) => toast.error(error.message),
            clearSigningCache: clearSigningClientCache
        });
    }

    // Push every logical-track snapshot into the controller so a CONFIRMING job
    // clears busy the instant the chain accepts its action.
    useEffect(() => {
        const controller = controllerRef.current;
        if (!controller) {
            return;
        }
        return subscribeLatestGameState(snapshot => controller.onGameState(snapshot));
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
