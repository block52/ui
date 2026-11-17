import { countByStatus } from "./statusCounts";

describe("countByStatus", () => {
    it("returns an empty object for an empty list", () => {
        expect(countByStatus([])).toEqual({});
    });

    it("counts withdrawals by status", () => {
        const withdrawals: { status: "pending" | "signed" | "completed" | "error" }[] = [
            { status: "pending" },
            { status: "signed" },
            { status: "pending" },
            { status: "completed" },
            { status: "error" },
            { status: "pending" }
        ];
        const counts = countByStatus(withdrawals);
        expect(counts.pending).toBe(3);
        expect(counts.signed).toBe(1);
        expect(counts.completed).toBe(1);
        expect(counts.error).toBe(1);
    });

    it("matches the per-status filter counts it replaces", () => {
        const deposits: { status: "loading" | "processed" | "pending" | "error" }[] = [
            { status: "processed" },
            { status: "processed" },
            { status: "loading" },
            { status: "pending" }
        ];
        const counts = countByStatus(deposits);
        expect(counts.processed ?? 0).toBe(deposits.filter(d => d.status === "processed").length);
        expect(counts.pending ?? 0).toBe(deposits.filter(d => d.status === "pending").length);
        expect(counts.error ?? 0).toBe(0);
    });
});
