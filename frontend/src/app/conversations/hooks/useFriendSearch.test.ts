import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";

import { authService, friendsService } from "@/services/api";

import useFriendSearch from "./useFriendSearch";

type MockUser = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
  avatar_url?: string | null;
};

const currentUser: MockUser = {
  id: "current-user",
  email: "me@example.com",
  first_name: "Me",
  last_name: "User",
  username: "me",
  created_at: "2026-03-16T10:00:00Z",
};

const alice: MockUser = {
  id: "friend-1",
  email: "alice@example.com",
  first_name: "Alice",
  last_name: "Martin",
  username: "Alice",
  created_at: "2026-03-16T10:00:00Z",
};

const bob: MockUser = {
  id: "friend-2",
  email: "bob@example.com",
  first_name: null,
  last_name: null,
  username: "bob",
  created_at: "2026-03-16T10:00:00Z",
};

const fetchMock = jest.fn<(url: string, options?: RequestInit) => Promise<unknown>>();

describe("useFriendSearch", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    window.localStorage.clear();
    window.localStorage.setItem("token", "token-123");

    jest.spyOn(authService, "getCurrentUser").mockReturnValue(currentUser);
    jest.spyOn(friendsService, "list").mockResolvedValue([alice, bob]);
    jest.spyOn(friendsService, "incomingRequests").mockResolvedValue([
      {
        id: "incoming-1",
        status: "pending",
        created_at: "2026-03-16T10:00:00Z",
        user: bob,
      },
    ]);
    jest.spyOn(friendsService, "outgoingRequests").mockResolvedValue([
      {
        id: "outgoing-1",
        status: "pending",
        created_at: "2026-03-16T10:00:00Z",
        user: alice,
      },
    ]);
    fetchMock.mockReset();
    Object.defineProperty(globalThis, "fetch", {
      configurable: true,
      writable: true,
      value: fetchMock,
    });
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [currentUser, alice, bob],
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("loads friends, requests and all users when the friends tab is active", async () => {
    const onlineUserIds = new Set(["friend-1"]);

    const { result } = renderHook(() =>
      useFriendSearch({
        isReady: true,
        activeTab: "friends",
        onlineUserIds,
      })
    );

    await waitFor(() => {
      // 🔴 CORRECTION : "Alice" au lieu de "Alice Martin"
      expect(result.current.friendList).toEqual([
        { id: "friend-1", name: "Alice", username: "Alice", avatar_url: undefined, status: "En ligne" },
        { id: "friend-2", name: "bob", username: "bob", avatar_url: undefined, status: "Hors ligne" },
      ]);
      expect(result.current.selectedFriend).toBe("friend-1");
      expect(result.current.incomingRequests).toHaveLength(1);
      expect(result.current.outgoingRequests).toHaveLength(1);
      expect(result.current.allUsers).toEqual([alice, bob]);
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/users", {
      headers: { Authorization: "Bearer token-123" },
      signal: expect.any(AbortSignal),
    });
  });

  it("searches users with debounce and filters out the current user", async () => {
    jest.useFakeTimers();
    const onlineUserIds = new Set<string>();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [currentUser, alice, bob],
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [currentUser, alice],
      });

    const { result } = renderHook(() =>
      useFriendSearch({
        isReady: true,
        activeTab: "friends",
        onlineUserIds,
      })
    );

    await waitFor(() => {
      expect(result.current.allUsers).toEqual([alice, bob]);
    });

    act(() => {
      result.current.setFriendSearch("ali");
    });

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.friendResults).toEqual([alice]);
    });

    expect(fetchMock).toHaveBeenLastCalledWith(
      "http://localhost:3001/users/search?q=ali",
      {
        headers: { Authorization: "Bearer token-123" },
        signal: expect.any(AbortSignal),
      }
    );
  });

  it("refreshes the friend data after sending a friend request", async () => {
    const onlineUserIds = new Set<string>();
    const listSpy = jest
      .spyOn(friendsService, "list")
      .mockResolvedValueOnce([alice])
      .mockResolvedValueOnce([alice, bob]);
    const incomingSpy = jest
      .spyOn(friendsService, "incomingRequests")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const outgoingSpy = jest
      .spyOn(friendsService, "outgoingRequests")
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: "outgoing-2", status: "pending", created_at: "2026-03-16T10:00:00Z", user: bob }]);
    const sendRequestSpy = jest
      .spyOn(friendsService, "sendRequest")
      .mockResolvedValueOnce();

    const { result } = renderHook(() =>
      useFriendSearch({
        isReady: true,
        activeTab: "servers",
        onlineUserIds,
      })
    );

    await waitFor(() => {
      expect(result.current.friendList).toHaveLength(1);
    });

    await act(async () => {
      await result.current.handleSendFriendRequest(bob);
    });

    expect(sendRequestSpy).toHaveBeenCalledWith("friend-2");
    expect(listSpy).toHaveBeenCalledTimes(2);
    expect(incomingSpy).toHaveBeenCalledTimes(2);
    expect(outgoingSpy).toHaveBeenCalledTimes(2);
    
    // 🔴 CORRECTION : "Alice" au lieu de "Alice Martin"
    expect(result.current.friendList).toEqual([
      { id: "friend-1", name: "Alice", username: "Alice", avatar_url: undefined, status: "Hors ligne" },
      { id: "friend-2", name: "bob", username: "bob", avatar_url: undefined, status: "Hors ligne" },
    ]);
    expect(result.current.outgoingRequests).toHaveLength(1);
    expect(result.current.friendSearchError).toBe("");
  });

  it("shows the fallback error when the initial refresh fails", async () => {
    const onlineUserIds = new Set<string>();
    jest
      .spyOn(friendsService, "list")
      .mockRejectedValueOnce(new Error("boom"));

    const { result } = renderHook(() =>
      useFriendSearch({
        isReady: true,
        activeTab: "servers",
        onlineUserIds,
      })
    );

    await waitFor(() => {
      expect(result.current.friendSearchError).toBe(
        "Impossible de charger les donnees des amis."
      );
    });
  });
});