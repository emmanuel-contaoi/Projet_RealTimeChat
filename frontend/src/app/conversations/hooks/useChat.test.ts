import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { authService, messagesService } from "@/services/api";

import useChat from "./useChat";

type MockSocketInstance = {
  close: jest.Mock;
  onclose: ((event?: unknown) => void) | null;
  onerror: ((event?: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onopen: (() => void) | null;
  readyState: number;
  send: jest.Mock;
  url: string;
};

const socketInstances: MockSocketInstance[] = [];
const notificationInstances: MockNotification[] = [];

class MockWebSocket {
  static OPEN = 1;

  close = jest.fn();
  onclose: ((event?: unknown) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = MockWebSocket.OPEN;
  send = jest.fn();
  url: string;

  constructor(url: string) {
    this.url = url;
    socketInstances.push(this);
  }
}

class MockNotification {
  static permission: NotificationPermission = "granted";
  static requestPermission = jest.fn<() => Promise<NotificationPermission>>(
    () => Promise.resolve(MockNotification.permission)
  );

  close = jest.fn();
  onclick: (() => void) | null = null;
  title: string;
  options?: NotificationOptions;

  constructor(title: string, options?: NotificationOptions) {
    this.title = title;
    this.options = options;
    notificationInstances.push(this);
  }
}

describe("useChat", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    socketInstances.length = 0;
    notificationInstances.length = 0;
    MockNotification.permission = "granted";
    MockNotification.requestPermission = jest.fn(() =>
      Promise.resolve(MockNotification.permission)
    );
    window.localStorage.clear();
    window.localStorage.setItem("token", "token-123");
    window.localStorage.setItem("user", JSON.stringify({
      id: "me-id",
      username: "me",
    }));
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
    Object.defineProperty(window, "Notification", {
      configurable: true,
      writable: true,
      value: MockNotification,
    });
    jest.spyOn(window, "focus").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(authService, "getCurrentUser").mockReturnValue({
      id: "me-id",
      username: "me",
    } as ReturnType<typeof authService.getCurrentUser>);
    jest.spyOn(messagesService, "history").mockResolvedValue([]);
    jest.spyOn(messagesService, "update").mockResolvedValue(undefined as never);
    jest.spyOn(messagesService, "delete").mockResolvedValue(undefined as never);
    jest.spyOn(messagesService, "addReaction").mockResolvedValue([]);
    jest.spyOn(messagesService, "removeReaction").mockResolvedValue([]);
  });

  const openSocket = () => {
    act(() => {
      socketInstances[0].onopen?.();
    });
  };

  const emitWsEvent = (event: { type: string; [key: string]: unknown }) => {
    act(() => {
      socketInstances[0].onmessage?.({
        data: JSON.stringify(event),
      });
    });
  };

  it("normalizes websocket messages and ignores duplicate message ids", () => {
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setActiveChannel("channel-1");
    });

    emitWsEvent({
      type: "message_new",
      id: "msg-1",
      channel_id: "channel-1",
      user_id: "user-1",
      username: "alice",
      content: "hello",
      created_at: "2026-03-17T10:00:00Z",
      reactions: [
        { emoji: "🔥", user_ids: ["user-1", 42, "user-2"] },
        { emoji: 12 },
      ],
    });
    emitWsEvent({
      type: "message_new",
      id: "msg-1",
      channel_id: "channel-1",
      user_id: "user-1",
      username: "alice",
      content: "duplicate",
    });

    expect(result.current.messages).toEqual([
      {
        id: "msg-1",
        channel_id: "channel-1",
        user_id: "user-1",
        username: "alice",
        content: "hello",
        created_at: "2026-03-17T10:00:00Z",
        reactions: [{ emoji: "🔥", user_ids: ["user-1", "user-2"] }],
      },
    ]);
    expect(notificationInstances).toHaveLength(1);
    expect(notificationInstances[0]).toMatchObject({
      title: "Nouveau message de alice",
      options: { body: "1 nouveau message", tag: "chat-channel-1" },
    });
    expect(result.current.toastNotifications).toEqual([
      {
        id: "chat-channel-1",
        channelId: "channel-1",
        title: "Nouveau message de alice",
        body: "1 nouveau message",
      },
    ]);
  });

  it("does not notify for the current user's own messages", () => {
    const { result } = renderHook(() => useChat());

    emitWsEvent({
      type: "message_new",
      id: "msg-self",
      channel_id: "channel-1",
      user_id: "me-id",
      username: "me",
      content: "my own message",
    });

    expect(notificationInstances).toHaveLength(0);
    expect(result.current.toastNotifications).toEqual([]);
  });

  it("requests browser permission before notifying when needed", async () => {
    MockNotification.permission = "default";
    MockNotification.requestPermission = jest.fn(async () => {
      MockNotification.permission = "granted";
      return "granted";
    });

    renderHook(() => useChat());

    emitWsEvent({
      type: "message_new",
      id: "msg-2",
      channel_id: "channel-2",
      user_id: "user-2",
      username: "bob",
      content: "permission check",
    });

    await waitFor(() => {
      expect(MockNotification.requestPermission).toHaveBeenCalledTimes(1);
      expect(notificationInstances).toHaveLength(1);
    });
  });

  it("dismisses in-app toast notifications automatically and manually", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useChat());

    emitWsEvent({
      type: "message_new",
      id: "msg-toast",
      channel_id: "channel-9",
      user_id: "user-9",
      username: "zoe",
      content: "toast body",
    });

    expect(result.current.toastNotifications).toHaveLength(1);

    act(() => {
      result.current.dismissToastNotification("chat-channel-9");
    });

    expect(result.current.toastNotifications).toEqual([]);

    emitWsEvent({
      type: "message_new",
      id: "msg-auto",
      channel_id: "channel-10",
      user_id: "user-10",
      username: "max",
      content: "auto dismiss",
    });

    expect(result.current.toastNotifications).toHaveLength(1);

    act(() => {
      jest.advanceTimersByTime(12000);
    });

    expect(result.current.toastNotifications).toEqual([]);
  });

  it("loads message history and normalizes reactions", async () => {
    jest.spyOn(messagesService, "history").mockResolvedValue([
      {
        id: "msg-1",
        channel_id: "channel-1",
        user_id: "user-1",
        username: "alice",
        content: "hello",
        reactions: [{ emoji: "🔥", user_ids: ["user-1", null, "user-2"] }],
      },
    ]);

    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.loadMessages("channel-1");
    });

    expect(messagesService.history).toHaveBeenCalledWith("channel-1");
    expect(result.current.messages).toEqual([
      {
        id: "msg-1",
        channel_id: "channel-1",
        user_id: "user-1",
        username: "alice",
        content: "hello",
        reactions: [{ emoji: "🔥", user_ids: ["user-1", "user-2"] }],
      },
    ]);
  });

  it("counts unread messages by channel and clears the count when the channel becomes active", () => {
    const { result } = renderHook(() => useChat());

    emitWsEvent({
      type: "message_new",
      id: "msg-3",
      channel_id: "channel-unread",
      user_id: "user-3",
      username: "charlie",
      content: "first",
    });
    emitWsEvent({
      type: "message_new",
      id: "msg-4",
      channel_id: "channel-unread",
      user_id: "user-3",
      username: "charlie",
      content: "second",
    });

    expect(result.current.unreadChannels.has("channel-unread")).toBe(true);
    expect(result.current.unreadCountByChannel).toEqual({
      "channel-unread": 2,
    });
    expect(notificationInstances[1]).toMatchObject({
      title: "Nouveau message de charlie",
      options: { body: "2 nouveaux messages", tag: "chat-channel-unread" },
    });
    expect(result.current.toastNotifications).toEqual([
      {
        id: "chat-channel-unread",
        channelId: "channel-unread",
        title: "Nouveau message de charlie",
        body: "2 nouveaux messages",
      },
    ]);

    act(() => {
      result.current.setActiveChannel("channel-unread");
    });

    expect(result.current.unreadChannels.has("channel-unread")).toBe(false);
    expect(result.current.unreadCountByChannel).toEqual({});
    expect(window.localStorage.getItem("chat-unread-state:me-id")).toBeNull();
  });

  it("restores unread counters from localStorage on refresh", async () => {
    window.localStorage.setItem(
      "chat-unread-state:me-id",
      JSON.stringify({
        unreadCountByChannel: {
          "channel-restored": 4,
        },
      })
    );

    const { result } = renderHook(() => useChat());

    await waitFor(() => {
      expect(result.current.unreadChannels.has("channel-restored")).toBe(true);
      expect(result.current.unreadCountByChannel).toEqual({
        "channel-restored": 4,
      });
    });
  });

  it("persists unread counters when a new unread message arrives", async () => {
    const { result } = renderHook(() => useChat());

    emitWsEvent({
      type: "message_new",
      id: "msg-persist",
      channel_id: "channel-persisted",
      user_id: "user-12",
      username: "dina",
      content: "persist me",
    });

    await waitFor(() => {
      expect(result.current.unreadCountByChannel).toEqual({
        "channel-persisted": 1,
      });
      expect(window.localStorage.getItem("chat-unread-state:me-id")).toBe(
        JSON.stringify({
          unreadCountByChannel: {
            "channel-persisted": 1,
          },
        })
      );
    });
  });

  it("syncs websocket rooms when the active channel changes", async () => {
    const { result } = renderHook(() => useChat());

    openSocket();

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.syncChannel("channel-1");
      result.current.syncChannel("channel-2");
    });

    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ type: "join_channel", channel_id: "channel-1" })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({ type: "leave_channel", channel_id: "channel-1" })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      3,
      JSON.stringify({ type: "join_channel", channel_id: "channel-2" })
    );
  });

  it("throttles typing events and clears the throttle after sending a message", () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setActiveChannel("channel-1");
      result.current.handleTyping();
      result.current.handleTyping();
    });

    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ type: "typing_start", channel_id: "channel-1" })
    );

    act(() => {
      result.current.handleSendMessage("hello");
    });

    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({
        type: "message_send",
        channel_id: "channel-1",
        content: "hello",
      })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      3,
      JSON.stringify({ type: "typing_stop", channel_id: "channel-1" })
    );

    act(() => {
      result.current.handleTyping();
    });

    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      4,
      JSON.stringify({ type: "typing_start", channel_id: "channel-1" })
    );
  });

  it("updates local messages after edit, delete and reaction API calls", async () => {
    jest.spyOn(messagesService, "addReaction").mockResolvedValue([
      { emoji: "🔥", user_ids: ["user-1"] },
    ]);
    jest.spyOn(messagesService, "removeReaction").mockResolvedValue([]);

    const { result } = renderHook(() => useChat());

    act(() => {
      result.current.setMessages([
        {
          id: "msg-1",
          channel_id: "channel-1",
          user_id: "user-1",
          username: "alice",
          content: "before",
          reactions: [],
        },
      ]);
    });

    await act(async () => {
      await result.current.handleEditMessage("msg-1", "after");
      await result.current.handleAddReaction("msg-1", "🔥");
    });

    expect(result.current.messages[0]).toMatchObject({
      id: "msg-1",
      content: "after",
      reactions: [{ emoji: "🔥", user_ids: ["user-1"] }],
    });

    await act(async () => {
      await result.current.handleRemoveReaction("msg-1", "🔥");
      await result.current.handleDeleteMessage("msg-1");
    });

    expect(result.current.messages).toEqual([]);
  });

  it("tracks typing users and filters out the current user name", async () => {
    jest.useFakeTimers();
    const { result } = renderHook(() => useChat());

    emitWsEvent({
      type: "user_typing",
      user_id: "user-1",
      username: "alice",
      channel_id: "",
    });
    emitWsEvent({
      type: "user_typing",
      user_id: "user-2",
      username: "me",
      channel_id: "",
    });

    expect(result.current.typingUserNames).toEqual(["alice"]);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(result.current.typingUserNames).toEqual([]);
    });
  });
});
