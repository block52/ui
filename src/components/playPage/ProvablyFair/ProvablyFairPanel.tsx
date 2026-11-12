/**
 * ProvablyFairPanel (ui#972)
 *
 * A small non-modal "Provably fair" tab on the table, beside the Blinds tab.
 * It opens a panel that explains how Block52 deals and offers "Verify this
 * hand" for the hand in play (pending until it ends) and the last finished
 * hand, which opens the verify window.
 *
 * Non-modal like the Blinds panel: no backdrop, so the table stays clickable.
 * Dismisses on a second tab click, a click elsewhere, or Esc.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { holeCardsPerPlayer } from "@block52/poker-vm-sdk";
import { useGameStateContext } from "../../../context/GameStateContext";
import { useBlindLevel } from "../../../hooks/game/useBlindLevel";
import { DEAL_ORDER_DESCRIPTION, DERIVATION_DESCRIPTION, handPhase, previousHand } from "../../../utils/provablyFair";
import { hasValue, isNullish } from "../../../utils/guards";
import VerifyHandModal from "./VerifyHandModal";
import { ShieldIcon } from "./ShieldIcon";
import styles from "./ProvablyFairPanel.module.css";

const ProvablyFairPanel: React.FC = () => {
    const { id: tableId } = useParams<{ id: string }>();
    const { gameState, gameVariant, gameName } = useGameStateContext();
    const { isActive: blindsTabShown } = useBlindLevel();
    const [isOpen, setIsOpen] = useState(false);
    const [showHow, setShowHow] = useState(false);
    const [verifying, setVerifying] = useState<number | null>(null);
    const rootRef = useRef<HTMLDivElement>(null);

    const close = useCallback(() => setIsOpen(false), []);
    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    const toggleHow = useCallback(() => setShowHow(prev => !prev), []);
    const closeVerify = useCallback(() => setVerifying(null), []);
    // The verify window takes over from the panel.
    const openVerify = useCallback((hand: number) => {
        setIsOpen(false);
        setVerifying(hand);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") close();
        };
        const handlePointer = (e: MouseEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
        };
        window.addEventListener("keydown", handleKey);
        document.addEventListener("mousedown", handlePointer);
        return () => {
            window.removeEventListener("keydown", handleKey);
            document.removeEventListener("mousedown", handlePointer);
        };
    }, [isOpen, close]);

    const currentHand = gameState?.handNumber;
    const hasCurrentHand = hasValue(currentHand) && currentHand >= 1;
    const currentPhase = hasCurrentHand ? handPhase(gameState, currentHand) : "unknown";
    const lastHand = previousHand(gameState);

    return (
        <>
            <div ref={rootRef} className={`${styles.root} ${blindsTabShown ? styles.besideBlinds : ""}`} data-testid="provably-fair-root">
                <button
                    type="button"
                    onClick={toggle}
                    className={`${styles.tab} ${isOpen ? styles.tabOpen : ""}`}
                    aria-expanded={isOpen}
                    aria-haspopup="dialog"
                    title="How Block52 deals, and verify a hand"
                    data-testid="provably-fair-tab"
                >
                    <ShieldIcon className={styles.tabIcon} />
                    <span className={styles.tabText}>
                        <span className={styles.tabLabel}>Provably fair</span>
                        <span className={styles.tabSub}>Seed on chain</span>
                    </span>
                </button>

                {isOpen && (
                    <div className={styles.panel} role="dialog" aria-label="Provably fair deal" data-testid="provably-fair-panel">
                        <div className={styles.header}>
                            <ShieldIcon className={styles.headerIcon} />
                            <span>Provably fair deal</span>
                            <button type="button" className={styles.close} onClick={close} aria-label="Close">
                                ×
                            </button>
                        </div>

                        <p className={styles.intro}>
                            Every hand is shuffled from a seed recorded on chain in the transaction that starts it. When the hand ends you can recompute the deck
                            yourself and check every card the table showed.{" "}
                            <button type="button" className={styles.link} onClick={toggleHow} aria-expanded={showHow}>
                                {showHow ? "Hide how it works" : "How it works"}
                            </button>
                        </p>

                        {showHow && (
                            <dl className={styles.how} data-testid="provably-fair-how">
                                <dt>Shuffle</dt>
                                <dd>{DERIVATION_DESCRIPTION}.</dd>
                                <dt>Deal</dt>
                                <dd>{DEAL_ORDER_DESCRIPTION}.</dd>
                                <dt>Check</dt>
                                <dd>Every validator derives the same deck from the seed, so the board and every hand shown at showdown must sit where the deck puts them.</dd>
                            </dl>
                        )}

                        {hasCurrentHand && (
                            <section className={styles.section} data-testid="provably-fair-this-hand">
                                <div className={styles.sectionHead}>This hand #{currentHand}</div>
                                <div className={styles.row}>
                                    <span className={styles.rowLabel}>Verification</span>
                                    <span className={currentPhase === "running" ? styles.pending : styles.ready}>
                                        {currentPhase === "running" ? "opens when the hand ends" : "ready"}
                                    </span>
                                </div>
                                <button type="button" className={styles.verifyButton} onClick={() => openVerify(currentHand)} data-testid="provably-fair-verify-current">
                                    <ShieldIcon className={styles.buttonIcon} /> Verify this hand
                                </button>
                            </section>
                        )}

                        {hasValue(lastHand) && (
                            <section className={styles.section} data-testid="provably-fair-last-hand">
                                <div className={styles.sectionHead}>Previous hand #{lastHand}</div>
                                <button type="button" className={styles.verifyButton} onClick={() => openVerify(lastHand)} data-testid="provably-fair-verify-last">
                                    <ShieldIcon className={styles.buttonIcon} /> Verify hand #{lastHand}
                                </button>
                            </section>
                        )}
                    </div>
                )}
            </div>

            {!isNullish(verifying) && hasValue(tableId) && (
                <VerifyHandModal
                    tableId={tableId}
                    tableName={gameName}
                    handNumber={verifying}
                    phase={handPhase(gameState, verifying)}
                    holeCardsPerPlayer={holeCardsPerPlayer(gameVariant)}
                    onClose={closeVerify}
                />
            )}
        </>
    );
};

export default ProvablyFairPanel;
