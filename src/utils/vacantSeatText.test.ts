import { joinSeatButtonLabel, vacantSeatText } from "./vacantSeatText";

describe("vacantSeatText", () => {
    it("names the seat at a cash table", () => {
        expect(vacantSeatText(4, false, true, false, false)).toEqual({ title: "Seat 4", subtitle: "Click to Join" });
    });

    it("doesn't name a seat when the seat is drawn", () => {
        expect(vacantSeatText(4, false, true, true, false)).toEqual({ title: "Open Seat", subtitle: "Click to Join" });
    });

    it("says the seat is taken when it can't be joined", () => {
        expect(vacantSeatText(2, false, false, false, false)).toEqual({ title: "Seat 2", subtitle: "Seat Taken" });
        expect(vacantSeatText(2, false, false, true, false)).toEqual({ title: "Open Seat", subtitle: "Seat Taken" });
    });

    it("is a plain vacant seat for a player already at the table", () => {
        expect(vacantSeatText(3, true, false, false, false)).toEqual({ title: "Vacant Seat", subtitle: null });
        expect(vacantSeatText(3, true, false, true, false)).toEqual({ title: "Vacant Seat", subtitle: null });
    });
});

describe("vacantSeatText once registration is over", () => {
    it("is a plain vacant seat, never Open Seat or Seat Taken", () => {
        for (const seatDrawn of [false, true]) {
            for (const canJoin of [false, true]) {
                expect(vacantSeatText(6, false, canJoin, seatDrawn, true)).toEqual({ title: "Vacant Seat", subtitle: null });
            }
        }
    });
});

describe("joinSeatButtonLabel", () => {
    it("names the chosen seat at a cash table", () => {
        expect(joinSeatButtonLabel(5, false)).toBe("Confirm & Join Seat 5");
    });

    it("names no seat when the seat is drawn", () => {
        expect(joinSeatButtonLabel(5, true)).toBe("Confirm & Join");
    });
});
