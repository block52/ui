import React from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import NodesPage from "./NodesPage";

const originalFetch = global.fetch;

jest.mock("../context/NetworkContext", () => ({
    NETWORK_PRESETS: [
        {
            name: "Block52",
            rest: "https://node1.block52.xyz",
            rpc: "https://node1.block52.xyz/rpc/",
            grpc: "grpcs://node1.block52.xyz:9443",
            ws: "wss://node1.block52.xyz/ws"
        },
        {
            name: "Texas Hodl",
            rest: "https://node.texashodl.net",
            rpc: "https://node.texashodl.net/rpc/",
            grpc: "grpcs://node.texashodl.net:9443",
            ws: "wss://node.texashodl.net/ws"
        },
        {
            name: "Miller Services",
            rest: "https://node.tommillerservices.com",
            rpc: "https://node.tommillerservices.com/rpc/",
            grpc: "grpcs://node.tommillerservices.com:9443",
            ws: "wss://node.tommillerservices.com/ws"
        },
        { name: "Stub", rest: "http://localhost:8546", rpc: "http://localhost:8546", grpc: "http://localhost:8546", ws: "ws://localhost:8546/ws" },
        { name: "Localhost", rest: "http://localhost:1317", rpc: "http://localhost:26657", grpc: "http://localhost:9090", ws: "ws://localhost:26657/websocket" }
    ],
    useNetwork: () => ({ addDiscoveredNetwork: jest.fn(), discoveredNetworks: [] })
}));

jest.mock("../context/CosmosApiContext", () => {
    const validators = [
        { description: { moniker: "node1" }, operator_address: "block52valoper", status: "BOND_STATUS_BONDED" },
        { description: { moniker: "millerservices" }, operator_address: "millervaloper", status: "BOND_STATUS_BONDED" }
    ];
    const apiFactory = (rest: string) => ({
        getLatestBlock: jest.fn(() =>
            rest.startsWith("http://localhost") ? Promise.reject(new Error("stub is offline")) : Promise.resolve({ block: { header: { height: "42" } } })
        ),
        getValidatorsByStatus: jest.fn().mockResolvedValue({ validators })
    });
    return { useCosmosApiFactory: () => apiFactory };
});

jest.mock("../components/common/AnimatedBackground", () => ({ AnimatedBackground: () => null }));
jest.mock("../components/explorer/ExplorerHeader", () => ({ ExplorerHeader: () => null }));
jest.mock("../components/common/LoadingSpinner", () => ({ LoadingSpinner: () => null }));
jest.mock("../components/explorer/ValidatorEarningsPanel", () => ({ __esModule: true, default: () => null }));
jest.mock("../hooks/game/useValidatorBonds", () => ({
    useValidatorBonds: () => ({ bonds: [], hasQuery: false, isLoading: false })
}));
jest.mock("../services/nodeDiscovery", () => ({
    discoverNodes: jest.fn().mockResolvedValue([]),
    probeNodes: jest.fn().mockResolvedValue([]),
    getCachedNodes: jest.fn().mockReturnValue(null),
    cacheNodes: jest.fn(),
    clearNodeCache: jest.fn()
}));
// Keep this test focused on node classification rather than the newer
// information tabs and their Vite-only dependencies under coverage.
jest.mock(
    "../hooks/nodes/useChainOverview",
    () => ({
        useChainOverview: () => ({ overview: null, isLoading: false, error: null, refresh: async () => {} })
    }),
    { virtual: true }
);
jest.mock("../components/nodes/NetworkInfoPanel", () => ({ NetworkInfoPanel: () => null }), { virtual: true });
jest.mock("../components/nodes/RunNodePanel", () => ({ RunNodePanel: () => null }), { virtual: true });
jest.mock("../components/nodes/BecomeValidatorPanel", () => ({ BecomeValidatorPanel: () => null }), { virtual: true });
jest.mock("react-router-dom", () => ({ Link: () => null }), { virtual: true });

describe("NodesPage validator classification", () => {
    afterEach(() => {
        global.fetch = originalFetch;
        jest.clearAllMocks();
    });

    it("uses each preset node's voting power when names do not match staking monikers", async () => {
        global.fetch = jest.fn(async (input: RequestInfo | URL) => {
            const url = String(input);
            const votingPower = url.includes("block52") || url.includes("tommillerservices") ? "10" : "0";
            return {
                ok: true,
                json: async () => ({ result: { validator_info: { voting_power: votingPower } } })
            } as Response;
        }) as typeof fetch;

        render(<NodesPage />);

        await waitFor(() => {
            const block52Row = screen.getByText("Block52").closest("tr");
            expect(block52Row).not.toBeNull();
            expect(within(block52Row as HTMLElement).getByText("Validator")).toBeInTheDocument();
        });

        const texasRow = screen.getByText("Texas Hodl").closest("tr");
        const millerRow = screen.getByText("Miller Services").closest("tr");
        expect(within(texasRow as HTMLElement).getByText("Sync")).toBeInTheDocument();
        expect(within(millerRow as HTMLElement).getByText("Validator")).toBeInTheDocument();
        const stubRow = screen.getByText("Stub").closest("tr");
        expect(within(stubRow as HTMLElement).getByText("Offline")).toBeInTheDocument();
        expect(screen.getByText("Validators").parentElement).toHaveTextContent(/2\s*Validators/);
        expect(screen.getByText("Sync Nodes").parentElement).toHaveTextContent(/2\s*Sync Nodes/);
    });

    it("keeps an online node classified as Sync when the RPC response omits voting power", async () => {
        global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ result: {} }) }) as Response) as typeof fetch;

        render(<NodesPage />);

        await waitFor(() => {
            const block52Row = screen.getByText("Block52").closest("tr");
            expect(within(block52Row as HTMLElement).getByText("Sync")).toBeInTheDocument();
            expect(within(block52Row as HTMLElement).getByText("Online")).toBeInTheDocument();
        });
    });

    it.each(["returns a non-success response", "rejects the request"])(
        "keeps an online node classified as Sync when its RPC status request %s",
        async failure => {
            global.fetch = jest.fn(async (input: RequestInfo | URL) => {
                if (String(input).includes("node1.block52.xyz")) {
                    if (failure === "rejects the request") {
                        throw new Error("RPC unavailable");
                    }
                    return { ok: false } as Response;
                }
                return {
                    ok: true,
                    json: async () => ({ result: { validator_info: { voting_power: "0" } } })
                } as Response;
            }) as typeof fetch;

            render(<NodesPage />);

            await waitFor(() => {
                const block52Row = screen.getByText("Block52").closest("tr");
                expect(within(block52Row as HTMLElement).getByText("Sync")).toBeInTheDocument();
                expect(within(block52Row as HTMLElement).getByText("Online")).toBeInTheDocument();
            });
        }
    );
});
