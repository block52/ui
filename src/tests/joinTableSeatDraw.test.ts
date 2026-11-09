import { GameFormat, TexasHoldemStateDTO, TxExecutionError } from "@block52/poker-vm-sdk";
import { joinTable, MAX_SEAT_DRAW_ATTEMPTS } from "../hooks/playerActions/joinTable";
import type { NetworkEndpoints } from "../context/NetworkContext";

// ui#969: a Sit & Go join draws its seat; when another join takes that seat
// first the chain rejects ours with ErrSeatTaken (1110) and we redraw from
// the seats still open. A cash join keeps the seat the player chose.

const mockJoinGame = jest.fn();
let mockState: TexasHoldemStateDTO | undefined;

jest.mock("../utils/cosmos/client", () => ({
    withMoneyMoverRetry: (_network: unknown, fn: (client: unknown) => Promise<unknown>) => fn({ signingClient: { joinGame: mockJoinGame } })
}));
jest.mock("../hooks/playerActions/transportAction", () => ({
    getLatestGameState: () => mockState
}));

const state = (maxPlayers: number, occupiedSeats: number[]): TexasHoldemStateDTO =>
    ({
        gameOptions: { maxPlayers },
        players: occupiedSeats.map(seat => ({ seat }))
    } as unknown as TexasHoldemStateDTO);

const network = {} as NetworkEndpoints;
const seatTaken = (seat: number) =>
    new TxExecutionError("join game", { transactionHash: `TX${seat}`, code: 1110, rawLog: `seat ${seat} is already claimed in this block: seat already taken` });
const seatOf = (call: unknown[]) => call[1] as number;

beforeEach(() => {
    mockJoinGame.mockReset();
    jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe("joinTable at a Sit & Go", () => {
    it("joins at a drawn empty seat, never a seat the caller named", async () => {
        mockState = state(6, [1, 2, 3]);
        mockJoinGame.mockResolvedValue("HASH");
        const result = await joinTable("table", { amount: "1.00", seatNumber: 1, format: GameFormat.SIT_AND_GO }, network);
        expect([4, 5, 6]).toContain(result.seat);
        expect(seatOf(mockJoinGame.mock.calls[0])).toBe(result.seat);
        expect(result.hash).toBe("HASH");
        expect(result.buyInAmount).toBe("1000000");
    });

    it("redraws without the lost seat when another join took it first", async () => {
        mockState = state(3, [1]);
        mockJoinGame.mockImplementationOnce((_id: string, seat: number) => Promise.reject(seatTaken(seat))).mockResolvedValueOnce("HASH");
        const result = await joinTable("table", { amount: "1.00", format: GameFormat.SIT_AND_GO }, network);
        const [first, second] = mockJoinGame.mock.calls.map(seatOf);
        expect(mockJoinGame).toHaveBeenCalledTimes(2);
        expect(second).not.toBe(first);
        expect([2, 3]).toContain(second);
        expect(result.seat).toBe(second);
    });

    it(`gives up after ${MAX_SEAT_DRAW_ATTEMPTS} lost seats and surfaces the rejection`, async () => {
        mockState = state(9, []);
        mockJoinGame.mockImplementation((_id: string, seat: number) => Promise.reject(seatTaken(seat)));
        await expect(joinTable("table", { amount: "1.00", format: GameFormat.SIT_AND_GO }, network)).rejects.toBeInstanceOf(TxExecutionError);
        expect(mockJoinGame).toHaveBeenCalledTimes(MAX_SEAT_DRAW_ATTEMPTS);
        expect(new Set(mockJoinGame.mock.calls.map(seatOf)).size).toBe(MAX_SEAT_DRAW_ATTEMPTS);
    });

    it("stops with 'No available seats' once every open seat is lost", async () => {
        mockState = state(2, [1]);
        mockJoinGame.mockImplementation((_id: string, seat: number) => Promise.reject(seatTaken(seat)));
        await expect(joinTable("table", { amount: "1.00", format: GameFormat.SIT_AND_GO }, network)).rejects.toThrow("No available seats");
        expect(mockJoinGame).toHaveBeenCalledTimes(1);
    });

    it("doesn't redraw on any other rejection", async () => {
        mockState = state(6, []);
        const insufficient = new TxExecutionError("join game", { transactionHash: "TX", code: 5, rawLog: "insufficient funds" });
        mockJoinGame.mockRejectedValue(insufficient);
        await expect(joinTable("table", { amount: "1.00", format: GameFormat.SIT_AND_GO }, network)).rejects.toBe(insufficient);
        expect(mockJoinGame).toHaveBeenCalledTimes(1);
    });
});

describe("joinTable at a cash table", () => {
    it("joins the chosen seat and doesn't redraw when it's taken", async () => {
        mockState = state(6, []);
        mockJoinGame.mockRejectedValue(seatTaken(4));
        await expect(joinTable("table", { amount: "1.00", seatNumber: 4, format: GameFormat.CASH }, network)).rejects.toBeInstanceOf(TxExecutionError);
        expect(mockJoinGame).toHaveBeenCalledTimes(1);
        expect(seatOf(mockJoinGame.mock.calls[0])).toBe(4);
    });
});

it("refuses to join before the table's format has loaded", async () => {
    mockState = state(6, []);
    await expect(joinTable("table", { amount: "1.00", format: undefined }, network)).rejects.toThrow("game format not loaded yet");
    expect(mockJoinGame).not.toHaveBeenCalled();
});
