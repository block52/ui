import React from "react";
import { ClubAdminLayout } from "./ClubAdminLayout";

/** Hand review / collusion area (ui#795) — scaffold. */
const ClubHandReview: React.FC = () => (
    <ClubAdminLayout
        title="Hand Review"
        subtitle="Review specific hands to check for collusion and chip dumping."
        planned={[
            "Look up a player and list their recent hands.",
            "Open any hand in the existing replayer (poker-vm#2644 / ui#724).",
            "Pair analysis: players who are at the table together unusually often.",
            "Flags for chip-dumping patterns (soft play, one-way transfers).",
            "Mark a hand/pair as reviewed or escalate."
        ]}
    >
        <div className="rounded-lg border border-gray-700 px-5 py-10 text-center text-gray-500 text-sm">
            Search a player to load hands for review.
        </div>
    </ClubAdminLayout>
);

export default ClubHandReview;
