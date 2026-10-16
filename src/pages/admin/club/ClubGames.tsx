import React from "react";
import { Link } from "react-router-dom";
import { ClubAdminLayout } from "./ClubAdminLayout";

/** Game management area (ui#795) — scaffold. */
const ClubGames: React.FC = () => (
    <ClubAdminLayout
        title="Game Management"
        subtitle="Open and pre-stage games so they're ready on the platform for players."
        planned={[
            "Operator-scoped view of the club's live and staged games.",
            "Open a cash table or schedule an SNG, ready to go for players.",
            "Set stakes, format and seating; start / close games.",
            "Builds on the existing table admin, scoped to the operator."
        ]}
    >
        <div className="rounded-lg border border-gray-700 px-5 py-8 text-center">
            <p className="text-gray-400 text-sm mb-4">Reuses the existing table admin while this area is built out.</p>
            <Link
                to="/admin/tables"
                className="inline-flex items-center px-4 py-2 rounded-lg border border-pink-500/40 text-pink-300 text-sm hover:bg-pink-500/10 transition-colors"
            >
                Open Table Admin
            </Link>
        </div>
    </ClubAdminLayout>
);

export default ClubGames;
