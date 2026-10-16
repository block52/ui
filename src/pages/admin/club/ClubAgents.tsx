import React from "react";
import { ClubAdminLayout } from "./ClubAdminLayout";

/** Agents area (ui#795) — scaffold. */
const ClubAgents: React.FC = () => (
    <ClubAdminLayout
        title="Agents"
        subtitle="The agents recruiting players for the club, their deals and performance."
        planned={[
            "List of agents with the players each has brought in.",
            "Per-agent rakeback deal (the % they earn on their players' rake).",
            "Performance: rake generated, active players, who's performing vs not.",
            "Agent payouts owed and paid.",
            "Add / edit an agent and their deal."
        ]}
    >
        <div className="rounded-lg border border-gray-700 overflow-hidden">
            <div className="grid grid-cols-4 gap-4 px-5 py-3 bg-gray-900/60 text-xs font-semibold uppercase tracking-wide text-gray-400">
                <span>Agent</span>
                <span>Players</span>
                <span>Rakeback deal</span>
                <span>Rake generated</span>
            </div>
            <div className="px-5 py-10 text-center text-gray-500 text-sm">Agent roster connects here.</div>
        </div>
    </ClubAdminLayout>
);

export default ClubAgents;
