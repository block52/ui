/**
 * Stage Geometry Engine
 *
 * Calculates all table layout positions from the spec's stadium-intersection model.
 * Replaces ~1700 lines of hardcoded position arrays with calculated positions.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HOW IT WORKS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * 1. SPEC COORDINATES (from issue #142)
 *    TexasHODL provided exact seat positions on a 1600×850 "stage" using
 *    a stadium-intersection model (radial angles from table center).
 *
 * 2. COORDINATE CONVERSION
 *    stageToTable() converts those absolute stage coordinates into
 *    positions relative to the 900×450 table div:
 *      Stage (1282.2, 683.5) → Table-relative { left: "932.2px", top: "373.5px" }
 *
 * 3. DERIVED POSITIONS
 *    Chips, dealer buttons, and animations are calculated from seat positions:
 *      - Chips:      40% from seat toward table center (adjust CHIP_DISTANCE)
 *      - Dealer:     30% from seat toward table center (adjust DEALER_DISTANCE)
 *      - Turn anim:  seat position + 80px down (adjust TURN_ANIM_Y_OFFSET)
 *      - Win anim:   same as seat position
 *
 * 4. VIEWPORT SCALING
 *    Positions are FIXED on the table. Screen-size adaptation is handled by
 *    zoom/scale on the table container (calculateZoom + getTableTransform).
 *
 * ═══════════════════════════════════════════════════════════════════════
 * HOW TO FINE-TUNE POSITIONS
 * ═══════════════════════════════════════════════════════════════════════
 *
 * To move ALL chips/dealers/animations globally:
 *   → Change the distance constants: CHIP_DISTANCE, DEALER_DISTANCE, TURN_ANIM_Y_OFFSET
 *
 * To nudge ONE specific seat's element by a few pixels:
 *   → Add an entry to GLOBAL_OFFSETS (applies on all screen sizes)
 *     Example: GLOBAL_OFFSETS = { 9: { chips: { 3: { dx: -5, dy: 10 } } } }
 *
 * To nudge ONE specific seat on ONE specific screen size:
 *   → Add an entry to VIEWPORT_OFFSETS
 *     Example: VIEWPORT_OFFSETS["mobile-portrait"] = { 9: { chips: { 5: { dy: -8 } } } }
 *
 * dx = horizontal offset (positive = right, negative = left)
 * dy = vertical offset (positive = down, negative = up)
 *
 * References:
 * - Issue #142: https://github.com/block52/ui/issues/142
 * - Issue #46:  https://github.com/block52/ui/issues/46
 */

// ─── Types ───────────────────────────────────────────────────────────

export interface Position {
    left: string;
    top: string;
    color?: string;
}

export interface ChipPosition {
    left: string;
    bottom: string;
}

// ─── Stage Constants (from spec) ─────────────────────────────────────

export const STAGE_WIDTH = 1600;
export const STAGE_HEIGHT = 850;
export const TABLE_WIDTH = 1000;
export const TABLE_HEIGHT = 500;
export const TABLE_SURFACE_HEIGHT = 500; // Match spec: table surface fills the full table div
export const TABLE_CENTER_X = 800;
export const TABLE_CENTER_Y = 535;
export const SEAT_OFFSET = 72;

// Table div origin in stage coordinates
export const TABLE_ORIGIN_X = TABLE_CENTER_X - TABLE_WIDTH / 2;   // 350
export const TABLE_ORIGIN_Y = TABLE_CENTER_Y - TABLE_HEIGHT / 2;  // 310

// ─── Seat Colors ─────────────────────────────────────────────────────

const SEAT_COLORS_2 = ["#4ade80", "#3b82f6"];

const SEAT_COLORS_4 = [
    "#4ade80", "#f97316", "#3b82f6", "#ec4899"
];

const SEAT_COLORS_6 = [
    "#4ade80", "#f97316", "#ef4444",
    "#3b82f6", "#8b5cf6", "#ec4899"
];

const SEAT_COLORS_9 = [
    "#4ade80", "#f97316", "#ef4444",
    "#3b82f6", "#8b5cf6", "#212529",
    "#FFD700", "#ec4899", "#6b7280"
];

const SEAT_COLORS: Record<number, string[]> = {
    2: SEAT_COLORS_2,
    4: SEAT_COLORS_4,
    6: SEAT_COLORS_6,
    9: SEAT_COLORS_9
};

// ─── Seat Coordinates (from spec JSON, stage px) ─────────────────────

// Each entry is [stageX, stageY] from the issue #142 spec files
export const SEAT_COORDS: Record<number, [number, number][]> = {
    2: [
        [800, 832],      // seat 1 bottom
        [800, 238]       // seat 2 top
    ],
    4: [
        [800, 832],     // Seat 1 - bottom-center
        [317.8, 535],  // Seat 2 - left-center
        [800, 238],     // Seat 3 - top-center
        [1282.2, 535]    // Seat 4 - right-center
    ],
    6: [
        [800, 832],      // seat 1 bottom
        [317.8, 683.5],  // seat 2 lower-left
        [317.8, 386.5],  // seat 3 upper-left
        [800, 238],      // seat 4 top
        [1282.2, 386.5], // seat 5 upper-right
        [1282.2, 683.5]  // seat 6 lower-right
    ],
    9: [
        [800, 842],     // Seat 1 - bottom-center
        [575, 832],     // Seat 2 - bottom-left
        [295.9, 636.6], // Seat 3 - left arc +70deg
        [384.1, 307.5], // Seat 4 - left arc +140deg
        [680, 238],     // Seat 5 - top-left
        [920, 238],     // Seat 6 - top-right
        [1215.9, 307.5],// Seat 7 - right arc +140deg
        [1304.1, 636.6],// Seat 8 - right arc +70deg
        [1025, 832]     // Seat 9 - bottom-right
    ]
};


// ─── Coordinate Conversion ───────────────────────────────────────────

/** Convert stage coordinates to table-div-relative pixel values */
function stageToTable(stageX: number, stageY: number): [number, number] {
    return [
        Math.round((stageX - TABLE_ORIGIN_X) * 10) / 10,
        Math.round((stageY - TABLE_ORIGIN_Y) * 10) / 10
    ];
}

/** Convert stage coordinates to Position (left/top px strings) */
function stageToPosition(stageX: number, stageY: number, color?: string): Position {
    const [x, y] = stageToTable(stageX, stageY);
    return {
        left: `${x}px`,
        top: `${y}px`,
        ...(color ? { color } : {})
    };
}

// ─── Derivation Constants (tweak these to move ALL positions globally) ──

/** Scale factor for player components (cards, badges, chips, dealer button).
 *  Applied on top of the auto-fit zoom. 1.0 = default, 1.3 = 30% bigger.
 *  Doesn't affect positioning — just visual size around each element's center. */
export const COMPONENT_SCALE = 1.2;

/** How many extra pixels to push ALL seats outward from table center.
 *  Positive = further from center (seats spread out, table feels bigger).
 *  Negative = closer to center (seats tighter, table feels smaller).
 *  0 = spec positions from issue #142 (no change). */
const SEAT_SPREAD = -30;

/** How far chips sit from seat toward table center (0 = at seat, 1 = at center) */
const CHIP_DISTANCE = 0.42;

/** How far dealer button sits from seat toward table center.
 *  0.5 = halfway between seat and center — ensures button is ON the table surface
 *  for all seats including top (5,6) and edge (7,8) positions. */
const DEALER_DISTANCE = 0.34;

/** How many pixels down the turn animation ring sits below the seat coordinate.
 *  30px puts it on the badge center (player is 140px tall, centered via translate-y-50%). */
const TURN_ANIM_Y_OFFSET = 30;

// ─── Position Generators ─────────────────────────────────────────────

export type TableSize = 2 | 4 | 6 | 9;


/** Push a seat position outward from table center by SEAT_SPREAD pixels */
function applySpread(sx: number, sy: number): [number, number] {
    if ((SEAT_SPREAD as number) === 0) return [sx, sy];
    const dx = sx - TABLE_CENTER_X;
    const dy = sy - TABLE_CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist === 0) return [sx, sy];
    return [sx + (dx / dist) * SEAT_SPREAD, sy + (dy / dist) * SEAT_SPREAD];
}

/** Get player seat positions for a given table size (with SEAT_SPREAD applied) */
export function getSeatPositions(tableSize: TableSize): Position[] {
    const coords = SEAT_COORDS[tableSize];
    const colors = SEAT_COLORS[tableSize];
    return coords.map(([x, y], i) => {
        const [sx, sy] = applySpread(x, y);
        return stageToPosition(sx, sy, colors[i]);
    });
}

/** Get vacant seat positions (with SEAT_SPREAD applied) */
export function getVacantPositions(tableSize: TableSize): Position[] {
    const coords = SEAT_COORDS[tableSize];
    return coords.map(([x, y]) => {
        const [sx, sy] = applySpread(x, y);
        return stageToPosition(sx, sy);
    });
}

/**
 * Get chip positions derived from seat positions.
 * Chips sit between the seat and table center, inside the 900x350 surface div.
 * They use { left, bottom } instead of { left, top }.
 */
export function getChipPositions(tableSize: TableSize): ChipPosition[] {
    const coords = SEAT_COORDS[tableSize];

    return coords.map(([x, y]) => {
        const [sx, sy] = applySpread(x, y);
        // Vector from seat toward table center
        const dx = TABLE_CENTER_X - sx;
        const dy = TABLE_CENTER_Y - sy;

        // Move CHIP_DISTANCE of the way from seat toward center
        const chipStageX = sx + dx * CHIP_DISTANCE;
        const chipStageY = sy + dy * CHIP_DISTANCE;

        // Convert to table-div-relative
        const [chipX] = stageToTable(chipStageX, chipStageY);

        // Chips are inside the 900x350 surface div, using "bottom" positioning.
        // The surface div starts at y=0 within the table div and is 350px tall.
        // bottom = TABLE_SURFACE_HEIGHT - (chipStageY - TABLE_ORIGIN_Y)
        const chipRelY = chipStageY - TABLE_ORIGIN_Y;
        const chipBottom = TABLE_SURFACE_HEIGHT - chipRelY;

        return {
            left: `${Math.round(chipX)}px`,
            bottom: `${Math.round(chipBottom)}px`
        };
    });
}

/**
 * Get dealer button positions.
 * Placed between seat and table edge, offset toward table center.
 */
export function getDealerPositions(tableSize: TableSize): Position[] {
    const coords = SEAT_COORDS[tableSize];

    return coords.map(([x, y]) => {
        const [sx, sy] = applySpread(x, y);
        const dx = TABLE_CENTER_X - sx;
        const dy = TABLE_CENTER_Y - sy;

        // Move DEALER_DISTANCE from seat toward center
        const dealerX = sx + dx * DEALER_DISTANCE;
        const dealerY = sy + dy * DEALER_DISTANCE;

        return stageToPosition(dealerX, dealerY);
    });
}

/**
 * Get turn animation positions.
 * Placed at the seat with a slight downward offset for the ring animation.
 */
export function getTurnAnimationPositions(tableSize: TableSize): Position[] {
    const coords = SEAT_COORDS[tableSize];

    return coords.map(([x, y]) => {
        const [sx, sy] = applySpread(x, y);
        return stageToPosition(sx, sy + TURN_ANIM_Y_OFFSET);
    });
}

/**
 * Get win animation positions.
 * Same as seat positions (animation overlays the player).
 */
export function getWinAnimationPositions(tableSize: TableSize): Position[] {
    const coords = SEAT_COORDS[tableSize];
    return coords.map(([x, y]) => {
        const [sx, sy] = applySpread(x, y);
        return stageToPosition(sx, sy);
    });
}

// ─── Fine-Tuning Offsets ─────────────────────────────────────────────
//
// Add entries here to nudge individual elements by a few pixels after
// visual QA. Leave empty by default — only add what needs adjustment.
//
// HOW TO USE:
//
// 1. Nudge seat 3's chips 5px left, 10px down on ALL screens:
//    GLOBAL_OFFSETS = { 9: { chips: { 3: { dx: -5, dy: 10 } } } }
//
// 2. Nudge seat 5's chips 8px up on MOBILE PORTRAIT only:
//    VIEWPORT_OFFSETS["mobile-portrait"] = { 9: { chips: { 5: { dy: -8 } } } }
//
// 3. Move dealer button for seat 7 right 10px on tablet:
//    VIEWPORT_OFFSETS["tablet"] = { 9: { dealers: { 7: { dx: 10 } } } }
//
// dx = horizontal (positive = right, negative = left)
// dy = vertical (positive = down, negative = up)

interface Offset { dx?: number; dy?: number; }

type ElementType = "players" | "vacantPlayers" | "chips" | "dealers"
                 | "turnAnimations" | "winAnimations";

/** Global offsets — apply to all screen sizes */
const GLOBAL_OFFSETS: Partial<Record<TableSize,
    Partial<Record<ElementType, Record<number, Offset>>>>> = {
    2: {
        dealers: {
            0: { dx: 95, dy: 113 },
            1: { dx: 95, dy: -69 }
        },
        chips: {
            0: { dx: -38, dy: 40 },
            1: { dx: -38, dy: -5 }
        }
    },

    4: {
        dealers: {
            0: { dx: 95, dy: 113 },    // seat 1
            1: { dx: -57, dy: 24 },  // seat 2
            2: { dx: 95, dy: -69 }, // seat 3
            3: { dx: 60, dy: 24 },   // seat 4
            },
        chips: {
            0: { dx: -38, dy: 40 },    // seat 1
            1: { dx: -90, dy: 75 },  // seat 2
            2: { dx: -38, dy: -5 },  // seat 3
            3: { dx: 15, dy: 75 },   // seat 4
        }
    },

    6: {
        dealers: {
            0: { dx: 95, dy: 113 },    // seat 1
            1: { dx: -60, dy: 73 },  // seat 2
            2: { dx: -60, dy: -23 }, // seat 3
            3: { dx: 95, dy: -70 },   // seat 4
            4: { dx: 60, dy: -23 },  // seat 5
            5: { dx: 60, dy: 73 }    // seat 6
        },
        chips: {
            0: { dx: -38, dy: 40 },    // seat 1
            1: { dx: -92, dy: 20 },  // seat 2
            2: { dx: -92, dy: 15 },  // seat 3
            3: { dx: -40, dy: -7 },   // seat 4
            4: { dx: 18, dy: 15 },   // seat 5
            5: { dx: 18, dy: 20 }    // seat 6
        }
    },

    9: {
        dealers: {
            0: { dx: 95, dy: 115 },   // seat 1
            1: { dx: 25, dy: 165 },   // seat 2
            2: { dx: -68, dy: 55},   // seat 3
            3: { dx: -39, dy: -50 },  // seat 4
            4: { dx: 58, dy: -69 },  // seat 5
            5: { dx: 132, dy: -69 }, // seat 6
            6: { dx: 39, dy: -50 },   // seat 7
            7: { dx: 68, dy: 55 },    // seat 8
            8: { dx: 165, dy: 165 }   // seat 9
        },
        chips: {
            0: { dx: -35, dy: 40 },         // seat 1
            1: { dx: -125, dy: 40 },       // seat 2
            2: { dx: -103, dy: 2 },   // seat 3
            3: { dx: -69, dy: -16 },      // seat 4
            4: { dx: -85, dy: -8 },      // seat 5
            5: { dx: 7, dy: -8 },       // seat 6
            6: { dx: -10, dy: -16 },     // seat 7
            7: { dx: 27, dy: 2 },    // seat 8
            8: { dx: 50, dy: 40 }         // seat 9
        }
    }
};


/** Per-viewport offsets — override for specific screen sizes only */
const VIEWPORT_OFFSETS: Partial<Record<ViewportMode, typeof GLOBAL_OFFSETS>> = {
    "desktop": {
        9: {
            dealers: {
                1: { dy: -50 },  // D2 — move up so it's above the chips
                8: { dy: -50 },  // D9
            }
        }
    },
    "mobile-landscape": {
        9: {
            dealers: {
                1: { dy: -40 },  // D2
                8: { dy: -40 },  // D9
            }
        }
    }
};

/** Apply global + viewport offsets to a Position array */
function applyPositionOffsets(
    positions: Position[],
    tableSize: TableSize,
    element: ElementType
): Position[] {
    const mode = getViewportMode();
    const globalOffs = GLOBAL_OFFSETS[tableSize]?.[element];
    const vpOffs = VIEWPORT_OFFSETS[mode]?.[tableSize]?.[element];

    if (!globalOffs && !vpOffs) return positions;

    return positions.map((pos, i) => {
        const g = globalOffs?.[i];
        const v = vpOffs?.[i];
        if (!g && !v) return pos;

        const dx = (g?.dx ?? 0) + (v?.dx ?? 0);
        const dy = (g?.dy ?? 0) + (v?.dy ?? 0);

        return {
            ...pos,
            left: `${parseFloat(pos.left) + dx}px`,
            top: `${parseFloat(pos.top) + dy}px`
        };
    });
}

/** Apply global + viewport offsets to a ChipPosition array */
function applyChipOffsets(
    positions: ChipPosition[],
    tableSize: TableSize
): ChipPosition[] {
    const mode = getViewportMode();
    const globalOffs = GLOBAL_OFFSETS[tableSize]?.["chips"];
    const vpOffs = VIEWPORT_OFFSETS[mode]?.[tableSize]?.["chips"];

    if (!globalOffs && !vpOffs) return positions;

    return positions.map((pos, i) => {
        const g = globalOffs?.[i];
        const v = vpOffs?.[i];
        if (!g && !v) return pos;

        const dx = (g?.dx ?? 0) + (v?.dx ?? 0);
        const dy = (g?.dy ?? 0) + (v?.dy ?? 0);

        // Chips use "bottom" not "top", so dy inverts: positive dy = down = decrease bottom
        return {
            left: `${parseFloat(pos.left) + dx}px`,
            bottom: `${parseFloat(pos.bottom) - dy}px`
        };
    });
}

// ─── All Positions Bundle ────────────────────────────────────────────

export interface PositionArrays {
    players: Position[];
    vacantPlayers: Position[];
    chips: ChipPosition[];
    dealers: Position[];
    turnAnimations: Position[];
    winAnimations: Position[];
}

/** Get all position arrays for a given table size, with offsets applied */
export function getAllPositions(tableSize: TableSize): PositionArrays {
    return {
        players: applyPositionOffsets(getSeatPositions(tableSize), tableSize, "players"),
        vacantPlayers: applyPositionOffsets(getVacantPositions(tableSize), tableSize, "vacantPlayers"),
        chips: applyChipOffsets(getChipPositions(tableSize), tableSize),
        dealers: applyPositionOffsets(getDealerPositions(tableSize), tableSize, "dealers"),
        turnAnimations: applyPositionOffsets(getTurnAnimationPositions(tableSize), tableSize, "turnAnimations"),
        winAnimations: applyPositionOffsets(getWinAnimationPositions(tableSize), tableSize, "winAnimations")
    };
}

// ─── Viewport Scaling ────────────────────────────────────────────────

export type ViewportMode = "mobile-portrait" | "mobile-landscape" | "tablet" | "desktop";

export function getViewportMode(): ViewportMode {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const isLandscape = width > height;

    if (width <= 414 && !isLandscape) return "mobile-portrait";
    if (width <= 926 && isLandscape) return "mobile-landscape";
    if (width <= 1024) return "tablet";
    return "desktop";
}

/**
 * Viewport parameters — PURE FUNCTIONAL.
 *
 * paddingH:      horizontal breathing room within the container (total, split left/right)
 * paddingV:      vertical breathing room within the container (total, split top/bottom)
 * footerOverlay: px height of any FIXED overlay footer that sits ON TOP of the container.
 *                Only mobile-landscape has this (80px fixed footer). All other viewports
 *                have the footer in normal flex flow, so the container already excludes it.
 *
 * Container dimensions are MEASURED from the actual parent div (via ref),
 * not guessed from window.innerHeight. This eliminates all header/footer guesswork.
 */
export const VIEWPORT_PARAMS: Record<ViewportMode, {
    paddingH: number;
    paddingV: number;
    footerOverlay: number;
    portraitOffsetX?: number;
}> = {
    "desktop": {
        paddingH: 40,
        paddingV: 10,
        footerOverlay: 160      // footer is fixed h-[160px] overlay at bottom
    },
    "tablet": {
        paddingH: 40,
        paddingV: 10,
        footerOverlay: 160      // same as desktop
    },
    "mobile-landscape": {
        paddingH: 10,
        paddingV: 15,
        footerOverlay: 80       // mobile landscape footer is 80px
    },
    "mobile-portrait": {
        paddingH: 20,
        paddingV: 10,
        footerOverlay: 160,     // footer is fixed overlay (160px) on portrait too
        portraitOffsetX: -50    // horizontal offset to visually center the rotated table
    }
};

const MIN_SCALE = 0.3;
const MAX_GLOBAL_SCALE = 2.0;

// ─── Auto-Fit: Dynamic Content Bounds ───────────────────────────────
//
// Calculates the bounding box from SEAT_COORDS for the current table size.
// Includes padding for player UI components that extend beyond seat points.
// 9-seat, 6-seat, and 2-seat tables all auto-fit correctly.

/**
 * Padding for player UI that extends beyond seat coordinate points.
 * x:      player component width extending left/right of outermost seats
 * top:    cards (80px) + component centering (70px) + margin above topmost seat
 * bottom: badge + stack + progress bar below bottommost seat
 */
export const PLAYER_UI_PADDING: Record<ViewportMode, { x: number; top: number; bottom: number }> = {
    "desktop":          { x: 80, top: 90, bottom: 90 },    // symmetric → perfectly centered between header and footer
    "tablet":           { x: 80, top: 120, bottom: 90 },
    "mobile-landscape": { x: 40, top: 80, bottom: 60 },    // extra top for browser chrome
    "mobile-portrait":  { x: 60, top: 140, bottom: 40 },   // tighter for portrait rotation
};

export interface ContentBounds {
    width: number;
    height: number;
    centerX: number;   // content center in stage coords (for pixel-based positioning)
    centerY: number;
}

/** Calculate the bounding box + center of all seat positions + player UI.
 *  Uses per-viewport padding — desktop gets full room, mobile gets tighter fit. */
export function getContentBounds(tableSize: TableSize): ContentBounds {
    const mode = getViewportMode();
    const pad = PLAYER_UI_PADDING[mode];
    const coords = SEAT_COORDS[tableSize];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of coords) {
        const [sx, sy] = applySpread(x, y);
        minX = Math.min(minX, sx);
        maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy);
        maxY = Math.max(maxY, sy);
    }
    return {
        width: (maxX - minX) + pad.x * 2,
        height: (maxY - minY) + pad.top + pad.bottom,
        // Center of the PADDED bounds (not just seats). Accounts for asymmetric
        // padding — more above (cards) than below (badges). Without this offset,
        // the top player cards get clipped by the header.
        centerX: (minX + maxX) / 2,
        centerY: ((minY - pad.top) + (maxY + pad.bottom)) / 2
    };
}

/**
 * Calculate zoom level to fit all content within the container.
 * containerWidth/Height come from the ACTUAL measured parent div (via ref).
 * footerOverlay is subtracted for mobile-landscape where the footer overlays the container.
 */
export function calculateZoom(
    tableSize: TableSize,
    containerWidth: number,
    containerHeight: number
): number {
    const mode = getViewportMode();
    const params = VIEWPORT_PARAMS[mode];
    const bounds = getContentBounds(tableSize);

    // Usable space = container minus any fixed overlay minus breathing room
    const usableWidth = containerWidth - params.paddingH;
    const usableHeight = containerHeight - params.footerOverlay - params.paddingV;

    // In portrait mode, the table is rotated 90deg — content width maps to screen height
    // and content height maps to screen width. Swap the fit calculation.
    let scaleByWidth: number;
    let scaleByHeight: number;
    if (mode === "mobile-portrait") {
        scaleByWidth = usableHeight / bounds.width;    // content width fits in screen height
        scaleByHeight = usableWidth / bounds.height;   // content height fits in screen width
    } else {
        scaleByWidth = usableWidth / bounds.width;
        scaleByHeight = usableHeight / bounds.height;
    }
    const fitScale = Math.min(scaleByWidth, scaleByHeight);

    const result = Math.max(MIN_SCALE, Math.min(fitScale, MAX_GLOBAL_SCALE));

    // DEBUG: remove once positioning is dialled in
    console.log(`[zoom] mode=${mode} tableSize=${tableSize} container=${containerWidth}x${containerHeight} usable=${usableWidth.toFixed(0)}x${usableHeight.toFixed(0)} bounds=${bounds.width.toFixed(0)}x${bounds.height.toFixed(0)} scaleW=${scaleByWidth.toFixed(3)} scaleH=${scaleByHeight.toFixed(3)} → zoom=${result.toFixed(3)}`);

    return result;
}

/**
 * Build CSS transform — pixel-based, no percentages.
 * Centers the content within the measured container.
 * CSS wrapper must have: top:0; left:0; transform-origin: 0 0;
 */
export function getTableTransform(
    zoom: number,
    tableSize: TableSize,
    containerWidth: number,
    containerHeight: number
): string {
    const mode = getViewportMode();
    const params = VIEWPORT_PARAMS[mode];
    const bounds = getContentBounds(tableSize);

    // Center of the usable area within the container
    const usableCenterX = containerWidth / 2;
    const usableCenterY = (containerHeight - params.footerOverlay) / 2;

    // Content center after scaling (transform-origin: 0 0)
    const scaledCenterX = bounds.centerX * zoom;
    const scaledCenterY = bounds.centerY * zoom;

    if (mode === "mobile-portrait") {
        // PORTRAIT: Rotate the table 90deg clockwise using transform-origin at the
        // content center. This way rotate+scale happen around the content center,
        // and we just need a simple translate to move it to the play area center.
        //
        // Transform-origin is set to the content center in stage px.
        // After rotate(90deg) + scale(zoom) around that origin, the content center
        // stays at the origin point. We then translate to move it to screen center.
        //
        // The CSS will be: transform-origin: CXpx CYpx;
        //                  transform: translate(dx, dy) rotate(90deg) scale(zoom);
        //
        // Since transform-origin handles centering, translate just offsets from origin to screen center.
        // In the local coord system (before transforms), the origin is at (cx, cy).
        // We want it to end up at screen (usableCenterX, usableCenterY).
        // The origin starts at CSS top:0 left:0, so its screen position = (cx, cy) before transform.
        // After rotate+scale around itself, it stays at (cx, cy) in the parent's coord system... no.
        //
        // Actually: transform-origin only affects WHERE the transforms are centered.
        // The element still starts at (left:0, top:0).
        // After all transforms, the origin point IS at the element's CSS position + origin offset.
        //
        // Simplest approach that works: use matrix math.
        // Put translate FIRST in CSS (applied last in screen space):

        // Use the STAGE center (not padded bounds center) as the rotation pivot.
        // The padded centerY has asymmetric top/bottom offsets that would cause
        // a horizontal shift after 90deg rotation. Stage center is symmetric.
        const cx = TABLE_CENTER_X;
        const cy = TABLE_CENTER_Y;

        // Matrix math: rotate(90deg) then scale(z)
        // matrix = [0, z, -z, 0, tx, ty]
        // Point (cx, cy) maps to: (-z*cy, z*cx)
        // We want (-z*cy + tx, z*cx + ty) = (usableCenterX, usableCenterY)
        // tx = usableCenterX + portraitOffsetX + z*cy
        // ty = usableCenterY - z*cx

        const offsetX = params.portraitOffsetX ?? 0;
        const tx = usableCenterX + offsetX + zoom * cy;
        const ty = usableCenterY - zoom * cx;

        console.log(`[transform:portrait] center=(${cx},${cy}) usableCenter=${usableCenterX.toFixed(0)},${usableCenterY.toFixed(0)} tx=${tx.toFixed(1)} ty=${ty.toFixed(1)} zoom=${zoom.toFixed(3)}`);

        // Using matrix: scale(z) * rotate(90deg) = matrix(0, z, -z, 0, tx, ty)
        return `matrix(0, ${zoom}, ${-zoom}, 0, ${tx.toFixed(1)}, ${ty.toFixed(1)})`;
    }

    // Normal (non-rotated) modes
    const tx = usableCenterX - scaledCenterX;
    const ty = usableCenterY - scaledCenterY;

    console.log(`[transform] container=${containerWidth}x${containerHeight} usableCenter=${usableCenterX.toFixed(0)},${usableCenterY.toFixed(0)} tx=${tx.toFixed(1)} ty=${ty.toFixed(1)} zoom=${zoom.toFixed(3)}`);

    return `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${zoom})`;
}
