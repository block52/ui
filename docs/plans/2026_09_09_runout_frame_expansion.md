# Runout Frame Expansion — Pacing Multi-Street Jumps

**Date:** 2026-09-09
**Status:** Phase 1 implemented (`src/bus/expandFrames.ts`, wired into
`GameMessageBus.ingest`, 40 new tests in `expandFrames.test.ts` + `runout.test.ts`).
Phases 2–4 open.
**Owner:** TBD

## Goal

Make an all-in runout *read* like a runout: hole cards on their backs, then
flop, turn, river with a beat between each, then the winner. Today all of it
paints in a single frame — five cards in one flat 1000ms sweep, with the winner
banner and the payout already on screen before the first card lands.

Do it **without** loosening the two-track invariant, without inventing state,
and without adding pacing to consensus.

---

## 1. The problem

### 1.1 What the server sends

The entire runout — flop, turn, river, showdown, settlement — happens
synchronously inside one `performAction` call, so it is one chain tx and one
broadcast.

`poker-vm/pvm/ts/src/engine/texasHoldem.ts:1340-1367`:

```ts
private runPostActionHooks(action: ...): void {
    ...
    while (this.hasRoundEnded(this._currentRound) && this._currentRound !== TexasHoldemRound.END) {
        this.nextRound();
    }
}
```

`shouldAutoRunout` (`managers/roundEndDetectionManager.ts:186-221`) flips true
the moment no further betting is possible; `AUTO_RUNOUT` deliberately has no
side effects (`texasHoldem.ts:1164-1168`) so the loop just keeps spinning. Each
spin deals one street (`roundTransitionManager.ts:47-58` — PREFLOP→3, FLOP→1,
TURN→1). Nothing is persisted or emitted between spins. The Go port is
identical (`poker-vm/pvm/go/engine/gamemachine.go:194-215`).

Between snapshot N and N+1 the client therefore sees:

| | snapshot N | snapshot N+1 |
|---|---|---|
| `round` | `"preflop"` | `"end"` |
| `communityCards` | `[]` | `[c1..c5]` |
| `winners` | `[]` | populated |
| `players[].stack` | pre-payout | post-payout |

**There is no recoverable street timing in the payload.** `previousActions`
records player/non-player actions only — street transitions are not entries, so
in a runout the last logged action is the CALL that triggered it. No per-street
timestamps exist anywhere. Any pacing must be synthesized client-side.

### 1.2 What the bus does with it

One snapshot produces one commit, carrying every derived event at once:

- `deriveEvents.ts:181-184` emits **one** `roundAdvanced` (PREFLOP→END) whose
  `newCommunityCards` is all five cards. The comment already concedes it:
  *"A single frame can jump multiple streets (all-in runout)."*
- `communityCardStagger.ts:53-61` turns that into **one** `dealCards` hint,
  5 cards, uniform `staggerMs: 200`.
- `useCardAnimations.ts:114-126` computes `startSlot = cardCount - newCardCount`
  = 0 and reveals slots 0–4 at 200/400/600/800/1000ms.
- `handEnded`, `stackChanged`, and `cardsRevealed` are derived on that **same
  item**, so the winner banner, the `animate-win-card` lift, the stacks, and the
  opponents' hole cards all render at t=0.

### 1.3 The two symptoms

1. **Too fast / wrong rhythm.** Five cards on one uniform 200ms metronome. No
   flop-group, no pause, no turn, no pause, no river.
2. **Wrong order.** The result is on screen before the board that produced it.
   `showdownHold`'s `minDisplayMs: 2000` cannot help — it is a *post-commit*
   hold, so it delays the *next* item and does nothing for ordering *within* the
   current one.

### 1.4 Root cause

> **The bus queues snapshots, not presentation steps.**

One snapshot is one atomic React commit. The drain can space things *between*
commits; it has no mechanism to space anything *within* one. Every pacing knob
we have (`holdPreviousMs`, `minDisplayMs`, acks) operates on commit boundaries,
and the runout has no commit boundary to work with.

This is not a bug in any one decorator. Tuning `CARD_STAGGER_MS` or adding
per-card delays (see §2.8) addresses symptom 1 and cannot address symptom 2.

---

## 2. Proposed architecture

### 2.1 Overview

Insert one pure stage between derivation and enqueue that expands a multi-street
jump into an ordered list of sub-frames, each a **projection of two real
snapshots**. The existing drain, decorators, acks, and coalescing then pace them
with no further changes.

```
ws.onmessage → classifyMessage → GameMessageBus.ingest
                                      │
                                      ├─ logical track ← REAL next, immediately (unchanged)
                                      │
                                      └─ expandFrames(prev, next) → [f0, f1, …, next]
                                             │
                                             └─ per frame: deriveEvents → decorators
                                                → assignAckIds → enqueue
                                                     │
                                                     └─ existing paced drain
```

### 2.2 The projection rule

Nothing is invented. Every intermediate field is a real value taken from either
`prev` or `next`:

```ts
// Carry the triggering action(s) forward so the CALL badge and sound fire on
// the FIRST beat, not after the river.
const base = { ...prev, previousActions: next.previousActions, actionCount: next.actionCount };

// One frame per street actually dealt.
const frame_i = { ...base, round: street_i, communityCards: next.communityCards.slice(0, n_i) };

// The last frame is the real snapshot, verbatim.
const final = next;
```

This satisfies Commandment 7: no field is defaulted, coerced, or synthesized —
each is copied from an authoritative DTO. `stack`, `pots`, and `winners` simply
hold their **pre-showdown** values until the final frame, which is what we want:
the payout should land with the winner, not before the flop.

### 2.3 Beat sequence

For a PREFLOP→END runout:

| # | Frame | Derived event | Consumer |
|---|---|---|---|
| R | `base` + opponents' revealed `holeCards` | `cardsRevealed` | *(new)* card-flip animation |
| 0 | `base`, round FLOP, cards 0–2 | `roundAdvanced` + `playerActed` | `communityCardStagger`, action badge |
| 1 | `base`, round TURN, cards 0–3 | `roundAdvanced` | `communityCardStagger` |
| 2 | `base`, round RIVER, cards 0–4 | `roundAdvanced` | `communityCardStagger` |
| F | `next` verbatim | `handEnded`, `stackChanged` | `showdownHold`, win animation |

Frame R merges only `holeCards` per seat:

```ts
players: prev.players.map(p => ({ ...p, holeCards: nextBySeat.get(p.seat)?.holeCards ?? p.holeCards }))
```

This finally consumes `cardsRevealed`, which `deriveEvents.ts:187-192` has been
deriving since Phase 2 with no consumer.

### 2.4 Why the decorators need no changes

Because each sub-frame is derived against its *predecessor sub-frame*, not
against `prev`, `deriveEvents` naturally yields one `roundAdvanced` per street
with `newCommunityCards` of length 3, 1, 1. `communityCardStagger` then produces
exactly the hint it was written for.

This also retires a latent bug: `DEAL_CARDS_ACK_TIMEOUT_MS` is budgeted at
2100ms for `MAX_STREET_CARDS = 3` (`communityCardStagger.ts:32,48`), but a
5-card runout acks at `200×5 + 1000 = 2000ms` — 100ms of margin. Raise the
stagger at all and the drain silently advances before the cards land. After
expansion no frame ever carries more than 3 cards, and the constant means what
it says.

`handEnded` derives only on frame F, so the winner **cannot** paint before the
river. Ordering is fixed structurally, not by tuning.

### 2.5 Bus integration

`GameMessageBus.ingest` (`GameMessageBus.ts:155-194`) currently builds one item
and calls `this.enqueue(item)` at line 193. The change is confined to that
method:

- `this.seq += 1` moves inside the per-frame loop. Every sub-frame needs its own
  seq — `ackId` is `${seq}:${hintIndex}` (`assignAckIds`, line 275-281) and must
  stay globally unique.
- `deriveEventsForItem` is called per frame against the preceding sub-frame.
- `updateLogicalTrack` is called **once**, with the real `next`, exactly as
  today. Sub-frames never touch `lastSnapshot` or `setLatestGameState`. **This
  is the invariant that must not break** — action submission reads the logical
  track and would otherwise send stale action indices.
- Expansion applies only when `next.communityCards.length - prev.communityCards.length`
  exceeds the cards owed by a single street. Normal play takes the existing
  single-frame path with zero added latency.

`RegressedSnapshotError` is not a concern: consecutive sub-frames carry
identical `previousActions`, so indices are equal, never decreasing.

### 2.6 Backpressure interaction — the one real gotcha

Two caps in `GameMessageBus.ts:73-76` were written assuming every queued item is
an independently-arrived frame. Expansion breaks that assumption:

```ts
export const DEPTH_CAP = 5;      // queued STATE items above this trigger coalescing
export const HOLD_CAP_MS = 4000; // accumulated queued hold above this triggers coalescing
```

- **`HOLD_CAP_MS` is not actually at risk.** `accumulatedHoldMs()` (line 485-491)
  sums only `holdPreviousMs + minDisplayMs`, and `communityCardStagger` sets
  neither — it gates on acks. Only frame F's `showdownHold` (2000ms) counts.
- **`DEPTH_CAP` is.** A 5-beat runout enqueues 5 items, which is *at* the cap,
  not over it. But the moment one more real frame arrives — and one will, given
  the 250ms optimistic poller (`pokerchain/pkg/wsserver/optimistic.go:188-230`)
  and the next-block hand-lifecycle rebroadcast (`server.go:997-1014`) — the
  check at `enqueue` line 307 fires `abandonAcks()`, cutting the in-flight card
  reveal short, and `coalesce()` (line 463-483) drops the coalescible sub-frames.

The fix is to distinguish **planned choreography** from **unplanned backlog**:
count only externally-ingested items toward `DEPTH_CAP`, or track the expansion's
frames as one logical unit. Either way the *degradation* stays correct — mark
sub-frames `coalescible: true` and a genuinely lagging client skips the pretty
runout and snaps to truth. `coalesce()` already preserves any `handEnded` item
(line 474), so frame F always survives.

### 2.7 What this deliberately does not do

- **No server-side pacing.** Emitting per-street chain events would put
  presentational delay into consensus and slow the logical track for every
  client. Pacing is a client concern; the two-track design already says so.
- **No stack/pot rollback beyond `prev`.** During the runout, stacks show their
  pre-call values — the caller's chips are not visibly committed until frame F.
  This is a ~4-second cosmetic inaccuracy, and fixing it properly means applying
  `next.previousActions` deltas to stacks/bets/pot client-side. Deferred to
  Phase 2 (§3), with rake and side pots as the reasons to be careful.
- **No new animation library.** `framer-motion` is in `dependencies` but has
  zero imports in `src/`; this needs no more than the existing CSS keyframes.
- **No change to normal-play latency.** Single-street advances bypass expansion
  entirely.

---

## 3. Implementation plan

### Phase 1 — `expandFrames` + board/winner ordering — DONE

- `src/bus/expandFrames.ts`, pure, signature mirrors `deriveEvents`.
- `GameMessageBus.ingest` reworked per §2.5: `updateLogicalTrack` runs once with
  the real snapshot before the loop; a new `buildItem` assigns per-frame seq and
  runs derivation/decoration/ack-stamping against each frame's PREDECESSOR.
- `GameStreamItem.synthetic` added; `backlogDepth()` replaces `queue.length` at
  all three `DEPTH_CAP` sites; `introspection.expanded` counts synthesized frames.

Two corrections to this design, found while building it:

1. **The reveal must be applied to `base`, not to the reveal frame.** As written
   in §2.3 the flop/turn/river frames spread from `base` and would have flipped a
   revealed hand back to `["X","X"]`. Pinned by
   *"keeps revealed cards face up for the rest of the runout"*.
2. **The `DEPTH_CAP` consequence is worse than §2.6 estimated.** `underPressure`
   does not merely shorten holds — `afterCommit` sets
   `ackHints = underPressure ? [] : ...`, dropping every animation ack. A runout
   that tripped the cap would not deal fast, it would not deal at all. Pinned by
   *"does not treat its own choreography as backlog"*.

Also note the final frame emits a `roundAdvanced` (RIVER→END) carrying zero new
cards. Harmless: `communityCardStagger` requires `hasElements`, so it produces no
hint.

### Phase 2 — Hole-card reveal beat

- Frame R per §2.3; consume `cardsRevealed` in a new `useHoleCardReveal` hook.
- The flip CSS already exists but is dead: `Card/UserCards.css:9-21` has no
  importer. Either wire it up or delete it.

### Phase 3 — Bet settlement during the runout (optional)

- Apply `next.previousActions` deltas to `stack`/`sumOfBets`/`totalPot` on
  `base`, so committed chips are visible before the flop. Needs a tested pure
  helper; watch rake and side pots.

### Phase 4 — Timing config (independent, can ship first)

Not strictly part of this design, but it is what "configured delays" means and
it is currently a correctness hazard:

- `CARD_DROP_MS = 1000` is declared twice — `communityCardStagger.ts:38` and
  `useCardAnimations.ts:16` — and must *also* be kept equal to `Table.css:65`
  `fall 1.0s` by hand.
- The badge choreography constants (2000/150/500) are duplicated verbatim in
  `usePlayerActionDropBox.ts:17-19` and `useSeatJoinNotification.ts:12-14`.

One `src/bus/timing.ts`, exported to CSS as custom properties so durations
cannot drift, plus a speed multiplier (slow/normal/fast/instant) as a user
setting and `window.__B52_SPEED__` for Playwright.

---

## 4. Risks & open questions

| Risk | Mitigation |
|---|---|
| Synthetic frames leak onto the logical track → stale action indices → chain rejects | `updateLogicalTrack` called once with real `next`; assert in a bus test |
| `DEPTH_CAP` eats the choreography mid-runout (§2.6) | Count only externally-ingested items; sub-frames coalescible so degradation is still correct |
| Runout choreography (~4s) outlasts the next hand's arrival | Frame F keeps `showdownHold`; verify against `timeout_commit = 1s` production cadence |
| Stale stacks visible during the runout | Accepted in Phase 1; Phase 3 fixes it |
| A client that reconnects mid-runout replays nothing | Already handled — `prev === undefined` returns `[next]`, and `useCardAnimations:49-51` reveals dealt slots instantly on late mount |

**Open:** should expansion also cover a fold-to-showdown or an uncalled-bet
win, where `round` jumps but no cards are dealt? Probably not — there is no
board to pace — but the guard in §2.5 should be written to make that explicit
rather than incidental.

---

## 5. Test strategy

- **Unit (`expandFrames.test.ts`)** — pure, no React, per Phase 1 above.
- **Bus integration (`pacing.test.ts`, `acks.test.ts`)** — fake timers; assert
  commit count, per-commit `eventCount`, and that `handEnded` lands last.
  `window.__B52_BUS__` already exposes `committed`, `coalesced`, `queueDepth`,
  `pendingAcks`, `ackTimeouts`, `commitLog` for numeric assertions.
- **Backpressure** — inject a real frame mid-runout and assert the sub-frames
  are dropped while frame F survives.
- **E2E** — the stub's `__control/script` and `__control/config` frame pacing
  can drive an all-in runout; assert board slot order, not screenshot timing.

---

## 6. References

- `docs/plans/2026_07_13_ws_action_bus.md` — the bus this extends (§2.2 two
  tracks, §2.6 coalescing, §2.7 acks)
- `ui/CLAUDE.md` — 12 Commandments of Types; WS Action Bus extension points
- Engine runout loop: `poker-vm/pvm/ts/src/engine/texasHoldem.ts:1340-1367`,
  `managers/roundEndDetectionManager.ts:186-221`
- Broadcast triggers: `pokerchain/pkg/wsserver/server.go:935-1014`,
  `optimistic.go:188-230`
