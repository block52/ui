/**
 * Table chat bus (block52-chat#1) — a tiny module-level pub/sub that decouples the
 * chat UI from the game WebSocket. Chat rides the SAME socket the game already
 * uses (near-zero extra hosting cost): GameStateContext registers a sender that
 * puts a {type:"chat"} frame on the wire, and forwards inbound chat frames here.
 *
 * Own messages are echoed locally on send, so the chat box works standalone for a
 * demo even before the ws-server broadcasts chat to other subscribers
 * (block52-chat#6).
 */

export interface ChatMessage {
    id: string;
    /** Sender identity — a wallet address for others, undefined for your own ("You"). */
    from?: string;
    text: string;
    ts: number;
    /** True for messages this client sent (right-aligned, labelled "You"). */
    mine: boolean;
}

const MAX_MESSAGES = 100;

let messages: ChatMessage[] = [];
const listeners = new Set<(messages: ChatMessage[]) => void>();
let sender: ((text: string) => void) | null = null;
let seq = 0;

function emit(): void {
    const snapshot = messages;
    listeners.forEach(l => l(snapshot));
}

/** Append a chat message (capped to the most recent {@link MAX_MESSAGES}). */
export function pushChatMessage(msg: Omit<ChatMessage, "id">): void {
    const next = messages.concat({ ...msg, id: `c${Date.now()}_${seq++}` });
    messages = next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
    emit();
}

/** Subscribe to the message list; returns an unsubscribe. */
export function subscribeChatMessages(listener: (messages: ChatMessage[]) => void): () => void {
    listeners.add(listener);
    listener(messages);
    return () => {
        listeners.delete(listener);
    };
}

export function getChatMessages(): ChatMessage[] {
    return messages;
}

/** GameStateContext registers the real WS sender here (and null on teardown). */
export function registerChatSender(fn: ((text: string) => void) | null): void {
    sender = fn;
}

/**
 * Send a chat message: echo it locally straight away (so you see your own message
 * without any backend), then put it on the wire via the registered sender.
 */
export function sendChat(text: string): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    pushChatMessage({ text: trimmed, ts: Date.now(), mine: true });
    sender?.(trimmed);
}

/** Clear the log (e.g. when switching tables). */
export function clearChat(): void {
    messages = [];
    emit();
}
