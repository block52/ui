/**
 * VIP tier badge (ui#589). Shows the tier label and, optionally, the rakeback %.
 */

import React from "react";
import type { VipTier } from "../../types/players";
import { getVipTierMeta } from "../../utils/vip";

interface VipBadgeProps {
    tier: VipTier | string | null | undefined;
    rakebackPct?: number;
    showRakeback?: boolean;
    className?: string;
}

export const VipBadge: React.FC<VipBadgeProps> = ({ tier, rakebackPct, showRakeback = false, className = "" }) => {
    const meta = getVipTierMeta(tier);
    const pct = rakebackPct ?? meta.rakebackPct;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${meta.badgeClass} ${className}`}>
            {meta.label}
            {showRakeback && pct > 0 && <span className="font-normal opacity-80">· {pct}% rakeback</span>}
        </span>
    );
};
