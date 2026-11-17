/**
 * Table-UI shapes the message bus carries. Defined here (not in a component or
 * context file) so the bus stays free of React; the web app re-exports them
 * from where they used to live.
 */

/** A game state that failed validation: which fields were missing and the raw payload. */
export interface ValidationError {
    missingFields: string[];
    message: string;
    rawData?: unknown;
}

/** An action this client submitted and has not yet seen confirmed. */
export interface PendingAction {
    gameId: string;
    actor: string;
    action: string;
    amount?: string;
    timestamp: number;
}
