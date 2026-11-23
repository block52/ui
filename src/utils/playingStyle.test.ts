import type { PlayerProfile } from "@block52/poker-ui-core/types/players";
import { formatPlayingStyle, PLAYING_STYLE_FIGURES } from "./playingStyle";

function profile(overrides: Partial<PlayerProfile>): PlayerProfile {
    return {
        player_address: "b521test",
        total_hands: 100,
        total_actions: 500,
        total_buy_ins: 0,
        total_cash_outs: 0,
        net_profit: 0,
        session_count: 1,
        avg_session_length: 0,
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
    };
}

describe("PLAYING_STYLE_FIGURES", () => {
    it("lists the five tiles in profile order, each with an explanation", () => {
        expect(PLAYING_STYLE_FIGURES.map(f => f.title)).toEqual(["VPIP", "PFR", "Aggression", "WTSD", "W$SD"]);
        for (const figure of PLAYING_STYLE_FIGURES) {
            expect(figure.name).not.toHaveLength(0);
            expect(figure.explanation).not.toHaveLength(0);
        }
    });

    it("describes WTSD over all hands dealt, as the indexer computes it, not over flops seen", () => {
        const wtsd = PLAYING_STYLE_FIGURES.find(f => f.key === "wtsd");
        expect(wtsd?.explanation).toContain("Of the hands you were dealt");
        expect(wtsd?.explanation).not.toContain("flop");
    });
});

describe("formatPlayingStyle", () => {
    it("shows the indexer's scaled percentages and aggression ratio", () => {
        const p = profile({});
        expect(formatPlayingStyle("vpip", p)).toBe("25.50%");
        expect(formatPlayingStyle("pfr", p)).toBe("12.00%");
        expect(formatPlayingStyle("wtsd", p)).toBe("30.00%");
        expect(formatPlayingStyle("won_at_showdown", p)).toBe("50.00%");
        expect(formatPlayingStyle("aggression_factor", p)).toBe("1.27");
    });

    it("shows a dash for every figure when the player has no hands", () => {
        const p = profile({ total_hands: 0, vpip: 0, pfr: 0, wtsd: 0, won_at_showdown: 0, aggression_factor: 0 });
        for (const figure of PLAYING_STYLE_FIGURES) {
            expect(formatPlayingStyle(figure.key, p)).toBe("—");
        }
    });

    it("shows a dash for aggression when the player never called, not a 0 ratio", () => {
        expect(formatPlayingStyle("aggression_factor", profile({ total_calls: 0, aggression_factor: 0 }))).toBe("—");
    });

    it("keeps a real 0% when the player has hands", () => {
        expect(formatPlayingStyle("pfr", profile({ pfr: 0 }))).toBe("0.00%");
    });
});
