import { renderHook } from "@testing-library/react";
import { PlayerDTO } from "@block52/poker-vm-sdk";
import { usePlayersBySeat } from "./usePlayersBySeat";
import { useGameData } from "../../context/gameState/GameDataContext";

jest.mock("../../context/gameState/GameDataContext");

const mockedUseGameData = useGameData as jest.MockedFunction<typeof useGameData>;

const player = (seat: number, address: string): PlayerDTO =>
    ({ seat, address } as unknown as PlayerDTO);

describe("usePlayersBySeat", () => {
    afterEach(() => jest.clearAllMocks());

    it("indexes players by their seat number", () => {
        mockedUseGameData.mockReturnValue({
            gameState: { players: [player(1, "0xa"), player(5, "0xb")] } as any
        });

        const { result } = renderHook(() => usePlayersBySeat());

        expect(result.current.get(1)?.address).toBe("0xa");
        expect(result.current.get(5)?.address).toBe("0xb");
        expect(result.current.get(3)).toBeUndefined();
        expect(result.current.size).toBe(2);
    });

    it("returns an empty map when there is no game state", () => {
        mockedUseGameData.mockReturnValue({ gameState: undefined });

        const { result } = renderHook(() => usePlayersBySeat());

        expect(result.current.size).toBe(0);
    });

    it("returns an empty map when players is not an array", () => {
        mockedUseGameData.mockReturnValue({
            gameState: { players: undefined } as any
        });

        const { result } = renderHook(() => usePlayersBySeat());

        expect(result.current.size).toBe(0);
    });

    it("returns a stable map reference while the players array is unchanged", () => {
        const players = [player(2, "0xc")];
        mockedUseGameData.mockReturnValue({ gameState: { players } as any });

        const { result, rerender } = renderHook(() => usePlayersBySeat());
        const first = result.current;
        rerender();

        expect(result.current).toBe(first);
    });

    it("keeps the last player when two share a seat (matches prior find() semantics)", () => {
        // Array.find returns the FIRST match; a Map keyed by seat keeps the LAST
        // write. Seats are unique in real game state, so this only documents the
        // degenerate case — flagged so a future dup-seat bug is loud, not silent.
        mockedUseGameData.mockReturnValue({
            gameState: { players: [player(1, "0xfirst"), player(1, "0xsecond")] } as any
        });

        const { result } = renderHook(() => usePlayersBySeat());

        expect(result.current.get(1)?.address).toBe("0xsecond");
    });
});
