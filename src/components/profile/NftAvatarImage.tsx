import React, { useEffect, useMemo, useState } from "react";
import { parseIpfsRef, ipfsGatewayUrl, ipfsGatewayCount } from "../../utils/profile/ipfs";

interface NftAvatarImageProps {
    /** The resolved avatar URL (may be an ipfs gateway URL, ipfs://, CDN, or data:). */
    src: string;
    alt: string;
    imgClassName: string;
    /** Class for the chip wrapper around the <img>. */
    chipClassName: string;
    /** Class(es) applied to the "NFT" fallback chip when every source fails. */
    fallbackClassName: string;
}

/**
 * Renders an NFT avatar with an IPFS gateway fallback chain (ui#625).
 *
 * A single public gateway is a runtime liability — `ipfs.io` 403'd a live avatar
 * (CORP `same-origin`) mid-session and the seat fell straight to the "NFT" chip.
 * When `src` is an IPFS ref we walk every gateway in IPFS_GATEWAYS on error
 * before giving up; non-IPFS sources (Alchemy CDN, data:) just try once. The
 * chip and placeholder styling are passed in so seats keep their existing look.
 */
export const NftAvatarImage: React.FC<NftAvatarImageProps> = ({ src, alt, imgClassName, chipClassName, fallbackClassName }) => {
    const ref = useMemo(() => parseIpfsRef(src), [src]);
    // Candidate URLs to try, in order: for an IPFS ref, one per gateway; else the
    // single source as given.
    const candidates = useMemo(() => {
        if (ref) {
            return Array.from({ length: ipfsGatewayCount() }, (_, i) => ipfsGatewayUrl(ref, i));
        }
        return [src];
    }, [ref, src]);

    const [attempt, setAttempt] = useState(0);

    // Reset when the avatar changes.
    useEffect(() => {
        setAttempt(0);
    }, [src]);

    const exhausted = attempt >= candidates.length;

    if (exhausted || candidates.length === 0) {
        return <div className={fallbackClassName}>NFT</div>;
    }

    return (
        <div className={chipClassName}>
            <img
                src={candidates[attempt]}
                alt={alt}
                className={imgClassName}
                // Step to the next gateway/source; when all are spent the next
                // render shows the "NFT" chip.
                onError={() => setAttempt(a => a + 1)}
            />
        </div>
    );
};

export default NftAvatarImage;
