import { useCallback, useEffect, useRef, useState } from "react";
import useWebSocket from "@/hooks/useWebSocket";
import { authService, messagesService } from "@/services/api";
import type { ChannelMessage, MessageReaction } from "../types";

type UseChatOptions = {
  onExtraWsEvent?: (event: { type: string; [key: string]: unknown }) => void;
};

type ChatToastNotification = {
  id: string;
  channelId: string;
  title: string;
  body: string;
};

const TOAST_NOTIFICATION_DURATION_MS = 12000;
const UNREAD_STORAGE_PREFIX = "chat-unread-state:";

const formatNewMessageCount = (count: number) =>
  `${count} nouveau${count > 1 ? "x" : ""} message${count > 1 ? "s" : ""}`;

export default function useChat(options?: UseChatOptions) {
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [unreadChannels, setUnreadChannels] = useState<Set<string>>(new Set());
  const [unreadCountByChannel, setUnreadCountByChannel] = useState<Record<string, number>>({});
  const [toastNotifications, setToastNotifications] = useState<ChatToastNotification[]>([]);
  
  const [typingUsers, setTypingUsers] = useState<
    Record<string, { username: string; timer: ReturnType<typeof setTimeout> }>
  >({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevChannelRef = useRef("");
  const activeChannelRef = useRef("");
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const toastTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const hasHydratedUnreadStateRef = useRef(false);
  const unreadCountByChannelRef = useRef<Record<string, number>>({});

  const getUnreadStorageKey = useCallback(() => {
    const currentUser = authService.getCurrentUser() as { id?: string } | null;
    return currentUser?.id ? `${UNREAD_STORAGE_PREFIX}${currentUser.id}` : null;
  }, []);

  const sanitizeUnreadCounts = useCallback((value: unknown): Record<string, number> => {
    if (!value || typeof value !== "object") return {};

    return Object.fromEntries(
      Object.entries(value)
        .filter(([channelId, count]) => (
          typeof channelId === "string" &&
          Number.isFinite(count) &&
          typeof count === "number" &&
          count > 0
        ))
        .map(([channelId, count]) => [channelId, Math.floor(count)])
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storageKey = getUnreadStorageKey();
    if (!storageKey) {
      hasHydratedUnreadStateRef.current = true;
      return;
    }

    try {
      const rawValue = window.localStorage.getItem(storageKey);
      if (!rawValue) {
        hasHydratedUnreadStateRef.current = true;
        return;
      }

      const parsed = JSON.parse(rawValue) as { unreadCountByChannel?: unknown };
      const nextUnreadCountByChannel = sanitizeUnreadCounts(parsed.unreadCountByChannel);
      unreadCountByChannelRef.current = nextUnreadCountByChannel;
      setUnreadCountByChannel(nextUnreadCountByChannel);
      setUnreadChannels(new Set(Object.keys(nextUnreadCountByChannel)));
    } catch {
      window.localStorage.removeItem(storageKey);
    } finally {
      hasHydratedUnreadStateRef.current = true;
    }
  }, [getUnreadStorageKey, sanitizeUnreadCounts]);

  useEffect(() => {
    if (typeof window === "undefined" || !hasHydratedUnreadStateRef.current) return;

    const storageKey = getUnreadStorageKey();
    if (!storageKey) return;

    try {
      if (!Object.keys(unreadCountByChannel).length) {
        window.localStorage.removeItem(storageKey);
        return;
      }

      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ unreadCountByChannel })
      );
    } catch {
      // On ignore les erreurs de quota/localStorage indisponible
    }
  }, [getUnreadStorageKey, unreadCountByChannel]);

  useEffect(() => {
    unreadCountByChannelRef.current = unreadCountByChannel;
  }, [unreadCountByChannel]);

  const setActiveChannel = useCallback((channelId: string) => {
    activeChannelRef.current = channelId;
    setUnreadChannels((prev) => {
      if (!prev.has(channelId)) return prev;
      const next = new Set(prev);
      next.delete(channelId);
      return next;
    });
    setUnreadCountByChannel((prev) => {
      if (!prev[channelId]) return prev;
      const next = { ...prev };
      delete next[channelId];
      unreadCountByChannelRef.current = next;
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

  const notifyNewMessage = useCallback((message: ChannelMessage, newMessageCount = 1) => {
    if (typeof window === "undefined" || !("Notification" in window)) return;

    const currentUser = authService.getCurrentUser() as { id?: string } | null;
    if (message.user_id === currentUser?.id) return;

    const showNotification = () => {
      const body = formatNewMessageCount(newMessageCount);
      const notification = new window.Notification(`Nouveau message de ${message.username}`, {
        body,
        tag: `chat-${message.channel_id}`,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    };

    if (window.Notification.permission === "granted") {
      showNotification();
      return;
    }

    if (window.Notification.permission === "default") {
      void window.Notification.requestPermission()
        .then((permission) => {
          if (permission === "granted") {
            showNotification();
          }
        })
        .catch(() => {});
    }
  }, []);

  const dismissToastNotification = useCallback((toastId: string) => {
    const timer = toastTimersRef.current[toastId];
    if (timer) {
      clearTimeout(timer);
      delete toastTimersRef.current[toastId];
    }
    setToastNotifications((prev) => prev.filter((toast) => toast.id !== toastId));
  }, []);

  const pushToastNotification = useCallback((message: ChannelMessage, newMessageCount = 1) => {
    const currentUser = authService.getCurrentUser() as { id?: string } | null;
    if (message.user_id === currentUser?.id) return;

    const toastId = `chat-${message.channel_id}`;

    setToastNotifications((prev) => {
      const next = prev.filter((toast) => toast.id !== toastId);
      return [
        ...next,
        {
          id: toastId,
          channelId: message.channel_id,
          title: `Nouveau message de ${message.username}`,
          body: formatNewMessageCount(newMessageCount),
        },
      ].slice(-3);
    });

    const existingTimer = toastTimersRef.current[toastId];
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    toastTimersRef.current[toastId] = setTimeout(() => {
      dismissToastNotification(toastId);
    }, TOAST_NOTIFICATION_DURATION_MS);
  }, [dismissToastNotification]);

  useEffect(() => () => {
    Object.values(toastTimersRef.current).forEach((timer) => clearTimeout(timer));
    toastTimersRef.current = {};
  }, []);

  const handleWsMessage = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      if (event.type === "message_new") {
        const msgChannelId = event.channel_id as string;
        const currentUser = authService.getCurrentUser() as { id?: string } | null;
        const msg: ChannelMessage = {
          id: event.id as string | undefined,
          channel_id: msgChannelId,
          user_id: event.user_id as string,
          username: event.username as string,
          content: event.content as string,
          created_at: event.created_at as string | undefined,
          reactions: normalizeReactions(event.reactions),
        };

        if (msg.id) {
          if (seenMessageIdsRef.current.has(msg.id)) return;
          seenMessageIdsRef.current.add(msg.id);
        }

        const isOwnMessage = msg.user_id === currentUser?.id;

        if (msgChannelId === activeChannelRef.current) {
          setMessages((prev) => [...prev, msg]);
        } else if (!isOwnMessage) {
          const nextUnreadCount = (unreadCountByChannelRef.current[msgChannelId] ?? 0) + 1;
          setUnreadChannels((prev) => {
            const next = new Set(prev);
            next.add(msgChannelId);
            return next;
          });
          unreadCountByChannelRef.current = {
            ...unreadCountByChannelRef.current,
            [msgChannelId]: nextUnreadCount,
          };
          setUnreadCountByChannel(unreadCountByChannelRef.current);
          notifyNewMessage(msg, nextUnreadCount);
          pushToastNotification(msg, nextUnreadCount);
          return;
        }

        notifyNewMessage(msg);
        pushToastNotification(msg);
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
          const hasNew = users.some((u) => !prev.has(u.user_id));
          if (!hasNew) return prev;
          const next = new Set(prev);
          for (const u of users) next.add(u.user_id);
          return next;
        });
      }
    },
    [normalizeReactions, notifyNewMessage, pushToastNotification]
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
      nextMessages.forEach((message) => {
        if (message.id) {
          seenMessageIdsRef.current.add(message.id);
        }
      });
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
    unreadCountByChannel,
    toastNotifications,
    isConnected,
    joinChannel,
    loadMessages,
    syncChannel,
    setActiveChannel,
    dismissToastNotification,
    handleSendMessage,
    handleEditMessage,
    handleDeleteMessage,
    handleAddReaction,
    handleRemoveReaction,
    handleTyping,
  };
}
