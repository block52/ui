import * as React from "react";
import { createPortal } from "react-dom";
import { usePlayerNote } from "../../../hooks/player/usePlayerNotes";
import { truncateMiddle } from "../../../utils/stringUtils";
import {
    MAX_PLAYER_NOTE_LENGTH,
    PLAYER_NOTE_TAGS,
    isPlayerNoteDraftChanged,
    placeNotesPanel,
    togglePlayerNoteTag,
    type NotesPanelPlacement,
    type PlayerNoteTagId
} from "../../../utils/playerNotes";
import styles from "./PlayerNotes.module.css";

type PlayerNotesPanelProps = {
    playerAddress: string;
    seat: number;
    /** The seat element the panel grows out of. */
    anchor: HTMLElement | null;
    onClose: () => void;
};

/**
 * Notes box for one player (ui#947): preset tag icons plus free text. OK saves
 * (no text and no tags removes the note); Cancel, Esc, or a click outside with
 * nothing changed closes without saving. Ctrl/Cmd+Enter is OK.
 */
export const PlayerNotesPanel: React.FC<PlayerNotesPanelProps> = ({ playerAddress, seat, anchor, onClose }) => {
    const { note, saveNote, clearNote } = usePlayerNote(playerAddress);
    const [text, setText] = React.useState<string>(note?.text ?? "");
    const [tags, setTags] = React.useState<PlayerNoteTagId[]>(note?.tags ?? []);
    const [placement, setPlacement] = React.useState<NotesPanelPlacement | null>(null);
    const panelRef = React.useRef<HTMLDivElement>(null);
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);

    const isDirty = isPlayerNoteDraftChanged(note, text, tags);

    // Place the panel beside the seat once its real size is known, and again on resize.
    React.useLayoutEffect(() => {
        const place = () => {
            const panel = panelRef.current;
            if (!panel || !anchor) return;
            setPlacement(
                placeNotesPanel(
                    anchor.getBoundingClientRect(),
                    { width: window.innerWidth, height: window.innerHeight },
                    { width: panel.offsetWidth, height: panel.offsetHeight }
                )
            );
        };
        place();
        window.addEventListener("resize", place);
        return () => window.removeEventListener("resize", place);
    }, [anchor]);

    React.useEffect(() => {
        textareaRef.current?.focus({ preventScroll: true });
    }, []);

    const handleToggleTag = React.useCallback((id: PlayerNoteTagId) => setTags(prev => togglePlayerNoteTag(prev, id)), []);

    const handleSave = React.useCallback(() => {
        saveNote(text, tags);
        onClose();
    }, [saveNote, text, tags, onClose]);

    const handleClear = React.useCallback(() => {
        clearNote();
        onClose();
    }, [clearNote, onClose]);

    const handleBackdrop = React.useCallback(() => {
        if (!isDirty) onClose();
    }, [isDirty, onClose]);

    const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent) => {
            // Keep table shortcuts from firing while typing.
            e.stopPropagation();
            if (e.key === "Escape") {
                e.preventDefault();
                onClose();
            } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSave();
            }
        },
        [onClose, handleSave]
    );

    const panelStyle: React.CSSProperties = placement
        ? { left: placement.left, top: placement.top, transformOrigin: placement.origin }
        : { left: 0, top: 0, visibility: "hidden" };

    return createPortal(
        <>
            <div className={styles.backdrop} onClick={handleBackdrop} data-testid="player-notes-backdrop" />
            <div
                ref={panelRef}
                className={styles.panel}
                style={panelStyle}
                role="dialog"
                aria-modal="true"
                aria-label={`Notes on seat ${seat}`}
                onKeyDown={handleKeyDown}
                onClick={e => e.stopPropagation()}
                data-testid="player-notes-panel"
            >
                <div className={styles.header}>
                    <div>
                        <div className={styles.title}>Player notes</div>
                        <div className={styles.subtitle} title={playerAddress}>
                            Seat {seat} · {truncateMiddle(playerAddress, 8, 6)}
                        </div>
                    </div>
                    <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close notes">
                        ×
                    </button>
                </div>

                <div className={styles.sectionLabel}>Tags</div>
                <div className={styles.tagGrid}>
                    {PLAYER_NOTE_TAGS.map(tag => {
                        const selected = tags.includes(tag.id);
                        return (
                            <button
                                key={tag.id}
                                type="button"
                                className={`${styles.tagButton} ${selected ? styles.tagButtonSelected : ""}`}
                                onClick={() => handleToggleTag(tag.id)}
                                title={tag.description}
                                aria-pressed={selected}
                                data-testid={`player-note-tag-${tag.id}`}
                            >
                                <span className={styles.tagButtonIcon} aria-hidden="true">
                                    {tag.icon}
                                </span>
                                {tag.label}
                            </button>
                        );
                    })}
                </div>

                <label className={styles.sectionLabel} htmlFor={`player-notes-${seat}`}>
                    Notes
                </label>
                <textarea
                    id={`player-notes-${seat}`}
                    ref={textareaRef}
                    className={styles.textarea}
                    value={text}
                    maxLength={MAX_PLAYER_NOTE_LENGTH}
                    onChange={e => setText(e.target.value)}
                    placeholder="e.g. 3-bets light on the button, folds to river pressure"
                    data-testid="player-notes-text"
                />
                <div className={styles.counter}>
                    {text.length}/{MAX_PLAYER_NOTE_LENGTH}
                </div>

                <div className={styles.footer}>
                    {note && (
                        <button type="button" className={styles.clearButton} onClick={handleClear}>
                            Delete note
                        </button>
                    )}
                    <div className={styles.footerSpacer} />
                    <button type="button" className={styles.cancelButton} onClick={onClose}>
                        Cancel
                    </button>
                    <button type="button" className={styles.okButton} onClick={handleSave} data-testid="player-notes-ok">
                        OK
                    </button>
                </div>
                <div className={styles.hint}>Only you see these. Saved in this browser, and they follow this player to every table.</div>
            </div>
        </>,
        document.body
    );
};
