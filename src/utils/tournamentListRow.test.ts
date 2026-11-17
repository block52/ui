import { tournamentListRow } from "./tournamentListRow";
import type { TournamentLobbyCard } from "./tournamentLobby";

const card = (over: Partial<TournamentLobbyCard>): TournamentLobbyCard =>
    ({
        tournamentId: "0xface4d5c",
        phase: "running",
        registered: 27,
        maxEntrants: 27,
        cost: { gross: 1_000_000n, entryFee: 0n, protocolCut: 100_000n, networkFee: 0n, total: 1_000_000n, net: 900_000n },
        ...over
    }) as TournamentLobbyCard;

describe("tournamentListRow", () => {
    it("shows the runners out of the most the tournament takes, and the buy-in", () => {
        const row = tournamentListRow(card({ registered: 27, maxEntrants: 40 }));
        expect(row.runners).toBe("27/40");
        expect(row.buyIn).toBe("$1.00");
    });

    it("shows the 0.10 network fee on top of the buy-in for a new tournament (pokerchain#476)", () => {
        const row = tournamentListRow(card({ cost: { gross: 1_000_000n, entryFee: 0n, protocolCut: 0n, networkFee: 100_000n, total: 1_100_000n, net: 1_000_000n } }));
        expect(row.buyIn).toBe("$1.00 + 0.10 network fee");
    });

    it("links a running or finished tournament to its own page", () => {
        expect(tournamentListRow(card({ phase: "running" })).action).toEqual({ label: "View", url: "/tournament/0xface4d5c" });
        expect(tournamentListRow(card({ phase: "finished" })).action).toEqual({ label: "View", url: "/tournament/0xface4d5c" });
    });

    it("sends an open tournament to the lobby to register, and says when it is full or cancelled", () => {
        expect(tournamentListRow(card({ phase: "open" })).action).toEqual({ label: "Register", url: "/tournaments" });
        expect(tournamentListRow(card({ phase: "full" })).action.label).toBe("Full");
        expect(tournamentListRow(card({ phase: "cancelled" })).action.label).toBe("Cancelled");
    });
});
