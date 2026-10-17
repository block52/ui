import { probeNodeEndpoints } from "./nodeDiscovery";

const endpoints = {
    name: "Node",
    rest: "https://node.example",
    rpc: "https://node.example/rpc/",
    grpc: "grpcs://node.example:9443",
    ws: "wss://node.example/ws"
};

function response(body: unknown): Response {
    return { ok: true, json: async () => body } as Response;
}

describe("probeNodeEndpoints", () => {
    const originalFetch = global.fetch;

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it("uses RPC voting power to identify a validator", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce(response({ result: { validator_info: { voting_power: "10" } } }))
            .mockResolvedValueOnce(response({ block: { header: { height: "42", chain_id: "block52" } } })) as typeof fetch;

        await expect(probeNodeEndpoints(endpoints)).resolves.toEqual({
            reachable: true,
            blockHeight: "42",
            chainId: "block52",
            isValidator: true
        });
    });

    it("does not classify a node with zero voting power as a validator", async () => {
        global.fetch = jest
            .fn()
            .mockResolvedValueOnce(response({ result: { validator_info: { voting_power: "0" } } }))
            .mockResolvedValueOnce(response({ block: { header: { height: "42", chain_id: "block52" } } })) as typeof fetch;

        await expect(probeNodeEndpoints(endpoints)).resolves.toMatchObject({ isValidator: false });
    });
});
