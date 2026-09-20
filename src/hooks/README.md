# Poker VM Hooks Documentation

This directory contains custom React hooks for the Poker VM application. Hooks are organized by domain for easier discovery and maintenance.

## 📁 Directory Structure

```
hooks/
├── game/          # Game state, table data, and game flow hooks
├── player/        # Player-specific data and state hooks
├── playerActions/ # Player action handlers (bet, fold, raise, etc.)
├── wallet/        # Wallet connection and balance hooks
├── animations/    # UI animations and transitions
├── notifications/ # Toast and notification system hooks
└── README.md      # This file
```

## 🎮 Game Hooks (`hooks/game/`)

Hooks related to game state, table management, and game flow.

### Core Table Hooks

#### `useTableData()`
Returns formatted table data including blinds, pots, community cards, and player positions.

```typescript
const {
  tableDataType,
  tableDataAddress,
  tableDataSmallBlind,
  tableDataBigBlind,
  tableDataPlayers,
  tableDataCommunityCards,
  tableDataPots,
  isLoading,
  error
} = useTableData();
```

**Data Source:** GameStateContext (WebSocket subscription)
**Updates:** Real-time via WebSocket
**Use Case:** Displaying table information, game state

#### `useTableState()`
Provides current table state including game status and active round.

```typescript
const { currentTableId, tableState, isLoading } = useTableState();
```

**Dependencies:** useTableData()

### Game Flow Hooks

#### `useGameProgress()`
Tracks game progression through rounds (preflop, flop, turn, river).

```typescript
const {
  currentRound,
  isPreflop,
  isFlop,
  isTurn,
  isRiver
} = useGameProgress();
```

#### `useGameStartCountdown()`
Countdown timer for Sit & Go games waiting to start.

```typescript
const { secondsRemaining, canStart } = useGameStartCountdown(tableId);
```

#### `useGameResults()`
Processes and formats end-of-hand results including winners and payouts.

```typescript
const { winners, payout, showResults } = useGameResults();
```

### Table Discovery & Configuration

#### `useFindGames()`
Fetches list of available games from backend.

```typescript
const { games, isLoading, error, refresh } = useFindGames();
```

**Data Source:** Backend API
**Use Case:** Lobby game list

#### `useNewTable()`
Hook for creating new poker tables with form validation.

```typescript
const {
  createTable,
  isCreating,
  error,
  formState,
  updateFormField
} = useNewTable();
```

#### `useGameOptions()`
Parses and validates game configuration options.

```typescript
const {
  format,
  variant,
  smallBlind,
  bigBlind,
  maxPlayers,
  buyInMin,
  buyInMax
} = useGameOptions(tableId);
```

### Table Metadata Hooks

#### `useTablePlayerCounts()`
Tracks active, sitting out, and total player counts.

```typescript
const {
  activePlayers,
  sittingOutPlayers,
  totalPlayers,
  maxPlayers
} = useTablePlayerCounts();
```

#### `useTableTopUp()`
Handles automatic top-up functionality for cash games.

```typescript
const { topUp, isTopping Up, canTopUp } = useTableTopUp();
```

#### `useMinAndMaxBuyIns()`
Calculates valid buy-in ranges based on game type.

```typescript
const { minBuyIn, maxBuyIn, defaultBuyIn } = useMinAndMaxBuyIns();
```

### Position & Seat Hooks

#### `useDealerPosition()`
Tracks dealer button position.

```typescript
const { dealerPosition } = useDealerPosition();
```

#### `useNextToActInfo()`
Identifies which player should act next.

```typescript
const {
  nextToActSeat,
  nextToActPlayer,
  isCurrentPlayer
} = useNextToActInfo();
```

#### `useVacantSeatData()`
Lists available seats for joining.

```typescript
const { vacantSeats, hasVacantSeats } = useVacantSeatData();
```

### Tournament-Specific Hooks

#### `useSitAndGoPlayerResults()`
Displays Sit & Go tournament results and prize distribution.

```typescript
const { results, prizes, isComplete } = useSitAndGoPlayerResults();
```

> **Note:** Sit & Go joins go through the transport-aware `joinTable()`
> (`hooks/playerActions/joinTable.ts`) like every other join, which resolves a
> concrete empty seat and routes through the active transport (gateway by
> default, ui#440). The old `useSitAndGoPlayerJoinRandomSeat` hook — chain-direct
> with the seat-0 "random" sentinel — was removed.

### Winner Display

#### `useWinnerInfo()`
Formats winner data for display at end of hand.

```typescript
const { winners, showWinners, winnerNames } = useWinnerInfo();
```

---

## 👤 Player Hooks (`hooks/player/`)

Hooks for individual player data, stats, and state.

### Core Player Hooks

#### `usePlayerData(seatIndex: number)`
Fetches comprehensive player data for a specific seat.

```typescript
const {
  playerData,
  stackValue,
  isFolded,
  isAllIn,
  isSittingOut,
  isBusted,
  holeCards,
  round,
  isLoading,
  error
} = usePlayerData(seatIndex);
```

**Data Source:** GameStateContext (WebSocket subscription)
**Updates:** Real-time via WebSocket
**Use Case:** Displaying player information at table

**Key Features:**
- Automatic USDC conversion for cash games
- Tournament chip handling
- Real-time status updates
- Hole card access (if visible)

#### `usePlayerSeatInfo()`
Maps player address to their current seat.

```typescript
const { seatIndex, hasSeat } = usePlayerSeatInfo(playerAddress);
```

#### `usePlayerChipData()`
Calculates player chip stack with display formatting.

```typescript
const { chips, formattedChips, hasChips } = usePlayerChipData(playerAddress);
```

### Player Actions & State

#### `usePlayerTimer()`
Manages player action countdown timer.

```typescript
const {
  timeRemaining,
  isExpiring,
  hasTimedOut
} = usePlayerTimer(seatIndex);
```

**Features:**
- Visual warnings at thresholds (e.g., 5s remaining)
- Automatic fold on timeout
- Adjustable timer duration

#### `usePlayerActionDropBox()`
Manages drag-and-drop chip bet interface.

```typescript
const {
  droppedAmount,
  handleDrop,
  clearDrop
} = usePlayerActionDropBox();
```

#### `useShowingCardsByAddress()`
Determines which players' cards should be visible.

```typescript
const {
  showingCards,
  shouldShowHoleCards
} = useShowingCardsByAddress(playerAddress);
```

### Hand Strength & Equity

#### `useCardsForHandStrength()`
Evaluates player's hand strength using poker solver.

```typescript
const {
  handStrength,
  handRank,
  handDescription
} = useCardsForHandStrength(holeCards, communityCards);
```

**Uses:** PokerSolver from @block52/poker-vm-sdk

#### `useAllInEquity()`
Calculates win probability for all-in situations.

```typescript
const {
  equity,
  isCalculating,
  winProbability
} = useAllInEquity(holeCards, opponentCards, communityCards);
```

**Calculation:** Monte Carlo simulation
**Use Case:** Displaying odds during all-in showdowns

---

## 🎯 Player Actions (`hooks/playerActions/`)

Hooks for executing player actions (bet, raise, fold, etc.).

### Action Execution Hooks

All action hooks follow a similar pattern:

```typescript
const { execute, isLoading, error } = use[Action]Hook();
```

Available actions:
- `betHand()` - Place a bet
- `raiseHand()` - Raise current bet
- `callHand()` - Call current bet
- `checkHand()` - Check (no bet)
- `foldHand()` - Fold hand
- `joinTable()` - Join table at specific seat
- `leaveTable()` - Leave current table
- `sitIn()` - Return from sitting out
- `sitOut()` - Sit out from action
- `showCards()` - Reveal hole cards
- `muckCards()` - Conceal hole cards at showdown
- `postSmallBlind()` - Post small blind
- `postBigBlind()` - Post big blind
- `dealCards()` - Deal cards (dealer action)
- `startNewHand()` - Start new hand (dealer action)

### Specialized Action Hooks

#### `usePlayerLegalActions()`
Determines which actions are currently legal for the player.

```typescript
const {
  legalActions,
  canBet,
  canRaise,
  canCall,
  canCheck,
  canFold,
  minBet,
  maxBet
} = usePlayerLegalActions();
```

**Uses:** Game state + blockchain legal actions
**Updates:** On every action and game state change

#### `useOptimisticAction()`
Implements optimistic UI updates for player actions.

```typescript
const {
  executeAction,
  isOptimistic,
  revertAction
} = useOptimisticAction();
```

**Pattern:**
1. Update UI immediately (optimistic)
2. Submit to blockchain
3. Confirm or revert on response

---

## 💰 Wallet Hooks (`hooks/wallet/`)

Hooks for wallet connection, balance management, and token operations.

### Primary Wallet Hooks

#### `useCosmosWallet()`
Main Cosmos wallet interface for game interactions.

```typescript
const {
  address,
  balance,
  isLoading,
  error,
  refreshBalance,
  importSeedPhrase,
  sendTokens
} = useCosmosWallet();
```

**Chain:** Cosmos-based Poker Chain
**Token:** USDC (micro-units, 6 decimals)
**Storage:** LocalStorage for mnemonic

**Methods:**
- `importSeedPhrase(mnemonic)` - Import wallet from seed
- `sendTokens(recipient, amount, denom)` - Send tokens
- `refreshBalance()` - Refresh balance from chain

#### `useUserWallet()`
Ethereum wallet connection for deposits/withdrawals.

```typescript
const {
  address,
  balance,
  connect,
  disconnect,
  isConnected
} = useUserWallet();
```

**Chain:** Ethereum (or L2)
**Use Case:** Bridge deposits/withdrawals

### Deposit & Bridge Hooks (`hooks/DepositPage/`)

#### `useDepositUSDC()`
Handles USDC deposits from Ethereum to Poker Chain.

```typescript
const {
  deposit,
  isDepositing,
  error
} = useDepositUSDC();
```

**Flow:** Ethereum USDC → Bridge → Cosmos USDC

#### `useWithdraw()`
Handles USDC withdrawals from Poker Chain to Ethereum.

```typescript
const {
  withdraw,
  isWithdrawing,
  error
} = useWithdraw();
```

**Flow:** Cosmos USDC → Bridge → Ethereum USDC

#### `useAllowance()`
Checks and manages ERC20 token allowances for bridge.

```typescript
const {
  allowance,
  hasAllowance,
  refresh
} = useAllowance(tokenAddress, spenderAddress);
```

#### `useApprove()`
Approves bridge contract to spend USDC tokens.

```typescript
const {
  approve,
  isApproving,
  error
} = useApprove();
```

#### `useWalletBalance()`
Fetches Ethereum wallet USDC balance.

```typescript
const { balance, isLoading, refetch } = useWalletBalance();
```

#### `useDecimals()`
Gets token decimal places for amount conversion.

```typescript
const { decimals } = useDecimals(tokenAddress);
```

#### `useUserWalletConnect()`
Manages Ethereum wallet connection flow.

```typescript
const {
  connect,
  disconnect,
  isConnecting
} = useUserWalletConnect();
```

---

## 🎨 Animation Hooks (`hooks/animations/`)

Hooks for managing UI animations and transitions.

#### `useTableAnimations()`
Coordinates table-level animations (card dealing, chip movements).

```typescript
const {
  triggerCardDeal,
  triggerChipAnimation,
  isAnimating
} = useTableAnimations();
```

#### `useCardAnimations()`
Handles community-card flip/reveal animations. Bus-driven: consumes the
`dealCards` animation hint (from the `communityCardStagger` decorator) and the
`handStarted` event, so it re-triggers on flop, turn, AND river and resets per
hand.

```typescript
const {
  flipped1,
  flipped2,
  flipped3,
  showThreeCards
} = useCardAnimations();
```

#### `useHoleCardDeal()`
Runs the hole-card dealing choreography (ui#21) — the per-seat twin of
`useCardAnimations`. Consumes the `dealHoleCards` animation hint (from the
`holeCardDeal` decorator: the dealt seats clockwise from the button) and exposes
the timeline the render layer draws from: the card-back `flights` for
`DealingLayer`, `isDealt(seat)` so a seat holds its placeholder until its second
card lands, and `viewerRevealed` so the local player's pair flips only once the
whole deal has landed. Acks the bus when the flip finishes; any other commit
snaps to truth (the backpressure path). Skipped, with an immediate ack, when the
`dealingAnimation` setting is off or the OS prefers reduced motion. Runs ONCE per
table via `HoleCardDealProvider`; consumers read `useHoleCardDealContext()`.

```typescript
const { flights, landedCount, isDealt, viewerRevealed, isDealing } = useHoleCardDealContext();
```

#### `useChipPositions()`
Calculates chip stack positions and animations.

```typescript
const {
  chipPositions,
  animateChipsToPlayer,
  animateChipsToPot
} = useChipPositions();
```

---

## 🔔 Notification Hooks (`hooks/notifications/`)

Hooks for user notifications and alerts.

#### `useTurnNotification()`
Displays toast notification when it's the player's turn to act.

```typescript
const { showNotification, clearNotification } = useTurnNotification();
```

**Features:**
- Sound alert (optional)
- Browser notification (if permission granted)
- Toast message with action buttons

#### `useSeatJoinNotification(seatNumber)`
Shows the "YOUR SEAT" banner under the local player's badge when they join.
Bus-driven: consumes `useGameEvents("playerJoined")` filtered to this seat AND
the local player's address (only the joining player sees it), replacing the old
`window` callback registry.

```typescript
const {
  isVisible,
  isTextHiding,
  isAnimatingOut
} = useSeatJoinNotification(seatNumber);
```

---

## 🏗️ Hook Architecture Patterns

### Data Flow Pattern

Most hooks follow this data flow:

```
Blockchain/API → WebSocket → Bus (serialize + decorate) → Context → Hooks → Components
```

1. **Data Source**: Blockchain (Cosmos SDK) or Backend API
2. **Bus** (`src/bus/`): serializes inbound WS messages, derives typed
   transitions (`GameEvent[]`), and decorates them with pacing/animation/sound
   hints — see below
3. **Context**: GameStateContext, NetworkContext, WalletContext
4. **Hook**: Processes, formats, and memoizes data
5. **Component**: Renders UI

#### WS Action Bus — two tracks

The bus (`src/bus/`) sits between the WebSocket and React so inbound messages are
processed strictly one at a time and annotated as they arrive, instead of every
consumer reverse-engineering "what happened" by diffing consecutive snapshots. It
runs on two tracks:

- **Logical track** — every snapshot updates `setLatestGameState` immediately at
  ingest (zero added latency). Action submission and submission decisions (e.g.
  `useAutoNewHand`) read this track so they never act on a stale action index.
- **Rendered track** — the queue drains into `setGameState` at the pace the
  decorations dictate (e.g. `showdownHold` holds the winner banner ~2s while the
  next hand deals behind it). Everything visual reads this track via
  `GameDataContext`.

Hooks consume the derived transitions of the latest commit through
`useGameEvents(filter?)` (`hooks/game/useGameEvents.ts`) rather than hand-rolling
`useRef` snapshot diffing. Design details: `docs/plans/2026_07_13_ws_action_bus.md`.

### Real-Time Updates

Hooks using WebSocket subscriptions:
- `useTableData()` - via GameStateContext
- `usePlayerData()` - via GameStateContext

Pattern:
```typescript
// Components subscribe to table
useEffect(() => {
  subscribeToTable(tableId);
  return () => unsubscribeFromTable(tableId);
}, [tableId]);

// Hooks read from context
const { gameState } = useGameStateContext();
```

### Optimistic Updates

Actions use optimistic updates for better UX:

```typescript
// 1. Update UI immediately
dispatch({ type: 'OPTIMISTIC_ACTION', payload: action });

// 2. Send to blockchain
const tx = await performAction(action);

// 3. Confirm or revert
if (tx.success) {
  dispatch({ type: 'CONFIRM_ACTION' });
} else {
  dispatch({ type: 'REVERT_ACTION' });
}
```

### Memoization

All hooks use React.useMemo() and useCallback() to prevent unnecessary re-renders:

```typescript
const derivedValue = useMemo(() => {
  return expensiveCalculation(data);
}, [data]);

const callback = useCallback(() => {
  // action
}, [dependencies]);
```

---

## 📝 Hook Development Guidelines

### Documentation Standard

All hooks should include JSDoc comments:

```typescript
/**
 * Hook description - what it does and why
 *
 * Detailed explanation of functionality, data sources, and update patterns.
 *
 * @param paramName - Parameter description
 * @returns Object with hook values and methods
 *
 * @example
 * ```typescript
 * const { value, method } = useHook(param);
 * method();
 * ```
 */
export const useHook = (param: Type): ReturnType => {
  // implementation
};
```

### Return Type Pattern

Define explicit return types for better IntelliSense:

```typescript
interface UseHookReturn {
  data: DataType;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export const useHook = (): UseHookReturn => {
  // ...
};
```

### Error Handling

Always include error states:

```typescript
const [error, setError] = useState<string | null>(null);

try {
  // operation
} catch (err) {
  console.error('Error in useHook:', err);
  setError(err.message);
}

return { data, error };
```

### Loading States

Include loading indicators for async operations:

```typescript
const [isLoading, setIsLoading] = useState(false);

const fetchData = async () => {
  setIsLoading(true);
  try {
    // fetch
  } finally {
    setIsLoading(false);
  }
};
```

---

## 🔗 Hook Dependencies

### Internal Dependencies

Common hook composition patterns:

```
useTableData()
  └─ useGameStateContext()

usePlayerData(seat)
  └─ useGameStateContext()
  └─ useTableData()

usePlayerLegalActions()
  └─ usePlayerData()
  └─ useTableData()
  └─ useCosmosWallet()
```

### External Dependencies

- `@block52/poker-vm-sdk` - Cosmos SDK, types, utilities
- `react` - Hook primitives
- `@tanstack/react-query` - Data fetching (some hooks)
- Context APIs - GameStateContext, NetworkContext, WalletContext

---

## 🧪 Testing Hooks

Hooks include test coverage following these patterns:

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useHook } from './useHook';

describe('useHook', () => {
  it('should return initial state', () => {
    const { result } = renderHook(() => useHook());
    expect(result.current.data).toBeNull();
  });

  it('should fetch data', async () => {
    const { result } = renderHook(() => useHook());
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });
});
```

See `useTurnNotification.test.ts` for a complete example.

---

## 🚀 Migration Notes

### From Old Hook Locations

If you're importing hooks from old locations, update your imports:

```typescript
// OLD
import { useTableData } from '../hooks/useTableData';

// NEW
import { useTableData } from '../hooks/game';
```

### Deprecated Hooks

None currently. When hooks are deprecated, they'll be listed here with migration guides.

---

## 📚 Additional Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [Poker VM SDK Documentation](../../sdk/README.md)
- [GameStateContext Documentation](../context/GameStateContext.tsx)
- [Component Architecture](../components/README.md)

---

## 🤝 Contributing

When adding new hooks:

1. Place in appropriate category directory
2. Add comprehensive JSDoc comments
3. Export from category `index.ts`
4. Update this README with hook description
5. Add tests for complex logic
6. Use TypeScript return types
7. Include loading and error states

---

## 📊 Hook Statistics

- **Total Hooks**: 57
- **Game Hooks**: 20
- **Player Hooks**: 8
- **Player Action Hooks**: 14
- **Wallet Hooks**: 8
- **Animation Hooks**: 3
- **Notification Hooks**: 2
- **Utility Hooks**: 2

Last Updated: 2026-01-28
