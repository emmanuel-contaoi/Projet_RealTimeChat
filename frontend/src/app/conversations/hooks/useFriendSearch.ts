// Hook pour gerer la liste d'amis, les demandes et la recherche d'utilisateurs

import { useCallback, useEffect, useRef, useState } from "react";
import { authService, friendsService } from "@/services/api";
import { formatUserLabel } from "../utils";
import type { Friend, FriendRequest, UserSearchResult } from "../types";

type UseFriendSearchParams = {
  isReady: boolean;
  activeTab: "servers" | "friends";
  onlineUserIds: Set<string>;
};

type ApiErrorShape = {
  response?: {
    data?: unknown;
  };
};

const FRIEND_WS_EVENTS = new Set([
  "friend_request_received",
  "friend_request_cancelled",
  "friend_request_accepted",
  "friend_request_rejected",
  "friend_removed",
]);

const getErrorMessage = (error: unknown, fallback: string) => {
  const apiError = error as ApiErrorShape;
  const payload = apiError.response?.data;
  if (typeof payload === "string" && payload.trim()) return payload;
  return fallback;
};

export default function useFriendSearch({ isReady, activeTab, onlineUserIds }: UseFriendSearchParams) {
  const [friendList, setFriendList] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const currentUserId = authService.getCurrentUser()?.id ?? "";

  // 🔴 LA CORRECTION EST ICI : On ajoute avatar_url et username dans le mapping !
  const mapFriends = useCallback(
    (users: UserSearchResult[]) =>
      users.map((user) => ({
        id: user.id,
        name: formatUserLabel(user),
        username: user.username || user.first_name || "Ami",
        avatar_url: user.avatar_url, 
        status: onlineUserIds.has(user.id) ? "En ligne" : "Hors ligne",
      })),
    [onlineUserIds]
  );

  const refreshFriendsData = useCallback(async () => {
    const [friendsData, incomingData, outgoingData] = await Promise.all([
      friendsService.list() as Promise<UserSearchResult[]>,
      friendsService.incomingRequests() as Promise<FriendRequest[]>,
      friendsService.outgoingRequests() as Promise<FriendRequest[]>,
    ]);
    setFriendList(mapFriends(friendsData));
    setIncomingRequests(incomingData);
    setOutgoingRequests(outgoingData);
  }, [mapFriends]);

  const refreshFriendsDataRef = useRef(refreshFriendsData);
  useEffect(() => {
    refreshFriendsDataRef.current = refreshFriendsData;
  }, [refreshFriendsData]);

  // Charger amis + demandes au demarrage
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        await refreshFriendsDataRef.current();
      } catch (error) {
        setFriendSearchError(getErrorMessage(error, "Impossible de charger les donnees des amis."));
      }
    })();
  }, [isReady]);

  // Mettre a jour le statut en ligne quand onlineUserIds change
  useEffect(() => {
    setFriendList((prev) =>
      prev.map((f) => ({
        ...f,
        status: onlineUserIds.has(f.id) ? "En ligne" : "Hors ligne",
      }))
    );
  }, [onlineUserIds]);

  // Auto-selectionner le premier ami quand on change d'onglet
  useEffect(() => {
    if (activeTab !== "friends") return;
    if (!friendList.length) {
      setSelectedFriend("");
      return;
    }
    if (!selectedFriend || !friendList.some((f) => f.id === selectedFriend)) {
      setSelectedFriend(friendList[0].id);
    }
  }, [activeTab, selectedFriend, friendList]);

  // Recherche d'utilisateurs avec debounce
  useEffect(() => {
    if (activeTab !== "friends") return;
    const query = friendSearch.trim();
    if (!query) {
      setFriendResults([]);
      setFriendSearchError("");
      if (!allUsers.length) {
        const controller = new AbortController();
        (async () => {
          try {
            setAllUsersLoading(true);
            const token = localStorage.getItem("token");
            const response = await fetch(`${apiBaseUrl}/users`, {
              headers: token ? { Authorization: `Bearer ${token}` } : undefined,
              signal: controller.signal,
            });
            if (!response.ok) throw new Error("Chargement impossible.");
            const data = (await response.json()) as UserSearchResult[];
            setAllUsers(data.filter((u) => u.id !== currentUserId));
          } catch (error) {
            if ((error as Error).name === "AbortError") return;
            setFriendSearchError("Impossible de charger la liste des utilisateurs.");
          } finally {
            setAllUsersLoading(false);
          }
        })();
        return () => controller.abort();
      }
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setFriendSearchLoading(true);
        setFriendSearchError("");
        const token = localStorage.getItem("token");
        const response = await fetch(
          `${apiBaseUrl}/users/search?q=${encodeURIComponent(query)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : undefined,
            signal: controller.signal,
          }
        );
        if (!response.ok) throw new Error("Recherche impossible.");
        const data = (await response.json()) as UserSearchResult[];
        setFriendResults(data.filter((u) => u.id !== currentUserId));
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setFriendSearchError("Impossible de charger les utilisateurs.");
      } finally {
        setFriendSearchLoading(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [activeTab, apiBaseUrl, friendSearch, allUsers.length, currentUserId]);

  const handleSendFriendRequest = async (user: UserSearchResult) => {
    try {
      await friendsService.sendRequest(user.id);
      setFriendSearchError("");
      await refreshFriendsData();
    } catch (error) {
      setFriendSearchError(getErrorMessage(error, "Impossible d'envoyer cette demande."));
    }
  };

  const handleAcceptFriendRequest = async (requestId: string) => {
    try {
      await friendsService.acceptRequest(requestId);
      setFriendSearchError("");
      await refreshFriendsData();
    } catch (error) {
      setFriendSearchError(getErrorMessage(error, "Impossible d'accepter la demande."));
    }
  };

  const handleRejectFriendRequest = async (requestId: string) => {
    try {
      await friendsService.rejectRequest(requestId);
      setFriendSearchError("");
      await refreshFriendsData();
    } catch (error) {
      setFriendSearchError(getErrorMessage(error, "Impossible de refuser la demande."));
    }
  };

  const handleCancelFriendRequest = async (requestId: string) => {
    try {
      await friendsService.cancelRequest(requestId);
      setFriendSearchError("");
      await refreshFriendsData();
    } catch (error) {
      setFriendSearchError(getErrorMessage(error, "Impossible d'annuler la demande."));
    }
  };

  // Supprimer un ami
  const handleRemoveFriend = async (friendId: string) => {
    try {
      await friendsService.remove(friendId);
      setFriendSearchError("");
      await refreshFriendsData();
    } catch (error) {
      setFriendSearchError(getErrorMessage(error, "Impossible de supprimer cet ami."));
    }
  };

  const handleWsEvent = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      if (FRIEND_WS_EVENTS.has(event.type)) {
        refreshFriendsDataRef.current().catch(console.error);
      }
    },
    []
  );

  return {
    friendList,
    selectedFriend,
    setSelectedFriend,
    friendSearch,
    setFriendSearch,
    friendResults,
    friendSearchError,
    friendSearchLoading,
    allUsers,
    allUsersLoading,
    incomingRequests,
    outgoingRequests,
    handleSendFriendRequest,
    handleAcceptFriendRequest,
    handleRejectFriendRequest,
    handleCancelFriendRequest,
    handleRemoveFriend,
    handleWsEvent,
  };
}