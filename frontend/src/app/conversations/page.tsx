"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { authService, friendsService, serversService, channelsService, messagesService } from "@/services/api";
import useWebSocket from "@/hooks/useWebSocket";
import AddChannelModal from "./components/AddChannelModal";
import AddServerMemberModal from "./components/AddServerMemberModal";
import ChannelsPanel from "./components/ChannelsPanel";
import ChatPanel from "./components/ChatPanel";
import ConversationsHeader from "./components/ConversationsHeader";
import CreateServerModal from "./components/CreateServerModal";
import FriendsPanel from "./components/FriendsPanel";
import LoadingScreen from "./components/LoadingScreen";
import Sidebar from "./components/Sidebar";
import { initialFriends } from "./data/mockData";
import type { Channel, ChannelMessage, Server, UserSearchResult } from "./types";
import { formatUserLabel } from "./utils";

export default function ConversationsPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [serverList, setServerList] = useState<Server[]>([]);
  const [friendList, setFriendList] = useState(initialFriends);
  const [selectedServer, setSelectedServer] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [activeTab, setActiveTab] = useState<"servers" | "friends">("servers");
  const [selectedFriend, setSelectedFriend] = useState("");
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");
  const [newServerName, setNewServerName] = useState("");
  const [newServerMembers, setNewServerMembers] = useState("");
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [channelList, setChannelList] = useState<string[]>([]);
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [serverMembers, setServerMembers] = useState<Record<string, string[]>>(
    {}
  );
  const [currentUserId, setCurrentUserId] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const prevChannelRef = useRef<string>("");

  // Get current channel name for display
  const selectedChannelName =
    channels.find((c) => c.id === selectedChannel)?.name ?? "";
  const selectedServerName =
    serverList.find((s) => s.id === selectedServer)?.name ?? "";

  // WebSocket handler
  const onWsMessage = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      console.log("[WS] Received event:", event.type, event);
      if (event.type === "message_new") {
        const msg: ChannelMessage = {
          id: event.id as string,
          channel_id: event.channel_id as string,
          user_id: event.user_id as string,
          username: event.username as string,
          content: event.content as string,
          created_at: event.created_at as string,
        };
        console.log("[WS] New message, user_id:", msg.user_id, "currentUserId:", localStorage.getItem("user") ? JSON.parse(localStorage.getItem("user")!).id : "N/A");
        setMessages((prev) => [...prev, msg]);
      }
    },
    []
  );

  const { sendMessage, joinChannel, leaveChannel, isConnected } = useWebSocket({
    onMessage: onWsMessage,
  });

  // Auth check
  useEffect(() => {
    const isAuthed = !!localStorage.getItem("token");
    if (!isAuthed) {
      router.replace("/connexion");
      return;
    }
    const user = authService.getCurrentUser();
    if (user?.id) {
      console.log("[Auth] currentUserId set to:", user.id);
      setCurrentUserId(user.id);
    }
    setIsReady(true);
  }, [router]);

  // Close menu on outside click
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

  // Load servers from API
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const data = await serversService.list();
        setServerList(data);
        if (data.length && !selectedServer) {
          setSelectedServer(data[0].id);
        }
      } catch {
        // servers will stay empty
      }
    })();
  }, [isReady]);

  // Load channels when server changes
  useEffect(() => {
    if (!selectedServer) {
      setChannels([]);
      return;
    }
    (async () => {
      try {
        const data = await channelsService.list(selectedServer);
        setChannels(data);
        if (data.length) {
          setSelectedChannel(data[0].id);
        } else {
          setSelectedChannel("");
        }
      } catch {
        setChannels([]);
      }
    })();
  }, [selectedServer]);

  // Handle channel changes + WS connection: join/leave room + load messages
  // Single effect ensures join always fires when both isConnected and selectedChannel are ready
  useEffect(() => {
    if (prevChannelRef.current && prevChannelRef.current !== selectedChannel) {
      leaveChannel(prevChannelRef.current);
    }
    prevChannelRef.current = selectedChannel;

    if (!selectedChannel) {
      setMessages([]);
      return;
    }

    if (isConnected) {
      console.log("[WS] Joining channel:", selectedChannel);
      joinChannel(selectedChannel);
    } else {
      console.log("[WS] Not connected yet, cannot join channel:", selectedChannel);
    }

    (async () => {
      try {
        const data = await messagesService.history(selectedChannel);
        console.log("[History] Loaded", data.length, "messages for channel", selectedChannel);
        setMessages(data);
      } catch {
        setMessages([]);
      }
    })();
  }, [selectedChannel, isConnected, joinChannel, leaveChannel]);

  // Load friends
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const data = await friendsService.list();
        const mapped = data.map((user: UserSearchResult) => ({
          id: user.id,
          name: formatUserLabel(user),
          status: "Actif",
          lastMessage: "",
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

  const handleSelectServer = (serverId: string) => {
    setSelectedServer(serverId);
  };

  const handleSelectFriend = (friendName: string) => {
    setSelectedFriend(friendName);
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await friendsService.remove(friendId);
      setFriendList((prev) => prev.filter((friend) => friend.id !== friendId));
    } catch {
      setFriendSearchError("Impossible de supprimer cet ami.");
    }
  };

  const handleAddFriend = async (user: UserSearchResult) => {
    try {
      const added = await friendsService.add(user.id);
      const label = formatUserLabel(added);
      setFriendList((prev) => {
        if (prev.some((friend) => friend.id === added.id)) {
          return prev;
        }
        return [
          ...prev,
          { id: added.id, name: label, status: "Actif", lastMessage: "" },
        ];
      });
      setSelectedFriend(label);
      setFriendSearch("");
      setFriendResults([]);
      setFriendSearchError("");
    } catch {
      setFriendSearchError("Impossible d'ajouter cet ami.");
    }
  };

  const handleAddServerMember = (friendId: string) => {
    if (!selectedServer) return;
    setServerMembers((prev) => {
      const current = prev[selectedServer] ?? [];
      if (current.includes(friendId)) {
        return prev;
      }
      return {
        ...prev,
        [selectedServer]: [...current, friendId],
      };
    });
  };

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

  const handleCreateServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newServerName.trim();
    if (!trimmedName) return;

    try {
      const server = await serversService.create(trimmedName);

      // Create channels via API
      const channelNames = channelList.length ? channelList : ["general"];
      const createdChannels: Channel[] = [];
      for (const chName of channelNames) {
        try {
          const ch = await channelsService.create(server.id, chName);
          createdChannels.push(ch);
        } catch {
          // skip failed channels
        }
      }

      // Add new server to list in the shape the API returns
      const newServer: Server = {
        id: server.id,
        name: server.name,
        invite_code: server.invite_code,
        created_at: null,
      };

      setServerList((prev) => [newServer, ...prev]);
      setSelectedServer(server.id);
      setChannels(createdChannels);
      if (createdChannels.length) {
        setSelectedChannel(createdChannels[0].id);
      }
      setIsCreateServerOpen(false);
      setNewServerName("");
      setNewServerMembers("");
      setChannelList([]);
    } catch {
      // could show an error toast
    }
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

  const handleSendMessage = (content: string) => {
    if (!selectedChannel) return;
    sendMessage(selectedChannel, content);
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  const currentServerMembers = selectedServer
    ? serverMembers[selectedServer] ?? []
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
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={setSelectedChannel}
            onAddMember={() => setIsAddMemberOpen(true)}
          />
        ) : null}

        {activeTab === "servers" ? (
          <ChatPanel
            selectedChannel={selectedChannelName}
            selectedServer={selectedServerName}
            messages={messages}
            currentUserId={currentUserId}
            onSendMessage={handleSendMessage}
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

      <AddServerMemberModal
        isOpen={isAddMemberOpen}
        serverName={selectedServerName}
        friends={friendList}
        members={currentServerMembers}
        onClose={() => setIsAddMemberOpen(false)}
        onAddMember={handleAddServerMember}
      />
    </div>
  );
}
