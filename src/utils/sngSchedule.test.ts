import {
    getTimeZoneOffsetMs,
    getZonedWeekday,
    zonedWallTimeToUtc,
    getNextOccurrence,
    getUpcomingSngs,
    formatCountdown,
    formatUtcLabel,
    parseSngSchedule,
    type SngTournament
} from "./sngSchedule";

const TUESDAY_10: SngTournament = {
    id: "tuesday-10",
    name: "$10 Tuesday",
    buyIn: "$10",
    dayOfWeek: 2,
    hour: 18,
    minute: 0,
    timeZone: "Australia/Sydney",
    link: "https://example.com/tuesday-10"
};

const THURSDAY_50: SngTournament = {
    id: "thursday-50",
    name: "$50 Thursday",
    buyIn: "$50",
    dayOfWeek: 4,
    hour: 18,
    minute: 0,
    timeZone: "Australia/Sydney",
    link: "https://example.com/thursday-50"
};

describe("getTimeZoneOffsetMs", () => {
    it("returns +11h for Sydney in January (AEDT, daylight saving)", () => {
        // 2026-01-15T00:00:00Z — southern-hemisphere summer, Sydney is UTC+11.
        const offset = getTimeZoneOffsetMs("Australia/Sydney", new Date("2026-01-15T00:00:00Z"));
        expect(offset).toBe(11 * 60 * 60 * 1000);
    });

    it("returns +10h for Sydney in July (AEST, standard time)", () => {
        const offset = getTimeZoneOffsetMs("Australia/Sydney", new Date("2026-07-15T00:00:00Z"));
        expect(offset).toBe(10 * 60 * 60 * 1000);
    });

    it("returns 0 for UTC", () => {
        expect(getTimeZoneOffsetMs("UTC", new Date("2026-07-15T00:00:00Z"))).toBe(0);
    });
});

describe("zonedWallTimeToUtc", () => {
    it("maps 6pm AEST (July) to 08:00 UTC", () => {
        // AEST = UTC+10, so 18:00 Sydney → 08:00 UTC.
        const utc = zonedWallTimeToUtc(2026, 7, 14, 18, 0, "Australia/Sydney");
        expect(utc.toISOString()).toBe("2026-07-14T08:00:00.000Z");
    });

    it("maps 6pm AEDT (January) to 07:00 UTC", () => {
        // AEDT = UTC+11, so 18:00 Sydney → 07:00 UTC.
        const utc = zonedWallTimeToUtc(2026, 1, 13, 18, 0, "Australia/Sydney");
        expect(utc.toISOString()).toBe("2026-01-13T07:00:00.000Z");
    });
});

describe("getZonedWeekday", () => {
    it("identifies a Tuesday in Sydney", () => {
        // 2026-07-14T08:00:00Z is Tuesday 18:00 in Sydney.
        expect(getZonedWeekday("Australia/Sydney", new Date("2026-07-14T08:00:00Z"))).toBe(2);
    });
});

describe("getNextOccurrence", () => {
    it("finds the next Tuesday 6pm AEST when now is earlier that week", () => {
        // Monday 2026-07-13, midday UTC.
        const now = new Date("2026-07-13T12:00:00Z");
        const next = getNextOccurrence(TUESDAY_10, now);
        expect(next.toISOString()).toBe("2026-07-14T08:00:00.000Z");
    });

    it("rolls to next week when the current week's slot has passed", () => {
        // Tuesday 2026-07-14 at 09:00 UTC — one hour after the 08:00Z start.
        const now = new Date("2026-07-14T09:00:00Z");
        const next = getNextOccurrence(TUESDAY_10, now);
        expect(next.toISOString()).toBe("2026-07-21T08:00:00.000Z");
    });

    it("treats the exact start instant as already passed", () => {
        const now = new Date("2026-07-14T08:00:00Z");
        const next = getNextOccurrence(TUESDAY_10, now);
        expect(next.toISOString()).toBe("2026-07-21T08:00:00.000Z");
    });

    it("crosses a DST boundary correctly (AEDT ends ~April 2026)", () => {
        // Sydney leaves daylight saving on 2026-04-05. A Tuesday just after the
        // switch must resolve to the AEST (UTC+10) instant, 08:00Z.
        const now = new Date("2026-04-06T00:00:00Z");
        const next = getNextOccurrence(TUESDAY_10, now);
        expect(next.toISOString()).toBe("2026-04-07T08:00:00.000Z");
    });
});

describe("getUpcomingSngs", () => {
    it("returns tournaments sorted soonest-first", () => {
        // Monday — Tuesday's $10 comes before Thursday's $50.
        const now = new Date("2026-07-13T12:00:00Z");
        const upcoming = getUpcomingSngs([THURSDAY_50, TUESDAY_10], now, 2);
        expect(upcoming.map(u => u.id)).toEqual(["tuesday-10", "thursday-50"]);
        expect(upcoming[0].nextStart.toISOString()).toBe("2026-07-14T08:00:00.000Z");
        expect(upcoming[1].nextStart.toISOString()).toBe("2026-07-16T08:00:00.000Z");
    });

    it("limits to the requested count", () => {
        const now = new Date("2026-07-13T12:00:00Z");
        const upcoming = getUpcomingSngs([TUESDAY_10, THURSDAY_50], now, 1);
        expect(upcoming).toHaveLength(1);
        expect(upcoming[0].id).toBe("tuesday-10");
    });
});

describe("formatCountdown", () => {
    it("includes days when over 24h out", () => {
        const ms = (2 * 86_400 + 9 * 3_600 + 45 * 60 + 12) * 1000;
        expect(formatCountdown(ms)).toBe("2d 09h 45m 12s");
    });

    it("drops the day segment under 24h", () => {
        const ms = (3 * 3_600 + 5 * 60 + 9) * 1000;
        expect(formatCountdown(ms)).toBe("03h 05m 09s");
    });

    it("shows a starting message at or past zero", () => {
        expect(formatCountdown(0)).toBe("Starting now");
        expect(formatCountdown(-5000)).toBe("Starting now");
    });
});

describe("formatUtcLabel", () => {
    it("labels an instant in UTC", () => {
        expect(formatUtcLabel(new Date("2026-07-14T08:00:00Z"))).toBe("Tue 14 Jul, 08:00 UTC");
    });
});

describe("parseSngSchedule", () => {
    const valid = { tournaments: [TUESDAY_10, THURSDAY_50] };

    it("parses a valid schedule", () => {
        expect(parseSngSchedule(valid)).toEqual([TUESDAY_10, THURSDAY_50]);
    });

    it("rejects a non-object", () => {
        expect(() => parseSngSchedule(null)).toThrow();
        expect(() => parseSngSchedule("nope")).toThrow();
    });

    it("rejects an array where an object belongs", () => {
        expect(() => parseSngSchedule([])).toThrow("SNG schedule must be a JSON object");
        expect(() => parseSngSchedule({ tournaments: [[]] })).toThrow("SNG schedule entry 0 must be an object");
    });

    it("rejects a missing tournaments array", () => {
        expect(() => parseSngSchedule({})).toThrow(/tournaments/);
    });

    it("rejects an entry missing a string field", () => {
        const bad = { tournaments: [{ ...TUESDAY_10, name: "" }] };
        expect(() => parseSngSchedule(bad)).toThrow(/name/);
    });

    it("rejects an out-of-range dayOfWeek", () => {
        const bad = { tournaments: [{ ...TUESDAY_10, dayOfWeek: 7 }] };
        expect(() => parseSngSchedule(bad)).toThrow(/dayOfWeek/);
    });

    it("rejects a non-integer hour", () => {
        const bad = { tournaments: [{ ...TUESDAY_10, hour: 18.5 }] };
        expect(() => parseSngSchedule(bad)).toThrow(/hour/);
    });
});
