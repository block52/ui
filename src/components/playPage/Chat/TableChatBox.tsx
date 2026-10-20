import React, { useCallback, useEffect, useRef, useState } from "react";
import "./TableChatBox.css";
import { useTableChat } from "../../../chat/useTableChat";
import { senderLabel, relativeTime } from "../../../chat/chatFormat";

const EMOJIS = ["😀", "😂", "😎", "😭", "😮", "🤔", "🔥", "👍", "👎", "🙏", "👀", "💪", "🎉", "🤑", "😤", "🫡", "♠️", "♥️", "♦️", "♣️", "🃏", "💰", "🍀", "🤝"];

const LS_OPEN = "b52.chat.open";
const LS_DRAFT = "b52.chat.draft";

function readLS(key: string, fallback: string): string {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch {
        return fallback;
    }
}
function writeLS(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        /* private mode / blocked storage — chat still works in-session */
    }
}

/**
 * Table chat box (block52-chat#1). A collapsible panel in the corner of the table.
 * Rides the game WebSocket (see chatBus); own messages echo locally so it works
 * for a demo even before the ws-server broadcasts chat (block52-chat#6).
 */
const TableChatBox: React.FC = () => {
    const { messages, sendChat } = useTableChat();
    const [open, setOpen] = useState<boolean>(() => readLS(LS_OPEN, "false") === "true");
    const [draft, setDraft] = useState<string>(() => readLS(LS_DRAFT, ""));
    const [showEmoji, setShowEmoji] = useState(false);
    const [unread, setUnread] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const seenRef = useRef(messages.length);

    // Track unread while closed; clear on open.
    useEffect(() => {
        if (open) {
            setUnread(0);
            seenRef.current = messages.length;
        } else {
            const delta = messages.length - seenRef.current;
            if (delta > 0 && !messages[messages.length - 1]?.mine) setUnread(u => u + delta);
            seenRef.current = messages.length;
        }
    }, [messages, open]);

    // Keep the list scrolled to the newest message.
    useEffect(() => {
        if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages, open]);

    const toggle = useCallback(() => {
        setOpen(prev => {
            const next = !prev;
            writeLS(LS_OPEN, String(next));
            return next;
        });
        setShowEmoji(false);
    }, []);

    const onDraft = useCallback((v: string) => {
        setDraft(v);
        writeLS(LS_DRAFT, v);
    }, []);

    const submit = useCallback(() => {
        const text = draft.trim();
        if (!text) return;
        sendChat(text);
        onDraft("");
        setShowEmoji(false);
    }, [draft, sendChat, onDraft]);

    const onKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
            }
        },
        [submit]
    );

    return (
        <div className="b52-chat">
            {open && (
                <div className="b52-chat__panel" role="log" aria-label="Table chat">
                    <div className="b52-chat__header">
                        <span>Chat</span>
                        <button type="button" className="b52-chat__close" aria-label="Close chat" onClick={toggle}>
                            ✕
                        </button>
                    </div>

                    <div className="b52-chat__messages" ref={listRef}>
                        {messages.length === 0 ? (
                            <div className="b52-chat__empty">Say hello 👋</div>
                        ) : (
                            messages.map(m => (
                                <div key={m.id} className={`b52-chat__msg${m.mine ? " b52-chat__msg--mine" : ""}`}>
                                    <span className="b52-chat__meta">
                                        <span className="b52-chat__from">{senderLabel(m.from, m.mine)}</span>
                                        <span className="b52-chat__time">{relativeTime(m.ts)}</span>
                                    </span>
                                    <span className="b52-chat__text">{m.text}</span>
                                </div>
                            ))
                        )}
                    </div>

                    {showEmoji && (
                        <div className="b52-chat__emoji" role="listbox" aria-label="Emojis">
                            {EMOJIS.map(e => (
                                <button
                                    key={e}
                                    type="button"
                                    className="b52-chat__emoji-btn"
                                    onClick={() => {
                                        onDraft(draft + e);
                                        setShowEmoji(false);
                                    }}
                                >
                                    {e}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="b52-chat__composer">
                        <button
                            type="button"
                            className="b52-chat__emoji-toggle"
                            aria-label="Emojis"
                            onClick={() => setShowEmoji(s => !s)}
                        >
                            😊
                        </button>
                        <textarea
                            className="b52-chat__input"
                            value={draft}
                            onChange={e => onDraft(e.target.value)}
                            onKeyDown={onKeyDown}
                            placeholder="Message the table…"
                            rows={1}
                            maxLength={300}
                        />
                        <button type="button" className="b52-chat__send" onClick={submit} disabled={!draft.trim()}>
                            Send
                        </button>
                    </div>
                </div>
            )}

            <button type="button" className="b52-chat__fab" onClick={toggle} aria-label={open ? "Close chat" : "Open chat"}>
                💬
                {!open && unread > 0 && <span className="b52-chat__badge">{unread > 9 ? "9+" : unread}</span>}
            </button>
        </div>
    );
};

export default TableChatBox;
