import { PlayerDTO, PlayerStatus } from "@block52/poker-vm-sdk";
import { computeChipStandings } from "./leaderboard";

/**
 * Minimal PlayerDTO factory — computeChipStandings only reads address, seat,
 * avatar, stack and status, so the rest is filled with inert defaults.
 */
function player(overrides: Partial<PlayerDTO> & Pick<PlayerDTO, "seat" | "stack">): PlayerDTO {
    return {
        address: `0xseat${overrides.seat}`,
        status: PlayerStatus.ACTIVE,
        avatar: undefined,
        isSmallBlind: false,
        isBigBlind: false,
        isDealer: false,
        holeCards: undefined,
        lastAction: undefined,
        legalActions: [],
        sumOfBets: "0",
        timeout: 0,
        ...overrides
    } as PlayerDTO;
}

describe("computeChipStandings", () => {
    describe("empty / missing input", () => {
        it.each([[null], [undefined], [[]]])("returns zeroed summary for %p", input => {
            expect(computeChipStandings(input as PlayerDTO[] | null | undefined)).toEqual({
                standings: [],
                totalChips: 0,
                playersRemaining: 0,
                averageStack: 0
            });
        });
    });

    describe("ranking and chip share", () => {
        it("ranks by stack descending and shares sum to 100", () => {
            const { standings, totalChips, playersRemaining, averageStack } = computeChipStandings([
                player({ seat: 1, stack: "3000" }),
                player({ seat: 2, stack: "6000" }),
                player({ seat: 3, stack: "1000" })
            ]);

            expect(standings.map(s => [s.seat, s.rank])).toEqual([
                [2, 1],
                [1, 2],
                [3, 3]
            ]);
            expect(totalChips).toBe(10000);
            expect(playersRemaining).toBe(3);
            expect(averageStack).toBeCloseTo(10000 / 3);

            expect(standings[0].pctOfChips).toBeCloseTo(60);
            expect(standings[1].pctOfChips).toBeCloseTo(30);
            expect(standings[2].pctOfChips).toBeCloseTo(10);
            const total = standings.reduce((sum, s) => sum + s.pctOfChips, 0);
            expect(total).toBeCloseTo(100);
        });

        it("reads chips directly as chip units (no USDC conversion)", () => {
            const { standings } = computeChipStandings([player({ seat: 1, stack: "1500" })]);
            expect(standings[0].stack).toBe(1500);
        });

        it("passes address and avatar through to the row", () => {
            const { standings } = computeChipStandings([
                player({ seat: 4, stack: "500", address: "0xabc", avatar: "nft://cat" })
            ]);
            expect(standings[0].address).toBe("0xabc");
            expect(standings[0].avatar).toBe("nft://cat");
        });
    });

    describe("ties", () => {
        it("uses competition ranking (two leaders → 1,1,3) and breaks ties by seat", () => {
            const { standings } = computeChipStandings([
                player({ seat: 5, stack: "4000" }),
                player({ seat: 2, stack: "4000" }),
                player({ seat: 9, stack: "1000" })
            ]);

            expect(standings.map(s => [s.seat, s.rank])).toEqual([
                [2, 1], // tie broken by lower seat first
                [5, 1],
                [9, 3] // rank skips to 3, not 2
            ]);
        });
    });

    describe("busted / eliminated players", () => {
        it("excludes busted players from the denominator and sorts them last", () => {
            const { standings, totalChips, playersRemaining } = computeChipStandings([
                player({ seat: 1, stack: "5000" }),
                player({ seat: 2, stack: "0", status: PlayerStatus.BUSTED }),
                player({ seat: 3, stack: "5000" })
            ]);

            expect(totalChips).toBe(10000);
            expect(playersRemaining).toBe(2);

            const busted = standings.find(s => s.seat === 2)!;
            expect(standings[standings.length - 1]).toBe(busted);
            expect(busted.isBusted).toBe(true);
            expect(busted.pctOfChips).toBe(0);
            // All non-live players share the rank after the live field.
            expect(busted.rank).toBe(playersRemaining + 1);
        });

        it("treats a zero or negative stack as eliminated even without BUSTED status", () => {
            const { standings, playersRemaining } = computeChipStandings([
                player({ seat: 1, stack: "100" }),
                player({ seat: 2, stack: "0" }),
                player({ seat: 3, stack: "-5" })
            ]);

            expect(playersRemaining).toBe(1);
            expect(standings.filter(s => s.isBusted).map(s => s.seat).sort()).toEqual([2, 3]);
            expect(standings.filter(s => s.isBusted).every(s => s.stack === 0)).toBe(true);
        });

        it("treats a non-numeric stack as eliminated", () => {
            const { standings, playersRemaining } = computeChipStandings([
                player({ seat: 1, stack: "2000" }),
                player({ seat: 2, stack: "not-a-number" })
            ]);
            expect(playersRemaining).toBe(1);
            const bad = standings.find(s => s.seat === 2)!;
            expect(bad.isBusted).toBe(true);
            expect(bad.stack).toBe(0);
        });

        it("reports a zeroed average when every player is eliminated", () => {
            const { totalChips, playersRemaining, averageStack, standings } = computeChipStandings([
                player({ seat: 1, stack: "0", status: PlayerStatus.BUSTED }),
                player({ seat: 2, stack: "0", status: PlayerStatus.BUSTED })
            ]);
            expect(totalChips).toBe(0);
            expect(playersRemaining).toBe(0);
            expect(averageStack).toBe(0);
            expect(standings.every(s => s.pctOfChips === 0)).toBe(true);
        });
    });
});
