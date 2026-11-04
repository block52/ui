import React from "react";
import { createPortal } from "react-dom";
import type { TournamentFinish } from "../../../utils/tournamentFinish";
import { winnerMomentText } from "../../../utils/tournamentFinish";
import { formatUSDCToSimpleDollars } from "../../../utils/numberUtils";
import { truncateMiddle } from "../../../utils/stringUtils";
import "./TournamentWinnerMoment.css";

const truncateAddress = (address: string): string => truncateMiddle(address, 8, 4, "…");

/**
 * The tournament-winner moment (ui#874): after the deciding hand has played out,
 * a held card naming the winner, their prize, the winning hand and the
 * runner-up's finish — shown BEFORE any results / busted modal. Timing lives in
 * useTournamentFinishMoment; the words in utils/tournamentFinish.
 *
 * Non-interactive (pointer-events: none) so the table stays usable beneath it.
 */
const TournamentWinnerMoment: React.FC<{ finish: TournamentFinish }> = ({ finish }) => {
    const text = winnerMomentText(finish, formatUSDCToSimpleDollars, truncateAddress);
    return createPortal(
        <div className="b52-tournament-winner" role="status" aria-live="assertive" data-testid="tournament-winner-moment">
            <div className="b52-tournament-winner__card">
                <div className="b52-tournament-winner__trophy" aria-hidden="true">
                    🏆
                </div>
                <div className="b52-tournament-winner__headline" data-testid="tournament-winner-headline">
                    {text.headline}
                </div>
                {text.hand && (
                    <div className="b52-tournament-winner__hand" data-testid="tournament-winner-hand">
                        {text.hand}
                    </div>
                )}
                {text.prize && (
                    <div className="b52-tournament-winner__prize" data-testid="tournament-winner-prize">
                        {text.prize}
                    </div>
                )}
                {text.runnerUp && (
                    <div className="b52-tournament-winner__runner-up" data-testid="tournament-winner-runner-up">
                        {text.runnerUp}
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
};

export default TournamentWinnerMoment;
