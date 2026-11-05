import { renderHook } from "@testing-library/react";
import { useFrozenWhile } from "./useFrozenWhile";

describe("useFrozenWhile (ui#944)", () => {
    const run = () =>
        renderHook(({ value, frozen }: { value: number; frozen: boolean }) => useFrozenWhile(value, frozen), {
            initialProps: { value: 32, frozen: false }
        });

    it("follows the value while not frozen", () => {
        const { result, rerender } = run();
        rerender({ value: 31, frozen: false });
        expect(result.current).toBe(31);
    });

    it("holds the value from the moment it freezes", () => {
        const { result, rerender } = run();
        rerender({ value: 32, frozen: true });
        rerender({ value: 28, frozen: true });
        expect(result.current).toBe(32);
    });

    it("returns to the real value if the move is refused", () => {
        const { result, rerender } = run();
        rerender({ value: 32, frozen: true });
        rerender({ value: 27, frozen: false });
        expect(result.current).toBe(27);
    });
});
