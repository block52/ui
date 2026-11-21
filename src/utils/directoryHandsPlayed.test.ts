import { PlayerActionType } from "@block52/poker-vm-sdk";
import type { PlayerHand, PlayerListItem } from "../types/players";
import {
    countHandsPlayedForPlayer,
    directoryHandsComplete,
    directoryHandsOrder,
    formatDirectoryHands,
    withDirectoryHands
} from "./directoryHandsPlayed";
import { readHandLogAtHeights } from "./handContribution";

jest.mock("./handContribution", () => {
    const actual = jest.requireActual("./handContribution");
    return { ...actual, readHandLogAtHeights: jest.fn() };
});

const PLAYER = "b521kjpfyeyg3watq2f978vhu48ju3xjwdp0wjgp5t";
const OTHER = "b521otherplayer";

const listedHand = (hand_number: number, game_id = "cash"): PlayerHand => ({
    game_id,
    hand_number,
    seat: 1,
    status: "",
    won_amount: 0,
    block_height: 100 + hand_number,
    community_cards: [],
    winner_count: 0
});

const network = { name: "Block52", rpc: "https://node1.block52.xyz/rpc/", rest: "https://node1.block52.xyz", grpc: "", ws: "" };

const row = (player_address: string, total_hands = 0): PlayerListItem => ({
    player_address,
    vip_tier: "bronze",
    rakeback_pct: 0,
    total_hands,
    total_actions: 0,
    net_profit: 0,
    total_rake_contributed: 0
});

describe("formatDirectoryHands", () => {
    it("shows an ellipsis while pending, the chain count when ready, and a dash on failure", () => {
        expect(formatDirectoryHands(undefined)).toBe("…");
        expect(formatDirectoryHands({ dealt: 435 })).toBe("435");
        expect(formatDirectoryHands({ dealt: 1535 })).toBe("1,535");
        expect(formatDirectoryHands({ dealt: 0 })).toBe("0");
        expect(formatDirectoryHands({ failed: true })).toBe("—");
    });
});

describe("withDirectoryHands", () => {
    it("writes the chain count onto matching rows and leaves pending rows alone", () => {
        const players = [row(PLAYER, 0), row(OTHER, 0)];
        const hands = new Map([
            [PLAYER.toLowerCase(), { dealt: 435 } as const],
            [OTHER.toLowerCase(), { failed: true } as const]
        ]);
        const next = withDirectoryHands(players, hands);
        expect(next[0].total_hands).toBe(435);
        expect(next[1].total_hands).toBe(0);
        expect(directoryHandsComplete(players, hands)).toBe(true);
        expect(directoryHandsComplete(players, new Map([[PLAYER.toLowerCase(), { dealt: 435 }]]))).toBe(false);
    });
});

describe("directoryHandsOrder", () => {
    it("puts the visible page first and drops duplicates", () => {
        const all = [row("b521a"), row("b521b"), row("b521c")];
        expect(directoryHandsOrder([all[1], all[2]], all)).toEqual(["b521b", "b521c", "b521a"]);
    });
});

describe("countHandsPlayedForPlayer", () => {
    const readHandLogAtHeightsMock = readHandLogAtHeights as jest.MockedFunction<typeof readHandLogAtHeights>;

    beforeEach(() => {
        readHandLogAtHeightsMock.mockReset();
    });

    it("counts dealt-in listed hands and skips a log the node no longer has", async () => {
        const getPlayerHands = jest.fn().mockResolvedValue({
            data: [listedHand(1), listedHand(2), listedHand(3)],
            pagination: { total: 3 }
        });
        readHandLogAtHeightsMock.mockImplementation(async hand => {
            if (hand.handNumber === 1) return { previousActions: [{ playerId: PLAYER, action: PlayerActionType.BIG_BLIND }] };
            if (hand.handNumber === 2) return { previousActions: [{ playerId: PLAYER, action: "sit-out" }] };
            return undefined;
        });

        const result = await countHandsPlayedForPlayer(PLAYER, {
            getPlayerHands,
            rpcFor: jest.fn(),
            networks: [network]
        });
        expect(result).toEqual({ dealt: 1 });
        expect(readHandLogAtHeightsMock).toHaveBeenCalledTimes(3);
    });

    it("returns failed when the hand list cannot be read, not an indexer zero", async () => {
        const result = await countHandsPlayedForPlayer(PLAYER, {
            getPlayerHands: jest.fn().mockRejectedValue(new Error("offline")),
            rpcFor: jest.fn(),
            networks: [network]
        });
        expect(result).toEqual({ failed: true });
        expect(readHandLogAtHeightsMock).not.toHaveBeenCalled();
    });
});
