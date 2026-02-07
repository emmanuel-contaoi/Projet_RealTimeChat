import { useCallback, useRef, useState } from "react";
import useWebSocket from "@/hooks/useWebSocket";
import { authService, messagesService } from "@/services/api";
import type { ChannelMessage } from "../types";

export default function useChat() {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<
    Record<string, { username: string; timer: ReturnType<typeof setTimeout> }>
  >({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevChannelRef = useRef("");
  const activeChannelRef = useRef("");

  const setActiveChannel = useCallback((channelId: string) => {
    activeChannelRef.current = channelId;
  }, []);

  // --- WebSocket message handler ---
  const handleWsMessage = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      if (event.type === "message_new") {
        const msg: ChannelMessage = {
          id: event.id as string | undefined,
          channel_id: event.channel_id as string,
          user_id: event.user_id as string,
          username: event.username as string,
          content: event.content as string,
          created_at: event.created_at as string | undefined,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id && m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }

      if (event.type === "user_connected") {
        const uid = event.user_id as string;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.add(uid);
          return next;
        });
      }

      if (event.type === "user_disconnected") {
        const uid = event.user_id as string;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(uid);
          return next;
        });
      }

      if (event.type === "user_typing") {
        const uid = event.user_id as string;
        const uname = event.username as string;
        setTypingUsers((prev) => {
          if (prev[uid]) clearTimeout(prev[uid].timer);
          const timer = setTimeout(() => {
            setTypingUsers((p) => {
              const copy = { ...p };
              delete copy[uid];
              return copy;
            });
          }, 3000);
          return { ...prev, [uid]: { username: uname, timer } };
        });
      }

      if (event.type === "channel_users") {
        const users = event.users as Array<{
          user_id: string;
          username: string;
        }>;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          for (const u of users) {
            next.add(u.user_id);
          }
          return next;
        });
      }
    },
    []
  );

  const { sendMessage, joinChannel, leaveChannel, startTyping, isConnected } =
    useWebSocket({ onMessage: handleWsMessage });

  // --- Load message history when channel changes ---
  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    setTypingUsers({});
    try {
      const data = await messagesService.history(channelId);
      setMessages(data);
    } catch (err) {
      console.error("[API] Failed to load messages:", err);
      setMessages([]);
    }
  }, []);

  // --- WS join/leave channel ---
  const syncChannel = useCallback(
    (channelId: string) => {
      if (!isConnected) return;
      const prev = prevChannelRef.current;
      if (prev && prev !== channelId) {
        leaveChannel(prev);
      }
      if (channelId) {
        joinChannel(channelId);
      }
      prevChannelRef.current = channelId;
    },
    [isConnected, joinChannel, leaveChannel]
  );

  // --- Handlers ---
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!activeChannelRef.current) return;
      sendMessage(activeChannelRef.current, content);
    },
    [sendMessage]
  );

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await messagesService.delete(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error("[API] Delete message error:", err);
    }
  }, []);

  const handleTyping = useCallback(() => {
    if (!activeChannelRef.current) return;
    if (typingThrottleRef.current) return;
    startTyping(activeChannelRef.current);
    typingThrottleRef.current = setTimeout(() => {
      typingThrottleRef.current = null;
    }, 2000);
  }, [startTyping]);

  // --- Derived ---
  const typingUserNames = Object.values(typingUsers)
    .map((t) => t.username)
    .filter((name) => name !== authService.getCurrentUser()?.username);

  return {
    messages,
    setMessages,
    typingUserNames,
    onlineUserIds,
    isConnected,
    joinChannel,
    loadMessages,
    syncChannel,
    setActiveChannel,
    handleSendMessage,
    handleDeleteMessage,
    handleTyping,
  };
}
