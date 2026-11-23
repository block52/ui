import {
    truncateHash,
    formatTimestampRelative,
    formatTimestampAbsolute,
    formatDuration
} from "./formatUtils";

describe("formatUtils", () => {
    describe("truncateHash", () => {
        it("should truncate long hash with default length", () => {
            const hash = "abcdef1234567890abcdef1234567890";
            expect(truncateHash(hash)).toBe("abcdef12...34567890");
        });

        it("should truncate hash with custom length", () => {
            const hash = "abcdef1234567890";
            expect(truncateHash(hash, 4)).toBe("abcd...7890");
        });

        it("should return original hash if shorter than truncation length", () => {
            const hash = "abc123";
            expect(truncateHash(hash, 8)).toBe("abc123");
        });

        it("should return N/A for empty hash", () => {
            expect(truncateHash("")).toBe("N/A");
        });

        it("should return N/A for undefined hash", () => {
            expect(truncateHash(undefined as any)).toBe("N/A");
        });

        it("should return N/A for null hash", () => {
            expect(truncateHash(null as any)).toBe("N/A");
        });
    });

    describe("formatTimestampRelative", () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.useRealTimers();
        });

        it("should format seconds ago", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T11:59:30Z");
            expect(formatTimestampRelative(timestamp)).toBe("30 seconds ago");
        });

        it("should format 1 second ago (singular)", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T11:59:59Z");
            expect(formatTimestampRelative(timestamp)).toBe("1 second ago");
        });

        it("should format minutes ago", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T11:55:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("5 minutes ago");
        });

        it("should format 1 minute ago (singular)", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T11:59:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("1 minute ago");
        });

        it("should format hours ago", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T10:00:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("2 hours ago");
        });

        it("should format 1 hour ago (singular)", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T11:00:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("1 hour ago");
        });

        it("should format days ago", () => {
            const now = new Date("2024-01-05T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T12:00:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("4 days ago");
        });

        it("should format 1 day ago (singular)", () => {
            const now = new Date("2024-01-02T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T12:00:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("1 day ago");
        });

        it("should handle string timestamp", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = "2024-01-01T11:55:00Z";
            expect(formatTimestampRelative(timestamp)).toBe("5 minutes ago");
        });

        it("should handle Date object", () => {
            const now = new Date("2024-01-01T12:00:00Z");
            jest.setSystemTime(now);

            const timestamp = new Date("2024-01-01T11:55:00Z");
            expect(formatTimestampRelative(timestamp)).toBe("5 minutes ago");
        });
    });

    describe("formatTimestampAbsolute", () => {
        it("should format Date object as locale string", () => {
            const date = new Date("2024-01-01T12:00:00Z");
            const result = formatTimestampAbsolute(date);
            expect(result).toContain("2024");
            expect(typeof result).toBe("string");
        });

        it("should format ISO string as locale string", () => {
            const timestamp = "2024-01-01T12:00:00Z";
            const result = formatTimestampAbsolute(timestamp);
            expect(result).toContain("2024");
            expect(typeof result).toBe("string");
        });
    });

    describe("formatDuration", () => {
        it("should format seconds only (MM:SS)", () => {
            expect(formatDuration(45)).toBe("00:45");
        });

        it("should format minutes and seconds (MM:SS)", () => {
            expect(formatDuration(125)).toBe("02:05");
        });

        it("should format hours, minutes and seconds (HH:MM:SS)", () => {
            expect(formatDuration(3665)).toBe("01:01:05");
        });

        it("should pad single digits with zeros", () => {
            expect(formatDuration(65)).toBe("01:05");
            expect(formatDuration(3605)).toBe("01:00:05");
        });

        it("should handle zero duration", () => {
            expect(formatDuration(0)).toBe("00:00");
        });

        it("should handle large durations", () => {
            expect(formatDuration(86399)).toBe("23:59:59");
        });

        it("should format exactly 1 minute", () => {
            expect(formatDuration(60)).toBe("01:00");
        });

        it("should format exactly 1 hour", () => {
            expect(formatDuration(3600)).toBe("01:00:00");
        });
    });
});
