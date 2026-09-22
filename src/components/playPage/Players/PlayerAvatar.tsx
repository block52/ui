import * as React from "react";
import { memo, useEffect, useMemo, useState } from "react";
import { ipfsCandidateUrls } from "../../../utils/profile/ipfs";
import styles from "./PlayersCommon.module.css";

interface PlayerAvatarProps {
    /** The avatar as we hold it: an `ipfs://` reference, a gateway URL, or any image URL. */
    src: string | null | undefined;
}

/**
 * A seat's avatar, with the IPFS gateway fallback chain (ui#625).
 *
 * The seat used to render one `<img>` at one hardcoded gateway and drop
 * straight to the "NFT" text chip the moment it failed — which is exactly what
 * every player saw on 2026-09-20 when `ipfs.io` answered 403 under load. An
 * avatar is content-addressed, so a failure at one gateway says nothing about
 * the image: step to the next gateway, and only show the chip once every
 * configured gateway has refused.
 */
export const PlayerAvatar: React.FC<PlayerAvatarProps> = memo(({ src }) => {
    const candidates = useMemo(() => ipfsCandidateUrls(src), [src]);
    const [attempt, setAttempt] = useState(0);

    // A new avatar starts the chain again, otherwise it inherits the old one's failures.
    useEffect(() => {
        setAttempt(0);
    }, [src]);

    if (candidates.length === 0) {
        return null;
    }

    const current = candidates[attempt];
    if (!current) {
        return <div className={`${styles.avatarChip} ${styles.avatarFallback}`}>NFT</div>;
    }

    return (
        <div className={styles.avatarChip}>
            <img
                // Keyed by URL so a retry remounts the element — a plain src swap
                // does not reliably re-fire onError for the next gateway.
                key={current}
                src={current}
                alt="Player avatar"
                className={styles.avatarImage}
                onError={() => setAttempt(previous => previous + 1)}
            />
        </div>
    );
});

PlayerAvatar.displayName = "PlayerAvatar";
