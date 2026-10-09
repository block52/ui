const MICRO_PER_CENT = 10_000n;

interface BuyInPresetInput {
    minMicro: bigint;
    maxMicro: bigint;
    bigBlindMicro: bigint;
    balanceMicro: bigint;
}

export interface BuyInPreset {
    label: string;
    micro: bigint;
}

/**
 * Quick-amount stops for a cash buy-in, in micro-USDC, never above the balance
 * or the table max. Max is the balance floored to whole cents (exact, no float
 * error); when two stops land on the same amount the later label is kept.
 */
export const buildBuyInPresets = ({ minMicro, maxMicro, bigBlindMicro, balanceMicro }: BuyInPresetInput): BuyInPreset[] => {
    const balanceCents = (balanceMicro / MICRO_PER_CENT) * MICRO_PER_CENT;
    const cap = maxMicro < balanceCents ? maxMicro : balanceCents;

    const candidates: BuyInPreset[] = [{ label: "Min", micro: minMicro }];
    if (bigBlindMicro > 0n) {
        candidates.push({ label: "50 BB", micro: bigBlindMicro * 50n }, { label: "100 BB", micro: bigBlindMicro * 100n });
    }
    candidates.push({ label: "Max", micro: cap });

    const seen = new Set<bigint>();
    return candidates
        .filter(c => c.micro >= minMicro && c.micro <= cap)
        .reverse()
        .filter(c => {
            if (seen.has(c.micro)) return false;
            seen.add(c.micro);
            return true;
        })
        .reverse();
};
