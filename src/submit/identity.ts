/**
 * Submission identity (ui#609) — the pure "is THAT our action?" math.
 *
 * The old gate treated any table progress (actionCount / next index / handNumber
 * moving) as confirmation, so another player's action — or a mempool projection
 * of one — confirmed ours. Here a job is matched to the action the chain
 * actually RECORDED: an entry in `previousActions` by our address, with the
 * recorded name our submitted label maps to, at an index at or after the job's
 * baseline. Nothing else counts.
 *
 * `attributeEvidence` works over ALL open jobs at once so two jobs never claim
 * the same recorded action, and so a job whose earlier sibling is still
 * unsettled is not mistaken for "superseded" by that sibling's action.
 */
import type { ActionDTO, TexasHoldemStateDTO } from "@block52/poker-vm-sdk";
import { NonPlayerActionType, PlayerActionType } from "@block52/poker-vm-sdk";
import type { ConfirmationBaseline } from "./types";
import { hasElements } from "../utils/guards";

/**
 * The recorded action name(s) a submitted label can appear as. A full-stack
 * bet/call/raise is recorded as `all-in` (the SDK's internal recorded type), so
 * those labels accept both.
 */
const RECORDED_ACTIONS: Readonly<Record<string, readonly string[]>> = {
    fold: [PlayerActionType.FOLD],
    check: [PlayerActionType.CHECK],
    call: [PlayerActionType.CALL, PlayerActionType.ALL_IN],
    bet: [PlayerActionType.BET, PlayerActionType.ALL_IN],
    raise: [PlayerActionType.RAISE, PlayerActionType.ALL_IN],
    "small-blind": [PlayerActionType.SMALL_BLIND],
    "big-blind": [PlayerActionType.BIG_BLIND],
    muck: [PlayerActionType.MUCK],
    show: [PlayerActionType.SHOW],
    deal: [NonPlayerActionType.DEAL],
    "sit-in": [NonPlayerActionType.SIT_IN],
    "sit-out": [NonPlayerActionType.SIT_OUT],
    "new-hand": [NonPlayerActionType.NEW_HAND]
};

/**
 * Recorded names for a submitted label. A label without a mapping is assumed to
 * be recorded under its own name (the SDK's enum values ARE the labels for
 * every action added after this table was written).
 */
export function recordedActionsFor(actionName: string): readonly string[] {
    return RECORDED_ACTIONS[actionName] ?? [actionName];
}

/** What the latest snapshot proves about one job. */
export type Evidence =
    /** Our submitted action is recorded at/after the baseline. */
    | { kind: "matched"; action: ActionDTO }
    /** `new-hand` only: the hand number moved past the baseline (new-hand is not itself recorded as a turn). */
    | { kind: "handAdvanced" }
    /** A DIFFERENT action of ours is recorded at/after the baseline, and ours is not — ours can no longer land. */
    | { kind: "superseded"; action: ActionDTO }
    | { kind: "none" };

/** The subset of a job the attribution needs. */
export interface OpenJobRef {
    id: number;
    actionName: string;
    baseline: ConfirmationBaseline;
}

/**
 * Attribute the snapshot's recorded actions to the open jobs, oldest job first.
 *
 * Every own recorded action is claimed by at most one job (the first whose
 * baseline it is at/after and whose recorded names include it). Only an own
 * action that NO open job claims can supersede a job — so an unsettled earlier
 * job's action never reads as "the chain did something else instead" for the
 * job behind it.
 */
export function attributeEvidence(
    jobs: readonly OpenJobRef[],
    address: string | null,
    snapshot: TexasHoldemStateDTO | undefined
): Map<number, Evidence> {
    const result = new Map<number, Evidence>();
    if (!snapshot || !address) {
        for (const job of jobs) {
            result.set(job.id, { kind: "none" });
        }
        return result;
    }

    const own = snapshot.previousActions.filter(action => action.playerId === address).sort((a, b) => a.index - b.index);
    const ordered = [...jobs].sort((a, b) => a.id - b.id);
    const claimed = new Set<number>();

    // Pass 1: each job claims the first unclaimed own action that matches it.
    for (const job of ordered) {
        const wanted = recordedActionsFor(job.actionName);
        const match = own.find(action => !claimed.has(action.index) && action.index >= job.baseline.actionIndex && wanted.includes(action.action));
        if (match) {
            claimed.add(match.index);
            result.set(job.id, { kind: "matched", action: match });
        }
    }

    // Pass 2: the rest — structural evidence for new-hand, then supersession by
    // an own action nobody claimed, else nothing yet.
    for (const job of ordered) {
        if (result.has(job.id)) {
            continue;
        }
        if (job.actionName === "new-hand" && snapshot.handNumber > job.baseline.handNumber) {
            result.set(job.id, { kind: "handAdvanced" });
            continue;
        }
        const unclaimed = own.filter(action => !claimed.has(action.index) && action.index >= job.baseline.actionIndex);
        if (hasElements(unclaimed)) {
            claimed.add(unclaimed[0].index);
            result.set(job.id, { kind: "superseded", action: unclaimed[0] });
            continue;
        }
        result.set(job.id, { kind: "none" });
    }

    return result;
}
