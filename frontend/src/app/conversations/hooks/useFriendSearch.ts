// Hook pour gerer la recherche d'amis et la liste d'utilisateurs

import { useEffect, useState } from "react";
import { friendsService } from "@/services/api";
import { formatUserLabel } from "../utils";
import type { Friend, UserSearchResult } from "../types";

type UseFriendSearchParams = {
  isReady: boolean;
  activeTab: "servers" | "friends";
  onlineUserIds: Set<string>;
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

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

  // Charger la liste d'amis au demarrage
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const data = await friendsService.list();
        const mapped = data.map((user: UserSearchResult) => ({
          id: user.id,
          name: formatUserLabel(user),
          status: onlineUserIds.has(user.id) ? "En ligne" : "Hors ligne",
        }));
        setFriendList(mapped);
        if (!selectedFriend && mapped.length) {
          setSelectedFriend(mapped[0].name);
        }
      } catch {
        setFriendSearchError("Impossible de charger la liste d'amis.");
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
    if (!selectedFriend || !friendList.some((f) => f.name === selectedFriend)) {
      setSelectedFriend(friendList[0].name);
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
            setAllUsers(data);
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
        setFriendResults(data);
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
  }, [activeTab, apiBaseUrl, friendSearch, allUsers.length]);

  // Ajouter un ami
  const handleAddFriend = async (user: UserSearchResult) => {
    try {
      const added = await friendsService.add(user.id);
      const label = formatUserLabel(added);
      setFriendList((prev) => {
        if (prev.some((f) => f.id === added.id)) return prev;
        return [...prev, { id: added.id, name: label, status: "En ligne" }];
      });
      setSelectedFriend(label);
      setFriendSearch("");
      setFriendResults([]);
      setFriendSearchError("");
    } catch (err: any) {
      console.error("[Friends] Add error:", err);
      const msg = err.response?.data;
      setFriendSearchError(typeof msg === "string" ? msg : "Impossible d'ajouter cet ami.");
    }
  };

  // Supprimer un ami
  const handleRemoveFriend = async (friendId: string) => {
    try {
      await friendsService.remove(friendId);
      setFriendList((prev) => prev.filter((f) => f.id !== friendId));
    } catch {
      setFriendSearchError("Impossible de supprimer cet ami.");
    }
  };

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
    handleAddFriend,
    handleRemoveFriend,
  };
}
