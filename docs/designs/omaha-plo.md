# Design: Pot-Limit Omaha (PLO)

Status: draft · Issue: block52/ui#196-adjacent (new epic) · Author: design pass 2026-10-11

## Goal

Add **Pot-Limit Omaha (high-only)** as a second `GameVariant` alongside Texas
Hold'em. Omaha's two defining differences from Hold'em:

1. **4 hole cards** per player instead of 2.
2. At showdown, a player makes their best five-card hand using **exactly two of
   their four hole cards and exactly three of the five board cards** — not "best
   five of seven."

The hand *ranking* (high card → royal flush) is identical to Hold'em, so this is
**not** a new evaluator — it's a different **combination-enumeration strategy**
feeding the existing five-card evaluator. Betting is **pot-limit** (the pot-size
cap already has a precedent in the UI's pot-sized bet presets).

**Scope this pass:** PLO high-only. Out of scope: Omaha Hi-Lo (8-or-better split
pot), 5-card PLO, and short-deck. Hi-Lo would add a low-hand evaluator and
pot-splitting — a separate, larger design.

## What already exists (from the codebase map)

| Piece | Status | Location |
|---|---|---|
| `GameVariant` enum with `OMAHA` | ✅ declared, unused | `sdk/src/types/game.ts:79`, `pvm/go/engine/enums.go:105` |
| Variant parsing (`parseGameVariant`, display) | ✅ exists | `sdk/src/utils/gameFormatUtils.ts` |
| 5-card hand evaluator (ranking) | ✅ exists, TS **and** Go | `sdk/src/pokerSolver.ts:70` `EvaluateHand`; `pvm/go/engine/evaluator.go:57` |
| Best-of-combinations driver | ✅ exists (21 combos of 7) | `pokerSolver.ts:220` `findBestHand`; `evaluator.go:209` `FindBestHand` |
| `CompareHands` / `FindWinners` | ✅ generic, variant-agnostic | `evaluator.go:243`, `pokerSolver.ts:491` |
| Showdown orchestration | ✅ generic (just needs the right best-hand fn) | `pvm/go/engine/manager_showdownevaluation.go:78` |
| Deck / Board | ✅ variant-agnostic | `deck.go`, board in `gamemachine.go:48` |
| Hole cards in DTO | ✅ `string[]` (no length constraint) | `sdk/src/types/game.ts:250` |

**Everything else hardcodes 2 hole cards / Hold'em.** The enum is the only Omaha
code today.

## Where the hardcoding lives (the work surface)

Authoritative engine is **Go** (aligning with the in-progress Go PVM port — see
`[[go-pvm-engine-port]]`). TS engine kept at parity during transition.

| Hardcode | Location | Change |
|---|---|---|
| Deal loop `for cardIndex < 2` | `pvm/go/engine/gamemachine.go:105` | bound by variant hole-card count |
| `holeCardsPerPlayer = 2` (TS) | `pvm/ts/src/engine/texasHoldem.ts:74` | variant-aware property |
| `gameVariant` returns TEXAS | `texasHoldem.ts` | from game config |
| Showdown builds `board + hole` 7-card | `manager_showdownevaluation.go:96` | call variant best-hand fn |
| Equity requires 2 hole cards | `pokerSolver.ts:637` | generalize to variant count |
| UI own cards `length !== 2`, `[0]`/`[1]` | `ui/.../Player.tsx:114` | dynamic 4-card layout |
| UI opponent cards `length === 2` | `ui/.../OppositePlayer.tsx:125` | dynamic count |
| `useAllInEquity` `length === 2` | `ui/.../useAllInEquity.ts:139` | variant count |
| Tests asserting "exactly 2 hole cards" | `board_test.go`, `scene_assert_test.go` | parameterize by variant |

## Core design: the Omaha evaluator

The only genuinely new logic. Reuses `EvaluateHand` (5 cards → ranking) and
`CompareHands` unchanged.

**Hold'em today** (`FindBestHand`): take 7 cards, enumerate all **C(7,5)=21**
five-card subsets, evaluate each, keep the best.

**Omaha:** the best hand is constrained — enumerate **C(4,2)=6** hole-card pairs ×
**C(5,3)=10** board triples = **60** candidate five-card hands, evaluate each with
the *same* `EvaluateHand`, keep the best. No ranking changes; only which five
cards are allowed to form a hand.

```go
// engine/evaluator.go (new fn alongside FindBestHand)
// FindBestOmahaHand returns the best 5-card hand using EXACTLY 2 of the 4 hole
// cards and EXACTLY 3 of the 5 board cards. Ranking is identical to Hold'em.
func FindBestOmahaHand(holeCards []Card, boardCards []Card) (HandEvaluation, error) {
    if len(holeCards) != 4 { return HandEvaluation{}, errOmahaHoleCount }
    if len(boardCards) != 5 { return HandEvaluation{}, errOmahaBoardCount }
    var best HandEvaluation
    found := false
    for _, hc := range combinations(holeCards, 2) {   // 6 pairs
        for _, bc := range combinations(boardCards, 3) { // 10 triples
            h := EvaluateHand(append(append([]Card{}, hc...), bc...)) // reuse ranking
            if !found || CompareHands(h, best) > 0 { best = h; found = true }
        }
    }
    return best, nil
}
```

- `combinations` helper already exists in spirit (`getCombinations` in
  `pokerSolver.ts:44`); Go has the equivalent. Factor a small `k`-combination
  helper if not already generic.
- Mirror as `findBestOmahaHand(holeCards, board)` in `sdk/src/pokerSolver.ts`.
- **Partial board (flop/turn):** showdown only ever evaluates the full 5-card
  board, so `FindBestOmahaHand` requires 5. For *in-hand equity/odds* displays on
  the flop (3) or turn (4), the UI's equity path enumerates the remaining board —
  handled in the equity change, not here.

### Dispatch
Showdown and any best-hand call route by variant:

```go
switch game.Variant {
case VariantOmaha:      best, _ = FindBestOmahaHand(hole, board)
default /*holdem*/:     best, _ = FindBestHand(append(board, hole...))
}
```

Put the switch behind one function (`BestHandForVariant(variant, hole, board)`)
so there's a single dispatch point, not scattered branches.

## Dealing & game config

- A `VariantSpec` (or config lookup) exposes `HoleCardsPerPlayer(variant)` →
  `2` for Hold'em, `4` for Omaha; `CommunityCards = 5` for both.
- `gamemachine.go` deal loop bounds on that instead of literal `2`. Deal order
  unchanged (one card per live player per round, N rounds).
- No change to board dealing (still 5), rounds (preflop/flop/turn/river), blinds,
  or dealer button.

## Betting: pot-limit

- Max bet/raise = size of the pot (standard PLO cap). The chain/engine's legal
  `max` for a bet/raise becomes `min(stack, potSizedMax)` when the game's limit
  is pot-limit.
- UI already computes pot-fraction sizes (`calculatePotBetWithVariation`,
  `PotSizedBetButtons`) — the "Pot" preset *is* the max under PLO. Wire the
  action panel's `maxAmount` to the pot cap when limit == pot-limit.
- Pot-limit is a **betting-limit** property, orthogonal to the Omaha *variant*;
  model it as such so fixed/no-limit Omaha or pot-limit Hold'em remain possible
  later.

## UI: 4 hole cards

- **Own cards** (`Player.tsx:113`): replace the `length !== 2` guard and the
  hardcoded `holeCards[0]/[1]` with a map over `holeCards`. Layout must fit **4**
  cards in the player's card area — tighter spacing / smaller cards for Omaha, or
  a 4-across row. Keep 2-card Hold'em layout unchanged (branch on count, not
  variant, so it's robust).
- **Opponent cards** (`OppositePlayer.tsx:125`): render N face-down backs from
  `holeCards.length` (or the dealt count) instead of exactly 2.
- **Deal animation** (`bus/decorators/holeCardDeal.ts`): already seat-based and
  count-agnostic — verify it animates 4.
- **Winner highlight** (`useWinnerCards.ts`): highlight the **2 hole + 3 board**
  that formed the winning hand (the evaluator should return *which* cards it
  used, so the UI can highlight exactly those — see "evaluator returns used
  cards" below).
- **Equity** (`useAllInEquity.ts`, `pokerSolver` equity): generalize the
  `length === 2` assumption; Omaha equity enumerates over 4-card hands (heavier
  Monte Carlo, but same structure).

### Evaluator returns the cards it used
For the winner-card highlight to work in Omaha (and to show "with As Ks" style
descriptions), `FindBestOmahaHand` should return the chosen 2 hole + 3 board in
the `HandEvaluation`. Hold'em's evaluator returns the best 5; Omaha returns the
same 5 but the UI needs to know which 2 were from the hand. Add the used-cards to
the result (both engines) so `useWinnerCards` highlights the right ones.

## End-to-end: what changes vs Hold'em

```
CREATE   game config carries variant=omaha, limit=pot-limit
DEAL     4 hole cards per player (loop bound by HoleCardsPerPlayer), board 5 as now
BET      legal max = pot cap (pot-limit); UI maxAmount = pot
SHOWDOWN BestHandForVariant(omaha, hole[4], board[5]) → FindBestOmahaHand (60 combos)
         CompareHands / FindWinners unchanged → winners, payouts unchanged
UI       render 4 hole cards; highlight the 2+3 the winner used
```

Unchanged: deck, board, rounds, blinds, button, pot/side-pot math, winner
comparison, payout manager, showdown orchestration shell.

## Risks / edge cases

- **"Board plays" is impossible in Omaha** — you must use exactly 2 hole cards, so
  a player can never play the board. Any Hold'em code path that lets the board be
  the best hand must not be reachable for Omaha (the constrained enumeration
  already prevents it).
- **Nut-flush trap** — a common Omaha error is counting a flush using 1 or 3 hole
  cards. The exactly-2 constraint in enumeration is the guard; unit-test it
  explicitly (4 hearts in hand ≠ flush unless 2 are used with 3 board hearts).
- **Equity cost** — 4-card Monte Carlo is heavier; keep it off the hot WS path
  and memoized, consistent with the existing equity hooks.
- **TS/Go parity** — both evaluators must agree exactly; port the Omaha fn and
  share a golden-hand test corpus (the Go port already mirrors TS 1:1).
- **DTO is already `string[]`** — no wire/type change needed for 4 cards, but
  audit every `holeCards.length === 2` across UI + engine (listed above).

## Work breakdown (child issues)

1. **Engine (Go): Omaha evaluator** — `FindBestOmahaHand` (2-of-4 + 3-of-5, 60
   combos), `BestHandForVariant` dispatch, used-cards in result, golden tests
   incl. the nut-flush trap and board-can't-play.
2. **Engine (Go): variant-aware dealing & config** — `HoleCardsPerPlayer`,
   deal-loop bound, parameterize the "2 hole cards" tests.
3. **SDK/TS engine: parity** — mirror `findBestOmahaHand` + dispatch + hole-card
   count in `pokerSolver.ts` / `texasHoldem.ts`; shared test corpus with Go.
4. **Betting: pot-limit cap** — legal `max` = pot cap when limit is pot-limit;
   model limit as orthogonal to variant.
5. **UI: 4 hole cards + winner highlight** — dynamic card rendering
   (`Player.tsx`, `OppositePlayer.tsx`), deal animation for 4, winner-card
   highlight of the used 2+3, variant/limit in table creation.
6. **UI/engine: equity generalization** — `useAllInEquity` + `pokerSolver`
   equity for 4-card hands.
```
