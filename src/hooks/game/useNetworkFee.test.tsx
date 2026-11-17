import { renderHook, waitFor } from "@testing-library/react";
import { useNetworkFee } from "./useNetworkFee";
import { clearNetworkFeeCache } from "../../utils/networkFee";

const mockGetNetworkFeePerEntry = jest.fn();
let mockClient: { getNetworkFeePerEntry?: () => Promise<bigint> } | null = null;

jest.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({ currentNetwork: mockNetwork })
}));
jest.mock("../../utils/cosmos/client", () => ({
    getCosmosClient: () => mockClient
}));

const mockNetwork = { name: "fixture", rpc: "https://rpc.fixture", rest: "https://rest.fixture" };

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
    clearNetworkFeeCache();
    mockGetNetworkFeePerEntry.mockReset();
    mockClient = { getNetworkFeePerEntry: mockGetNetworkFeePerEntry };
    warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    error = jest.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    warn.mockRestore();
    error.mockRestore();
});

describe("useNetworkFee", () => {
    it("reports 0.10 while loading, then the chain's fee", async () => {
        mockGetNetworkFeePerEntry.mockResolvedValue(250_000n);
        const { result } = renderHook(() => useNetworkFee());
        expect(result.current).toEqual({ networkFeeMicro: 100_000n, isLoading: true, isFallback: false });
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toEqual({ networkFeeMicro: 250_000n, isLoading: false, isFallback: false });
    });

    it("falls back to 0.10, flags it and logs when the query fails", async () => {
        mockGetNetworkFeePerEntry.mockRejectedValue(new Error("params query failed"));
        const { result } = renderHook(() => useNetworkFee());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toEqual({ networkFeeMicro: 100_000n, isLoading: false, isFallback: true });
        expect(error).toHaveBeenCalled();
    });

    it("reports a governance fee of 0 as 0", async () => {
        mockGetNetworkFeePerEntry.mockResolvedValue(0n);
        const { result } = renderHook(() => useNetworkFee());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toEqual({ networkFeeMicro: 0n, isLoading: false, isFallback: false });
    });

    it("falls back to 0.10 on an SDK without getNetworkFeePerEntry", async () => {
        mockClient = {};
        const { result } = renderHook(() => useNetworkFee());
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current).toEqual({ networkFeeMicro: 100_000n, isLoading: false, isFallback: true });
        expect(warn).toHaveBeenCalled();
    });

    it("shares one chain read between components", async () => {
        mockGetNetworkFeePerEntry.mockResolvedValue(250_000n);
        const a = renderHook(() => useNetworkFee());
        const b = renderHook(() => useNetworkFee());
        await waitFor(() => expect(a.result.current.isLoading).toBe(false));
        await waitFor(() => expect(b.result.current.isLoading).toBe(false));
        expect(b.result.current.networkFeeMicro).toBe(250_000n);
        expect(mockGetNetworkFeePerEntry).toHaveBeenCalledTimes(1);
    });
});
