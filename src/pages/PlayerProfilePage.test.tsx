import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { PlayerProfile, PlayerSession, PlayerSessionsResponse } from "@block52/poker-ui-core/types/players";
import PlayerProfilePage from "./PlayerProfilePage";
import { useIndexerApi } from "../context/IndexerApiContext";

// A factory mock: the real module reads import.meta.env, which Jest can't parse.
jest.mock("../context/IndexerApiContext", () => ({ useIndexerApi: jest.fn() }));
jest.mock("../components/common/AnimatedBackground", () => ({ AnimatedBackground: () => null }));
// The common barrel pulls in colorConfig (import.meta.env); the page only needs Pagination from it.
jest.mock("../components/common", () => ({ Pagination: () => null }));

const ADDRESS = "b521profiletest";
const getPlayerProfile = jest.fn();
const getPlayerSessions = jest.fn();

const profile = (overrides: Partial<PlayerProfile> = {}): PlayerProfile => ({
    player_address: ADDRESS,
    total_hands: 200,
    total_actions: 1000,
    total_buy_ins: 5_000_000,
    total_cash_outs: 6_000_000,
    net_profit: 1_000_000,
    session_count: 3,
    avg_session_length: 100,
    vip_tier: "bronze",
    rakeback_pct: 0,
    vip_points: 0,
    total_rake_contributed: 0,
    current_month_rake: 0,
    vpip: 2550,
    pfr: 1200,
    aggression_factor: 127,
    wtsd: 3000,
    won_at_showdown: 5000,
    total_bets: 10,
    total_raises: 9,
    total_calls: 15,
    total_folds: 40,
    total_checks: 20,
    biggest_pot_won: 0,
    biggest_hand_profit: 0,
    longest_session_blocks: 0,
    ...overrides
});

const session = (game_id: string, overrides: Partial<PlayerSession> = {}): PlayerSession => ({
    player_address: ADDRESS,
    game_id,
    join_block: 100,
    leave_block: 150,
    buy_in_amount: 2_000_000,
    cash_out_amount: 2_500_000,
    created_at: "2026-11-20T00:00:00Z",
    ...overrides
});

const page = (data: PlayerSession[], extra: Partial<PlayerSessionsResponse> = {}): PlayerSessionsResponse => ({
    data,
    pagination: { limit: 20, offset: 0, total: data.length },
    ...extra
});

const GAMES = [
    { game_format: "sit-and-go", game_variant: "texas-holdem", sessions: 2 },
    { game_format: "cash", game_variant: "omaha", sessions: 1 }
];

function renderProfile() {
    return render(
        <MemoryRouter initialEntries={[`/players/${ADDRESS}`]}>
            <Routes>
                <Route path="/players/:address" element={<PlayerProfilePage />} />
            </Routes>
        </MemoryRouter>
    );
}

describe("PlayerProfilePage", () => {
    beforeEach(() => {
        getPlayerProfile.mockReset();
        getPlayerSessions.mockReset();
        (useIndexerApi as jest.Mock).mockReturnValue({ getPlayerProfile, getPlayerSessions });
        getPlayerProfile.mockResolvedValue(profile());
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
    });

    it("labels each session with its game, and shows an unfinished one as open", async () => {
        getPlayerSessions.mockResolvedValue(
            page(
                [
                    session("0xopen000000000000000000000000000001", {
                        leave_block: undefined,
                        cash_out_amount: undefined,
                        game_format: "sit-and-go",
                        game_variant: "texas-holdem"
                    }),
                    session("0xcash000000000000000000000000000002", { game_format: "cash", game_variant: "omaha" })
                ],
                { games: GAMES }
            )
        );
        renderProfile();

        const rows = await screen.findAllByRole("row");
        const [, open, cash] = rows;
        expect(within(open).getByText("Sit & Go · Texas Hold'em")).toBeInTheDocument();
        expect(within(open).getByText("Open")).toBeInTheDocument();
        expect(within(open).queryByText("$0.00")).not.toBeInTheDocument();
        expect(within(cash).getByText("Cash Game · Omaha")).toBeInTheDocument();
        expect(within(cash).getByText("$2.50")).toBeInTheDocument();
        expect(within(cash).queryByText("Open")).not.toBeInTheDocument();
    });

    it("filters the history by game on the indexer, from page 1", async () => {
        getPlayerSessions.mockResolvedValue(page([session("0xa")], { games: GAMES }));
        renderProfile();

        const menu = await screen.findByRole("combobox", { name: "Filter sessions by game" });
        expect(
            within(menu)
                .getAllByRole("option")
                .map(o => o.textContent)
        ).toEqual(["All games", "Sit & Go · Texas Hold'em (2)", "Cash Game · Omaha (1)"]);

        fireEvent.change(menu, { target: { value: "cash:omaha" } });
        await waitFor(() => expect(getPlayerSessions).toHaveBeenLastCalledWith(ADDRESS, 20, 0, { game_format: "cash", game_variant: "omaha" }));

        fireEvent.change(menu, { target: { value: "all" } });
        await waitFor(() => expect(getPlayerSessions).toHaveBeenLastCalledWith(ADDRESS, 20, 0, { game_format: undefined, game_variant: undefined }));
    });

    it("shows plain game ids and no menu on an indexer without game details", async () => {
        getPlayerSessions.mockResolvedValue(page([session("0xabcdef0000000000000000000000000000123456")]));
        renderProfile();

        await screen.findByText("Session History");
        await screen.findByText("0xabcdef...123456");
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.queryByText(/Texas Hold'em|Omaha/)).not.toBeInTheDocument();
    });

    it("shows dashes, not 0%, for playing style when the player has no hands", async () => {
        getPlayerProfile.mockResolvedValue(profile({ total_hands: 0, vpip: 0, pfr: 0, wtsd: 0, won_at_showdown: 0, aggression_factor: 0 }));
        getPlayerSessions.mockResolvedValue(page([]));
        renderProfile();

        await screen.findByText("Playing Style");
        expect(screen.queryByText("0.00%")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "About VPIP" })).toBeInTheDocument();
        expect(screen.getAllByText("—")).toHaveLength(5);
    });

    it("refreshes when the tab comes back, keeping the page on screen, and keeps it if the refresh fails", async () => {
        getPlayerSessions.mockResolvedValue(page([session("0xa")], { games: GAMES }));
        renderProfile();
        await screen.findByText("Playing Style");
        expect(getPlayerProfile).toHaveBeenCalledTimes(1);

        getPlayerProfile.mockResolvedValueOnce(profile({ vpip: 4100 }));
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(screen.queryByText("Loading player...")).not.toBeInTheDocument();
        await screen.findByText("41.00%");
        expect(getPlayerSessions).toHaveBeenCalledTimes(2);

        jest.spyOn(console, "error").mockImplementation(() => {});
        getPlayerProfile.mockRejectedValueOnce(new Error("indexer down"));
        await act(async () => {
            // Past the focus coalescing window.
            await new Promise(resolve => setTimeout(resolve, 300));
            window.dispatchEvent(new Event("focus"));
        });
        await waitFor(() => expect(getPlayerProfile).toHaveBeenCalledTimes(3));
        expect(screen.getByText("41.00%")).toBeInTheDocument();
        expect(screen.queryByText("indexer down")).not.toBeInTheDocument();
    });
});
