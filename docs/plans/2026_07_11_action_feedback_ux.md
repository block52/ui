# 2026-07-11 — Action Feedback UX (click → confirmed state)

**Status:** Proposed — three candidate approaches, phased recommendation at the end.
**Author:** Sam
**Problem (product owner, verbatim):** "The vote/action is sometimes too fast. Buttons are
fire-and-forget; the UI mutates from WS updates. When you click an action it's too fast —
we need some kind of feedback."

On a fast local/gateway path the confirming WS frame lands ~150ms after the click: the
button spinner exists for roughly one frame, then the whole action panel unmounts. The
click feels like *nothing happened*. On a slow path the spinner does show, but there is no
"it worked" moment at the end — the panel just silently disappears. We want a deliberate
acknowledgement between click and confirmed state, on both paths.

---

## 1. Verified current flow (read 2026-07-11)

A FOLD click, end to end:

| Step | Where | Notes |
|------|-------|-------|
| 1. Click | `MainActionButtons.tsx:42-49` → `onFold` → `PokerActionPanel.tsx:657` | `FoldButton` (`src/components/Footer/FoldButton.tsx:17`, `.btn-fold`) |
| 2. Wrap | `handleActionWithTransaction` (`PokerActionPanel.tsx:359-387`) | Sets `loadingAction` (`:66`) + `pendingActionCount`/`pendingHandNumber`/`pendingActionIndex` (`:84-92`, captured at `:361-367`) |
| 3. Sound | `PokerActionPanel.tsx:368-370` → `useActionSounds` (`src/hooks/notifications/useActionSounds.ts:43-59`) | Plays at **submit** time, gated on the `playerActionSounds` setting — this is currently the only fast-path feedback that reliably registers |
| 4. Submit | `await actionFn()` (`:371`) → `handleFold` (`src/components/common/actionHandlers.ts:127`) → `foldHand` → `executeTransportAction` (`src/hooks/playerActions/transportAction.ts:76-102`) | **Awaited, not literally fire-and-forget.** Gateway: signed POST `/actions` (`:104-167`). Chain: `performActionSync` (`:95`), returns in ~50ms under SYNC broadcast |
| 5. Spinner | `MainActionButtons.tsx:66-70` (`CHECKING...`), `:86-95` (`CALLING...`/`JAMMING...`), `:107-110` (`RAISING...`/`BETTING...`/`JAMMING...`); `FoldButton.tsx:25-31` (`FOLDING...`) | All buttons disabled via `loading !== null` (`MainActionButtons.tsx:45,64,84,102,128`) — this is the existing double-submit guard |
| 6. Confirm | WS `state` frame → `GameStateContext.tsx:174-298`, `setGameState` at `:255` → `usePlayerLegalActions` recomputes; `isPlayerTurn = nextToAct === seat` (`usePlayerLegalActions.ts:90`) flips false → `showActionButtons` false (`PokerActionPanel.tsx:491`) → button row unmounts (`:628`) | The watcher effect (`PokerActionPanel.tsx:396-409`) clears `loadingAction` when `actionCount` / shared next-action `index` (`transportAction.ts:49-58`) / `handNumber` advances |
| 7. Escape | `DIRTY_STATE_TIMEOUT_MS = 8000` (`PokerActionPanel.tsx:98`), timeout effect `:415-428` | Re-enables the button if no confirming state arrives |

Two latent facts that shape every approach below:

**F1 — Submit errors are swallowed before the panel sees them.** The
`createSimpleHandler` / `createAmountFirstHandler` / `createTableIdAmountHandler`
factories catch and `return null` (`actionHandlers.ts:56-64`, `:83-91`, `:110-118`), so
the `catch` in `handleActionWithTransaction` (`PokerActionPanel.tsx:377-384`) effectively
never fires for a transport failure (gateway 422, CheckTx reject, network error). Today a
*failed* submit shows an 8-second spinner, then silently re-enables. Any feedback design
must distinguish "sent, waiting" from "rejected" — so this must be fixed first (see §2).

**F2 — The gateway ack already carries the post-action state, and we throw it away.**
`GatewayActionResponse.state` (`src/apis/GatewayApi.ts:29-36`; comment at `:24-28`: "the
submitter can render immediately, no socket round-trip") is discarded when
`executeGatewayAction` builds its result (`transportAction.ts:159-166`). Approach B is
built on this.

Also relevant, existing and reusable: `react-toastify`'s `<ToastContainer>` is mounted in
`App.tsx:131`; table-level animation machinery exists (`TurnAnimation.tsx`,
`WinAnimation.tsx`, `useChipPositions.ts`); `useOptimisticAction.ts` exists but is
**dead code** — exported from `playerActions/index.ts:19,49`, consumed by nothing (the
panel goes through `actionHandlers.ts` directly), and its WS `sendAction` pre-announce +
the `event: "pending"` handler (`GameStateContext.tsx:262-273`) belong to the old PVM
path. `navigator.vibrate` is unused anywhere in `src/`.

---

## 2. Prerequisite (all approaches): stop swallowing submit errors

Change the three factory catches in `actionHandlers.ts` to `console.error` **and
rethrow** instead of `return null`. `handleActionWithTransaction`'s existing catch
(`PokerActionPanel.tsx:377-384`) already does the right thing — clears all pending state
so the player can retry immediately — it just never gets the chance. Add a
`toast.error(...)` in that catch (container already mounted, `App.tsx:131`) so a rejected
action says *why* instead of spinning for 8s. This is a small, self-contained PR and is
the "failed path" story for every approach below. Check the ~6 other callers of these
handlers (auto-fold/auto-muck/etc. pass their own error callbacks and are already
try/catch-wrapped at the hook level) — the factories' `hash || null` contract stays, only
the error path changes.

Effort: **S**.

---

## 3. Approach A — Designed acknowledgement window (press → sending → confirmed pill)

### Concept

Keep the WS as the sole authority; fix the *time domain* instead. Turn the accidental
"one-frame spinner then vanish" into a deliberate three-phase micro-interaction with a
**minimum visible duration**, rendered in the footer slot the buttons occupied — so the
fast path can't be invisible and the slow path reads as "working", not "stuck".

### What the player sees/feels

1. **Press (0ms):** button depresses — `transform: scale(0.96)` + brightness dip on
   `:active` (today CALL/FOLD oddly scale *up* on active, `MainActionButtons.tsx:80`,
   `FoldButton.tsx:17` — fix that), plus `navigator.vibrate(10)` on supporting mobile.
   Existing action sound plays as today (`PokerActionPanel.tsx:368-370`).
2. **Sending (0 → confirm):** the button row is replaced by a single compact **ack pill**
   in the same footer slot: pulsing dot + "Folding…" / "Raising to $6.00…". Because it is
   one calm element (not four disabled buttons with one spinning), it reads as a state,
   not a glitch.
3. **Confirmed:** the pill snaps to its confirmed form — check mark, action color
   (`--accent-danger` for fold, call green, raise gradient — reuse the `.btn-*` palette in
   `Footer.css:82-140`), label "Folded ✓" / "Raised to $6.00 ✓" — holds ~600ms, then fades
   out. **Total minimum on-screen time ~900ms even if the WS confirms in 150ms**; on the
   fast path phases 2→3 just transition early into the confirmed hold.
4. **Failed (rejected or 8s timeout):** pill turns red "Couldn't send — try again", fades,
   buttons return (they already re-enable via the timeout effect, `PokerActionPanel.tsx:415-428`).

### Implementation sketch

- New `src/components/Footer/ActionAckPill.tsx` — dumb presentational component:
  `{ phase: "sending" | "confirmed" | "failed"; label: string; variant: "fold" | "check" | "call" | "raise" }`.
  Keyframes in `Footer.css`. Renders `role="status" aria-live="polite"` so the label is
  announced.
- New `src/hooks/playerActions/useActionAck.ts` owning the phase machine. One `useState`
  per concern: `ackPhase`, `ackLabel`, `ackVariant`. API:
  `begin(actionName, label)` / `confirm()` / `fail()`. `confirm()` respects
  `MIN_ACK_VISIBLE_MS` (~300ms sending floor) before switching, then auto-clears after
  `CONFIRMED_HOLD_MS` (~600ms) via a timeout cleaned up in the effect return.
- `PokerActionPanel.tsx` wiring — three touch points, all in code that already exists:
  - `handleActionWithTransaction` (`:359-387`): call `ack.begin(...)` next to
    `setLoadingAction` (`:364`); `ack.fail()` in the catch (`:377`).
  - The confirm watcher (`:396-409`): call `ack.confirm()` where it clears
    `loadingAction` (`:403-408`). This is the key trick: **the pill's "confirmed" flash is
    driven by the exact same signal that already ends the dirty state** (actionCount /
    shared index / handNumber advance) — no new reconciliation logic, no guessing.
  - The timeout escape hatch (`:415-428`): `ack.fail()`.
- Render: inside the `!hideOtherButtons` block (`:596`), render `<ActionAckPill … />`
  **instead of** `MainActionButtons`/`RaiseBetControls` while `ackPhase !== null`. The
  pill does not depend on `legalActions`, so it survives the state flip that unmounts the
  buttons at `:628` — `PokerActionPanel` itself stays mounted. Label is captured at
  submit time (e.g. "Raising to $6.00" from the same `raiseToAmount` the button showed),
  so no stale-props freezing is needed.
- Double-submit: unchanged — buttons are gone while the pill shows, and `loadingAction`
  still gates everything (`MainActionButtons.tsx:45` etc.).
- Haptic: tiny `useActionHaptics.ts` beside `useActionSounds.ts` (`navigator.vibrate?.(10)`
  behind the same `playerActionSounds`-style settings toggle in `GameSettingsContext`).

Fast path: click → pill "Folding…" (300ms floor) → "Folded ✓" (600ms) → fade. Slow path:
pill pulses until the watcher or timeout fires. Failed path: §2 makes the catch fire →
red pill + toast.

### Tradeoffs / risks

- The 300ms sending floor **delays nothing real** (the request went out at click) but does
  hold the *next* street's buttons out of the slot ~900ms after confirm. If the player is
  next to act again immediately (heads-up), that's a perceptible pause — mitigate by
  cutting the confirmed hold short the moment `isPlayerTurn` flips true again.
- Pure additive UI; zero correctness risk — it renders no game state, only a receipt of
  what was clicked, confirmed by the signal that already exists.
- Mobile landscape (`isMobileLandscape`, `PokerActionPanel.tsx:104`) has a very short
  footer — pill must have a compressed variant.
- Accessibility is a net win (`aria-live` announcement of the acted state; today the
  buttons just disappear).

**Effort: M** (S for the pill + wiring, the rest is CSS polish and the settings toggle).

---

## 4. Approach B — Early authoritative state: inject the gateway ack's post-action state

### Concept

Fix the *data domain*: the feedback IS the table updating — the problem is only that the
update waits for the socket. The gateway already returns the **validated post-action
state in the ack** (`GatewayApi.ts:29-36`) ~50-150ms after click, and we discard it
(`transportAction.ts:159-166`). Feed that ack state through the exact same pipeline the
WS uses, so the submitter's UI mutates on the HTTP response instead of the broadcast.
This is *not* optimistic guessing — it's the gateway's committed answer; the later WS
frame is idempotent.

### What the player sees/feels

Click CALL → within ~100ms your chips slide out, the pot updates, the turn ring
(`TurnAnimation.tsx`) moves to the next player, your buttons yield to the next street —
i.e., exactly today's confirmed transition, but reliably fast and *causally attached to
the click*. Combined with the existing click-time sound it feels like a direct
manipulation. On chain transport or a slow gateway, behavior is unchanged (spinner →
WS confirm). On rejection (422), `submitAction` already throws
(`transportAction.ts:155-157`) → with §2, immediate re-enable + error toast.

### Implementation sketch

- **Expose an injection point on GameStateContext.** Extract the message-handling body of
  `ws.onmessage` (`GameStateContext.tsx:174-298`) — normalize → validate
  (`validateGameState`) → `setGameState` + `setLatestGameState` (`:255-256`) — into a
  `applyStateMessage(message)` `useCallback`, used by both `ws.onmessage` and a new
  context method `injectAckState(state: unknown)`. Publish it module-side the same way
  `setLatestGameState` is (`transportAction.ts:26-31`), since `executeTransportAction` is
  a plain async function with no React context: `setAckStateSink(fn)` registered by the
  provider.
- **Monotonic guard (the one piece of new correctness logic).** Before applying, compare
  `nextActionIndex(ackState)` (`transportAction.ts:49-58`) against
  `nextActionIndex(latestGameState)`; apply only if strictly greater. This makes
  ack-then-WS and WS-then-ack both safe: whichever arrives second with an equal/lower
  index is dropped. Unit-test this in `src/tests/` (ack newer, ack equal, ack stale,
  ack for a different `gameId` — must also check `gameId`).
- **Plumb it.** In `executeGatewayAction` (`transportAction.ts:142-157`), after the ack
  check, call the sink with `response.state` (shape per poker-vm#2226: same
  `GameStateResponseDTO` envelope as the WS `state` message — reuse
  `normalizeGatewayMessage` / `extractGameDataFromMessage` from `gameTransport.ts` /
  `gameFormatUtils.ts` rather than a second parser; Commandment 12).
- **No panel changes needed.** The injected state advances the shared action index, so
  the existing confirm watcher (`PokerActionPanel.tsx:396-409`) clears `loadingAction`
  by itself, and `usePlayerLegalActions` flips the buttons — the whole downstream tree is
  agnostic about where the state came from.
- Double-submit: unchanged (`loading !== null` guard), and the window it must cover
  shrinks from ~150ms-8s to ~100ms.
- **Out of scope / phase 2 if ever:** a true optimistic overlay for chain transport
  (locally simulating "I folded" before any server answer). That *would* require guess
  reconciliation, a visual rollback story, and per-action state simulation — expensive
  and contradiction-prone. Recommend not building it; chain transport keeps Approach A's
  pill as its feedback.

### Tradeoffs / risks

- **Solves latency, not acknowledgement.** On the (already fast) gateway path it makes
  the update instant — but "instant with no ceremony" is half of the original complaint.
  B wants A (or C) layered on top for the "I did that" moment; by itself it can make the
  too-fast feel *more* abrupt.
- Ordering: the guard must be airtight or a stale WS frame could visually "undo" an
  action for a frame. The index-monotonic rule is simple and testable, but note the WS
  handler currently applies every state frame unconditionally (`GameStateContext.tsx:255`)
  — consider applying the same monotonic guard to WS frames while in there (separate,
  careful change; replay mode `loadHistoricalState` at `:374-418` must bypass it).
- Gateway-transport only; chain tables see no benefit.
- Touches the state spine of the app — needs the pvm-stub e2e suite (full-hand Playwright
  run) as the regression net.

**Effort: M** (small diff, but tests + care around the state spine).

---

## 5. Approach C — Committed-action echo on the table (seat badge + chip fly, keyed to `previousActions`)

### Concept

Move the confirmation out of the footer and onto the *table*, and derive it purely from
committed data: when a new `previousActions` entry with **my address** and an index
greater than the one captured at submit appears in the game state, play a confirmation
moment at my seat — action badge + chips flying to the pot for chip actions. Because it
renders only what the server committed, it can never contradict, and it doubles as
feedback about *everyone's* actions (opponents get the same echo), which the table
currently lacks too.

### What the player sees/feels

Click RAISE → button feedback as today (or A's pill) → ~150ms later a "RAISE $6.00" badge
pops over your avatar with the raise color, your chip stack animates a chip sprite along
the seat→pot path, the pot count ticks up. Fold: card-toss/gray-out flourish at your seat
with a "FOLD" badge. The badge lingers 2-3s (or until the street ends), so even if you
looked away during the click you can see what you did. Slow path: the button spinner
covers "sending"; the echo fires whenever the state lands — the two together read as
send → confirm. Failed path: no entry ever appears; §2's toast covers it.

### Implementation sketch

- New `src/hooks/game/useAppliedActions.ts`: subscribes to `useGameData()`, diffs
  `gameState.previousActions` (`ActionDTO[]`, each with `index`, address, action, amount —
  the same array the panel already threads to `MainActionButtons` at
  `PokerActionPanel.tsx:652`) against a `useRef` of the last seen max index; emits
  `{ action: ActionDTO; isMe: boolean }` for each new entry. Hand-boundary reset: when
  `handNumber` changes, reset the ref (indexes restart) — same wrinkle the panel's
  `pendingHandNumber` exists for (`PokerActionPanel.tsx:79-85`).
- New `src/components/playPage/Animations/ActionEcho.tsx` (+ `.css`), rendered by the
  seat components (`Players/Player.tsx` / `OppositePlayer.tsx`) or positioned like
  `TurnAnimation.tsx:20-26` from the seat position map; chip-flight path from
  `useChipPositions.ts`. Badge text via the formatting already in
  `ActionsLog.utils.ts` (`getActionLine`) — don't re-derive amounts (Commandment 12:
  reuse the tested formatter).
- Filter to player actions (skip deal/blind-auto noise) via `PlayerActionType` from the
  SDK.
- Optionally move the *confirm* half of sound here: keep a soft click at submit
  (`PokerActionPanel.tsx:368-370`), play the chip/fold sound from `useActionSounds` when
  the echo fires — sound then means "committed", and opponents' actions get sounds for
  free (today's sounds are submit-side, self-only).
- Double-submit / panel behavior: untouched; this approach adds no writes anywhere.

### Tradeoffs / risks

- Purely reactive to committed state → zero correctness risk, but **no "sending" story**:
  on a slow path the only in-flight feedback is still the existing spinner. C is a
  confirmation surface, not a latency mask — it pairs with A rather than replacing it.
- Animation load: every action by every player now animates. Needs throttling when
  frames arrive in bursts (e.g. reconnect delivers a state jump spanning several
  actions — cap to the latest per seat, never queue a replay).
- Placement math on mobile landscape and different table sizes is fiddly; reuse the
  positioning that `TurnAnimation` already solved.
- Duplicate-echo risk if a state frame is re-delivered — the max-index ref handles it,
  but the hand-boundary reset must be right or echoes go missing at street/hand ends.
- Accessibility: visual-only; keep A's `aria-live` (or add one here) for screen readers.

**Effort: M-L** (hook is S; the animation/positioning polish across viewports is where
the time goes).

---

## 6. Recommendation

Phased, cheapest-reliable first:

1. **§2 error rethrow + failure toast** — prerequisite for everything; also fixes a real
   today-bug (failed submit = 8s dead spinner). Ship alone. (S)
2. **Approach A (ack pill + press/haptic polish)** — directly answers the complaint on
   *both* fast and slow paths, no state-spine risk, and its confirm/fail hooks are the
   watcher and timeout effects that already exist. This is the core deliverable. (M)
3. **Approach B (gateway ack-state injection)** — the latency fix that makes A's
   confirmed flash arrive near-instantly and shrinks the stale-panel window the whole
   `pendingActionIndex` machinery guards against. Skip the chain-side optimistic overlay
   entirely. (M)
4. **Approach C (table echo)** — polish layer once A/B land; also upgrades opponent-action
   visibility. (M-L)

A and C are additive UI; B is the only change to the state path and rides the pvm-stub
e2e suite for regression cover.

## 7. Open questions

- **Timing constants:** are 300ms sending-floor / 600ms confirmed-hold right? Needs a
  feel-test at the table (pvm-stub makes this easy offline). Heads-up back-to-back turns
  are the stress case.
- **Does the gateway ack `state` envelope always match the WS `state` message** (poker-vm#2226
  shape assumed in §4)? Verify against the live gateway before building B; if it can be
  partial/absent, B degrades to a no-op per action (fine).
- **Sound semantics:** move confirm sounds to committed-time (C) or keep submit-time?
  Two-stage (soft tick → chip sound) doubles audio events; needs a settings story.
- **Should WS state application become index-monotonic globally** (noted in §4)? It's the
  right invariant but touches replay mode and reconnect catch-up — separate investigation.
- **`useOptimisticAction` / `event: "pending"` dead code** (`useOptimisticAction.ts`,
  `GameStateContext.tsx:262-273`): delete as part of B, or leave? It overlaps confusingly
  with this work's naming.
- **Timer interplay:** the per-turn timer (`usePlayerTimer`, auto-fold at
  `PokerActionPanel.tsx:212-228`) keeps running during the ack window — if an auto-action
  fires while a manual one is in flight, both ride the same `loadingAction` slot; worth a
  test either way.
