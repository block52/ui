import { renderHook } from "@testing-library/react";
import { useFetchSngClaimSignature } from "./useFetchSngClaimSignature";

jest.mock("../../context/NetworkContext", () => ({
    useNetwork: () => ({
        currentNetwork: {
            name: "test",
            rpc: "http://localhost:26657",
            rest: "https://node1.example.com",
            grpc: "localhost:9090",
            ws: "ws://localhost:26657/websocket",
        },
    }),
}));

jest.mock("../../utils/cosmos/urls", () => ({
    getCosmosUrls: (net: { rest: string }) => ({
        rpcEndpoint: "http://localhost:26657",
        restEndpoint: net.rest,
    }),
}));

// Helper to fake a Response — TS doesn't have a public constructor
// shape for Response in node, so this is the cleanest path.
const fakeResponse = (overrides: Partial<Response>) => overrides as unknown as Response;

describe("useFetchSngClaimSignature", () => {
    const fetchMock = jest.fn();
    const originalFetch = global.fetch;

    beforeAll(() => {
        global.fetch = fetchMock as unknown as typeof global.fetch;
    });
    afterAll(() => {
        global.fetch = originalFetch;
    });
    beforeEach(() => {
        fetchMock.mockReset();
    });

    const renderFetch = () => {
        const { result } = renderHook(() => useFetchSngClaimSignature());
        return result.current.fetchSignature;
    };

    it("hits the canonical chain endpoint with url-encoded params", async () => {
        fetchMock.mockResolvedValueOnce(fakeResponse({
            ok: true,
            statusText: "OK",
            json: async () => ({
                recipient: "0xabc",
                game_id: "0xdef",
                place: 1,
                payout: "1000000",
                timestamp: "1747300000",
                format: "0xff",
                signature: "0xsig",
            }),
        }));

        const fn = renderFetch();
        await fn("0xdef", "b521xxx");

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock.mock.calls[0][0]).toBe(
            "https://node1.example.com/block52/pokerchain/poker/v1/sng_claim_signature/0xdef/b521xxx",
        );
    });

    it("translates the chain's snake_case response into the typed SngClaimPayload (timestamp as number)", async () => {
        fetchMock.mockResolvedValueOnce(fakeResponse({
            ok: true,
            statusText: "OK",
            json: async () => ({
                recipient: "0xabc",
                game_id: "0xdef",
                place: 2,
                payout: "400000",
                timestamp: "1747300000",
                format: "0xff",
                signature: "0xsig",
            }),
        }));

        const fn = renderFetch();
        const payload = await fn("0xdef", "b521xxx");
        expect(payload).toEqual({
            recipient: "0xabc",
            gameId: "0xdef",
            place: 2,
            payout: "400000",
            timestamp: 1747300000,
            format: "0xff",
            signature: "0xsig",
        });
    });

    it("surfaces the chain's structured error message on a 4xx", async () => {
        fetchMock.mockResolvedValueOnce(fakeResponse({
            ok: false,
            statusText: "Bad Request",
            json: async () => ({
                code: 3,
                message: "unpaid finish at place 4 — no NFT to claim",
            }),
        }));

        const fn = renderFetch();
        await expect(fn("0xdef", "b521xxx")).rejects.toThrow(
            /unpaid finish at place 4/,
        );
    });

    it("throws when the chain returns ok but with no signature (defensive)", async () => {
        fetchMock.mockResolvedValueOnce(fakeResponse({
            ok: true,
            statusText: "OK",
            json: async () => ({}),
        }));

        const fn = renderFetch();
        await expect(fn("0xdef", "b521xxx")).rejects.toThrow(
            /empty SNG claim signature payload/,
        );
    });

    it("falls back to statusText when the error body isn't JSON", async () => {
        fetchMock.mockResolvedValueOnce(fakeResponse({
            ok: false,
            statusText: "Service Unavailable",
            json: async () => {
                throw new Error("not json");
            },
        }));

        const fn = renderFetch();
        await expect(fn("0xdef", "b521xxx")).rejects.toThrow(
            /Service Unavailable/,
        );
    });
});
