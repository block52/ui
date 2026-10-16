import React from "react";
import { ClubAdminLayout } from "./ClubAdminLayout";

/** Players & KYC area (ui#795) — scaffold. */
const ClubPlayersKyc: React.FC = () => (
    <ClubAdminLayout
        title="Players & KYC"
        subtitle="Everyone playing on the club, with KYC status and account standing."
        planned={[
            "Searchable, filterable player list (KYC'd / non-KYC'd / pending).",
            "KYC status badge per player; drill into verification state (provider TBD).",
            "Balances, VIP tier and rakeback % (from the indexer — ui#589).",
            "Recent sessions and lifetime rake per player.",
            "Link straight to Hand Review for any player."
        ]}
    >
        {/* Placeholder table shell — no real player data wired yet. */}
        <div className="rounded-lg border border-gray-700 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-5 py-3 bg-gray-900/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <span>Player</span>
                <span>KYC</span>
                <span>VIP / Rakeback</span>
                <span>Lifetime rake</span>
            </div>
            <div className="px-5 py-10 text-center text-gray-500 text-sm">Player data connects here.</div>
        </div>
    </ClubAdminLayout>
);

export default ClubPlayersKyc;
