/**
 * usePlayerNote / usePlayerNotesBook (ui#947): the viewer's private notes on
 * other players, in localStorage, shared by every seat and kept in step with
 * other tabs.
 */
import { renderHook, act } from "@testing-library/react";
import { STORAGE_COSMOS_ADDRESS } from "../../utils/cosmos/storage";
import { playerNotesStorageKey } from "../../utils/playerNotes";
import { getNotesOwner, resetPlayerNotesCache, usePlayerNote, usePlayerNotesBook } from "./usePlayerNotes";

const ME = "b521viewer";
const VILLAIN = "b521Villain";

beforeEach(() => {
    localStorage.clear();
    resetPlayerNotesCache();
    localStorage.setItem(STORAGE_COSMOS_ADDRESS, ME);
});

describe("getNotesOwner", () => {
    it("is the connected cosmos wallet", () => {
        expect(getNotesOwner()).toBe(ME);
    });

    it("falls back to the guest book with no wallet", () => {
        localStorage.removeItem(STORAGE_COSMOS_ADDRESS);
        expect(getNotesOwner()).toBe("guest");
    });
});

describe("usePlayerNote", () => {
    it("starts with no note", () => {
        const { result } = renderHook(() => usePlayerNote(VILLAIN));
        expect(result.current.note).toBeNull();
    });

    it("saves text and tags under the viewer's key", () => {
        const { result } = renderHook(() => usePlayerNote(VILLAIN));
        act(() => result.current.saveNote("  overplays top pair ", ["aggressive", "fish"]));

        expect(result.current.note).toEqual(expect.objectContaining({ text: "overplays top pair", tags: ["fish", "aggressive"] }));
        const stored = JSON.parse(localStorage.getItem(playerNotesStorageKey(ME)) ?? "{}");
        expect(Object.keys(stored.notes)).toEqual(["b521villain"]);
    });

    it("updates every seat showing the same player", () => {
        const a = renderHook(() => usePlayerNote(VILLAIN));
        const b = renderHook(() => usePlayerNote(VILLAIN.toLowerCase()));
        act(() => a.result.current.saveNote("", ["shark"]));
        expect(b.result.current.note?.tags).toEqual(["shark"]);
    });

    it("removes the note when cleared", () => {
        const { result } = renderHook(() => usePlayerNote(VILLAIN));
        act(() => result.current.saveNote("x", ["fish"]));
        act(() => result.current.clearNote());
        expect(result.current.note).toBeNull();
        expect(JSON.parse(localStorage.getItem(playerNotesStorageKey(ME)) ?? "{}").notes).toEqual({});
    });

    it("keeps notes per viewer wallet", () => {
        const { result } = renderHook(() => usePlayerNote(VILLAIN));
        act(() => result.current.saveNote("mine", []));

        localStorage.setItem(STORAGE_COSMOS_ADDRESS, "b521someoneelse");
        const other = renderHook(() => usePlayerNote(VILLAIN));
        expect(other.result.current.note).toBeNull();
    });

    it("does nothing without a player address", () => {
        const { result } = renderHook(() => usePlayerNote(undefined));
        act(() => result.current.saveNote("x", ["fish"]));
        expect(result.current.note).toBeNull();
        expect(localStorage.getItem(playerNotesStorageKey(ME))).toBeNull();
    });

    it("picks up a write from another tab", () => {
        const { result } = renderHook(() => usePlayerNote(VILLAIN));
        const key = playerNotesStorageKey(ME);
        const value = JSON.stringify({ version: 1, notes: { b521villain: { text: "from tab 2", tags: ["tilter"], updatedAt: 9 } } });
        act(() => {
            localStorage.setItem(key, value);
            window.dispatchEvent(new StorageEvent("storage", { key, newValue: value }));
        });
        expect(result.current.note).toEqual({ text: "from tab 2", tags: ["tilter"], updatedAt: 9 });
    });

    it("ignores storage events for other keys", () => {
        const { result } = renderHook(() => usePlayerNote(VILLAIN));
        act(() => result.current.saveNote("kept", []));
        act(() => {
            window.dispatchEvent(new StorageEvent("storage", { key: "something_else", newValue: "1" }));
        });
        expect(result.current.note?.text).toBe("kept");
    });
});

describe("usePlayerNotesBook", () => {
    it("returns every note the viewer has", () => {
        const one = renderHook(() => usePlayerNote("b521a"));
        const two = renderHook(() => usePlayerNote("b521b"));
        act(() => one.result.current.saveNote("", ["fish"]));
        act(() => two.result.current.saveNote("nit", ["tight"]));
        const { result } = renderHook(() => usePlayerNotesBook());
        expect(Object.keys(result.current).sort()).toEqual(["b521a", "b521b"]);
    });
});
