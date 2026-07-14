# PLAN-280: Chip Leader Board

Issue: [block52/ui#280](https://github.com/block52/ui/issues/280)

## Status: 🅿️ PARKED (2026-07-14)

Plan drafted, not started. Parked pending resolution of the data-source blocker below.

**Notes / why parked:**
- The core blocker (see next section) is that the **indexer does not expose per-player
  won/lost amounts today** — only `winner_count`. "Fetch direct from the indexer" as
  requested cannot be fully met until the indexer/poker-vm-sdk adds this. That's an
  upstream (non-UI) change, so it gates the "real" version of this feature.
- Phase 1 (toggle + modal + live-WS accumulation) is buildable now with no backend
  changes, but it resets on refresh and only covers hands seen while the tab was open —
  a partial solution. Decide whether that's worth shipping standalone before un-parking.
- **To un-park:** confirm with @bitcoinbrisbane (a) the session scope, and (b) whether
  the indexer team will add a `/leaderboard` endpoint or per-player amounts on hands.
  See **Open Questions** at the bottom.

## Goal

Add a **Chip Leader Board** modal to the poker table that ranks the players in the
current session by net chip performance — **hands-won value less hands-lost value**.
It must be toggleable (on/off) from the table settings panel, and the data should be
fetched **directly from the indexer in the frontend** (no new backend endpoint).

Reference UX: https://www.youtube.com/watch?v=CAaDk1W9Vo0&t=666s (see screenshot in issue).

## Key constraint driving the design: where does per-player win/loss come from?

The blocker to resolve up front — the two data sources give us *different halves* of what we need:

| Source | Has | Missing |
|--------|-----|---------|
| **Indexer** (`IndexerApi.getHands(gameId)` → `/api/v1/hands?game_id=...`) | Full session hand history (every `hand_number`, `winner_count`, community/revealed cards, block heights) | **No per-player won/lost amounts.** `HandResult` only carries `winner_count` + `community_cards`. |
| **Live WS state** (`gameState.winners` via `useWinnerInfo` / `useGameResults`) | Per-player amounts (`WinnerInfo.amount` / `formattedAmount`) with seat + address | Only the **current hand** — no accumulated session totals, and lost when you refresh. |

So "hands won value less hands lost value **for the session**" is **not directly
answerable from the indexer as it exists today**. This is the single most important
thing to settle before building. See **Open Questions** — pick a path there first.

Relevant code:
- `src/apis/Api.ts` — `IndexerApi.getHands(gameId)`, `getHand(gameId, handNumber)`
- `src/pages/explorer/types.ts` — `HandListItem`, `HandDetail`, `HandResult`, `RevealedCard`
- `src/hooks/game/useWinnerInfo.ts`, `src/hooks/game/useGameResults.ts` — live per-hand winners
- `src/context/IndexerApiContext.tsx` — `useIndexerApi()` hook, base URL `VITE_INDEXER_URL`

## Recommended approach

**Phase this. Ship the toggle + modal shell + live-state accumulation first (real value,
no indexer changes), then move the source of truth to the indexer once it exposes
per-player amounts.**

### Phase 1 — Modal + settings toggle + client-side session accumulation

1. **Settings toggle** (`src/context/GameSettingsContext.tsx` + `TableSettingsSidebar.tsx`)
   - Add `showLeaderboard` boolean + `toggleShowLeaderboard`, persisted to
     `localStorage` key `setting_showleaderboard`, mirroring the existing `autoMuck`
     pattern exactly (`LS_KEY_*`, `useCallback` toggler).
   - Add a `ToggleRow` entry to `TableSettingsSidebar.tsx` ("Chip Leader Board — show
     session chip standings").

2. **Session accumulation hook** `src/hooks/game/useChipLeaderboard.ts`
   - Subscribe to `gameState.winners` (via `useWinnerInfo` / `useGameResults`) and the
     current `hand_number`.
   - Maintain a per-address running total keyed by `hand_number` so the **same hand is
     never counted twice** across WS re-renders (accumulate on hand-number change, not
     on every render). Track `{ address, seat, netChips, handsWon, handsLost }`.
   - Derive net as `won − lost`; sort descending. Return sorted rows.
   - Caveat to document in-code: this only covers hands observed while the tab was open;
     a refresh resets it. That limitation is what Phase 2 fixes.

3. **Leaderboard modal** `src/components/modals/LeaderboardModal.tsx`
   - Build on the shared `src/components/common/Modal.tsx` base (follow
     `MODAL_STYLE_GUIDE.md` and `BuyInModal.tsx` as the reference).
   - Props: `{ isOpen, onClose, tableId }`. Render ranked rows: position, player
     (address/avatar/seat), net chips (green/red), hands won/lost.

4. **Wiring into the table** (`src/components/playPage/Table.tsx` +
   `TableHeader.tsx` + `TableModals.tsx`)
   - `const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)`.
   - Only render the trigger when `showLeaderboard` is on. Add a leaderboard icon
     button in `TableHeader` next to the settings toggle (`IoSettingsOutline`) /
     leave-table (`RxExit`) buttons.
   - Render `<LeaderboardModal .../>` in `TableModals.tsx` conditionally, matching how
     the other modals are orchestrated there.

### Phase 2 — Move source of truth to the indexer (fulfils "fetch direct from the FE")

Requires the indexer to expose per-player, per-hand chip deltas. Two options:

- **2a (preferred): new indexer endpoint** e.g. `GET /api/v1/leaderboard?game_id=...`
  returning pre-aggregated `{ address, seat, hands_won, hands_lost, net }[]`.
  Add `IndexerApi.getLeaderboard(gameId)` in `src/apis/Api.ts` and a
  `useLeaderboard(gameId)` hook that calls it via `useIndexerApi()`. Swap the modal's
  data source from the Phase-1 accumulation hook to this. **This is a poker-vm-sdk /
  indexer-repo change, not just UI** — coordinate/track separately.
- **2b: aggregate client-side from richer hand results** — if `getHand(gameId, n)` is
  extended to include per-player win/loss amounts, iterate hands from the indexer in the
  FE and aggregate. Fully FE-side and survives refresh, but N calls/session (paginate;
  `getHands` is already `limit=100`).

Once Phase 2 lands, the leaderboard is refresh-durable and covers the whole session
regardless of when the tab opened.

## Files touched

New:
- `src/hooks/game/useChipLeaderboard.ts` (Phase 1), `src/hooks/game/useLeaderboard.ts` (Phase 2)
- `src/components/modals/LeaderboardModal.tsx`

Modified:
- `src/context/GameSettingsContext.tsx` — `showLeaderboard` setting
- `src/components/playPage/Table/components/TableSettingsSidebar.tsx` — toggle row
- `src/components/playPage/Table/components/TableHeader.tsx` — trigger button
- `src/components/playPage/Table/components/TableModals.tsx` — render modal
- `src/components/playPage/Table.tsx` — open/close state
- `src/apis/Api.ts` — `getLeaderboard` (Phase 2, if 2a)

## Testing

- `GameSettingsContext` toggle persists to localStorage (unit, alongside existing settings tests).
- `useChipLeaderboard` accumulation: same hand not double-counted; net = won − lost;
  sort order; multi-winner split pots. Mock `gameState.winners` transitions (see
  `useSitAndGoPlayerResults.test.tsx` for the mocking pattern).
- Modal render + open/close via settings toggle.

## Open questions (resolve before Phase 2; ideally before starting)

1. **Session scope** — is "session" the whole game (`game_id`) lifetime, or since the
   player sat down? Whole-game is what the indexer can serve; "since I joined" needs a
   start marker. Confirm with the issue author.
2. **Per-player amounts** — confirm the indexer team can add per-player win/loss to
   hand results or a `/leaderboard` endpoint (Phase 2a vs 2b). Without one of these,
   "fetch direct from the indexer" can't be met and we're stuck at Phase-1 live-state
   accumulation.
3. **Units** — display in chips (wei-scale `stack`/`amount` strings) or formatted big
   units? Reuse existing `formattedAmount` formatting from `useWinnerInfo`.
4. **Split pots / ties** — how to attribute won value when `winner_count > 1`.
