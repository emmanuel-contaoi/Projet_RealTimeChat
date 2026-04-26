import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import useWebSocket from "./useWebSocket";

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

describe("useWebSocket", () => {
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
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("connects with the current token and exposes the connected state", async () => {
    const onOpen = jest.fn();

    const { result } = renderHook(() => useWebSocket({ onOpen }));

    expect(socketInstances).toHaveLength(1);
    expect(socketInstances[0].url).toBe("ws://localhost:3001/ws?token=token-123");

    act(() => {
      socketInstances[0].onopen?.();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("forwards incoming events to both handlers", () => {
    const onMessage = jest.fn();
    const onExtraWsEvent = jest.fn();

    renderHook(() => useWebSocket({ onMessage, onExtraWsEvent }));

    act(() => {
      socketInstances[0].onmessage?.({
        data: JSON.stringify({ type: "message_new", content: "hello" }),
      });
    });

    expect(onMessage).toHaveBeenCalledWith({
      type: "message_new",
      content: "hello",
    });
    expect(onExtraWsEvent).toHaveBeenCalledWith({
      type: "message_new",
      content: "hello",
    });
  });

  it("sends websocket payloads for chat actions when the socket is open", () => {
    const { result } = renderHook(() => useWebSocket());

    act(() => {
      result.current.sendMessage("channel-1", "hello");
      result.current.joinChannel("channel-1");
      result.current.leaveChannel("channel-1");
      result.current.startTyping("channel-1");
      result.current.stopTyping("channel-1");
    });

    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({
        type: "message_send",
        channel_id: "channel-1",
        content: "hello",
      })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({ type: "join_channel", channel_id: "channel-1" })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      3,
      JSON.stringify({ type: "leave_channel", channel_id: "channel-1" })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      4,
      JSON.stringify({ type: "typing_start", channel_id: "channel-1" })
    );
    expect(socketInstances[0].send).toHaveBeenNthCalledWith(
      5,
      JSON.stringify({ type: "typing_stop", channel_id: "channel-1" })
    );
  });

  it("reconnects after the socket closes", () => {
    jest.useFakeTimers();

    renderHook(() => useWebSocket());

    expect(socketInstances).toHaveLength(1);

    act(() => {
      socketInstances[0].onclose?.();
    });

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(socketInstances).toHaveLength(2);
    expect(socketInstances[1].url).toBe("ws://localhost:3001/ws?token=token-123");
  });

  it("closes the socket when an error occurs", () => {
    renderHook(() => useWebSocket());

    act(() => {
      socketInstances[0].onerror?.();
    });

    expect(socketInstances[0].close).toHaveBeenCalled();
  });

  it("logs a warning when send is called while the socket is not open", () => {
    const { result } = renderHook(() => useWebSocket());

    socketInstances[0].readyState = 3;

    act(() => {
      result.current.sendMessage("ch-1", "hello");
    });

    expect(console.log).toHaveBeenCalledWith(
      "[WS] Cannot send, ws not open. readyState:",
      3
    );
  });
});
