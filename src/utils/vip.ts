/**
 * VIP tier presentation + player-stat formatting helpers (ui#589).
 *
 * Tiers and rakeback come from the indexer (see indexer sql/player_stats.sql);
 * this module only maps them to display metadata and formats the scaled-integer
 * stat fields. No thresholds are recomputed here — the chain/indexer owns those.
 */

import type { VipTier } from "../types/players";

export interface VipTierMeta {
    label: string;
    /** Tailwind classes for a filled badge pill. */
    badgeClass: string;
    /** Default rakeback % for the tier (indexer is the source of truth; this is a fallback label only). */
    rakebackPct: number;
    /** Rank for sorting: diamond highest. */
    rank: number;
}

const TIER_META: Record<VipTier, VipTierMeta> = {
    diamond: { label: "Diamond", badgeClass: "bg-cyan-500/20 text-cyan-300 border border-cyan-400/40", rakebackPct: 20, rank: 5 },
    platinum: { label: "Platinum", badgeClass: "bg-slate-300/20 text-slate-200 border border-slate-300/40", rakebackPct: 15, rank: 4 },
    gold: { label: "Gold", badgeClass: "bg-amber-500/20 text-amber-300 border border-amber-400/40", rakebackPct: 10, rank: 3 },
    silver: { label: "Silver", badgeClass: "bg-gray-400/20 text-gray-200 border border-gray-300/40", rakebackPct: 5, rank: 2 },
    bronze: { label: "Bronze", badgeClass: "bg-orange-700/20 text-orange-300 border border-orange-600/40", rakebackPct: 0, rank: 1 }
};

/** Metadata for a tier, defaulting to bronze for an unknown/missing value. */
export function getVipTierMeta(tier: string | null | undefined): VipTierMeta {
    if (tier && tier in TIER_META) {
        return TIER_META[tier as VipTier];
    }
    return TIER_META.bronze;
}

/**
 * Format an indexer percentage field (integer scaled x100) as a percent string.
 * e.g. 2550 -> "25.50%". null/undefined -> "0.00%".
 */
export function formatScaledPercent(scaled: number | null | undefined): string {
    const value = (scaled ?? 0) / 100;
    return `${value.toFixed(2)}%`;
}
