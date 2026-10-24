import { renderHook, act } from "@testing-library/react";
import { useTableNameError, NAME_CHECK_DEBOUNCE_MS } from "./useTableNameError";
import { fetchTableNameAvailable } from "../../utils/tableName";

jest.mock("../../context/NetworkContext", () => ({ useNetwork: () => ({ currentNetwork: { rest: "http://localhost:1317" } }) }));
jest.mock("../../utils/tableName", () => ({
    ...jest.requireActual("../../utils/tableName"),
    fetchTableNameAvailable: jest.fn()
}));
const mockAvailable = fetchTableNameAvailable as jest.MockedFunction<typeof fetchTableNameAvailable>;

async function afterDebounce(): Promise<void> {
    await act(async () => {
        jest.advanceTimersByTime(NAME_CHECK_DEBOUNCE_MS);
        await Promise.resolve();
        await Promise.resolve();
    });
}

describe("useTableNameError (ui#878)", () => {
    beforeEach(() => {
        jest.useFakeTimers();
        mockAvailable.mockReset();
    });
    afterEach(() => jest.useRealTimers());

    it("shows 'already taken' once the chain says the name is claimed", async () => {
        mockAvailable.mockResolvedValue(false);
        const { result } = renderHook(() => useTableNameError("callfix-876"));
        expect(result.current).toBeNull(); // not before the check comes back
        await afterDebounce();
        expect(mockAvailable).toHaveBeenCalledWith("http://localhost:1317", "callfix-876", expect.anything());
        expect(result.current).toBe("“callfix-876” is already taken — pick another name.");
    });

    it("no error when the name is free", async () => {
        mockAvailable.mockResolvedValue(true);
        const { result } = renderHook(() => useTableNameError("brand-new"));
        await afterDebounce();
        expect(result.current).toBeNull();
    });

    it("checks the normalized name (case-insensitive like the chain)", async () => {
        mockAvailable.mockResolvedValue(false);
        const { result } = renderHook(() => useTableNameError("  CallFix-876 "));
        await afterDebounce();
        expect(mockAvailable).toHaveBeenCalledWith("http://localhost:1317", "callfix-876", expect.anything());
        expect(result.current).toContain("already taken");
    });

    it("waits for typing to pause: one check, for the final name", async () => {
        mockAvailable.mockResolvedValue(true);
        const { rerender } = renderHook(({ name }) => useTableNameError(name), { initialProps: { name: "f" } });
        rerender({ name: "fr" });
        rerender({ name: "fri" });
        await afterDebounce();
        expect(mockAvailable).toHaveBeenCalledTimes(1);
        expect(mockAvailable).toHaveBeenCalledWith("http://localhost:1317", "fri", expect.anything());
    });

    it("a taken answer for an old spelling never shows on the new one", async () => {
        mockAvailable.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
        const { result, rerender } = renderHook(({ name }) => useTableNameError(name), { initialProps: { name: "taken" } });
        await afterDebounce();
        expect(result.current).toContain("already taken");
        rerender({ name: "taken-2" });
        expect(result.current).toBeNull();
        await afterDebounce();
        expect(result.current).toBeNull();
    });

    it("format errors win and skip the chain check; blank names are free", async () => {
        const { result, rerender } = renderHook(({ name }) => useTableNameError(name), { initialProps: { name: "bad name!" } });
        await afterDebounce();
        expect(result.current).toMatch(/lowercase letters/);
        rerender({ name: "" });
        await afterDebounce();
        expect(result.current).toBeNull();
        expect(mockAvailable).not.toHaveBeenCalled();
    });

    it("an unknown answer (network error) doesn't block the name", async () => {
        mockAvailable.mockResolvedValue(null);
        const { result } = renderHook(() => useTableNameError("friday"));
        await afterDebounce();
        expect(result.current).toBeNull();
    });
});
