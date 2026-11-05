import { FC } from "react";
import { Link } from "react-router-dom";
import { useProfileAvatar } from "../../context/profile/ProfileAvatarContext";
import { NftAvatarImage } from "../profile/NftAvatarImage";
import { hasContent, hasElements } from "../../utils/guards";
import type { PlayerAward } from "../../utils/playerAwards";
import { truncateMiddle } from "../../utils/stringUtils";
import styles from "./AwardCard.module.css";

interface AwardAddressProps {
    address: string;
    /** Resolved registered-NFT image, or null when none is registered yet. */
    avatarUrl: string | null;
    linkClassName: string;
    chipClassName: string;
}

/**
 * Truncated address, with the player's registered NFT beside it when one resolves.
 * A failed image drops the circle and leaves the address on its own.
 */
const AwardAddress: FC<AwardAddressProps> = ({ address, avatarUrl, linkClassName, chipClassName }) => (
    <Link to={`/players/${address}`} className={linkClassName}>
        {hasContent(avatarUrl) && (
            <NftAvatarImage
                src={avatarUrl}
                alt=""
                imgClassName={styles.avatarImage}
                chipClassName={chipClassName}
                fallbackClassName={chipClassName}
                hideOnExhausted
            />
        )}
        {truncateMiddle(address, 12, 8)}
    </Link>
);

/** One award: the winner with the evidence, then the runners-up with just their number. */
export const AwardCard: FC<{ award: PlayerAward }> = ({ award }) => {
    // Same lookup seats use. The profile context caches one chain query (and one
    // image resolution) per address for the session, so an address on several
    // cards does not hit RPC or Alchemy again.
    const { getAvatarForAddress } = useProfileAvatar();
    const [winner, ...runnersUp] = award.podium;
    return (
        <article className={`rounded-lg p-4 flex flex-col ${styles.card}`}>
            <h2 className="text-lg font-semibold text-white">
                <span aria-hidden="true">{award.emoji}</span> {award.title}
            </h2>
            <p className="text-xs text-gray-400 mt-1">{award.measure}</p>

            <AwardAddress
                address={winner.address}
                avatarUrl={getAvatarForAddress(winner.address)}
                linkClassName={`mt-3 inline-flex items-center gap-2 font-mono text-sm font-semibold hover:underline ${styles.winner}`}
                chipClassName={`${styles.avatar} ${styles.avatarWinner}`}
            />
            <p className="text-sm text-gray-200 mt-1">{winner.evidence}</p>

            {hasElements(runnersUp) && (
                <div className="mt-auto pt-3">
                    <ol className={`pt-2 text-xs ${styles.runnersUp}`}>
                        {runnersUp.map(entry => (
                            <li key={entry.address} className="flex justify-between gap-3 py-0.5">
                                <AwardAddress
                                    address={entry.address}
                                    avatarUrl={getAvatarForAddress(entry.address)}
                                    linkClassName="inline-flex min-w-0 items-center gap-1.5 font-mono text-gray-300 hover:underline"
                                    chipClassName={`${styles.avatar} ${styles.avatarRunner}`}
                                />
                                <span className="text-gray-300 tabular-nums">{entry.stat}</span>
                            </li>
                        ))}
                    </ol>
                </div>
            )}
        </article>
    );
};
