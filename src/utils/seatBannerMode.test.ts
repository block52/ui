import { seatBannerMode } from "./seatBannerMode";

const none = { isWinner: false, isOnTheClock: false, hasActionBadge: false, hasSeatJoinNotice: false, hasStatusLine: false };

describe("seatBannerMode (ui#944)", () => {
    it("is hidden with nothing to show", () => {
        expect(seatBannerMode(none)).toBe("hidden");
    });

    it("shows the winner over everything", () => {
        expect(seatBannerMode({ ...none, isWinner: true, isOnTheClock: true, hasActionBadge: true })).toBe("winner");
    });

    it("shows a running countdown over the badge for the seat's last move", () => {
        expect(seatBannerMode({ ...none, isOnTheClock: true, hasActionBadge: true })).toBe("timer");
    });

    it("shows the action badge when the seat is not on the clock", () => {
        expect(seatBannerMode({ ...none, hasActionBadge: true, hasSeatJoinNotice: true })).toBe("action");
    });

    it("shows the seat-join notice over the status line", () => {
        expect(seatBannerMode({ ...none, hasSeatJoinNotice: true, hasStatusLine: true })).toBe("seat-join");
    });

    it("falls back to the status line", () => {
        expect(seatBannerMode({ ...none, hasStatusLine: true })).toBe("timer");
    });
});
