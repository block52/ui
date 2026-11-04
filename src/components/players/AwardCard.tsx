import { FC } from "react";
import { Link } from "react-router-dom";
import { hasElements } from "../../utils/guards";
import type { PlayerAward } from "../../utils/playerAwards";
import { truncateMiddle } from "../../utils/stringUtils";
import styles from "./AwardCard.module.css";

/** One award: the winner with the evidence, then the runners-up with just their number. */
export const AwardCard: FC<{ award: PlayerAward }> = ({ award }) => {
    const [winner, ...runnersUp] = award.podium;
    return (
        <article className={`rounded-lg p-4 flex flex-col ${styles.card}`}>
            <h2 className="text-lg font-semibold text-white">
                <span aria-hidden="true">{award.emoji}</span> {award.title}
            </h2>
            <p className="text-xs text-gray-400 mt-1">{award.measure}</p>

            <Link to={`/players/${winner.address}`} className={`mt-3 font-mono text-sm font-semibold hover:underline ${styles.winner}`}>
                {truncateMiddle(winner.address, 12, 8)}
            </Link>
            <p className="text-sm text-gray-200 mt-1">{winner.evidence}</p>

            {hasElements(runnersUp) && (
                <div className="mt-auto pt-3">
                    <ol className={`pt-2 text-xs ${styles.runnersUp}`}>
                        {runnersUp.map(entry => (
                            <li key={entry.address} className="flex justify-between gap-3 py-0.5">
                                <Link to={`/players/${entry.address}`} className="font-mono text-gray-300 hover:underline">
                                    {truncateMiddle(entry.address, 12, 8)}
                                </Link>
                                <span className="text-gray-300 tabular-nums">{entry.stat}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </article>
    );
};
