import React from "react";
import { formatUSDCToSimpleDollars, formatForSitAndGo, convertUSDCToNumber } from "../../../utils/numberUtils";
import { decomposeAmount } from "../../../utils/chipBreakdown";
import { getChipImageUrl } from "../../../utils/cardImages";

/** Vertical offset per chip for same-denomination vertical stacking (px). */
const STACK_OFFSET_Y = 4;

/** Size of each chip image (px). */
const CHIP_SIZE = 28;
const CHIP_SIZE_MOBILE = 32;

type ChipProps = {
    amount: string | bigint;
    isTournament?: boolean;
};

/**
 * 2D cluster positions for each stack index.
 * Returns { x, y } offset in pixels relative to cluster origin (bottom-left).
 *
 * Layout patterns (like physical chip piles pushed together):
 *  1 stack:  centered
 *  2 stacks: side-by-side, second nudged up
 *  3 stacks: bottom-left, bottom-right, top-center (triangle)
 *  4+ stacks: 2-column grid, alternating rows
 */
function getClusterPosition(index: number, total: number, chipSize: number): { x: number; y: number } {
    // How much each pile overlaps its neighbor horizontally (~50% of chip)
    const hStep = chipSize * 0.50;
    // Vertical stagger between rows
    const vStep = chipSize * 0.35;

    if (total === 1) {
        return { x: 0, y: 0 };
    }

    if (total === 2) {
        // Side-by-side, second pile raised
        if (index === 0) return { x: 0, y: 0 };
        return { x: hStep, y: vStep };
    }

    if (total === 3) {
        // Triangle: two on bottom, one on top-center
        if (index === 0) return { x: 0, y: 0 };
        if (index === 1) return { x: hStep * 2, y: 0 };
        return { x: hStep, y: vStep };
    }

    // 4+ stacks: 2-column zigzag grid
    const col = index % 2;
    const row = Math.floor(index / 2);
    return {
        x: col * hStep + (row % 2 === 1 ? hStep * 0.5 : 0),
        y: row * vStep,
    };
}

/**
 * Calculate the bounding box of the 2D cluster.
 * @param maxVisibleCount tallest vertical stack across all denomination piles
 */
function getClusterBounds(count: number, chipSize: number, maxVisibleCount: number): { width: number; height: number } {
    if (count === 0) return { width: chipSize, height: chipSize };

    let maxX = 0;
    let maxY = 0;
    for (let i = 0; i < count; i++) {
        const pos = getClusterPosition(i, count, chipSize);
        maxX = Math.max(maxX, pos.x);
        maxY = Math.max(maxY, pos.y);
    }

    return {
        width: maxX + chipSize,
        height: maxY + chipSize + (maxVisibleCount - 1) * STACK_OFFSET_Y,
    };
}

const Chip: React.FC<ChipProps> = React.memo(({ amount, isTournament }) => {
    const amountStr = amount ? amount.toString() : "0";

    // Format based on game type: raw chips for tournaments, USDC conversion for cash
    const formattedAmount = isTournament
        ? formatForSitAndGo(Number(amountStr))
        : formatUSDCToSimpleDollars(amountStr);

    // For chip decomposition, always use dollar value
    const dollarAmount = isTournament
        ? Number(amountStr)
        : convertUSDCToNumber(amountStr);

    const allStacks = decomposeAmount(dollarAmount);

    const isMobile = window.innerWidth <= 768 || window.innerHeight <= 500;
    const chipSize = isMobile ? CHIP_SIZE_MOBILE : CHIP_SIZE;

    const maxVisibleCount = Math.max(1, ...allStacks.map(s => s.visibleCount));
    const bounds = getClusterBounds(allStacks.length, chipSize, maxVisibleCount);

    // How much of the cluster overlaps into the pill
    const chipInset = chipSize * 0.55;

    // How far left the cluster extends beyond the pill's left edge
    const overhang = Math.max(0, bounds.width - chipInset);

    return (
        <div
            className={`relative flex items-center rounded-full bg-[#00000054] ${
                isMobile ? "h-[36px] pr-[12px]" : "h-[32px] pr-[10px]"
            }`}
            style={{ marginLeft: `${overhang}px`, paddingLeft: `${chipInset + 2}px` }}
        >
            {/* Chip cluster — 2D arrangement */}
            <div
                className="absolute"
                style={{
                    right: "100%",
                    marginRight: `-${chipInset}px`,
                    width: `${bounds.width}px`,
                    height: `${bounds.height}px`,
                    top: "50%",
                    transform: "translateY(-50%)",
                }}
            >
                {allStacks.map((stack, si) => {
                    const pos = getClusterPosition(si, allStacks.length, chipSize);
                    return Array.from({ length: stack.visibleCount }).map((_, ci) => (
                        <img
                            key={`s${si}-c${ci}`}
                            src={getChipImageUrl(stack.file)}
                            alt={`$${stack.value} chip`}
                            style={{
                                position: "absolute",
                                left: `${pos.x}px`,
                                bottom: `${pos.y + ci * STACK_OFFSET_Y}px`,
                                width: `${chipSize}px`,
                                height: `${chipSize}px`,
                                zIndex: si * 10 + ci,
                            }}
                        />
                    ));
                })}
            </div>

            {/* Dollar amount label */}
            <span className={`text-[#dbd3d3] font-bold whitespace-nowrap ${
                isMobile ? "text-4xl" : "text-2xl"
            }`}>
                {isTournament ? formattedAmount : `$${formattedAmount}`}
            </span>
        </div>
    );
});

export default Chip;
