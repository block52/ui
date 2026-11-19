import { renderHook, waitFor } from "@testing-library/react";
import type { NetworkEndpoints } from "../../context/NetworkContext";
import { useRecoveredHands } from "./useRecoveredHands";
import { recoverUnlistedHands } from "../../utils/handHistoryRecover";

jest.mock("../../context/IndexerApiContext", () => ({
    useIndexerApi: () => ({ getPlayerSessions: jest.fn(), getHands: jest.fn() })
}));
jest.mock("../../context/CosmosApiContext", () => ({
    useCometRpcApiFactory: () => () => ({ txSearch: jest.fn(), abciQuery: jest.fn() })
}));
jest.mock("../../utils/handHistoryRecover", () => ({
    historySessionPageSize: 100,
    historyGameHandPageSize: 1000,
    recoverUnlistedHands: jest.fn()
}));

const recover = recoverUnlistedHands as jest.MockedFunction<typeof recoverUnlistedHands>;

const network: NetworkEndpoints = {
    name: "Texas Hodl",
    rpc: "https://node.texashodl.net/rpc/",
    rest: "https://node.texashodl.net",
    grpc: "grpcs://node.texashodl.net:9443",
    ws: "wss://node.texashodl.net/ws"
};

function pendingRecover(): Promise<{ hands: never[]; states: Map<string, never> }> {
    return new Promise(() => {
        /* leave in flight so a restart is visible */
    });
}

beforeEach(() => {
    recover.mockReset();
    recover.mockImplementation(pendingRecover);
});

test("does not restart when extraGameIds is a new array of the same tables, or endedHands is a new function", async () => {
    const { rerender } = renderHook(
        ({ extra, ended }: { extra?: string[]; ended?: () => Promise<never[]> }) =>
            useRecoveredHands("b521player", [], true, [network], extra || ended ? { extraGameIds: extra, endedHands: ended } : undefined),
        { initialProps: { extra: undefined as string[] | undefined, ended: undefined as (() => Promise<never[]>) | undefined } }
    );

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));
    rerender({ extra: undefined, ended: undefined });
    rerender({ extra: [], ended: async () => [] });
    rerender({ extra: [], ended: async () => [] });
    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(1);
});

test("restarts only when the extra table list actually changes", async () => {
    const { rerender } = renderHook(
        ({ extra }: { extra: string[] }) => useRecoveredHands("b521player", [], true, [network], { extraGameIds: extra }),
        { initialProps: { extra: [] as string[] } }
    );

    await waitFor(() => expect(recover).toHaveBeenCalledTimes(1));
    rerender({ extra: ["0xabc-t1"] });
    await waitFor(() => expect(recover).toHaveBeenCalledTimes(2));
    rerender({ extra: ["0xabc-t1"] });
    await Promise.resolve();
    expect(recover).toHaveBeenCalledTimes(2);
});
