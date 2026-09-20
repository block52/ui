/**
 * Confirmation baseline — where we were when a job executed.
 *
 * The controller captures this at execute time and the identity check
 * (`identity.ts`) matches the job to an action the chain RECORDED for our
 * address at or after `actionIndex` (or, for `new-hand`, a hand number past
 * `handNumber`). The old counter comparison ("actionCount / index / handNumber
 * advanced") is gone: any other player's action, or a mempool projection of
 * one, satisfied it (ui#609).
 */
import type { TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { nextActionIndex } from "../hooks/playerActions/transportAction";
import type { ConfirmationBaseline } from "./types";

/** Capture the confirmation baseline from a snapshot at execute time. */
export function snapshotConfirmationSignals(state: TexasHoldemStateDTO | undefined): ConfirmationBaseline {
    return {
        actionCount: state?.actionCount ?? 0,
        handNumber: state?.handNumber ?? 0,
        actionIndex: nextActionIndex(state)
    };
}
