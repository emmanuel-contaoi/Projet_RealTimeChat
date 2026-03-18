import { useCallback, useRef, useState } from "react";
import useWebSocket from "@/hooks/useWebSocket";
import { authService, messagesService } from "@/services/api";
import type { ChannelMessage, MessageReaction } from "../types";

type UseChatOptions = {
  onExtraWsEvent?: (event: { type: string; [key: string]: unknown }) => void;
};

export default function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  
  const [typingUsers, setTypingUsers] = useState<
    Record<string, { username: string; timer: ReturnType<typeof setTimeout> }>
  >({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevChannelRef = useRef("");
  const activeChannelRef = useRef("");

  const setActiveChannel = useCallback((channelId: string) => {
    activeChannelRef.current = channelId;
    setUnreadChannels((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
  }, []);

  const normalizeReactions = useCallback((reactions: unknown): MessageReaction[] => {
    if (!Array.isArray(reactions)) return [];
    return reactions
      .filter((reaction): reaction is { emoji: string; user_ids?: string[] } => (
        typeof reaction === "object" &&
        reaction !== null &&
        typeof (reaction as { emoji?: unknown }).emoji === "string"
      ))
      .map((reaction) => ({
        emoji: reaction.emoji,
        user_ids: Array.isArray(reaction.user_ids)
          ? reaction.user_ids.filter((id): id is string => typeof id === "string")
          : [],
      }));
  }, []);

  const handleWsMessage = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      if (event.type === "message_new") {
        const msgChannelId = event.channel_id as string;
        
        if (msgChannelId === activeChannelRef.current) {
          const msg: ChannelMessage = {
            id: event.id as string | undefined,
            channel_id: msgChannelId,
            user_id: event.user_id as string,
            username: event.username as string,
            content: event.content as string,
            created_at: event.created_at as string | undefined,
            reactions: normalizeReactions(event.reactions),
          };
          setMessages((prev) => {
            if (prev.some((m) => m.id && m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        } else {
          setUnreadChannels((prev) => {
            const next = new Set(prev);
            next.add(msgChannelId);
            return next;
          });
        }
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
        
        if (event.channel_id !== activeChannelRef.current) return;

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

      if (event.type === "message_edited") {
        const mid = event.message_id as string;
        const content = event.content as string;
        setMessages((prev) =>
          prev.map((m) => (m.id === mid ? { ...m, content } : m))
        );
      }

      if (event.type === "message_deleted") {
        const mid = event.message_id as string;
        setMessages((prev) => prev.filter((m) => m.id !== mid));
      }

      if (event.type === "message_reaction_updated") {
        const mid = event.message_id as string;
        const reactions = normalizeReactions(event.reactions);
        setMessages((prev) =>
          prev.map((m) => (m.id === mid ? { ...m, reactions } : m))
        );
      }

      if (event.type === "error") {
        console.warn("[WS] Server error:", event.message);
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
    [normalizeReactions]
  );

  const { sendMessage, joinChannel, leaveChannel, startTyping, stopTyping, isConnected } =
    useWebSocket({ onMessage: handleWsMessage, onExtraWsEvent: options?.onExtraWsEvent });

  const loadMessages = useCallback(async (channelId: string) => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    setTypingUsers({});
    try {
      const data = await messagesService.history(channelId);
      const nextMessages = Array.isArray(data)
        ? data.map((msg) => ({
            ...msg,
            reactions: normalizeReactions(
              (msg as { reactions?: unknown }).reactions
            ),
          }))
        : [];
      setMessages(nextMessages);
    } catch (err) {
      console.error("[API] Failed to load messages:", err);
      setMessages([]);
    }
  }, [normalizeReactions]);

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

  const handleSendMessage = useCallback(
    (content: string) => {
      if (!activeChannelRef.current) return;
      sendMessage(activeChannelRef.current, content);
      stopTyping(activeChannelRef.current);
      if (typingThrottleRef.current) {
        clearTimeout(typingThrottleRef.current);
        typingThrottleRef.current = null;
      }
    },
    [sendMessage, stopTyping]
  );

  const handleEditMessage = useCallback(async (messageId: string, content: string) => {
    try {
      await messagesService.update(messageId, content);
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, content } : m));
    } catch (err) {
      console.error("[API] Edit message error:", err);
    }
  }, []);

  const handleDeleteMessage = useCallback(async (messageId: string) => {
    try {
      await messagesService.delete(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    } catch (err) {
      console.error("[API] Delete message error:", err);
    }
  }, []);

  const handleAddReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const reactions = normalizeReactions(await messagesService.addReaction(messageId, emoji));
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
    } catch (err) {
      console.error("[API] Add reaction error:", err);
    }
  }, [normalizeReactions]);

  const handleRemoveReaction = useCallback(async (messageId: string, emoji: string) => {
    try {
      const reactions = normalizeReactions(await messagesService.removeReaction(messageId, emoji));
      setMessages((prev) => prev.map((m) => m.id === messageId ? { ...m, reactions } : m));
    } catch (err) {
      console.error("[API] Remove reaction error:", err);
    }
  }, [normalizeReactions]);

  const handleTyping = useCallback(() => {
    if (!activeChannelRef.current) return;
    if (typingThrottleRef.current) return;
    startTyping(activeChannelRef.current);
    typingThrottleRef.current = setTimeout(() => {
      typingThrottleRef.current = null;
    }, 2000);
  }, [startTyping]);

  const typingUserNames = Object.values(typingUsers)
    .map((t) => t.username)
    .filter((name) => name !== authService.getCurrentUser()?.username);

  return {
    messages,
    setMessages,
    typingUserNames,
    onlineUserIds,
    unreadChannels, 
    isConnected,
    joinChannel,
    loadMessages,
    syncChannel,
    setActiveChannel,
    handleSendMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleAddReaction,
    handleRemoveReaction,
    handleTyping,
  };
}