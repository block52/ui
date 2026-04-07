# UI - Claude Code Instructions

## Overview

The Poker VM UI is a React + TypeScript application for the Block 52 poker platform. It provides the web interface for playing poker games on the Cosmos blockchain.

---

## The 12 Commandments of Types (DO NOT CHANGE)

These rules prevent regression. **All UI code must conform to SDK types. Violations break the system.**

### 1. SDK is the Single Source of Truth

The `@block52/poker-vm-sdk` package defines ALL type shapes. The UI must import types from SDK, never define duplicates.

```
SDK Types → Go Server follows → UI follows
```

**Never** define duplicate types elsewhere. Import from SDK.

### 2. DTO Naming Convention

| Suffix | Meaning | BigInt Fields |
|--------|---------|---------------|
| `DTO` or `ResponseDTO` | Over-the-wire format | **Strings** (e.g., `"80000"`) |
| No suffix | Internal/runtime | **BigInt/number** |

### 3. Single Source of Truth Fields

These fields exist in **ONE place only**. Never duplicate them.

| Field | Canonical Location | NEVER put in |
|-------|-------------------|--------------|
| `format` | `GameStateResponseDTO.format` | `gameOptions.format` |
| `variant` | `GameStateResponseDTO.variant` | `gameOptions.variant` |
| `creator` | `GameStateResponseDTO.creator` | `gameOptions.owner` |
| `players[]` | `gameState.players` | Root `GameStateResponseDTO.players` |

### 4. Canonical Root Type

`GameStateResponseDTO` is the ONLY root type for game data over the wire:

```typescript
type GameStateResponseDTO = {
    gameId: string;
    creator: string;
    format: GameFormat;
    variant: GameVariant;
    gameState: TexasHoldemStateDTO;
};
```

### 5. WebSocket JSON Naming

ALL WebSocket messages use **camelCase**:
- `gameId` (not `game_id`)
- `playerAddress` (not `player_address`)
- `txHash` (not `tx_hash`)

### 6. Required vs Optional Fields

**Required fields have NO `?` marker.** Chain MUST provide these - if missing, it's a chain bug.
**Optional fields have `?` marker.** Only for specific game types or special configurations.

### 7. NO Defaults Policy (CRITICAL)

> **Errors happen at pokerchain/PVM level, NEVER hidden by defaults in UI.**

```typescript
// ❌ WRONG - NEVER use default values
const format = game.format || "cash";  // NO!
const timeout = gameOptions.timeout ?? 60;  // NO!

// ✅ CORRECT - let it error if undefined
const format = game.format;  // Will throw if missing - GOOD
if (!game.format) throw new Error("game.format required");
```

### 8. NO Backwards Compatibility

```typescript
// ❌ WRONG - NO aliases
type Game = GameStateResponseDTO;  // NO!

// ❌ WRONG - NO supporting old field names
const id = game.gameId || game.game_id;  // NO!

// ✅ CORRECT - one name only
const id = game.gameId;  // This is the only name
```

### 9. String Fields (BigNumber Values)

These fields are **always strings** in DTOs (to handle large numbers safely):
```
minBuyIn, maxBuyIn, startingStack, smallBlind, bigBlind,
stack, amount, sumOfBets, pots[], min/max in legalActions
```

### 10. Number Fields (Safe Integer Range)

These fields are **always numbers** (fit in JavaScript safe integer range):
```
minPlayers, maxPlayers, timeout, seat, dealer,
smallBlindPosition, bigBlindPosition, handNumber,
actionCount, index, timestamp, blindLevelDuration
```

### 11. NO `any` Type

**Never use `any` when SDK types exist.** Using `any` bypasses TypeScript's type checking.

```typescript
// ❌ WRONG - `any` hides shape mismatches
const games = cosmosGames.map((game: any) => ({ ... }));

// ✅ CORRECT - use SDK types
import { GameListItem } from "@block52/poker-vm-sdk";
const games = cosmosGames.map((game: GameListItem) => ({ ... }));
```

### 12. NO Inline Casting — Use Centralized Utilities

All type conversions must go through centralized, unit-tested utility functions.

```typescript
// ❌ WRONG - inline casting scattered everywhere
const format = game.format as GameFormat;

// ✅ CORRECT - use tested utility functions
import { parseGameFormat } from "../utils/typeConversions";
const format = parseGameFormat(game.format);
```

### Reference

- Issue: https://github.com/block52/poker-vm/issues/1691
- SDK Types: `@block52/poker-vm-sdk/src/types/game.ts`
- Full Rules: `/clients/block52/issues/cleaning_up_types/THE_12_COMMANDMENTS.md`

---

## The 7 Commandments of UI Architecture

These rules standardize how API calls, state management, and testing are structured across the UI. **Violations create inconsistency and tech debt.** Established in PR #159.

### 1. Centralized HTTPClient — No Raw Axios/Fetch

All HTTP calls go through `src/apis/HTTPClient.ts`. Never import `axios` or use `fetch` directly in components or hooks.

HTTPClient provides:
- Typed methods: `get<T>()`, `post<T>()`, `put<T>()`, `delete<T>()`
- Automatic Bearer token injection when `secure: true`
- Unified error handling via `onError` / `setCustomOnError()`
- Configurable timeout and abort signal support

```typescript
// ❌ WRONG — raw axios in a component
import axios from "axios";
const res = await axios.get("/api/data");

// ✅ CORRECT — use an API class that extends HTTPClient
import { PaymentApi } from "../apis/Api";
const api = new PaymentApi({ baseUrl: PROXY_URL, secure: true, timeout: 5000 });
const res = await api.getPaymentStatus(id);
```

### 2. API Class Pattern — Extend HTTPClient

Domain API classes live in `src/apis/Api.ts`, extend HTTPClient, and expose public arrow function methods — one endpoint per method, no business logic.

```typescript
export class CosmosApi extends HTTPClient {
    public getValidators = (limit?: number) =>
        this.get(`/cosmos/staking/v1beta1/validators${limit ? `?pagination.limit=${limit}` : ""}`);
    public getBalanceByAddress = (address: string) =>
        this.get(`/cosmos/bank/v1beta1/balances/${address}`);
}
```

**Rules:**
- One class per API domain (`PaymentApi`, `CosmosApi`, `IndexerApi`)
- Methods are public arrow functions calling `this.get/post/put/delete`
- No state, no side effects, no business logic in API classes

### 3. Context → Provider → Hook

Each API domain gets three pieces in `src/context/`:

1. **Context**: `createContext<XxxApi>(null as any)`
2. **Provider**: `FC` component that creates the API instance with config
3. **Hook**: `useXxxApi()` that calls `useContext`

```typescript
// src/context/PaymentApiContext.tsx
const PaymentApiContext = createContext<PaymentApi>(null as any);

export const PaymentApiProvider: FC<{ children: ReactNode }> = ({ children }) => {
    const api = new PaymentApi({ baseUrl: PROXY_URL!, secure: true, timeout: 5000 });
    return <PaymentApiContext.Provider value={api}>{children}</PaymentApiContext.Provider>;
};

export const usePaymentApi = (): PaymentApi => useContext(PaymentApiContext);
```

**Rules:**
- Use `useMemo` when the API instance depends on dynamic values (e.g., `currentNetwork`)
- Providers are composed in `App.tsx`
- Components consume APIs only via hooks, never by constructing API classes directly

### 4. Hook Composition

- One `useState` per concern — never combine unrelated state into a single object
- One `useEffect` per side-effect — separate timer, polling, and data-fetching effects
- `useCallback` with explicit dependency arrays for functions passed to children or used in effects
- Clean up intervals/subscriptions in effect return functions

### 5. Error Handling in Async Code

- Wrap async operations in try-catch inside `useCallback` / `useEffect`
- Store errors in component state (`useState<string | null>(null)`)
- Log with `console.error` — no silent failures
- Use `setCustomOnError()` on API instances for cross-cutting error handling

```typescript
// ✅ CORRECT pattern
const fetchData = useCallback(async () => {
    try {
        const result = await api.getData();
        setData(result);
    } catch (err) {
        console.error("Failed to fetch data:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
    }
}, [api]);
```

### 6. Naming Conventions

| Thing | Pattern | Example |
|-------|---------|---------|
| Custom hook | `use[Domain][Feature]` | `useDepositSession`, `usePaymentApi` |
| API class | `[Domain]Api` | `PaymentApi`, `CosmosApi`, `IndexerApi` |
| Context | `[Domain]ApiContext` | `PaymentApiContext` |
| Provider | `[Domain]ApiProvider` | `CosmosApiProvider` |
| Hook file | `use[Name].ts` | `useDepositSession.ts` |
| Context file | `[Domain]ApiContext.tsx` | `PaymentApiContext.tsx` |

### 7. API Testing Pattern

Tests live in `src/tests/`. Mock axios at the module level, use describe blocks per HTTP method, test both success and error paths.

```typescript
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("HTTPClient", () => {
    describe("GET", () => {
        it("should return data on success", async () => {
            mockedAxios.create.mockReturnValue({
                get: jest.fn().mockResolvedValueOnce({ data: expected }),
                interceptors: { request: { use: jest.fn() } }
            } as any);
            // ...
        });

        it("should call onError on failure", async () => {
            // test error path
        });
    });
});
```

---

### Tech Stack

- **React 19** - UI framework
- **TypeScript 5** - Type safety
- **Vite** - Build tool and dev server
- **TailwindCSS** - Styling
- **@block52/poker-vm-sdk** - Blockchain integration
- **@reown/appkit** - Wallet connection (Ethereum)

### Project Structure

```
ui/
├── src/
│   ├── components/       # React components
│   ├── hooks/           # Custom React hooks (see hooks/README.md)
│   ├── context/         # React Context providers
│   ├── pages/           # Page components
│   ├── utils/           # Utility functions
│   ├── types/           # TypeScript type definitions
│   └── App.tsx          # Root component
├── public/              # Static assets
└── build/               # Production build output
```

## Code Style

### Linting & Formatting

The project uses ESLint with strict TypeScript rules. **IMPORTANT**: Always follow these conventions:

#### Quotes
- **Use double quotes (`"`) for strings** - This is enforced by ESLint
- Single quotes (`'`) will cause linting errors

```typescript
// ✅ Correct
const greeting = "Hello, world!";
import { useTableData } from "../hooks/useTableData";

// ❌ Wrong - will fail linting
const greeting = 'Hello, world!';
import { useTableData } from '../hooks/useTableData';
```

#### Semicolons
- **Always use semicolons** - Required by ESLint

```typescript
// ✅ Correct
const value = 42;
return data;

// ❌ Wrong - will fail linting
const value = 42
return data
```

#### TypeScript Rules
- `@typescript-eslint/no-explicit-any`: OFF - `any` is allowed (use sparingly)
- `@typescript-eslint/no-unused-vars`: WARN - Prefix with `_` to ignore
- `@typescript-eslint/no-unused-expressions`: WARN

```typescript
// ✅ Ignore unused params with underscore prefix
const callback = (_event: Event, data: Data) => {
  console.log(data);
};
```

### Running Linting

```bash
# Check for lint errors
yarn lint

# Auto-fix lint errors
yarn lint:fix

# Fix with warnings allowed (up to 100)
yarn lint:warn
```

## Hooks Architecture

The application uses **57 custom React hooks** organized by domain. See [`hooks/README.md`](./src/hooks/README.md) for comprehensive documentation.

### Hook Categories

- **Game Hooks** (`hooks/game/`) - Table data, game state, game flow
- **Player Hooks** (`hooks/player/`) - Player data, stats, hand strength
- **Player Action Hooks** (`hooks/playerActions/`) - Bet, raise, fold, etc.
- **Wallet Hooks** (`hooks/wallet/`) - Wallet connection, deposits, withdrawals
- **Animation Hooks** (`hooks/animations/`) - UI animations
- **Notification Hooks** (`hooks/notifications/`) - Toasts, alerts

### Data Flow Pattern

```
Blockchain/API → WebSocket → Context → Hooks → Components
```

Most hooks read from **GameStateContext** which maintains a WebSocket connection for real-time updates.

```typescript
// Components subscribe to table
useEffect(() => {
  subscribeToTable(tableId);
  return () => unsubscribeFromTable(tableId);
}, [tableId]);

// Hooks read from context
const { gameState } = useGameStateContext();
```

See [`hooks/README.md`](./src/hooks/README.md) for detailed architecture patterns.

## Key Concepts

### WebSocket Subscriptions

The UI uses WebSocket connections for real-time game state updates:

1. **GameStateContext** manages WebSocket connections
2. Components call `subscribeToTable(tableId)` to connect
3. Hooks like `useTableData()` and `usePlayerData()` read from context
4. Updates are pushed in real-time from the backend

### Wallet Integration

The app integrates two wallet types:

1. **Cosmos Wallet** (`useCosmosWallet()`) - For gameplay on Poker Chain
   - Uses mnemonic stored in localStorage
   - Handles game transactions (bet, fold, join, etc.)
   - Token: USDC (6 decimals)

2. **Ethereum Wallet** (`useUserWallet()`) - For deposits/withdrawals
   - Connected via @reown/appkit (WalletConnect)
   - Bridge deposits from Ethereum to Cosmos
   - Bridge withdrawals from Cosmos to Ethereum

### Game Formats

Three game formats supported:

- **Cash Games** - Flexible buy-in, players can leave anytime
- **Sit & Go** - Fixed buy-in, starts when table fills
- **Tournaments** - Scheduled events with prize pools

Format detection:
```typescript
import { isTournamentFormat, isCashFormat } from "@block52/poker-vm-sdk";

if (isTournamentFormat(gameState.gameFormat)) {
  // Tournament logic
} else if (isCashFormat(gameState.gameFormat)) {
  // Cash game logic
}
```

### Stack Value Handling

**Critical distinction**:

- **Cash Games**: Stack is in USDC microunits (6 decimals)
  - Use `convertUSDCToNumber()` to display
  - Example: `1000000` = $1.00

- **Tournament Games**: Stack is in chip units (no decimals)
  - Use value directly
  - Example: `1500` = 1500 chips

```typescript
const stackValue = useMemo(() => {
  if (!playerData?.stack) return 0;

  const rawStack = Number(playerData.stack);

  if (isTournament) {
    return rawStack; // Chips as-is
  } else {
    return convertUSDCToNumber(playerData.stack); // Convert USDC
  }
}, [playerData?.stack, isTournament]);
```

## Development Workflow

### Running the App

```bash
# Development server (with lint checks)
yarn dev

# Development without checks
yarn dev:nocheck

# Run lint before dev
yarn dev:lint
```

### Building

```bash
# Type check + production build
yarn build

# Preview production build
yarn preview
```

### Testing

```bash
# Run all tests
yarn test

# Run tests in watch mode
yarn test:watch

# Run tests with coverage
yarn test:coverage
```

## Component Patterns

### Prop Types
Define explicit prop interfaces:

```typescript
interface TableProps {
  tableId: string;
  onJoinTable?: (seatIndex: number) => void;
}

export const Table: React.FC<TableProps> = ({ tableId, onJoinTable }) => {
  // component logic
};
```

### State Management
Use hooks for state, avoid prop drilling:

```typescript
// ✅ Good - use hooks
const { gameState } = useGameStateContext();
const { playerData } = usePlayerData(seatIndex);

// ❌ Avoid - prop drilling through multiple levels
<Parent gameState={gameState}>
  <Child gameState={gameState}>
    <GrandChild gameState={gameState} />
  </Child>
</Parent>
```

### Memoization
Use `useMemo()` and `useCallback()` for expensive operations:

```typescript
const sortedPlayers = useMemo(() => {
  return players.sort((a, b) => a.seat - b.seat);
}, [players]);

const handleAction = useCallback((action: Action) => {
  performAction(action);
}, [performAction]);
```

## Common Issues

### Import Errors from SDK
If SDK functions are not found, check that the SDK is rebuilt:

```bash
cd ../sdk
yarn build
cd ../ui
rm -rf node_modules/@block52
yarn install
```

### WebSocket Connection Issues
- Check that `subscribeToTable()` is called in component
- Verify table ID is correct
- Check Network context has correct endpoints

### Type Errors
- Ensure SDK types are up to date
- Check `tsconfig.json` includes all necessary paths
- Run `yarn build` to verify type checking

## Environment Variables

Create `.env` file with:

```bash
# Backend API
VITE_API_URL=http://localhost:8080

# Cosmos RPC endpoints
VITE_COSMOS_RPC=http://localhost:26657
VITE_COSMOS_REST=http://localhost:1317

# WalletConnect Project ID
VITE_WALLETCONNECT_PROJECT_ID=your_project_id
```

## Related Documentation

- [Hooks Documentation](./src/hooks/README.md) - Complete hook reference
- [SDK Documentation](../sdk/CLAUDE.md) - SDK usage and API
- [Component Architecture](./src/components/README.md) - Component patterns

## Contributing

When making changes:

1. Follow code style (double quotes, semicolons)
2. Run linting before commit: `yarn lint:fix`
3. Add JSDoc comments to new hooks
4. Update relevant documentation
5. Test changes thoroughly

---

Last Updated: 2026-02-04
