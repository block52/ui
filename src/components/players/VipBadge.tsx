import React from "react";
import type { VipTier } from "../../types/players";
import { getVipTierMeta } from "../../utils/vip";

interface VipBadgeProps {
    tier: VipTier | string | null | undefined;
    rakebackPct?: number;
    showRakeback?: boolean;
    className?: string;
}

// The tier badge text is a pale 200/300 shade for dark surfaces; light mode needs the dark shade of the same hue.
const LIGHT_TEXT_BY_LABEL: Record<string, string> = {
    Diamond: "[[data-theme=light]_&]:text-cyan-800",
    Platinum: "[[data-theme=light]_&]:text-slate-700",
    Gold: "[[data-theme=light]_&]:text-amber-800",
    Silver: "[[data-theme=light]_&]:text-gray-700",
    Bronze: "[[data-theme=light]_&]:text-orange-800"
};

export const VipBadge: React.FC<VipBadgeProps> = ({ tier, rakebackPct, showRakeback = false, className = "" }) => {
    const meta = getVipTierMeta(tier);
    const pct = rakebackPct ?? meta.rakebackPct;

    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${meta.badgeClass} ${LIGHT_TEXT_BY_LABEL[meta.label]} ${className}`}>
            {meta.label}
            {showRakeback && pct > 0 && <span className="font-normal opacity-80">· {pct}% rakeback</span>}
        </span>
    );
};
