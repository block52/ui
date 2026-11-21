import type { PlayerListItem } from "../types/players";
import { playersPage, sortPlayers } from "./playerDirectory";

const row = (player_address: string, net_profit: number, total_hands = 0): PlayerListItem => ({
    player_address,
    vip_tier: "bronze",
    rakeback_pct: 0,
    total_hands,
    total_actions: 0,
    net_profit,
    total_rake_contributed: 0
});

describe("playersPage", () => {
    const players = [row("b521b", -50), row("b521a", 10), row("b521c", 10)];

    it("sorts by the given net and pages", () => {
        expect(playersPage(players, "net_profit", "desc", 2, 0).map(player => player.player_address)).toEqual(["b521a", "b521c"]);
        expect(playersPage(players, "net_profit", "desc", 2, 2).map(player => player.player_address)).toEqual(["b521b"]);
    });

    it("breaks a tie on the address so the page does not shuffle", () => {
        expect(sortPlayers(players, "net_profit", "asc").map(player => player.player_address)).toEqual(["b521b", "b521a", "b521c"]);
    });

    it("sorts hands without changing a row", () => {
        const ranked = [row("b521b", 0, 3), row("b521a", 0, 9)];
        expect(playersPage(ranked, "total_hands", "desc", 1, 0)[0].player_address).toBe("b521a");
    });
});
