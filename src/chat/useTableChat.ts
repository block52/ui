import { useEffect, useState, useCallback } from "react";
import { ChatMessage, subscribeChatMessages, sendChat as busSendChat } from "./chatBus";

export interface UseTableChat {
    messages: ChatMessage[];
    sendChat: (text: string) => void;
}

/** Subscribe to the table chat log and expose a send function. */
export function useTableChat(): UseTableChat {
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    useEffect(() => subscribeChatMessages(setMessages), []);

    const sendChat = useCallback((text: string) => busSendChat(text), []);

    return { messages, sendChat };
}
