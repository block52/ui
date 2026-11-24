import { joinSeatButtonLabel, vacantSeatText } from "./vacantSeatText";

describe("vacantSeatText", () => {
    it("names the seat at a cash table", () => {
        expect(vacantSeatText(4, false, true, false)).toEqual({ title: "Seat 4", subtitle: "Click to Join" });
    });

    it("doesn't name a seat when the seat is drawn", () => {
        expect(vacantSeatText(4, false, true, true)).toEqual({ title: "Open Seat", subtitle: "Click to Join" });
    });

    it("says the seat is taken when it can't be joined", () => {
        expect(vacantSeatText(2, false, false, false)).toEqual({ title: "Seat 2", subtitle: "Seat Taken" });
        expect(vacantSeatText(2, false, false, true)).toEqual({ title: "Open Seat", subtitle: "Seat Taken" });
    });

    it("is a plain vacant seat for a player already at the table", () => {
        expect(vacantSeatText(3, true, false, false)).toEqual({ title: "Vacant Seat", subtitle: null });
        expect(vacantSeatText(3, true, false, true)).toEqual({ title: "Vacant Seat", subtitle: null });
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
