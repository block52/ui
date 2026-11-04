import { useCallback, useSyncExternalStore } from "react";
import { getCosmosAddress } from "../../utils/cosmos/storage";
import { hasContent, hasValue, isNullish } from "../../utils/guards";
import {
    GUEST_NOTES_OWNER,
    PLAYER_NOTES_STORAGE_PREFIX,
    buildPlayerNote,
    normalizeNoteAddress,
    parsePlayerNotesStore,
    playerNotesStorageKey,
    serializePlayerNotesStore,
    upsertPlayerNote,
    type PlayerNote
} from "../../utils/playerNotes";

/**
 * Player notes store (ui#947). One parsed book per viewer, cached so every seat
 * reads the same object, and re-read when another tab writes (multi-tabling).
 */
type NotesBook = Record<string, PlayerNote>;

const EMPTY_BOOK: NotesBook = {};
const cache = new Map<string, NotesBook>();
const listeners = new Set<() => void>();

const notify = (): void => listeners.forEach(listener => listener());

const readBook = (owner: string): NotesBook => {
    const key = playerNotesStorageKey(owner);
    const cached = cache.get(key);
    if (cached) return cached;
    let book: NotesBook = EMPTY_BOOK;
    try {
        book = parsePlayerNotesStore(localStorage.getItem(key));
    } catch (err) {
        console.error("Failed to read player notes:", err);
    }
    cache.set(key, book);
    return book;
};

const writeBook = (owner: string, book: NotesBook): void => {
    const key = playerNotesStorageKey(owner);
    cache.set(key, book);
    try {
        localStorage.setItem(key, serializePlayerNotesStore(book));
    } catch (err) {
        console.error("Failed to save player notes:", err);
    }
    notify();
};

const onStorage = (event: StorageEvent): void => {
    // A null key means the whole of storage was cleared.
    if (hasValue(event.key) && !event.key.startsWith(PLAYER_NOTES_STORAGE_PREFIX)) return;
    if (isNullish(event.key)) {
        cache.clear();
    } else {
        cache.delete(event.key);
    }
    notify();
};

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    if (listeners.size === 1) window.addEventListener("storage", onStorage);
    return () => {
        listeners.delete(listener);
        if (listeners.size === 0) window.removeEventListener("storage", onStorage);
    };
};

/** The wallet the notes belong to; spectators without a wallet share a guest book. */
export const getNotesOwner = (): string => {
    const address = getCosmosAddress();
    return hasContent(address) ? address : GUEST_NOTES_OWNER;
};

/** Test hook: forget cached books so a test starts from localStorage. */
export const resetPlayerNotesCache = (): void => {
    cache.clear();
};

export type UsePlayerNoteReturn = {
    note: PlayerNote | null;
    saveNote: (text: string, tags: readonly string[]) => void;
    clearNote: () => void;
};

/**
 * The viewer's note on one player, by address. `saveNote` with no text and no
 * tags removes the note. Every seat showing the same player updates together.
 */
export function usePlayerNote(playerAddress: string | null | undefined): UsePlayerNoteReturn {
    const owner = getNotesOwner();
    const book = useSyncExternalStore(subscribe, () => readBook(owner), () => EMPTY_BOOK);
    const note = hasContent(playerAddress) ? book[normalizeNoteAddress(playerAddress)] ?? null : null;

    const saveNote = useCallback(
        (text: string, tags: readonly string[]) => {
            if (!hasContent(playerAddress)) return;
            const next = upsertPlayerNote(readBook(owner), playerAddress, buildPlayerNote(text, tags, Date.now()));
            writeBook(owner, next);
        },
        [owner, playerAddress]
    );

    const clearNote = useCallback(() => saveNote("", []), [saveNote]);

    return { note, saveNote, clearNote };
}

/** The viewer's whole notes book, keyed by lower-cased player address. */
export function usePlayerNotesBook(): NotesBook {
    const owner = getNotesOwner();
    return useSyncExternalStore(subscribe, () => readBook(owner), () => EMPTY_BOOK);
}
