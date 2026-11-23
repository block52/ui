import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWinnerInfo } from "../../../hooks/game/useWinnerInfo";
import { winnerBannerRollDistance, winnerBannerText, winnerBannerTop } from "../../../utils/winnerBanner";
import { useProfileAvatar } from "../../../context/profile/ProfileAvatarContext";
import { NftAvatarImage } from "../../profile/NftAvatarImage";
import { hasElements } from "@block52/ui-sdk/helpers";
import "./WinnerBanner.css";

/** How long the last-pot banner takes to roll across, end to end (ms). */
const BANNER_MS = 15000;

/**
 * Last-pot winner banner (ui#848): a brief, non-intrusive readout of who won the
 * last pot and how much. After a pot is awarded it rolls right-to-left across the
 * middle of the screen above the table, in and out through invisible edges — a
 * calmer alternative to the gold celebration (ui#847) that still tells you who won. Handles split pots.
 */
const WinnerBanner: React.FC = () => {
    const { winnerInfo } = useWinnerInfo();
    const { getAvatarForAddress } = useProfileAvatar();
    const [text, setText] = useState<string | null>(null);
    // The sole winner's address, for their avatar/NFT; null for a split pot.
    const [winnerAddress, setWinnerAddress] = useState<string | null>(null);
    // Measured when a banner starts, so it clears the header at any window size.
    const [top, setTop] = useState<number>(() => winnerBannerTop(null));
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const trackRef = useRef<HTMLDivElement>(null);
    const pillRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const next = winnerBannerText(winnerInfo);
        if (!next) return; // no winners this frame — leave the current banner to time out
        setText(next);
        setTop(winnerBannerTop(document.querySelector(".sub-header")?.getBoundingClientRect().bottom ?? null));
        setWinnerAddress(hasElements(winnerInfo) && winnerInfo.length === 1 ? winnerInfo[0].address : null);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setText(null), BANNER_MS);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [winnerInfo]);

    // The roll, in plain pixels measured once per banner, via the Web Animations
    // API: a pixel translate runs on the compositor, so it stays smooth while the
    // table re-renders. (Reduced motion keeps the CSS fade instead.)
    useLayoutEffect(() => {
        const track = trackRef.current;
        const pill = pillRef.current;
        if (!text || !track || !pill || typeof pill.animate !== "function") return;
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
        const distance = winnerBannerRollDistance(track.clientWidth, pill.offsetWidth);
        // The tiny rotation stops Chrome snapping the layer to whole pixels (which
        // it does to keep text crisp): at this speed the pill moves ~1px a
        // frame, and snapping turns that into a visible judder.
        const roll = pill.animate([{ transform: "translate3d(0, 0, 0) rotate(0.01deg)" }, { transform: `translate3d(${-distance}px, 0, 0) rotate(0.01deg)` }], {
            duration: BANNER_MS,
            easing: "linear",
            fill: "forwards"
        });
        return () => roll.cancel();
    }, [text]);

    if (!text) return null;

    // The winner's avatar (an NFT when they've linked one) leads the banner.
    const avatarUrl = winnerAddress ? getAvatarForAddress(winnerAddress) : null;

    // Portal to <body>: the banner rolls across the screen, so it must not be
    // positioned (or scaled) by the table stage it's mounted from. Keyed on the
    // text so a new pot restarts the roll.
    return createPortal(
        // The track is the visible window (the middle half of the screen); the
        // pill slides out of its right edge and into its left, like a train
        // through a tunnel, clipped rather than faded.
        <div key={text} ref={trackRef} className="b52-winner-banner-track" style={{ top }} role="status" aria-live="polite">
            <div ref={pillRef} className="b52-winner-banner">
                {avatarUrl && (
                    <NftAvatarImage
                        src={avatarUrl}
                        alt="Winner avatar"
                        imgClassName="b52-winner-banner__avatar"
                        chipClassName="b52-winner-banner__avatar"
                        fallbackClassName="b52-winner-banner__avatar"
                    />
                )}
                <span className="b52-winner-banner__trophy" aria-hidden="true">
                    🏆
                </span>
                <span className="b52-winner-banner__text">{text}</span>
            </div>
        </div>,
        document.body
    );
};

export default WinnerBanner;
