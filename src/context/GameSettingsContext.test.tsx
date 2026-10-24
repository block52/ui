import React from "react";
import { act, renderHook } from "@testing-library/react";
import { GameSettingsProvider, useGameSettings, useStacksInBigBlinds } from "./GameSettingsContext";

const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => <GameSettingsProvider>{children}</GameSettingsProvider>;

describe("GameSettingsContext — win celebration (ui#847)", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("is on by default, so existing players see no change", () => {
        const { result } = renderHook(() => useGameSettings(), { wrapper });
        expect(result.current.winCelebration).toBe(true);
    });

    it("toggles off and back on, persisting each change", () => {
        const { result } = renderHook(() => useGameSettings(), { wrapper });

        act(() => result.current.toggleWinCelebration());
        expect(result.current.winCelebration).toBe(false);
        expect(localStorage.getItem("setting_wincelebration")).toBe("false");

        act(() => result.current.toggleWinCelebration());
        expect(result.current.winCelebration).toBe(true);
        expect(localStorage.getItem("setting_wincelebration")).toBe("true");
    });

    it("remembers the choice across a reload", () => {
        localStorage.setItem("setting_wincelebration", "false");
        const { result } = renderHook(() => useGameSettings(), { wrapper });
        expect(result.current.winCelebration).toBe(false);
    });
});

describe("GameSettingsContext — pot as chips (ui#772)", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("is off by default, so the pot stays as plain text", () => {
        const { result } = renderHook(() => useGameSettings(), { wrapper });
        expect(result.current.potAsChips).toBe(false);
    });

    it("toggles on and back off, persisting each change", () => {
        const { result } = renderHook(() => useGameSettings(), { wrapper });

        act(() => result.current.togglePotAsChips());
        expect(result.current.potAsChips).toBe(true);
        expect(localStorage.getItem("setting_potaschips")).toBe("true");

        act(() => result.current.togglePotAsChips());
        expect(result.current.potAsChips).toBe(false);
        expect(localStorage.getItem("setting_potaschips")).toBe("false");
    });

    it("remembers the choice across a reload", () => {
        localStorage.setItem("setting_potaschips", "true");
        const { result } = renderHook(() => useGameSettings(), { wrapper });
        expect(result.current.potAsChips).toBe(true);
    });
});

describe("GameSettingsContext — stacks in big blinds (ui#895)", () => {
    beforeEach(() => {
        localStorage.removeItem("setting_stacksbbcash");
        localStorage.removeItem("setting_stacksbbtournament");
    });

    it("is off by default for both formats", () => {
        const { result } = renderHook(() => ({ cash: useStacksInBigBlinds(false), tournament: useStacksInBigBlinds(true) }), { wrapper });
        expect(result.current).toEqual({ cash: false, tournament: false });
    });

    it("each format has its own switch, and the choice is remembered", () => {
        const { result } = renderHook(
            () => ({ settings: useGameSettings(), cash: useStacksInBigBlinds(false), tournament: useStacksInBigBlinds(true) }),
            { wrapper }
        );
        act(() => result.current.settings.toggleStacksInBBTournament());
        expect(result.current.tournament).toBe(true);
        expect(result.current.cash).toBe(false);
        expect(localStorage.getItem("setting_stacksbbtournament")).toBe("true");

        act(() => result.current.settings.toggleStacksInBBCash());
        expect(result.current.cash).toBe(true);

        const { result: reloaded } = renderHook(() => ({ cash: useStacksInBigBlinds(false), tournament: useStacksInBigBlinds(true) }), { wrapper });
        expect(reloaded.current).toEqual({ cash: true, tournament: true });
    });

    it("is off outside the settings provider", () => {
        const { result } = renderHook(() => useStacksInBigBlinds(true));
        expect(result.current).toBe(false);
    });
});
