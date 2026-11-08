import * as React from "react";
import { isEmpty } from "../../../utils/guards";
import { describePlayerNote, summarizeSeatTags, type PlayerNote } from "../../../utils/playerNotes";
import styles from "./PlayerNotes.module.css";

type PlayerNoteTagsProps = {
    note: PlayerNote | null;
};

/**
 * The tag icons the viewer gave this player (ui#947), sitting just left of the
 * stack pill. A 📝 shows when there is note text but no tag. Hover for details.
 */
export const PlayerNoteTags: React.FC<PlayerNoteTagsProps> = React.memo(({ note }) => {
    const { icons, hiddenCount, hasText } = React.useMemo(() => summarizeSeatTags(note), [note]);
    const title = React.useMemo(() => describePlayerNote(note), [note]);

    if (isEmpty(icons) && !hasText) return null;

    return (
        <div className={styles.seatTags} title={title} data-testid="player-note-tags">
            {icons.map(tag => (
                <span key={tag.id} className={styles.seatTagIcon} role="img" aria-label={tag.label}>
                    {tag.icon}
                </span>
            ))}
            {hiddenCount > 0 && <span className={styles.seatTagMore}>+{hiddenCount}</span>}
            {isEmpty(icons) && hasText && (
                <span className={styles.seatTagIcon} role="img" aria-label="Has notes">
                    📝
                </span>
            )}
        </div>
    );
});

PlayerNoteTags.displayName = "PlayerNoteTags";
