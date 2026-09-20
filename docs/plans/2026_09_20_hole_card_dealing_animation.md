# Hole-Card Dealing Animation — cards fly from the deck to each seat

**Date:** 2026-09-20
**Status:** Plan (nothing implemented). Tracks block52/ui#21.
**Owner:** TBD

## Goal

Make the deal *read* like a deal (ui#21): two rounds of face-down cards leave a
deck zone in the middle of the table and land on each live seat clockwise from
the button, then the local player's two cards flip face-up. Opponents' cards
stay on their backs. Smooth, short enough never to hold up play, correct for
2/4/6/9-max and for every table rotation, and switchable off.

Do it the way the board already animates — as a **bus decoration consumed by a
render hook that acks the drain** — not as another ad-hoc timer keyed off a
snapshot diff (the pattern `docs/plans/2026_07_13_ws_action_bus.md` §1.2/§1.3
removed). Nothing here touches consensus, the logical track, or the wire shape.

---

## 1. What exists today (read 2026-09-20)

### 1.1 Hole cards appear in one frame, with no choreography

- The engine deals every live seat inside one action. With the engine-driven
  hand start (poker-vm#2617 / pokerchain#363) that action is the `new-hand`
  itself: the frame that carries `handStarted` also carries the blind posts, the
  `deal`, and every seat's hole cards. Under the older client-driven flow the
  `deal` is its own frame. Either way, the client receives **one** snapshot in
  which `players[].holeCards` goes from absent to `["X","X"]` (opponents) or the
  real pair (the viewer).
- `Player.tsx:113-142` (`renderCards`) and `OppositePlayer.tsx:136-151` render
  those cards the instant the frame commits: the viewer's two faces, opponents'
  two backs. There is no in-between state.

### 1.2 The animation pipeline that the board uses

- `deriveEvents` (`src/bus/deriveEvents.ts`) diffs consecutive snapshots into
  typed events. It has `handStarted`, `playerActed` (including the `deal`
  non-player action), `roundAdvanced`, `cardsRevealed` — but **no event for
  "these seats were just dealt hole cards"**.
- `communityCardStagger` (`src/bus/decorators/communityCardStagger.ts`) turns a
  `roundAdvanced` with new community cards into a `dealCards` hint with a
  per-card `staggerMs` and an `ackTimeoutMs`; `useCardAnimations` consumes it,
  drops the cards in one at a time (`TableBoard` gates each slot on
  `revealedSlots`), and calls `bus.ackAnimation` when the last drop finishes so
  the drain waits exactly as long as the reveal takes (Phase 5 acks, §2.7).
- Late mount is handled there too: on first render the board shows whatever is
  already dealt with no animation, and any non-deal commit *reconciles* slot
  visibility without disturbing an in-flight stagger.

That is the whole shape this feature needs. The hole-card deal is the same
problem one level down: a per-**seat** stagger instead of a per-**slot** one,
plus a flight path.

### 1.3 Geometry

- Seats live in a 1600×850 stage; the table is a 1000×500 div at stage origin
  (300, 285), inside a zoom wrapper (`Table.tsx:1341`). Every per-seat
  overlay — chips, dealer button, turn/win rings — is positioned from
  `stageGeometry.ts` position arrays (`getChipPositions`, `getDealerPositions`,
  `getTurnAnimationPositions`, …), all derived from `SEAT_COORDS[tableSize]` and
  rendered **inside the table div**, so the zoom transform applies uniformly.
- Rotation: `seatNumber = ((positionIndex − startIndex + tableSize) % tableSize) + 1`
  (`PlayerSeating.tsx:129`); the dealer button does the inverse
  (`Table.tsx:1406`). Any new overlay must use the same mapping.
- The board is centred on the felt (`TableBoard.tsx`), which is where a deck
  belongs.

### 1.4 Loose ends worth folding in

- `Card/UserCards.css` is a complete, **unused** 3D flip (`.handcard`,
  `.handcard.flipped`) — noted as dead in the runout plan (Phase 2). The local
  player's flip is its natural importer.
- `CARD_DROP_MS` is declared in two places and mirrored by hand in CSS; the
  runout plan's Phase 4 proposes one `src/bus/timing.ts`. This feature adds
  three more durations, so that file should land first.
- `GameSettingsContext` already persists per-user toggles (auto-deal, sounds,
  seat-at-bottom…) and `Table.css:566` already honours
  `prefers-reduced-motion`. The "option to reduce or skip animations" the issue
  asks for slots into both.

---

## 2. Proposed design

### 2.1 Overview

```
snapshot N → N+1 (seats gain holeCards)
   │
   ▼  deriveEvents            cardsDealt { seats: [1,3,5,7], dealerSeat: 5 }
   ▼  holeCardDeal decorator  dealHoleCards hint { seats: [7,1,3,5] (clockwise from button+1),
   │                                              staggerMs, ackTimeoutMs }  ← ack opt-in
   ▼  drain commits the frame; hint stamped with ackId
   ▼  useHoleCardDeal (render)
        ├─ DealingLayer: 2 × |seats| card backs fly deck → slot, CSS-only
        ├─ per-seat `dealt` flips as that seat's 2nd card lands → Player/OppositePlayer
        │  stop rendering the empty placeholder and show their cards
        ├─ viewer's cards render face-down, flip after the last card lands
        └─ ackAnimation(ackId) when the flip ends → drain proceeds
```

Two invariants carried over from the board animation:

1. **No invented state.** Every frame the render track shows is a real snapshot
   (or a runout projection of two real ones). The choreography only controls
   *when* a seat's already-present cards become visible. Commandment 7 holds.
2. **The drain never stalls on us.** The hint opts into an ack with a hard
   `ackTimeoutMs`; a missing ack (unmount, disabled animation, hidden tab) falls
   back to the budget, and backpressure abandons acks exactly as it does for the
   board (`GameMessageBus.afterCommit`).

### 2.2 Bus layer (pure, unit-tested)

**New event** in `src/bus/types.ts` / `deriveEvents.ts`:

```ts
| { type: "cardsDealt"; seats: number[]; dealerSeat: number }
```

Emitted when a seat present in both snapshots has no hole cards in `prev` and
two in `next` (masked or real — `isMaskedHand || isRevealedHand`), collected in
ascending seat order, with `next.dealer`. Not gated to `sameHand`: with the
engine-driven start the deal lands on the `handStarted` frame. `prev ===
undefined` still yields nothing (late mount is not a deal). A seat that is
`WAITING_FOR_BIG_BLIND` never gains cards, so it is naturally excluded (see
`usePlayerData.ts:91-93`).

**New decorator** `src/bus/decorators/holeCardDeal.ts`, registered in
`buildDefaultDecorators`:

```ts
{ kind: "dealHoleCards", seats, staggerMs: HOLE_CARD_STAGGER_MS, ackTimeoutMs }
```

- `seats` re-ordered **clockwise from the seat after the button**, wrapping at
  `maxPlayers` — the issue's "first active player left of the dealer". The
  engine hands the deck out in seat order, but the cards are face-down, so the
  visual order is free to follow the felt.
- `ackTimeoutMs = 2 × seats.length × HOLE_CARD_STAGGER_MS + DEAL_FLIGHT_MS +
  HOLE_CARD_FLIP_MS + ACK_MARGIN_MS` — the same budget shape as
  `DEAL_CARDS_ACK_TIMEOUT_MS`, computed per frame from the actual seat count so
  heads-up is not budgeted like 9-max.
- No `minDisplayMs` / `holdPreviousMs`: the ack is the pacing, as for the board.
- `AnimationHint` gains an optional typed `seats?: number[]` (no `any`, no
  reuse of `cards` for a different meaning).

**Timing** in a new `src/bus/timing.ts` (the runout plan's Phase 4, pulled
forward): `HOLE_CARD_STAGGER_MS = 90`, `DEAL_FLIGHT_MS = 200`,
`HOLE_CARD_FLIP_MS = 300`, plus the existing `CARD_STAGGER_MS`, `CARD_DROP_MS`,
`ACK_MARGIN_MS` moved in, exported to CSS as custom properties on the table
root so the keyframes cannot drift from the JS budgets. Starting values give a
full 9-max deal of ~2.0 s (18 flights on a 90 ms metronome, the last landing at
~1.7 s, flip after) and a heads-up deal of ~0.8 s; both are constants to tune,
not policy.

### 2.3 Render layer

**`useHoleCardDeal()`** (`src/hooks/animations/useHoleCardDeal.ts`), the
per-seat twin of `useCardAnimations`. Consumes `latestItem`:

- `dealHoleCards` hint → build a timeline: flight *k* (0-based, over
  `2 × seats.length`) departs at `k × staggerMs` for seat `seats[k % n]`, card
  `⌊k / n⌋`; a seat becomes `dealt` when its second card lands
  (`depart + DEAL_FLIGHT_MS`); `flipViewer` turns true when the last card
  lands; `ackDone(ackId)` fires `HOLE_CARD_FLIP_MS` after that. Timers are owned
  by the hook and cleared on unmount / next commit, exactly like
  `useCardAnimations` (the bus timeout is the backstop).
- `handStarted` without a deal hint → reset (`dealt = ∅`).
- Any other commit → **reconcile**: `dealt` = seats whose snapshot has cards.
  This is also the catch-up path — under backpressure the drain does not wait
  for the ack, so a newer frame simply snaps every seat to truth and the
  in-flight cards are dropped.
- Late mount → initial `dealt` = seats with cards, no animation.
- Setting off or `prefers-reduced-motion` → mark all seats dealt and ack at once.

Exposed through a small **`HoleCardDealProvider`** (Context → Provider → Hook,
UI Commandment 3) so the three consumers read one memoized value:
`{ isDealt(seat), flights, viewerFlipped }`.

**`DealingLayer`** (`src/components/playPage/Animations/DealingLayer.tsx`),
mounted inside the 1000×500 table div next to the dealer button. Renders one
`<img>` of the current card back (`getCardBackUrl(cardBackStyle)`) per flight,
absolutely positioned at `DECK_ORIGIN`, animated to its slot by a single CSS
keyframe using per-element custom properties (`--dx`, `--dy`, `--delay`) —
one render, no per-frame JavaScript, at most 18 elements, removed once the
last one lands. This is the CPU-neutral choice given what ui#600 just cleaned
up; framer-motion is a dependency but nothing imports it, and this does not
need it.

**Seat components** gate on `isDealt(seat)`:

- `OppositePlayer.tsx` — keep the placeholder until dealt, then the two backs.
- `Player.tsx` — until dealt, the placeholder; from dealt until
  `viewerFlipped`, the backs; then the faces. The flip reuses `UserCards.css`
  (`.handcard` / `.handcard.flipped`), which finally gets an importer. Winner
  lift / mute classes are unchanged.

Both already tolerate an empty render (the `w-[120px] h-[80px]` placeholder),
so layout does not shift.

### 2.4 Geometry

`stageGeometry.ts` gains:

- `DECK_ORIGIN`: table-div coordinates of the deck zone — the felt centre,
  nudged above the community-card row so cards visibly *leave* the board area.
- `getHoleCardSlotPositions(tableSize)`: for each seat, the two card centres in
  table-div coordinates, derived from `SEAT_COORDS` the way `getChipPositions`
  is, with a per-card offset (`±HOLE_CARD_DX`, `HOLE_CARD_DY`) matching where
  `Player`/`OppositePlayer` draw their 60×80 cards relative to the seat anchor.
- Exposed through `getAllPositions` as `positions.holeCards` so
  `useTableLayout` memoizes it with everything else, and the layer maps seat →
  position with the same rotation formula as the dealer button.
- The geometry debug overlay in `Table.tsx` gets a cards marker toggle next to
  `showDealers` so
  the offsets are tuned by eye once, per table size, instead of guessed.

### 2.5 Settings and accessibility

- `GameSettings.dealingAnimation` (default **on**, localStorage
  `setting_dealanimation`, toggle in the settings panel) — the "disable on
  low-end devices" option from the issue thread.
- `prefers-reduced-motion: reduce` disables it too, in the hook (instant deal +
  immediate ack) and in CSS (no flight keyframe), matching `Table.css:566`.
- The decorator still attaches the hint either way: the bus does not know
  settings, and the ack contract is what keeps the drain honest.

### 2.6 Interactions checked

- **Engine-driven hand start.** The `new-hand` frame carries blinds + deal +
  `handStarted`. The hook resets on `handStarted` *and* then runs the deal from
  the same frame's hint; the blind chips paint at commit, the cards fly after —
  which is the natural order at a real table.
- **Board deal in the same frame.** Cannot happen: preflop never carries
  community cards, so `communityCardStagger` attaches nothing on the deal frame
  and the two choreographies never overlap.
- **Runout expansion.** `expandFrames` only synthesises street frames from a
  frame that already has hole cards on both sides; the deal frame is never
  expanded.
- **Showdown reveal** (`cardsRevealed`) is a different event on a different
  frame; `OppositePlayer` keeps its existing showing-cards path.
- **Hole-card watchdog (ui#409).** If the viewer's real cards are missing on
  the deal frame, the viewer keeps seeing backs until the watchdog's
  resubscribe delivers them; the reconcile branch then snaps to faces. No new
  failure mode.
- **Table rotation / seat-at-bottom** changes `startIndex` only; the layer
  recomputes targets from `positions.holeCards` on the next render.
- **Replay mode** goes through the same bus, so replays deal too.

### 2.7 What this deliberately does not do

- No per-card *content* animation for opponents (they are backs; nothing to
  show). No dealing sound in v1 — trivially added later as a `SoundHint` on the
  same hint through `remoteActionSound`'s pattern.
- No burn cards, no dealer avatar, no chip-collection animation.
- No change to when cards are *dealt* — that is the engine's, and the two-track
  invariant means submitting an action never waits on any of this.

---

## 3. Implementation plan

Four PRs, each independently mergeable and behaviour-preserving until the last.

### Phase 0 — Timing + geometry (no behaviour change)

- `src/bus/timing.ts` with the existing board constants moved in (one source)
  and the three new ones; CSS custom properties emitted on the table root.
- `DECK_ORIGIN`, `getHoleCardSlotPositions`, `positions.holeCards`, and the
  debug marker toggle. Tune the offsets for 2/4/6/9 with the markers.
- Tests: geometry (slots inside the table div, two per seat, rotation
  round-trip), timing exports.

### Phase 1 — Bus (pure)

- `cardsDealt` event; `holeCardDeal` decorator + registration; `AnimationHint.seats`.
- Tests: `deriveEvents` (masked and real pairs, hand-boundary frame, late mount
  yields nothing, waiting-for-BB excluded, no event when nobody gains cards);
  decorator (clockwise order from button+1 with wrap, heads-up, seats without
  cards skipped, ack budget formula); `decorators.test.ts` merge with the other
  hints on the engine-start frame.
- Hints are inert until Phase 2 consumes them — safe to ship alone.

### Phase 2 — Render

- `useHoleCardDeal` + `HoleCardDealProvider`; `DealingLayer` + CSS; gating in
  `Player` / `OppositePlayer`; the viewer flip via `UserCards.css`; the setting
  and reduced-motion handling.
- Tests (renderHook with fake timers, as `useCardAnimations.test.ts`): seats
  become dealt in hint order at land times; viewer flips after the last land;
  ack fires once after the flip and never before; unmount clears timers; a
  non-deal commit snaps to truth mid-flight; `handStarted` resets; late mount
  is instant; setting off / reduced motion acks immediately. Component tests:
  the layer renders `2 × n` flights with increasing delays; `Player` shows the
  placeholder → backs → faces sequence; `OppositePlayer` shows placeholder →
  backs.
- Manual gate: 9-max, 6-max, heads-up, rotated table, mobile portrait, tab
  hidden during a deal (ack timeout path), settings toggle live.

### Phase 3 — Polish (optional, separable)

- Deal sound hint; a speed multiplier on `timing.ts` (slow/normal/fast/instant)
  as the runout plan proposed, also driving Playwright via
  `window.__B52_SPEED__`; delete any CSS left unused.

---

## 4. Risks & open questions

- **Slot offsets vs. real render positions.** The two seat components draw
  their cards with Tailwind classes, so the slot geometry is a documented
  constant, not measured. Mitigation: the debug markers, and a note in both
  components that the card row position is mirrored in `stageGeometry`. A
  DOM-measured alternative was rejected: it would reintroduce the synchronous
  layout reads ui#604 just removed from the hot path.
- **Backpressure makes it look abrupt** (cards snap) — intended, identical to
  the board's behaviour, and better than a lagging client watching a deal it
  is already behind.
- **Ack budget vs. `HOLD_CAP_MS`.** Ack budgets are not counted in
  `accumulatedHoldMs`, so a ~3.8 s 9-max budget cannot trip the hold cap; the
  depth cap is unaffected (one frame).
- **Decide:** starting `HOLE_CARD_STAGGER_MS` / `DEAL_FLIGHT_MS` values
  (product feel); whether the setting default is on; whether blind chips should
  animate *before* the cards fly on the engine-start frame (they currently
  paint at commit).

---

## 5. Test strategy

Every new module is pure or hook-shaped and follows an existing test file:
`deriveEvents.test.ts`, `decorators.test.ts`, `useCardAnimations.test.ts`
(fake timers + mocked contexts), and the `stageGeometry` tests. No new test
infrastructure. Coverage target: the bus additions at parity with the board's
(100% of `holeCardDeal`, the new `deriveEvents` branch), the hook at parity
with `useCardAnimations`.

## 6. References

- ui#21 (this feature), ui#600 / #604 (CPU budget), ui#409 (hole-card
  watchdog), ui#443 (pacing)
- `docs/plans/2026_07_13_ws_action_bus.md` §2.4 decorators, §2.6
  backpressure, §2.7 animation acks
- `docs/plans/2026_09_09_runout_frame_expansion.md` Phase 2 (hole-card reveal),
  Phase 4 (timing config)
- poker-vm#2617 / pokerchain#363 — engine-driven hand start (the deal now
  arrives on the `new-hand` frame)
