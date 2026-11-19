/**
 * Profile Stats totals that include every game variant.
 *
 * The indexer's buy-in, cash-out and net cover cash games, Sit & Go and
 * single-table tournaments (sessions). Multi-table tournament entry is
 * MsgRegisterTournament, so those buy-ins never appear as sessions. Sit & Go
 * and single-table prizes already come from `sng_prize_claimed`. MTT payouts
 * settle on the tournament record (`tournament_finished`), and unregistering
 * refunds `net_buy_in` on `tournament_unregistered`. This adds those chain
 * figures once, without counting an indexer session or prize claim twice.
 */
import type { PlayerListItem, PlayerSession } from "../types/players";
import { hasContent, hasElements, hasValue, isEmpty } from "./guards";
import { addedPrizeCash, type PlayerPrizeClaim } from "./playerPrizeClaims";
import {
    coversTournament,
    paidTournamentPrize,
    registrationBuyIn,
    type PlayerTournamentEntry,
    type TournamentRegistration,
    type TournamentUnregistration
} from "./playerTournamentEntries";

export interface ProfileStatsMoney {
    totalBuyIns: number;
    totalCashOuts: number;
    netProfit: number;
}

export interface ProfileStatsMoneyInput {
    totalBuyIns: number;
    totalCashOuts: number;
    netProfit: number;
}

/** True when the indexer already has a session for this tournament or one of its tables. */
export function sessionCoversTournament(sessions: PlayerSession[], tournamentId: string): boolean {
    return sessions.some(session => coversTournament(session.game_id, tournamentId));
}

/**
 * Buy-ins the indexer missed: every successful MTT registration (buy-in plus
 * entry fee) whose tournament is not already a session. When `registrations`
 * is empty, each `entries` row is counted once, so a caller that only loaded
 * the tournament records still fills the gap.
 */
export function addedTournamentBuyIns(
    sessions: PlayerSession[],
    registrations: TournamentRegistration[],
    entries: PlayerTournamentEntry[]
): number {
    if (hasElements(registrations)) {
        const byId = new Map(entries.map(entry => [entry.tournamentId.toLowerCase(), entry] as const));
        let added = 0;
        for (const registration of registrations) {
            if (sessionCoversTournament(sessions, registration.tournamentId)) continue;
            const cost = registrationBuyIn(registration, {}) ?? byId.get(registration.tournamentId.toLowerCase())?.buyIn;
            if (!hasValue(cost)) continue;
            added += cost;
        }
        return added;
    }
    let added = 0;
    for (const entry of entries) {
        if (sessionCoversTournament(sessions, entry.tournamentId)) continue;
        added += entry.buyIn;
    }
    return added;
}

/**
 * Prize-claim amounts already counted for this tournament's tables, so an MTT
 * payout is not added a second time if it also arrived as sng_prize_claimed.
 */
export function claimsForTournament(claims: PlayerPrizeClaim[], tournamentId: string): number {
    let total = 0;
    for (const claim of claims) {
        if (coversTournament(claim.gameId, tournamentId)) total += claim.amount;
    }
    return total;
}

/**
 * MTT cash the indexer missed: unregister refunds, plus paid finishes that
 * are not already in a session or a prize claim.
 */
export function addedTournamentCashOuts(
    sessions: PlayerSession[],
    claims: PlayerPrizeClaim[],
    entries: PlayerTournamentEntry[],
    unregistrations: TournamentUnregistration[],
    player: string | undefined
): number {
    let added = 0;
    const seenRefund = new Set<string>();
    for (const unreg of unregistrations) {
        if (sessionCoversTournament(sessions, unreg.tournamentId) || !hasValue(unreg.refund)) continue;
        const key = `${unreg.tournamentId.toLowerCase()}:${unreg.height}:${unreg.txhash}`;
        if (seenRefund.has(key)) continue;
        seenRefund.add(key);
        added += unreg.refund;
    }
    if (!hasContent(player) || isEmpty(entries)) return added;
    for (const entry of entries) {
        if (sessionCoversTournament(sessions, entry.tournamentId)) continue;
        const prize = paidTournamentPrize(entry, player);
        if (!hasValue(prize)) continue;
        added += prize - claimsForTournament(claims, entry.tournamentId);
    }
    return added;
}

/**
 * Indexer buy-ins, cash-outs and net, plus prize claims and MTT registration
 * costs, refunds and payouts the indexer never saw.
 */
export function profileMoneyWithAllVariants(
    money: ProfileStatsMoneyInput,
    sessions: PlayerSession[],
    claims: PlayerPrizeClaim[],
    entries: PlayerTournamentEntry[],
    registrations: TournamentRegistration[] = [],
    unregistrations: TournamentUnregistration[] = [],
    player?: string
): ProfileStatsMoney {
    const addedBuyIns = addedTournamentBuyIns(sessions, registrations, entries);
    const addedCash = addedPrizeCash(sessions, claims) + addedTournamentCashOuts(sessions, claims, entries, unregistrations, player);
    return {
        totalBuyIns: money.totalBuyIns + addedBuyIns,
        totalCashOuts: money.totalCashOuts + addedCash,
        netProfit: money.netProfit + addedCash - addedBuyIns
    };
}

/**
 * Directory rows with prize claims and MTT registration costs, refunds and
 * payouts applied to net profit, using the same rules as the profile.
 * Players with no claims or tournament activity are returned as-is.
 */
export function playerListWithAllVariants(
    players: PlayerListItem[],
    claimsByPlayer: Map<string, PlayerPrizeClaim[]>,
    sessionsByPlayer: Map<string, PlayerSession[]>,
    registrationsByPlayer: Map<string, TournamentRegistration[]> = new Map(),
    entriesByPlayer: Map<string, PlayerTournamentEntry[]> = new Map(),
    unregistrationsByPlayer: Map<string, TournamentUnregistration[]> = new Map()
): PlayerListItem[] {
    return players.map(player => {
        const key = player.player_address.toLowerCase();
        const claims = claimsByPlayer.get(key) ?? [];
        const sessions = sessionsByPlayer.get(key) ?? [];
        const registrations = registrationsByPlayer.get(key) ?? [];
        const entries = entriesByPlayer.get(key) ?? [];
        const unregistrations = unregistrationsByPlayer.get(key) ?? [];
        if (isEmpty(claims) && isEmpty(registrations) && isEmpty(entries) && isEmpty(unregistrations)) return player;
        const money = profileMoneyWithAllVariants(
            { totalBuyIns: 0, totalCashOuts: 0, netProfit: player.net_profit },
            sessions,
            claims,
            entries,
            registrations,
            unregistrations,
            player.player_address
        );
        if (money.netProfit === player.net_profit) return player;
        return { ...player, net_profit: money.netProfit };
    });
}
