"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AddChannelModal from "./components/AddChannelModal";
import ChannelsPanel from "./components/ChannelsPanel";
import ChatPanel from "./components/ChatPanel";
import ConversationsHeader from "./components/ConversationsHeader";
import CreateServerModal from "./components/CreateServerModal";
import FriendsPanel from "./components/FriendsPanel";
import LoadingScreen from "./components/LoadingScreen";
import Sidebar from "./components/Sidebar";
import { channelMessages, initialFriends, initialServers } from "./data/mockData";
import type { UserSearchResult } from "./types";
import { formatUserLabel } from "./utils";

export default function ConversationsPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [serverList, setServerList] = useState(initialServers);
  const [friendList, setFriendList] = useState(initialFriends);
  const [selectedServer, setSelectedServer] = useState(
    initialServers[0]?.name ?? ""
  );
  const [selectedChannel, setSelectedChannel] = useState(
    initialServers[0]?.channels?.[0] ?? ""
  );
  const [activeTab, setActiveTab] = useState<"servers" | "friends">("servers");
  const [selectedFriend, setSelectedFriend] = useState(
    initialFriends[0]?.name ?? ""
  );
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [newServerName, setNewServerName] = useState("");
  const [newServerMembers, setNewServerMembers] = useState("");
  const [newServerStatus, setNewServerStatus] = useState("Actif");
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelList, setChannelList] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const isAuthed = !!localStorage.getItem("token");
    if (!isAuthed) {
      router.replace("/connexion");
      return;
    }
    setIsReady(true);
  }, [router]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/");
  };

  const handleSwitchAccount = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    router.push("/connexion");
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    router.push("/inscription");
  };

  const handleMenuSwitchAccount = () => {
    setIsMenuOpen(false);
    handleSwitchAccount();
  };

  const handleMenuLogout = () => {
    setIsMenuOpen(false);
    handleLogout();
  };

  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3002";

  const getServerChannels = (serverName: string) =>
    serverList.find((server) => server.name === serverName)?.channels ?? [];

  const handleSelectServer = (serverName: string) => {
    setSelectedServer(serverName);
    const channels = getServerChannels(serverName);
    setSelectedChannel(channels[0] ?? "");
  };

  const handleSelectFriend = (friendName: string) => {
    setSelectedFriend(friendName);
  };

  const handleRemoveFriend = (friendName: string) => {
    setFriendList((prev) => prev.filter((friend) => friend.name !== friendName));
  };

  const handleAddFriend = (user: UserSearchResult) => {
    const label = formatUserLabel(user);
    setFriendList((prev) => {
      if (
        prev.some((friend) => friend.name.toLowerCase() === label.toLowerCase())
      ) {
        return prev;
      }
      return [
        ...prev,
        { name: label, status: "Nouveau", lastMessage: "Demande envoyee." },
      ];
    });
    setSelectedFriend(label);
    setFriendSearch("");
    setFriendResults([]);
    setFriendSearchError("");
  };

  useEffect(() => {
    const channels = getServerChannels(selectedServer);
    if (!channels.length) {
      setSelectedChannel("");
      return;
    }
    if (!channels.includes(selectedChannel)) {
      setSelectedChannel(channels[0]);
    }
  }, [selectedServer, selectedChannel, serverList]);

  useEffect(() => {
    if (activeTab !== "friends") return;
    if (!friendList.length) {
      setSelectedFriend("");
      return;
    }
    if (!selectedFriend || !friendList.some((friend) => friend.name === selectedFriend)) {
      setSelectedFriend(friendList[0].name);
    }
  }, [activeTab, selectedFriend, friendList]);

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
            if (!response.ok) {
              throw new Error("Chargement impossible.");
            }
            const data = (await response.json()) as UserSearchResult[];
            setAllUsers(data);
          } catch (error) {
            if ((error as Error).name === "AbortError") return;
            setFriendSearchError(
              "Impossible de charger la liste des utilisateurs."
            );
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

        if (!response.ok) {
          throw new Error("Recherche impossible.");
        }

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

  const handleCreateServer = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newServerName.trim();
    if (!trimmedName) return;

    const membersValue = newServerMembers.trim() || "1 membre";
    const channelsValue = channelList.length ? channelList : ["general"];

    const nextServer = {
      name: trimmedName,
      members: membersValue,
      status: newServerStatus,
      channels: channelsValue,
    };

    setServerList((prev) => [nextServer, ...prev]);
    setSelectedServer(trimmedName);
    setSelectedChannel(channelsValue[0] ?? "");
    setIsCreateServerOpen(false);
    setNewServerName("");
    setNewServerMembers("");
    setNewServerStatus("Actif");
    setChannelList([]);
  };

  const handleAddChannel = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newChannelName.trim();
    if (!trimmedName) return;

    setChannelList((prev) => {
      if (
        prev.some(
          (channel) => channel.toLowerCase() === trimmedName.toLowerCase()
        )
      ) {
        return prev;
      }
      return [...prev, trimmedName];
    });

    setNewChannelName("");
    setIsAddChannelOpen(false);
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  const channelsForServer = getServerChannels(selectedServer);
  const currentMessages = selectedChannel
    ? channelMessages[selectedChannel] ?? []
    : [];

  return (
    <div className="relative flex h-screen min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <ConversationsHeader
        isMenuOpen={isMenuOpen}
        menuRef={menuRef}
        onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
        onEditProfile={handleEditProfile}
        onSwitchAccount={handleMenuSwitchAccount}
        onLogout={handleMenuLogout}
      />

      <main
        className={`relative z-10 grid w-full max-w-none flex-1 gap-6 px-8 pb-0 md:px-12 ${
          activeTab === "friends"
            ? "grid-cols-[320px_1fr]"
            : "grid-cols-[260px_220px_1fr]"
        }`}
      >
        <Sidebar
          activeTab={activeTab}
          serverList={serverList}
          friendList={friendList}
          selectedServer={selectedServer}
          selectedFriend={selectedFriend}
          onTabChange={setActiveTab}
          onSelectServer={handleSelectServer}
          onCreateServer={() => setIsCreateServerOpen(true)}
          onSelectFriend={handleSelectFriend}
          onRemoveFriend={handleRemoveFriend}
        />

        {activeTab === "servers" ? (
          <ChannelsPanel
            channels={channelsForServer}
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
          />
        ) : null}

        {activeTab === "servers" ? (
          <ChatPanel
            selectedChannel={selectedChannel}
            selectedServer={selectedServer}
            messages={currentMessages}
          />
        ) : (
          <FriendsPanel
            friendSearch={friendSearch}
            onFriendSearchChange={setFriendSearch}
            friendSearchError={friendSearchError}
            friendSearchLoading={friendSearchLoading}
            friendResults={friendResults}
            allUsersLoading={allUsersLoading}
            allUsers={allUsers}
            onAddFriend={handleAddFriend}
          />
        )}
      </main>

      <CreateServerModal
        isOpen={isCreateServerOpen}
        newServerName={newServerName}
        newServerMembers={newServerMembers}
        channelList={channelList}
        onClose={() => setIsCreateServerOpen(false)}
        onOpenAddChannel={() => setIsAddChannelOpen(true)}
        onServerNameChange={setNewServerName}
        onServerMembersChange={setNewServerMembers}
        onSubmit={handleCreateServer}
      />

      <AddChannelModal
        isOpen={isAddChannelOpen}
        newChannelName={newChannelName}
        onClose={() => setIsAddChannelOpen(false)}
        onChannelNameChange={setNewChannelName}
        onSubmit={handleAddChannel}
      />
    </div>
  );
}
