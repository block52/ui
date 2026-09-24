/**
 * Predefined blind levels for poker table creation
 * Each level contains a label for display and the actual small blind and big blind amounts
 */
export interface BlindLevel {
    label: string;
    smallBlind: number;
    bigBlind: number;
}

export const BLIND_LEVELS: BlindLevel[] = [
    { label: "0.01 / 0.02", smallBlind: 0.01, bigBlind: 0.02 },
    { label: "0.02 / 0.05", smallBlind: 0.02, bigBlind: 0.05 },
    { label: "0.05 / 0.10", smallBlind: 0.05, bigBlind: 0.10 },
    { label: "0.10 / 0.25", smallBlind: 0.10, bigBlind: 0.25 },
    { label: "0.25 / 0.50", smallBlind: 0.25, bigBlind: 0.50 },
    { label: "0.50 / 1.00", smallBlind: 0.50, bigBlind: 1.00 },
    { label: "1.00 / 2.00", smallBlind: 1.00, bigBlind: 2.00 },
    { label: "2.50 / 5.00", smallBlind: 2.50, bigBlind: 5.00 },
    { label: "5.00 / 10.00", smallBlind: 5.00, bigBlind: 10.00 },
    { label: "10.00 / 20.00", smallBlind: 10.00, bigBlind: 20.00 },
    { label: "25.00 / 50.00", smallBlind: 25.00, bigBlind: 50.00 },
    { label: "50.00 / 100.00", smallBlind: 50.00, bigBlind: 100.00 },
    { label: "100.00 / 200.00", smallBlind: 100.00, bigBlind: 200.00 },
    { label: "200.00 / 400.00", smallBlind: 200.00, bigBlind: 400.00 },
    { label: "300.00 / 600.00", smallBlind: 300.00, bigBlind: 600.00 },
    { label: "500.00 / 1,000.00", smallBlind: 500.00, bigBlind: 1000.00 },
    { label: "1,000.00 / 2,000.00", smallBlind: 1000.00, bigBlind: 2000.00 },
    { label: "2,000.00 / 4,000.00", smallBlind: 2000.00, bigBlind: 4000.00 },
    { label: "5,000.00 / 10,000.00", smallBlind: 5000.00, bigBlind: 10000.00 },
    { label: "10,000.00 / 20,000.00", smallBlind: 10000.00, bigBlind: 20000.00 },
    { label: "20,000.00 / 40,000.00", smallBlind: 20000.00, bigBlind: 40000.00 },
    { label: "25,000.00 / 50,000.00", smallBlind: 25000.00, bigBlind: 50000.00 }
];

/**
 * Default blind level index (0.50 / 1.00)
 */
export const DEFAULT_BLIND_LEVEL_INDEX = 5;

/**
 * Sit & Go starting blinds, in CHIPS (not dollars) — the presets /admin/tables
 * offers. Used by the dashboard's Create New Table form (ui#690).
 */
export const SNG_BLINDS: ReadonlyArray<{ smallBlind: number; bigBlind: number }> = [
    { smallBlind: 10, bigBlind: 20 },
    { smallBlind: 25, bigBlind: 50 },
    { smallBlind: 50, bigBlind: 100 }
];
