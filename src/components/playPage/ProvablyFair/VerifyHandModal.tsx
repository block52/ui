/**
 * VerifyHandModal (ui#972)
 *
 * "Verify this hand": recomputes a finished hand's deck from the seed in its
 * new-hand transaction and checks the board and every hand shown at showdown
 * against it. A running hand shows the checks as pending and reads nothing —
 * its seed would give away every card.
 *
 * Layout follows the PlayBlind reference: verdict banner, the checks, the
 * cards as dealt, then every input needed to redo it, with copy buttons and a
 * downloadable record. The table stays visible behind the overlay.
 */
import React, { useCallback, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useHandVerification } from "../../../hooks/game/useHandVerification";
import { useCopyToClipboard } from "../../../hooks/useCopyToClipboard";
import { getCardImageUrl } from "../../../utils/cardImages";
import { downloadJson } from "../../../utils/download";
import { hasContent, hasElements, hasValue } from "../../../utils/guards";
import { truncateMiddle } from "../../../utils/stringUtils";
import {
    DEAL_ORDER_DESCRIPTION,
    DERIVATION_DESCRIPTION,
    dealtHandLabel,
    placeholderChecks,
    seedDigest,
    verificationBanner,
    verificationRecord,
    verificationRecordFileName,
    type CheckStatus,
    type HandPhase
} from "../../../utils/provablyFair";
import { ShieldIcon } from "./ShieldIcon";
import styles from "./VerifyHandModal.module.css";

interface VerifyHandModalProps {
    tableId: string;
    tableName?: string;
    handNumber: number;
    phase: HandPhase;
    holeCardsPerPlayer: number;
    onClose: () => void;
}

const STATUS_MARK: Record<CheckStatus | "pending", string> = { pass: "✓", fail: "✕", skipped: "–", pending: "…" };

const Cards: React.FC<{ cards: string[]; small?: boolean; dim?: boolean }> = ({ cards, small, dim }) => (
    <span className={styles.cards}>
        {cards.map(card => (
            <img key={card} src={getCardImageUrl(card)} alt={card} title={card} className={`${small ? styles.cardSmall : styles.card} ${dim ? styles.cardDim : ""}`} />
        ))}
    </span>
);

const InputRow: React.FC<{ label: string; value: string; copy?: (text: string) => void; prose?: boolean; children?: React.ReactNode }> = ({ label, value, copy, prose, children }) => (
    <div className={styles.inputRow}>
        <span className={styles.inputLabel}>{label}</span>
        <span className={prose ? styles.inputProse : styles.inputValue}>{children ?? value}</span>
        {copy && (
            <button type="button" className={styles.copy} onClick={() => copy(value)} aria-label={`Copy ${label}`} title={`Copy ${label}`}>
                ⧉
            </button>
        )}
    </div>
);

const VerifyHandModal: React.FC<VerifyHandModalProps> = ({ tableId, tableName, handNumber, phase, holeCardsPerPlayer, onClose }) => {
    const { status, evidence, verification, startTx, endHeight, error } = useHandVerification({ tableId, handNumber, holeCardsPerPlayer, phase, enabled: true });
    const { copy } = useCopyToClipboard();
    const copyValue = useCallback((text: string) => void copy(text, "Copied"), [copy]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKey);
        return () => window.removeEventListener("keydown", handleKey);
    }, [onClose]);

    const banner = verificationBanner(status, verification, error);
    const checks = useMemo(
        () =>
            verification?.checks.map(check => ({ ...check, mark: check.status })) ??
            placeholderChecks(status === "pending" ? "Opens when the hand ends." : "Checking…").map(check => ({ ...check, mark: "pending" as const })),
        [verification, status]
    );
    const seed = evidence?.seed ?? null;
    const canDownload = status === "ready" && hasValue(evidence) && hasValue(verification);

    const download = useCallback(() => {
        if (!evidence || !verification) return;
        downloadJson(verificationRecordFileName(tableId, handNumber), verificationRecord({ tableId, handNumber, startTx, endHeight, evidence, verification }));
    }, [tableId, handNumber, startTx, endHeight, evidence, verification]);

    return createPortal(
        <div className={styles.overlay} onMouseDown={onClose} data-testid="verify-hand-overlay">
            <div className={styles.window} role="dialog" aria-modal="true" aria-label={`Verify hand ${handNumber}`} onMouseDown={e => e.stopPropagation()} data-testid="verify-hand-modal">
                <div className={styles.titleBar}>
                    <ShieldIcon className={styles.titleIcon} />
                    <span className={styles.titleText}>Verify this hand</span>
                    <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
                        ×
                    </button>
                </div>

                <div className={styles.scroll}>
                    <div className={styles.headRow}>
                        <div>
                            <h2 className={styles.handTitle}>
                                Hand #{handNumber} · {hasContent(tableName) ? tableName : truncateMiddle(tableId, 6, 4)}
                            </h2>
                            <div className={styles.handSub}>{status === "pending" ? "In play" : hasValue(endHeight) ? `Ended in block ${endHeight.toLocaleString()}` : "Finished"}</div>
                        </div>
                        <button type="button" className={styles.download} onClick={download} disabled={!canDownload} data-testid="verify-hand-download">
                            ⤓ Download record
                        </button>
                    </div>

                    <div className={`${styles.banner} ${styles[`banner_${banner.tone}`]}`} data-testid="verify-hand-banner" data-tone={banner.tone}>
                        <ShieldIcon className={styles.bannerIcon} />
                        <span>{banner.text}</span>
                    </div>

                    <ul className={styles.checks} data-testid="verify-hand-checks">
                        {checks.map(check => (
                            <li key={check.id} className={styles.check} data-check={check.id} data-status={check.mark}>
                                <span className={`${styles.mark} ${styles[`mark_${check.mark}`]}`} aria-hidden="true">
                                    {STATUS_MARK[check.mark]}
                                </span>
                                <span>
                                    <span className={styles.checkTitle}>{check.title}</span>
                                    <span className={styles.checkDetail}>{check.detail}</span>
                                </span>
                            </li>
                        ))}
                    </ul>

                    {status === "ready" && hasValue(verification) && hasElements(verification.hands) && (
                        <section className={styles.section} data-testid="verify-hand-cards">
                            <h3 className={styles.sectionTitle}>Cards as dealt</h3>
                            {verification.hands.map(hand => (
                                <div key={hand.position} className={styles.dealRow}>
                                    <span className={styles.dealLabel}>{dealtHandLabel(hand)}</span>
                                    <Cards cards={hand.cards} />
                                    {hand.shown && <span className={styles.shownTag}>shown</span>}
                                </div>
                            ))}
                            {hasElements(verification.setAside) && (
                                <div className={styles.dealRow}>
                                    <span className={styles.dealLabel}>Set aside</span>
                                    <Cards cards={verification.setAside} small dim />
                                </div>
                            )}
                            <div className={styles.dealRow}>
                                <span className={styles.dealLabel}>Board</span>
                                {hasElements(verification.board) ? <Cards cards={verification.board} /> : <span className={styles.muted}>not dealt</span>}
                            </div>
                            {verification.hands.some(hand => !hasValue(hand.seat)) && (
                                <p className={styles.note}>Seats are numbered in deal order: this hand's own end state wasn't readable, so seat numbers can't be shown.</p>
                            )}
                        </section>
                    )}

                    {status === "ready" && hasValue(evidence) && (
                        <section className={styles.section} data-testid="verify-hand-inputs">
                            <h3 className={styles.sectionTitle}>Inputs</h3>
                            <p className={styles.note}>Everything needed to redo the checks yourself.</p>
                            <div className={styles.inputs}>
                                <InputRow label="Hand" value={String(handNumber)} />
                                <InputRow label="Table" value={tableId} copy={copyValue} />
                                {hasValue(seed) && <InputRow label="Seed" value={seed} copy={copyValue} />}
                                {hasValue(seed) && <InputRow label="Seed SHA-256" value={seedDigest(seed)} copy={copyValue} />}
                                {hasValue(startTx) && (
                                    <InputRow label="Started in" value={startTx.hash} copy={copyValue}>
                                        <Link to={`/explorer/tx/${startTx.hash}`} className={styles.txLink}>
                                            {truncateMiddle(startTx.hash, 10, 8)}
                                        </Link>{" "}
                                        · block {startTx.height.toLocaleString()}
                                    </InputRow>
                                )}
                                {hasValue(endHeight) && <InputRow label="Ended in" value={`block ${endHeight.toLocaleString()}`} />}
                                <InputRow label="Shuffle" value={DERIVATION_DESCRIPTION} prose />
                                <InputRow label="Deal order" value={DEAL_ORDER_DESCRIPTION} prose />
                                {hasValue(verification?.deck) && <InputRow label="Deck" value={verification.deck.join(" ")} copy={copyValue} />}
                            </div>
                        </section>
                    )}

                    <p className={styles.footer}>
                        The same derivation runs on every validator (pokerchain <code>ShuffleFromVRF</code>) and in the SDK (<code>Deck.shuffleFromSeed</code>).
                    </p>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default VerifyHandModal;
