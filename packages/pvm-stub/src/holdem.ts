/**
 * Minimal heads-up Texas Hold'em engine for the wallet-stub — enough to drive
 * the UI through a full hand (join → blinds → deal → betting streets → showdown),
 * NOT a rules-accurate poker engine (per docs/plans/2026_07_11_wallet_stub_server.md
 * §2, the bar is "exercise the UI"). One human seat vs. a check/call auto-bot.
 *
 * Simplifications (intentional): the human is always dealer/SB and acts first
 * every street; the bot only checks/calls; at showdown the human wins. Legal
 * actions are permissive. Emits canonical TexasHoldemStateDTO snapshots.
 *
 * Money is bigint internally (USDC microunits), stringified in the DTO per the
 * 12 Commandments.
 */

export const CASH_GAME_ID =
  "0x00000000000000000000000000000000000000000000000000000000cafe0001";

const CREATOR = "b521s8aug28r6vned2xm767xhgrkg90wfef2hfg4mg";
const BOT_ADDRESS = "b521stubbot00000000000000000000000000000bot";

const SMALL_BLIND = 10_000_000n; // 10 USDC
const BIG_BLIND = 20_000_000n; // 20 USDC
const BOT_STACK = 1_000_000_000n; // 1000 USDC

const OPTIONS = {
  minBuyIn: "100000000",
  maxBuyIn: "1000000000",
  minPlayers: 2,
  maxPlayers: 9,
  smallBlind: SMALL_BLIND.toString(),
  bigBlind: BIG_BLIND.toString(),
  timeout: 30,
  startingStack: "0",
  blindLevelDuration: 0,
};

type Round = "ante" | "preflop" | "flop" | "turn" | "river" | "showdown" | "end";

interface Seat {
  seat: number;
  address: string;
  stack: bigint;
  holeCards: string[];
  status: string; // PlayerStatus value
  streetBet: bigint; // contributed this street
  totalBet: bigint; // contributed this hand
  hasActed: boolean;
  isBot: boolean;
  lastAction: { action: string; amount: bigint; round: Round; index: number } | null;
}

export interface Action {
  address?: string;
  action: string;
  amount?: string;
  data?: string;
  index?: number;
}

interface Table {
  gameId: string;
  seats: Seat[];
  dealer: number;
  round: Round;
  board: string[];
  deck: string[];
  currentBet: bigint;
  pot: bigint;
  nextToAct: number; // seat number, -1 = nobody
  handNumber: number;
  actionCount: number;
  previousActions: Array<{
    playerId: string;
    seat: number;
    action: string;
    amount: string;
    round: Round;
    index: number;
    timestamp: number;
  }>;
  winners: Array<{ address: string; amount: string; cards: string[]; name: string; description: string }>;
}

const store = new Map<string, Table>();

// ---- stub config (per-frame broadcasting, §5.3) --------------------------
// When frameDelayMs > 0 the server broadcasts one frame per engine step
// (human action, then each bot action) instead of one collapsed frame. Default
// 0 keeps the collapsed behaviour so the existing specs are untouched.
let frameDelayMs = 0;

/** Set stub config from POST /__control/config. */
export function setStubConfig(cfg: { frameDelayMs?: number }): void {
  if (typeof cfg.frameDelayMs === "number" && cfg.frameDelayMs >= 0) {
    frameDelayMs = cfg.frameDelayMs;
  }
}

/** Current per-frame broadcast delay (ms); 0 = collapsed (single frame). */
export function getFrameDelayMs(): number {
  return frameDelayMs;
}

/** Reset stub config to defaults (called by /__control/reset). */
export function resetConfig(): void {
  frameDelayMs = 0;
}

function freshTable(gameId: string): Table {
  return {
    gameId,
    seats: [],
    dealer: 0,
    round: "ante",
    board: [],
    deck: [],
    currentBet: 0n,
    pot: 0n,
    nextToAct: -1,
    handNumber: 0,
    actionCount: 0,
    previousActions: [],
    winners: [],
  };
}
store.set(CASH_GAME_ID, freshTable(CASH_GAME_ID));

function table(gameId: string): Table | undefined {
  return store.get(gameId);
}

/** Reset all tables to their fresh, empty state (test isolation between runs). */
export function resetTables(): void {
  store.clear();
  store.set(CASH_GAME_ID, freshTable(CASH_GAME_ID));
  resetConfig();
}

// ---- deck ----------------------------------------------------------------
const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
const SUITS = ["C", "D", "H", "S"];

function shuffledDeck(): string[] {
  const cards: string[] = [];
  for (const r of RANKS) for (const s of SUITS) cards.push(r + s);
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

// ---- hand lifecycle ------------------------------------------------------

function seatOf(t: Table, seat: number): Seat | undefined {
  return t.seats.find((s) => s.seat === seat);
}
function human(t: Table): Seat | undefined {
  return t.seats.find((s) => !s.isBot);
}
function bot(t: Table): Seat | undefined {
  return t.seats.find((s) => s.isBot);
}
function activePlayers(t: Table): Seat[] {
  return t.seats.filter((s) => s.status === "active" || s.status === "all-in");
}

/** Human joins; auto-seat a bot opponent and start the hand once heads-up. */
function join(t: Table, action: Action): void {
  const address = action.address ?? "unknown";
  const seatNum = parseSeat(action.data) ?? nextFreeSeat(t);
  const buyIn = BigInt(action.amount ?? "0");
  if (!seatOf(t, seatNum)) {
    t.seats.push(makeSeat(seatNum, address, buyIn, false));
  }
  // Auto-seat a bot in the next free seat so a lone human can play.
  if (!bot(t)) {
    t.seats.push(makeSeat(nextFreeSeat(t), BOT_ADDRESS, BOT_STACK, true));
  }
  if (t.seats.length >= 2 && (t.round === "ante" || t.round === "end")) {
    startHand(t);
  }
}

/** Extract the requested seat from the join `data` field ("seat=N"). */
function parseSeat(data: string | undefined): number | null {
  const m = /seat=(\d+)/.exec(data ?? "");
  return m ? Number(m[1]) : null;
}

/** Lowest unoccupied seat (1..9). */
function nextFreeSeat(t: Table): number {
  const occupied = new Set(t.seats.map((s) => s.seat));
  for (let i = 1; i <= 9; i++) if (!occupied.has(i)) return i;
  return 1;
}

function makeSeat(seat: number, address: string, stack: bigint, isBot: boolean): Seat {
  return {
    seat,
    address,
    stack,
    holeCards: [],
    status: "seated",
    streetBet: 0n,
    totalBet: 0n,
    hasActed: false,
    isBot,
    lastAction: null,
  };
}

function startHand(t: Table): void {
  const h = human(t);
  const b = bot(t);
  if (!h || !b) return;

  t.handNumber += 1;
  t.deck = shuffledDeck();
  t.board = [];
  t.pot = 0n;
  t.winners = [];
  t.round = "preflop";
  t.dealer = h.seat; // human is dealer/SB (acts first heads-up)

  for (const s of [h, b]) {
    s.status = "active";
    s.streetBet = 0n;
    s.totalBet = 0n;
    s.hasActed = false;
    s.lastAction = null;
    s.holeCards = [t.deck.pop()!, t.deck.pop()!];
  }

  // Blinds: human (dealer) posts SB, bot posts BB.
  postBlind(t, h, SMALL_BLIND);
  postBlind(t, b, BIG_BLIND);
  t.currentBet = BIG_BLIND;
  t.nextToAct = h.seat; // SB acts first preflop
}

function postBlind(t: Table, s: Seat, amount: bigint): void {
  const pay = amount > s.stack ? s.stack : amount;
  s.stack -= pay;
  s.streetBet += pay;
  s.totalBet += pay;
  t.pot += pay;
}

// ---- actions -------------------------------------------------------------

/**
 * Apply a submitted action, then auto-run the bot until it's the human's turn.
 *
 * `onStep` (optional) is invoked synchronously after EACH engine step — the
 * human action, then each bot action — so the caller can capture the state at
 * that step for per-frame broadcasting (§5.3). In collapsed mode the caller
 * omits it and broadcasts once after applyAction returns.
 */
export function applyAction(gameId: string, action: Action, onStep?: () => void): void {
  const t = table(gameId);
  if (!t) return;
  const step = onStep ?? (() => {});

  if (action.action === "join") {
    join(t, action);
    step();
    return;
  }
  if (action.action === "new-hand") {
    // Deal the next hand from the END state (carries stacks forward). The UI
    // reaches here via useAutoNewHand / the manual "START NEW HAND" button.
    if (t.round === "end") startHand(t);
    step();
    return;
  }
  applyBettingAction(t, action);
  step();
  runBotUntilHuman(t, step);
}

function applyBettingAction(t: Table, action: Action): void {
  const actor = t.seats.find((s) => s.seat === t.nextToAct && s.address === (action.address ?? s.address))
    ?? seatOf(t, t.nextToAct);
  if (!actor || actor.status !== "active") return;

  const amount = BigInt(action.amount ?? "0");
  switch (action.action) {
    case "fold":
      actor.status = "folded";
      break;
    case "check":
      actor.hasActed = true;
      break;
    case "call": {
      const owed = t.currentBet - actor.streetBet;
      const pay = owed > actor.stack ? actor.stack : owed;
      actor.stack -= pay;
      actor.streetBet += pay;
      actor.totalBet += pay;
      t.pot += pay;
      actor.hasActed = true;
      break;
    }
    case "bet":
    case "raise": {
      // amount is the TARGET street bet (RAISE TO) or bet size; treat as target.
      const target = action.action === "bet" ? actor.streetBet + amount : amount;
      const pay = target - actor.streetBet;
      const capped = pay > actor.stack ? actor.stack : pay;
      actor.stack -= capped;
      actor.streetBet += capped;
      actor.totalBet += capped;
      t.pot += capped;
      t.currentBet = actor.streetBet;
      actor.hasActed = true;
      // Opponent must respond to the new bet.
      for (const s of activePlayers(t)) if (s !== actor) s.hasActed = false;
      break;
    }
    default:
      return; // unmodeled action (deal/new-hand/blind) — ignore, keep state
  }

  recordAction(t, actor, action.action, amount);
  advance(t);
}

function recordAction(t: Table, actor: Seat, action: string, amount: bigint): void {
  t.actionCount += 1;
  const entry = {
    playerId: actor.address,
    seat: actor.seat,
    action,
    amount: amount.toString(),
    round: t.round,
    index: t.actionCount,
    timestamp: Date.now(),
  };
  t.previousActions.push(entry);
  actor.lastAction = { action, amount, round: t.round, index: t.actionCount };
}

/** Progress the hand: end on fold, else advance street when betting settles. */
function advance(t: Table): void {
  const active = activePlayers(t);
  if (active.length <= 1) {
    showdown(t);
    return;
  }
  const bettingDone = active.every((s) => s.hasActed && s.streetBet === t.currentBet);
  if (!bettingDone) {
    // Pass action to the other active player.
    const other = active.find((s) => s.seat !== t.nextToAct);
    t.nextToAct = (other ?? active[0]).seat;
    return;
  }
  // Street complete → next street or showdown.
  if (t.round === "river") {
    showdown(t);
    return;
  }
  dealNextStreet(t);
}

function dealNextStreet(t: Table): void {
  if (t.round === "preflop") {
    t.round = "flop";
    t.board.push(t.deck.pop()!, t.deck.pop()!, t.deck.pop()!);
  } else if (t.round === "flop") {
    t.round = "turn";
    t.board.push(t.deck.pop()!);
  } else if (t.round === "turn") {
    t.round = "river";
    t.board.push(t.deck.pop()!);
  }
  t.currentBet = 0n;
  for (const s of activePlayers(t)) {
    s.streetBet = 0n;
    s.hasActed = false;
  }
  // Human acts first each street (simplification).
  const h = human(t);
  t.nextToAct = h && h.status === "active" ? h.seat : activePlayers(t)[0].seat;
}

function showdown(t: Table): void {
  const active = activePlayers(t);
  // Winner: the sole survivor, else the human (deterministic — "exercise the UI").
  const winner = active.length === 1 ? active[0] : human(t) ?? active[0];
  winner.stack += t.pot;
  winner.status = "showing";
  t.winners = [
    {
      address: winner.address,
      amount: t.pot.toString(),
      cards: [...winner.holeCards, ...t.board],
      name: "Winner",
      description: active.length === 1 ? "Opponent folded" : "High Card",
    },
  ];
  // Land on END (not "showdown") so the UI offers a NEW_HAND action to the
  // human and can cycle into the next hand (auto or manual). Cards stay revealed
  // through END (see playerDTO); stacks carry forward into startHand.
  t.round = "end";
  t.nextToAct = human(t)?.seat ?? -1; // human drives the next hand
  t.pot = 0n;
}

function runBotUntilHuman(t: Table, step: () => void): void {
  let guard = 0;
  while (t.round !== "showdown" && t.round !== "end" && guard++ < 20) {
    const actor = seatOf(t, t.nextToAct);
    if (!actor || !actor.isBot || actor.status !== "active") break;
    // Bot policy: call if facing a bet, else check.
    const facing = t.currentBet > actor.streetBet;
    applyBettingAction(t, { address: actor.address, action: facing ? "call" : "check" });
    // Emit a frame for each bot step so per-frame mode reproduces the live
    // gateway's one-frame-per-action stream.
    step();
  }
}

// ---- DTO projection ------------------------------------------------------

function legalActionsFor(t: Table, s: Seat): Array<{ action: string; min: string; max: string; index: number }> {
  // Hand over: only the human, on their turn, may start the next hand. Their
  // status here is "showing"/"folded", so this precedes the active-status guard.
  if (t.round === "end") {
    if (t.nextToAct !== s.seat || s.isBot) return [];
    return [{ action: "new-hand", min: "0", max: "0", index: t.actionCount + 1 }];
  }
  if (t.nextToAct !== s.seat || s.status !== "active") return [];
  const index = t.actionCount + 1;
  const owed = t.currentBet - s.streetBet;
  const mk = (action: string, min: bigint, max: bigint) => ({
    action,
    min: min.toString(),
    max: max.toString(),
    index,
  });
  if (owed > 0n) {
    return [
      mk("fold", 0n, 0n),
      mk("call", owed, owed),
      mk("raise", t.currentBet + BIG_BLIND, s.streetBet + s.stack),
    ];
  }
  return [mk("check", 0n, 0n), mk("bet", BIG_BLIND, s.streetBet + s.stack)];
}

function playerDTO(t: Table, s: Seat) {
  const revealed = !s.isBot || t.round === "showdown" || t.round === "end";
  return {
    address: s.address,
    seat: s.seat,
    stack: s.stack.toString(),
    isSmallBlind: s.seat === t.dealer,
    isBigBlind: !s.isBot ? false : t.round !== "ante",
    isDealer: s.seat === t.dealer,
    holeCards: s.holeCards.length ? (revealed ? s.holeCards : ["??", "??"]) : [],
    status: s.status,
    lastAction: s.lastAction
      ? {
          playerId: s.address,
          seat: s.seat,
          action: s.lastAction.action,
          amount: s.lastAction.amount.toString(),
          round: s.lastAction.round,
          index: s.lastAction.index,
          timestamp: 0,
        }
      : undefined,
    legalActions: legalActionsFor(t, s),
    sumOfBets: s.streetBet.toString(),
    timeout: 30,
    signature: "",
  };
}

function texasHoldemStateDTO(t: Table) {
  const occupied = new Set(t.seats.map((s) => s.seat));
  const availableSeats: number[] = [];
  for (let i = 1; i <= 9; i++) if (!occupied.has(i)) availableSeats.push(i);
  const nextSeat = seatOf(t, t.nextToAct);
  return {
    gameOptions: OPTIONS,
    smallBlindPosition: t.dealer,
    bigBlindPosition: bot(t)?.seat ?? 0,
    dealer: t.dealer,
    players: t.seats.map((s) => playerDTO(t, s)),
    communityCards: t.board,
    deck: "",
    pots: [t.pot.toString()],
    totalPot: t.pot.toString(),
    nextToAct: t.nextToAct,
    previousActions: t.previousActions,
    actionCount: t.actionCount,
    handNumber: t.handNumber,
    round: t.round,
    winners: t.winners,
    results: [],
    legalActions: nextSeat ? legalActionsFor(t, nextSeat) : [],
    availableSeats,
    signature: "",
  };
}

/** GameStateResponseDTO — the canonical root type. */
export function getGameStateResponse(gameId: string) {
  const t = table(gameId);
  if (!t) return undefined;
  return {
    gameId,
    creator: CREATOR,
    format: "cash",
    variant: "texas-holdem",
    gameState: texasHoldemStateDTO(t),
  };
}

/** list_games — `games` is a JSON-ENCODED STRING (verified vs live node1). */
export function listGamesResponse() {
  const games = [...store.keys()].map((gameId) => {
    const t = table(gameId)!;
    return {
      gameId,
      creator: CREATOR,
      format: "cash",
      variant: "texas-holdem",
      gameOptions: OPTIONS,
      currentPlayers: t.seats.length,
      createdAt: "2026-07-11T00:00:00Z",
      updatedAt: "2026-07-11T00:00:00Z",
    };
  });
  return { games: JSON.stringify(games) };
}

/**
 * Chain WS state frame — the cosmos/node-relay shape the UI's bus classifies
 * directly (src/bus/ingest.ts): a COSMOS_STATE_EVENTS `event` plus the payload
 * under `data:{format,variant,gameState}`. `action_performed` is the generic
 * "state advanced" event.
 */
export function cosmosStateMessage(gameId: string) {
  const g = getGameStateResponse(gameId);
  if (!g) return null;
  return {
    event: "action_performed",
    gameId,
    data: { format: g.format, variant: g.variant, gameState: g.gameState },
  };
}
