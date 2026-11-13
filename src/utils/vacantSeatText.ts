/**
 * Labels for an empty seat and its buy-in button (ui#969).
 *
 * At a Sit & Go the seat is drawn when you join (utils/seatDraw), so an empty
 * seat is an entry point, not a seat you claim: it reads "Open Seat" and the
 * button doesn't name a seat number. Cash tables name the seat you pick. Once
 * registration is over (a running tournament) an empty seat is only "Vacant".
 */

export interface VacantSeatText {
    title: string;
    subtitle: string | null;
}

/** Shown on a Sit & Go buy-in so the player knows the clicked seat isn't theirs. */
export const SEAT_DRAW_NOTE = "Your seat is drawn at random";

export function vacantSeatText(seat: number, isUserAlreadyPlaying: boolean, canJoin: boolean, seatDrawn: boolean, registrationClosed: boolean): VacantSeatText {
    // Seated at the table, or registration is over (a running tournament): the
    // seat is just empty. It is not "Open", and "Seat Taken" would be a lie.
    if (isUserAlreadyPlaying || registrationClosed) {
        return { title: "Vacant Seat", subtitle: null };
    }
    return {
        title: seatDrawn ? "Open Seat" : `Seat ${seat}`,
        subtitle: canJoin ? "Click to Join" : "Seat Taken"
    };
}

export function joinSeatButtonLabel(seat: number, seatDrawn: boolean): string {
    return seatDrawn ? "Confirm & Join" : `Confirm & Join Seat ${seat}`;
}
