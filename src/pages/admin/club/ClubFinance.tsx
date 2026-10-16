import React from "react";
import { ClubAdminLayout } from "./ClubAdminLayout";

/** Finance overview area (ui#795) — scaffold. */
const StatCard: React.FC<{ label: string }> = ({ label }) => (
    <div className="p-5 rounded-lg border border-gray-700 bg-gray-900/40">
        <div className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">{label}</div>
        <div className="text-2xl font-bold text-gray-600">—</div>
    </div>
);

const ClubFinance: React.FC = () => (
    <ClubAdminLayout
        title="Finance Overview"
        subtitle="Money in / money out for the club, with breakdowns."
        planned={[
            "Headline: deposits in, withdrawals out, net.",
            "Rake collected over a period; agent rakeback paid out.",
            "Breakdown by day / week / month.",
            "Sourced from the chain + bridge; operator-scoped."
        ]}
    >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Money in" />
            <StatCard label="Money out" />
            <StatCard label="Rake collected" />
            <StatCard label="Net" />
        </div>
    </ClubAdminLayout>
);

export default ClubFinance;
