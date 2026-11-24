/**
 * Utility functions for sorting poker tables
 */

/**
 * Sort tables by available seats (least empty seats first, full tables last)
 * 
 * @param tables - Array of tables to sort
 * @returns Sorted array with tables having fewer empty seats first, full tables last
 * 
 * @example
 * // Tables sorted by fewest available seats first, full tables at bottom:
 * // 1. 8/9 players (1 seat available) - 9-player table
 * // 2. 1/2 players (1 seat available) - 2-player table  
 * // 3. 3/4 players (1 seat available) - 4-player table
 * // 4. 5/6 players (1 seat available) - 6-player table
 * // 5. 7/9 players (2 seats available) - 9-player table
 * // 6. 2/6 players (4 seats available) - 6-player table
 * // 7. 0/4 players (4 seats available - empty) - 4-player table
 * // 8. 0/9 players (9 seats available - empty) - 9-player table
 * // 9. 9/9 players (FULL) - 9-player table
 * // 10. 4/4 players (FULL) - 4-player table
 * // 11. 2/2 players (FULL) - 2-player table
 */
export function sortTablesByAvailableSeats<T extends { maxPlayers: number; currentPlayers?: number }>(
    tables: T[]
): T[] {
    return [...tables].sort((a, b) => {
        const aMaxPlayers = a.maxPlayers;
        const bMaxPlayers = b.maxPlayers;
        const aCurrentPlayers = a.currentPlayers || 0;
        const bCurrentPlayers = b.currentPlayers || 0;
        
        const aAvailableSeats = aMaxPlayers - aCurrentPlayers;
        const bAvailableSeats = bMaxPlayers - bCurrentPlayers;
        
        // Full tables go to the bottom
        const aIsFull = aCurrentPlayers >= aMaxPlayers;
        const bIsFull = bCurrentPlayers >= bMaxPlayers;
        
        if (aIsFull && !bIsFull) return 1;
        if (!aIsFull && bIsFull) return -1;
        
        // For non-full tables, sort by available seats (ascending - fewer empty seats first)
        return aAvailableSeats - bAvailableSeats;
    });
}
