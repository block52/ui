# Cosmos SDK Migration Checklist

This document tracks which hooks have been migrated to use Cosmos SDK vs old PVM/Ethereum implementations.

**Last Updated:** 2025-10-17

## 📊 Migration Summary

| Status | Count | Category |
|--------|-------|----------|
| ✅ **Migrated** | 4 | `useNewTable`, `useFindGames`, `joinTable`, `useCosmosWallet` |
| 🚧 **Ready to Migrate** | 12+ | All player actions + game state queries |
| 🔴 **Not Started** | ~3 | Account/utility hooks |
| ❓ **Needs Investigation** | 3 | leaveTable, showCards, muckCards |

**SDK Coverage:** The Cosmos SDK provides complete coverage for:
- ✅ All game queries (state, metadata, legal actions, player games)
- ✅ All transactions (create, join, perform action)
- ✅ All blockchain queries (blocks, transactions, balances)

**Next Steps:** Migrate the 7 player action hooks (fold, call, bet, raise, check, sitOut, sitIn) - all use the same pattern with `performAction()`.

---

## ✅ Fully Migrated to Cosmos SDK

### Game Management Hooks

- [x] **`useNewTable.ts`** - Creates new games on Cosmos blockchain
  - Uses: `createSigningClientFromMnemonic()` → `SigningCosmosClient.createGame()`
  - Status: ✅ **COSMOS SDK** (SigningClient for transactions)
  - Location: `/src/hooks/useNewTable.ts`

- [x] **`useFindGames.ts`** - Queries available games from Cosmos blockchain
  - Uses: `getCosmosClient()` → `CosmosClient.findGames()`
  - Status: ✅ **COSMOS SDK** (Read-only client for queries)
  - Location: `/src/hooks/useFindGames.ts`

### Player Action Hooks

- [x] **`joinTable.ts`** - Joins a game on Cosmos blockchain
  - Uses: `createSigningClientFromMnemonic()` → `SigningCosmosClient.joinGame()`
  - Status: ✅ **COSMOS SDK** (SigningClient for transactions)
  - Location: `/src/hooks/playerActions/joinTable.ts`

### Wallet Hooks

- [x] **`useCosmosWallet.ts`** - Manages Cosmos wallet (mnemonic, balance, transfers)
  - Uses: `DirectSecp256k1HdWallet`, `SigningStargateClient`
  - Status: ✅ **COSMOS SDK**
  - Location: `/src/hooks/useCosmosWallet.ts`

---

## 🚧 Partial Migration / Mixed

### Game State Hooks (✅ SDK Ready - Can Migrate Now)

- [ ] **`useTableData.ts`** - Fetches game state
  - Current: Uses PVM REST API endpoint
  - **SDK Method**: `CosmosClient.getGameState(gameId)` ✅
  - **SDK Endpoint**: `/block52/pokerchain/poker/v1/game_state/{gameId}`
  - Returns: Parsed JSON game state object
  - Location: `/src/hooks/useTableData.ts`

- [ ] **`useTablePlayerCounts.ts`** - Gets player counts for games
  - Current: Uses PVM REST API
  - **SDK Method**: `CosmosClient.getGame(gameId)` ✅
  - **SDK Endpoint**: `/block52/pokerchain/poker/v1/game/{gameId}`
  - Returns: Game object with player array (count = `players.length`)
  - Location: `/src/hooks/useTablePlayerCounts.ts`

- [ ] **`useMinAndMaxBuyIns.ts`** - Gets buy-in limits for a game
  - Current: Uses PVM REST API
  - **SDK Method**: `CosmosClient.getGame(gameId)` ✅
  - Returns: Game object with `minBuyIn` and `maxBuyIn` fields
  - Location: `/src/hooks/useMinAndMaxBuyIns.ts`

- [ ] **`useVacantSeatData.ts`** - Gets available seats at a table
  - Current: Uses PVM REST API
  - **SDK Method**: `CosmosClient.getGameState(gameId)` ✅
  - Returns: Game state with players array (check seat occupancy)
  - Location: `/src/hooks/useVacantSeatData.ts`

- [ ] **`usePlayerLegalActions.ts`** - Gets legal actions for current player
  - Current: Uses PVM REST API
  - **SDK Method**: `CosmosClient.getLegalActions(gameId, playerAddress?)` ✅
  - **SDK Endpoint**: `/block52/pokerchain/poker/v1/legal_actions/{gameId}/{playerAddress?}`
  - Returns: Parsed JSON array of legal actions
  - Location: `/src/hooks/usePlayerLegalActions.ts`

### Player Action Hooks (✅ SDK Ready - Can Migrate Now)

- [x] **`foldHand.ts`** - Fold action
  - Status: ✅ **MIGRATED TO COSMOS SDK**
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "fold", 0n)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/foldHand.ts`

- [ ] **`callHand.ts`** - Call action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "call", amount)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/callHand.ts`

- [ ] **`betHand.ts`** - Bet action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "bet", amount)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/betHand.ts`

- [ ] **`raiseHand.ts`** - Raise action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "raise", amount)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/raiseHand.ts`

- [ ] **`checkHand.ts`** - Check action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "check", 0n)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/checkHand.ts`

- [ ] **`sitOut.ts`** - Sit out action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "sitout", 0n)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/sitOut.ts`

- [ ] **`sitIn.ts`** - Sit in action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "sitin", 0n)` ✅
  - Pattern: `createSigningClientFromMnemonic()` → `performAction()`
  - Location: `/src/hooks/playerActions/sitIn.ts`

- [ ] **`leaveTable.ts`** - Leave a game
  - Migrated: uses the Cosmos client (`withMoneyMoverRetry`); the old `getClient()` stub was deleted (#718)
  - **SDK Method**: ❌ No `leaveGame()` method in SDK
  - **Workaround**: Use `SigningCosmosClient.performAction(gameId, "leave", 0n)` if supported
  - **TODO**: Check if blockchain supports "leave" action or needs separate message type
  - Location: `/src/hooks/playerActions/leaveTable.ts`

- [ ] **`showCards.ts`** - Show cards action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "show", 0n)` ⚠️
  - **TODO**: Verify action name ("show" or "showdown"?) with blockchain
  - Location: `/src/hooks/playerActions/showCards.ts`

- [ ] **`muckCards.ts`** - Muck cards action
  - Current: Uses old PVM RPC client
  - **SDK Method**: `SigningCosmosClient.performAction(gameId, "muck", 0n)` ⚠️
  - **TODO**: Verify action name with blockchain
  - Location: `/src/hooks/playerActions/muckCards.ts`

---

## 🔴 Not Yet Migrated (Using Old PVM/Ethereum)

### Account/Wallet Hooks

- [ ] **`useAccount.ts`** - User account data
  - Current: Uses PVM REST API or Ethereum
  - TODO: Review if needed with Cosmos wallet
  - Location: `/src/hooks/useAccount.ts`

- [ ] **`useUserWalletConnect.ts`** - Web3 wallet connection (MetaMask, WalletConnect)
  - Status: ⚠️ **Keep for Base Chain USDC deposits** (Bridge functionality)
  - Note: This is for the optional Web3 wallet, not game wallet
  - Location: `/src/hooks/useUserWalletConnect.ts`

### Token/Balance Hooks

- [ ] **`useMintTokens.ts`** - Mint tokens (possibly for testing)
  - Current: Uses Cosmos SDK or needs review
  - TODO: Verify implementation
  - Location: `/src/hooks/useMintTokens.ts`

### Utility Hooks

- [ ] **`usePlayerLegalActions.ts`** - Gets legal actions for current player
  - Current: Uses PVM REST API
  - TODO: Migrate to Cosmos query `/block52/pokerchain/poker/v1/legal_actions/{gameId}`
  - Location: `/src/hooks/usePlayerLegalActions.ts`

---

## 📝 Migration Notes

### Pattern for Transactions (Write Operations)
```typescript
import { createSigningClientFromMnemonic, COSMOS_CONSTANTS } from "@bitcoinbrisbane/block52";
import { getCosmosAddress, getCosmosMnemonic } from "../utils/cosmos/storage";

const userAddress = getCosmosAddress();
const mnemonic = getCosmosMnemonic();

const signingClient = await createSigningClientFromMnemonic({
    rpcEndpoint: import.meta.env.VITE_COSMOS_RPC_URL || "http://localhost:26657",
    restEndpoint: import.meta.env.VITE_COSMOS_REST_URL || "http://localhost:1317",
    chainId: COSMOS_CONSTANTS.CHAIN_ID,
    prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
    denom: "stake", // Gas token
    gasPrice: "0.025stake"
}, mnemonic);

const txHash = await signingClient.performAction(gameId, action, amount);
```

### Pattern for Queries (Read Operations)
```typescript
import { getCosmosClient } from "../utils/cosmos/client";

const cosmosClient = getCosmosClient();
const games = await cosmosClient.findGames();
```

### SDK Methods Available

**Read-Only Query Methods (`CosmosClient`)** - No signing required:
- ✅ `getAccount(address)` - Get account info from Cosmos auth module
- ✅ `getAllBalances(address)` - Get all coin balances for an address
- ✅ `getBalance(address, denom?)` - Get specific token balance (returns bigint)
- ✅ `getB52USDCBalance(address)` - Get b52USDC balance specifically
- ✅ `getHeight()` - Get current blockchain height
- ✅ `getTx(txHash)` - Get transaction details by hash
- ✅ `getBlock(height)` - Get block at specific height
- ✅ `getLatestBlock()` - Get most recent block
- ✅ `getBlocks(startHeight, count)` - Get multiple blocks
- ✅ `getLatestBlocks(count)` - Get most recent N blocks
- ✅ `getGameState(gameId)` - Get full game state JSON
  - Endpoint: `/block52/pokerchain/poker/v1/game_state/{gameId}`
- ✅ `getGame(gameId)` - Get game info (metadata, buy-ins, blinds, players)
  - Endpoint: `/block52/pokerchain/poker/v1/game/{gameId}`
- ✅ `getLegalActions(gameId, playerAddress?)` - Get legal actions for player
  - Endpoint: `/block52/pokerchain/poker/v1/legal_actions/{gameId}/{playerAddress?}`
- ✅ `listGames()` - List all games
  - Endpoint: `/block52/pokerchain/poker/v1/list_games`
- ✅ `findGames(min?, max?)` - Find games with optional player count filters
- ✅ `getPlayerGames(playerAddress)` - Get games for specific player
  - Endpoint: `/block52/pokerchain/poker/v1/player_games/{playerAddress}`
- ✅ `b52usdcToUsdc(amount)` - Convert microunits to display format
- ✅ `usdcToB52usdc(amount)` - Convert display format to microunits

**Transaction Methods (`SigningCosmosClient`)** - Requires wallet/signing:
- ✅ `getWalletAddress()` - Get address from wallet
- ✅ `sendTokens(from, to, amount, denom?, memo?)` - Send any token
- ✅ `sendB52USDC(from, to, amount, memo?)` - Send b52USDC specifically
- ✅ `createGame(gameFormat, minPlayers, maxPlayers, minBuyIn, maxBuyIn, smallBlind, bigBlind, timeout)` - Create new game
  - Message: `/pokerchain.poker.v1.MsgCreateGame`
- ✅ `joinGame(gameId, seat, buyInAmount)` - Join existing game
  - Message: `/pokerchain.poker.v1.MsgJoinGame`
- ✅ `performAction(gameId, action, amount?)` - Perform game action
  - Message: `/pokerchain.poker.v1.MsgPerformAction`
  - Actions: "fold", "call", "bet", "raise", "check", "sitout", "sitin", "leave"?, "show"?, "muck"?
- ✅ `setWallet(wallet)` - Change wallet for signing
- ✅ `getWallet()` - Get current wallet instance
- ✅ `disconnect()` - Disconnect signing client

**Factory Functions:**
- ✅ `createSigningCosmosClient(config, wallet)` - Create client with existing wallet
- ✅ `createSigningClientFromMnemonic(config, mnemonic)` - Create client from seed phrase

---

## 🎯 Priority Migration Tasks

### ⚡ High Priority - Player Action Hooks (SDK Ready ✅)

These can be migrated **immediately** using `SigningCosmosClient.performAction()`:

1. **`foldHand.ts`** → `performAction(gameId, "fold", 0n)`
2. **`callHand.ts`** → `performAction(gameId, "call", amount)`
3. **`betHand.ts`** → `performAction(gameId, "bet", amount)`
4. **`raiseHand.ts`** → `performAction(gameId, "raise", amount)`
5. **`checkHand.ts`** → `performAction(gameId, "check", 0n)`
6. **`sitOut.ts`** → `performAction(gameId, "sitout", 0n)`
7. **`sitIn.ts`** → `performAction(gameId, "sitin", 0n)`

**Migration Pattern** (same for all):
```typescript
import { createSigningClientFromMnemonic, COSMOS_CONSTANTS } from "@bitcoinbrisbane/block52";
import { getCosmosAddress, getCosmosMnemonic } from "../../utils/cosmos/storage";

export async function foldHand(gameId: string): Promise<any> {
    const mnemonic = getCosmosMnemonic();
    const signingClient = await createSigningClientFromMnemonic({
        rpcEndpoint: import.meta.env.VITE_COSMOS_RPC_URL || "http://localhost:26657",
        restEndpoint: import.meta.env.VITE_COSMOS_REST_URL || "http://localhost:1317",
        chainId: COSMOS_CONSTANTS.CHAIN_ID,
        prefix: COSMOS_CONSTANTS.ADDRESS_PREFIX,
        denom: "stake",
        gasPrice: "0.025stake"
    }, mnemonic);

    const txHash = await signingClient.performAction(gameId, "fold", 0n);
    return { hash: txHash };
}
```

### 🔧 Medium Priority - Game State Query Hooks (SDK Ready ✅)

These can be migrated **immediately** using `CosmosClient` methods:

1. **`useTableData.ts`** → Use `CosmosClient.getGameState(gameId)`
   - Returns full game state with all player data, cards, pot, etc.

2. **`useTablePlayerCounts.ts`** → Use `CosmosClient.getGame(gameId)`
   - Returns game metadata with `players` array (length = player count)

3. **`useMinAndMaxBuyIns.ts`** → Use `CosmosClient.getGame(gameId)`
   - Returns game object with `minBuyIn` and `maxBuyIn` fields

4. **`useVacantSeatData.ts`** → Use `CosmosClient.getGameState(gameId)`
   - Check `players` array to find empty seats

5. **`usePlayerLegalActions.ts`** → Use `CosmosClient.getLegalActions(gameId, playerAddress)`
   - Returns array of legal actions for the player

**Migration Pattern** (read-only):
```typescript
import { getCosmosClient } from "../../utils/cosmos/client";

export const useTableData = (gameId: string) => {
    const [gameState, setGameState] = useState(null);

    useEffect(() => {
        const fetchGameState = async () => {
            const client = getCosmosClient();
            const state = await client.getGameState(gameId);
            setGameState(state);
        };
        fetchGameState();
    }, [gameId]);

    return { gameState };
};
```

### 🔍 Low Priority - Verify Action Names

Need to confirm with blockchain what action strings are supported:

- ❓ **`leaveTable.ts`** → Is "leave" supported? Or separate message type?
- ❓ **`showCards.ts`** → Is "show" or "showdown" correct?
- ❓ **`muckCards.ts`** → Is "muck" supported?

### 📋 Review Later

- **`useAccount.ts`** - May be redundant with `useCosmosWallet`
- **`useMintTokens.ts`** - Verify if still needed for testing
- **`useUserWalletConnect.ts`** - Keep for Base Chain USDC bridge

---

## 🔍 Testing Status

**Verified Working:**
- ✅ `createGame()` - Tested on `/test-signing` page (tx: `389AA2D6...`)
- ✅ `joinGame()` - Tested on `/test-signing` page (tx: `7D29E41C...`)
- ✅ `performAction()` - Tested on `/test-signing` page (tx: `543155B4...`)

**Needs Testing:**
- Dashboard game creation flow
- Dashboard game joining flow via BuyInModal
- In-game player actions (fold, call, bet, raise, check)
- Leave game functionality

---

## 📚 References

- SDK Documentation: `/poker-vm/sdk/README.md`
- Cosmos Client: `/poker-vm/sdk/src/cosmosClient.ts`
- Signing Client: `/poker-vm/sdk/src/signingClient.ts`
- Test Page: `/poker-vm/ui/src/pages/TestSigningPage.tsx`
- Integration Checklist: `/poker-vm/ui/SDK_INTEGRATION_CHECKLIST.md`
