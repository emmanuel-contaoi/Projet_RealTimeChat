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

describe("useChat", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    socketInstances.length = 0;
    window.localStorage.clear();
    window.localStorage.setItem("token", "token-123");
    Object.defineProperty(window, "WebSocket", {
      configurable: true,
      writable: true,
      value: MockWebSocket,
    });
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(authService, "getCurrentUser").mockReturnValue({
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
