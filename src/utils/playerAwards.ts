import type { PlayerHand, PlayerProfile } from "../types/players";
import { isEmpty } from "./guards";

/**
 * The player awards ("biggest nit" and friends), ranked from the indexer's
 * recorded action counts and hands. The rules follow the 9 High article
 * "The Nit, the Station, and the Maniac".
 *
 * There is deliberately no money award: the indexer's net_profit only counts
 * cash-outs, not sit-and-go prizes, so nearly every wallet looks like a loser.
 */

/** Fewest recorded decisions to be ranked at all, so nobody wins for folding three hands and going home. */
export const MIN_AWARD_DECISIONS = 150;
/** Fewest bets, raises and calls for the aggression awards: a ratio of a handful of actions says little. */
export const MIN_AWARD_MONEY_ACTIONS = 50;
/** Fewest hands with a recorded winner for the win-rate awards. */
export const MIN_AWARD_HANDS = 30;
/** How many wallets each award lists: the winner and the runners-up. */
export const AWARD_PODIUM_SIZE = 3;

export interface PlayerAwardLine {
    address: string;
    bets: number;
    raises: number;
    calls: number;
    folds: number;
    checks: number;
    /** Hands with a recorded winner: see handsWithRecordedWinner. */
    handsCounted: number;
    handsWon: number;
}

export interface PlayerAwardEntry {
    address: string;
    /** The ranked number on its own, e.g. "73%". */
    stat: string;
    /** The full sentence, e.g. "Folds 73% of decisions: 156 of 215". */
    evidence: string;
}

export interface PlayerAward {
    id: string;
    emoji: string;
    title: string;
    /** What the award measures, in one line. */
    measure: string;
    /** Best first; never empty. */
    podium: PlayerAwardEntry[];
}

const handKey = (hand: PlayerHand): string => `${hand.game_id}/${hand.hand_number}`;

/**
 * The hands some wallet is recorded as winning chips in, from every wallet's
 * hands. The indexer has no winnings at all for about a third of the hands that
 * reach a full board, and counting those would read as a loss for the whole
 * table. Don't use `winner_count` for this: it's 0 for a hand everyone folded
 * before the flop, whose winner is recorded.
 */
export const handsWithRecordedWinner = (hands: PlayerHand[]): Set<string> => new Set(hands.filter(hand => hand.won_amount > 0).map(handKey));

export const toAwardLine = (profile: PlayerProfile, hands: PlayerHand[], handsWithWinner: Set<string>): PlayerAwardLine => {
    const counted = hands.filter(hand => handsWithWinner.has(handKey(hand)));
    return {
        address: profile.player_address,
        bets: profile.total_bets,
        raises: profile.total_raises,
        calls: profile.total_calls,
        folds: profile.total_folds,
        checks: profile.total_checks,
        handsCounted: counted.length,
        handsWon: counted.filter(hand => hand.won_amount > 0).length
    };
};

const aggressiveActions = (line: PlayerAwardLine): number => line.bets + line.raises;
const moneyActions = (line: PlayerAwardLine): number => aggressiveActions(line) + line.calls;
export const decisionCount = (line: PlayerAwardLine): number => moneyActions(line) + line.folds + line.checks;

const foldShare = (line: PlayerAwardLine): number => line.folds / decisionCount(line);
const moneyShare = (line: PlayerAwardLine): number => moneyActions(line) / decisionCount(line);
/** Bets and raises per call. Infinite for a wallet that never called. */
const aggressionFactor = (line: PlayerAwardLine): number => aggressiveActions(line) / line.calls;
const winRate = (line: PlayerAwardLine): number => line.handsWon / line.handsCounted;

const percent = (share: number): string => `${Math.round(share * 100)}%`;
const factor = (value: number): string => (Number.isFinite(value) ? value.toFixed(2) : "∞");
const count = (value: number): string => value.toLocaleString();

const hasEnoughMoneyActions = (line: PlayerAwardLine): boolean => moneyActions(line) >= MIN_AWARD_MONEY_ACTIONS;
const hasEnoughHands = (line: PlayerAwardLine): boolean => line.handsCounted >= MIN_AWARD_HANDS;
const everyone = (): boolean => true;

const aggressionEvidence = (line: PlayerAwardLine): string =>
    `Aggression ${factor(aggressionFactor(line))}: ${count(aggressiveActions(line))} bets and raises against ${count(line.calls)} calls`;
const winEvidence = (line: PlayerAwardLine): string =>
    `Won ${count(line.handsWon)} of ${count(line.handsCounted)} hands: ${percent(winRate(line))}`;

interface AwardRule {
    id: string;
    emoji: string;
    title: string;
    measure: string;
    eligible: (line: PlayerAwardLine) => boolean;
    /** Highest score wins. */
    score: (line: PlayerAwardLine) => number;
    stat: (line: PlayerAwardLine) => string;
    evidence: (line: PlayerAwardLine) => string;
}

const AWARD_RULES: AwardRule[] = [
    {
        id: "nit",
        emoji: "🧊",
        title: "Biggest nit",
        measure: "Folds the biggest share of their decisions",
        eligible: everyone,
        score: foldShare,
        stat: line => percent(foldShare(line)),
        evidence: line => `Folds ${percent(foldShare(line))} of decisions: ${count(line.folds)} of ${count(decisionCount(line))}`
    },
    {
        id: "loosest",
        emoji: "🎢",
        title: "Loosest player",
        measure: "Puts money in on the biggest share of their decisions",
        eligible: everyone,
        score: moneyShare,
        stat: line => percent(moneyShare(line)),
        evidence: line => `Money in on ${percent(moneyShare(line))} of decisions: ${count(moneyActions(line))} of ${count(decisionCount(line))}`
    },
    {
        id: "maniac",
        emoji: "🔥",
        title: "The maniac",
        measure: "Most bets and raises for every call",
        eligible: hasEnoughMoneyActions,
        score: aggressionFactor,
        stat: line => factor(aggressionFactor(line)),
        evidence: aggressionEvidence
    },
    {
        id: "station",
        emoji: "📞",
        title: "Calling station",
        measure: "Fewest bets and raises for every call",
        eligible: hasEnoughMoneyActions,
        score: line => -aggressionFactor(line),
        stat: line => factor(aggressionFactor(line)),
        evidence: aggressionEvidence
    },
    {
        id: "boss",
        emoji: "👑",
        title: "Table boss",
        measure: "Wins the biggest share of their hands",
        eligible: hasEnoughHands,
        score: winRate,
        stat: line => percent(winRate(line)),
        evidence: winEvidence
    },
    {
        id: "card-dead",
        emoji: "💀",
        title: "Card dead",
        measure: "Wins the smallest share of their hands",
        eligible: hasEnoughHands,
        score: line => -winRate(line),
        stat: line => percent(winRate(line)),
        evidence: winEvidence
    },
    {
        id: "grinder",
        emoji: "🏋️",
        title: "The grinder",
        measure: "Most decisions at the tables",
        eligible: everyone,
        score: decisionCount,
        stat: line => count(decisionCount(line)),
        evidence: line => `${count(decisionCount(line))} decisions at the tables`
    }
];

/** Ties go to the bigger sample, then the address, so the order never flips between loads. */
const compareLines = (a: PlayerAwardLine, b: PlayerAwardLine, score: AwardRule["score"]): number =>
    score(b) - score(a) || decisionCount(b) - decisionCount(a) || a.address.localeCompare(b.address);

/** Wallets with enough decisions to be ranked. */
export const rankedLines = (lines: PlayerAwardLine[]): PlayerAwardLine[] => lines.filter(line => decisionCount(line) >= MIN_AWARD_DECISIONS);

/** Every award with at least one eligible wallet, in display order. */
export const computeAwards = (lines: PlayerAwardLine[]): PlayerAward[] => {
    const ranked = rankedLines(lines);
    return AWARD_RULES.flatMap(rule => {
        const podium = ranked
            .filter(rule.eligible)
            .sort((a, b) => compareLines(a, b, rule.score))
            .slice(0, AWARD_PODIUM_SIZE)
            .map(line => ({ address: line.address, stat: rule.stat(line), evidence: rule.evidence(line) }));
        return isEmpty(podium) ? [] : [{ id: rule.id, emoji: rule.emoji, title: rule.title, measure: rule.measure, podium }];
    });
};
