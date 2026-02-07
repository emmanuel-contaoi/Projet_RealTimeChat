"use client";

import type { FormEvent } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

import { authService, friendsService, serversService, channelsService, messagesService } from "@/services/api";
import useWebSocket from "@/hooks/useWebSocket";
import AddChannelModal from "./components/AddChannelModal";
import ChannelsPanel from "./components/ChannelsPanel";
import ChatPanel from "./components/ChatPanel";
import ConversationsHeader from "./components/ConversationsHeader";
import CreateServerModal from "./components/CreateServerModal";
import JoinServerModal from "./components/JoinServerModal";
import FriendsPanel from "./components/FriendsPanel";
import LoadingScreen from "./components/LoadingScreen";
import MembersPanel from "./components/MembersPanel";
import Sidebar from "./components/Sidebar";
import type { Server, Channel, ChannelMessage, Friend, Member, UserSearchResult } from "./types";
import { formatUserLabel } from "./utils";

export default function ConversationsPage() {
  const router = useRouter();
  const [isReady, setIsReady] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Server / Channel / Message state
  const [serverList, setServerList] = useState<Server[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [selectedChannel, setSelectedChannel] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const prevChannelRef = useRef("");

  // Members + online tracking
  const [members, setMembers] = useState<Member[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  // Typing indicator
  const [typingUsers, setTypingUsers] = useState<Record<string, { username: string; timer: ReturnType<typeof setTimeout> }>>({});
  const typingThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Friends state
  const [friendList, setFriendList] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState("");
  const [activeTab, setActiveTab] = useState<"servers" | "friends">("servers");

  // Modal state
  const [isCreateServerOpen, setIsCreateServerOpen] = useState(false);
  const [newServerName, setNewServerName] = useState("");
  const [isAddChannelOpen, setIsAddChannelOpen] = useState(false);
  const [addChannelTarget, setAddChannelTarget] = useState<"creation" | "server">("creation");
  const [newChannelName, setNewChannelName] = useState("");
  const [channelList, setChannelList] = useState<string[]>([]);
  const [isJoinServerOpen, setIsJoinServerOpen] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [joinServerError, setJoinServerError] = useState("");
  const [joinServerLoading, setJoinServerLoading] = useState(false);

  // Friend search state
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState<UserSearchResult[]>([]);
  const [allUsers, setAllUsers] = useState<UserSearchResult[]>([]);
  const [allUsersLoading, setAllUsersLoading] = useState(false);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [friendSearchError, setFriendSearchError] = useState("");

  const menuRef = useRef<HTMLDivElement | null>(null);

  // --- WebSocket ---
  const handleWsMessage = useCallback(
    (event: { type: string; [key: string]: unknown }) => {
      if (event.type === "message_new") {
        const msg: ChannelMessage = {
          id: event.id as string | undefined,
          channel_id: event.channel_id as string,
          user_id: event.user_id as string,
          username: event.username as string,
          content: event.content as string,
          created_at: event.created_at as string | undefined,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id && m.id === msg.id)) return prev;
          return [...prev, msg];
        });
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

      if (event.type === "channel_users") {
        const users = event.users as Array<{ user_id: string; username: string }>;
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          for (const u of users) {
            next.add(u.user_id);
          }
          return next;
        });
      }
    },
    []
  );

  const { sendMessage, joinChannel, leaveChannel, startTyping, isConnected } = useWebSocket({
    onMessage: handleWsMessage,
  });

  // --- Auth check ---
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    const user = authService.getCurrentUser();
    if (user?.id) {
      setCurrentUserId(user.id);
    }
    setIsReady(true);
  }, [router]);

  // --- Click outside menu ---
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

  // --- Load servers from API ---
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const data = await serversService.list();
        setServerList(data);
        if (data.length && !selectedServer) {
          setSelectedServer(data[0].id);
        }
      } catch (err) {
        console.error("[API] Failed to load servers:", err);
      }
    })();
  }, [isReady]);

  // --- Load channels + members when server changes ---
  useEffect(() => {
    if (!selectedServer) {
      setChannels([]);
      setSelectedChannel("");
      setMembers([]);
      return;
    }
    (async () => {
      try {
        const [chData, memberData] = await Promise.all([
          channelsService.list(selectedServer),
          serversService.members(selectedServer),
        ]);
        setChannels(chData);
        setMembers(memberData);
        if (chData.length) {
          setSelectedChannel(chData[0].id);
        } else {
          setSelectedChannel("");
        }
      } catch (err) {
        console.error("[API] Failed to load channels/members:", err);
        setChannels([]);
        setSelectedChannel("");
        setMembers([]);
      }
    })();
  }, [selectedServer]);

  // --- Load message history when channel changes ---
  useEffect(() => {
    if (!selectedChannel) {
      setMessages([]);
      return;
    }
    setTypingUsers({});
    (async () => {
      try {
        const data = await messagesService.history(selectedChannel);
        setMessages(data);
      } catch (err) {
        console.error("[API] Failed to load messages:", err);
        setMessages([]);
      }
    })();
  }, [selectedChannel]);

  // --- WebSocket join/leave channel ---
  useEffect(() => {
    if (!isConnected) return;
    const prev = prevChannelRef.current;
    if (prev && prev !== selectedChannel) {
      leaveChannel(prev);
    }
    if (selectedChannel) {
      joinChannel(selectedChannel);
    }
    prevChannelRef.current = selectedChannel;
  }, [selectedChannel, isConnected, joinChannel, leaveChannel]);

  // --- Load friends ---
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const data = await friendsService.list();
        const mapped = data.map((user: UserSearchResult) => ({
          id: user.id,
          name: formatUserLabel(user),
          status: "Actif",
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

  // --- Friend tab auto-select ---
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

  // --- Friend search ---
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

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

  // --- Derived state ---
  const selectedServerObj = serverList.find((s) => s.id === selectedServer);
  const selectedServerName = selectedServerObj?.name ?? "";
  const currentUserRole = members.find((m) => m.user_id === currentUserId)?.role ?? "";
  const canManageChannels = currentUserRole === "owner" || currentUserRole === "admin";
  const typingUserNames = Object.values(typingUsers)
    .map((t) => t.username)
    .filter((name) => name !== authService.getCurrentUser()?.username);

  // --- Handlers ---
  const handleLogout = () => {
    authService.logout();
    router.push("/");
  };

  const handleSwitchAccount = () => {
    authService.logout();
    router.push("/login");
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    router.push("/register");
  };

  const handleSelectServer = (serverId: string) => {
    setSelectedServer(serverId);
  };

  const handleSelectFriend = (friendName: string) => {
    setSelectedFriend(friendName);
  };

  const handleRemoveFriend = async (friendId: string) => {
    try {
      await friendsService.remove(friendId);
      setFriendList((prev) => prev.filter((f) => f.id !== friendId));
    } catch {
      setFriendSearchError("Impossible de supprimer cet ami.");
    }
  };

  const handleAddFriend = async (user: UserSearchResult) => {
    try {
      const added = await friendsService.add(user.id);
      const label = formatUserLabel(added);
      setFriendList((prev) => {
        if (prev.some((f) => f.id === added.id)) return prev;
        return [...prev, { id: added.id, name: label, status: "Actif" }];
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

  const handleLeaveServer = async (serverId: string) => {
    try {
      await serversService.leave(serverId);
      setServerList((prev) => prev.filter((s) => s.id !== serverId));
      if (selectedServer === serverId) {
        setSelectedServer("");
        setChannels([]);
        setSelectedChannel("");
        setMessages([]);
        setMembers([]);
      }
    } catch (err: any) {
      console.error("[API] Leave server error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de quitter ce serveur.");
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm("Supprimer ce serveur ? Cette action est irreversible.")) return;
    try {
      await serversService.delete(serverId);
      setServerList((prev) => prev.filter((s) => s.id !== serverId));
      if (selectedServer === serverId) {
        setSelectedServer("");
        setChannels([]);
        setSelectedChannel("");
        setMessages([]);
        setMembers([]);
      }
    } catch (err: any) {
      console.error("[API] Delete server error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de supprimer ce serveur.");
    }
  };

  const handleDeleteChannel = async (channelId: string) => {
    if (!confirm("Supprimer ce channel ?")) return;
    try {
      await channelsService.delete(channelId);
      setChannels((prev) => prev.filter((c) => c.id !== channelId));
      if (selectedChannel === channelId) {
        setSelectedChannel("");
        setMessages([]);
      }
    } catch (err: any) {
      console.error("[API] Delete channel error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de supprimer ce channel.");
    }
  };

  const handleUpdateRole = async (userId: string, role: string) => {
    if (!selectedServer) return;
    try {
      await serversService.updateRole(selectedServer, userId, role);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role } : m))
      );
    } catch (err: any) {
      console.error("[API] Update role error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de changer le role.");
    }
  };

  const handleSendMessage = (content: string) => {
    if (!selectedChannel) return;
    sendMessage(selectedChannel, content);
  };

  const handleTyping = useCallback(() => {
    if (!selectedChannel) return;
    if (typingThrottleRef.current) return;
    startTyping(selectedChannel);
    typingThrottleRef.current = setTimeout(() => {
      typingThrottleRef.current = null;
    }, 2000);
  }, [selectedChannel, startTyping]);

  const handleJoinServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = joinInviteCode.trim();
    if (!code) return;

    setJoinServerLoading(true);
    setJoinServerError("");
    try {
      const server: Server = await serversService.join(code);
      setServerList((prev) => {
        if (prev.some((s) => s.id === server.id)) return prev;
        return [server, ...prev];
      });
      setSelectedServer(server.id);
      setIsJoinServerOpen(false);
      setJoinInviteCode("");
    } catch (err: any) {
      console.error("[API] Join server error:", err);
      const msg = err.response?.data;
      setJoinServerError(typeof msg === "string" ? msg : "Code d'invitation invalide.");
    } finally {
      setJoinServerLoading(false);
    }
  };

  const handleCreateServer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newServerName.trim();
    if (!trimmedName) return;

    try {
      const server: Server = await serversService.create(trimmedName);
      const channelNames = channelList.length ? channelList : ["general"];
      const createdChannels: Channel[] = [];
      for (const name of channelNames) {
        const ch = await channelsService.create(server.id, name);
        createdChannels.push(ch);
      }

      setServerList((prev) => [server, ...prev]);
      setSelectedServer(server.id);
      setChannels(createdChannels);

      if (createdChannels.length) {
        const firstCh = createdChannels[0];
        setSelectedChannel(firstCh.id);
        if (isConnected) {
          joinChannel(firstCh.id);
        }
      }

      setIsCreateServerOpen(false);
      setNewServerName("");
      setChannelList([]);
    } catch (err) {
      console.error("[API] Failed to create server:", err);
    }
  };

  const handleAddChannel = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = newChannelName.trim();
    if (!trimmedName) return;

    if (addChannelTarget === "server" && selectedServer) {
      try {
        const ch = await channelsService.create(selectedServer, trimmedName);
        setChannels((prev) => [...prev, ch]);
        setSelectedChannel(ch.id);
      } catch (err) {
        console.error("[API] Failed to create channel:", err);
      }
    } else {
      setChannelList((prev) => {
        if (prev.some((c) => c.toLowerCase() === trimmedName.toLowerCase())) return prev;
        return [...prev, trimmedName];
      });
    }

    setNewChannelName("");
    setIsAddChannelOpen(false);
  };

  const openCreateChannelOnServer = () => {
    setAddChannelTarget("server");
    setNewChannelName("");
    setIsAddChannelOpen(true);
  };

  const openCreateChannelInModal = () => {
    setAddChannelTarget("creation");
    setIsAddChannelOpen(true);
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative flex h-screen min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(0,212,255,0.35),_transparent_55%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,_rgba(255,255,255,0.04)_1px,_transparent_1px),_linear-gradient(to_bottom,_rgba(255,255,255,0.04)_1px,_transparent_1px)] bg-[size:48px_48px] opacity-40" />

      <ConversationsHeader
        isMenuOpen={isMenuOpen}
        menuRef={menuRef}
        onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
        onEditProfile={handleEditProfile}
        onSwitchAccount={() => { setIsMenuOpen(false); handleSwitchAccount(); }}
        onLogout={() => { setIsMenuOpen(false); handleLogout(); }}
      />

      <main
        className={`relative z-10 grid w-full max-w-none flex-1 gap-6 px-8 pb-0 md:px-12 ${
          activeTab === "friends"
            ? "grid-cols-[320px_1fr]"
            : "grid-cols-[260px_200px_1fr_200px]"
        }`}
      >
        <Sidebar
          activeTab={activeTab}
          serverList={serverList}
          friendList={friendList}
          selectedServer={selectedServer}
          selectedFriend={selectedFriend}
          currentUserRole={currentUserRole}
          onTabChange={setActiveTab}
          onSelectServer={handleSelectServer}
          onCreateServer={() => setIsCreateServerOpen(true)}
          onJoinServer={() => setIsJoinServerOpen(true)}
          onLeaveServer={handleLeaveServer}
          onDeleteServer={handleDeleteServer}
          onSelectFriend={handleSelectFriend}
          onRemoveFriend={handleRemoveFriend}
        />

        {activeTab === "servers" ? (
          <ChannelsPanel
            channels={channels}
            selectedChannel={selectedChannel}
            canManageChannels={canManageChannels}
            onSelectChannel={setSelectedChannel}
            onDeleteChannel={handleDeleteChannel}
            onCreateChannel={openCreateChannelOnServer}
          />
        ) : null}

        {activeTab === "servers" ? (
          <ChatPanel
            channelName={channels.find((c) => c.id === selectedChannel)?.name ?? ""}
            selectedChannel={selectedChannel}
            selectedServer={selectedServerName}
            messages={messages}
            currentUserId={currentUserId}
            typingUsers={typingUserNames}
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
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

        {activeTab === "servers" ? (
          <MembersPanel
            members={members}
            onlineUserIds={onlineUserIds}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onUpdateRole={handleUpdateRole}
          />
        ) : null}
      </main>

      <CreateServerModal
        isOpen={isCreateServerOpen}
        newServerName={newServerName}
        channelList={channelList}
        onClose={() => setIsCreateServerOpen(false)}
        onOpenAddChannel={openCreateChannelInModal}
        onServerNameChange={setNewServerName}
        onSubmit={handleCreateServer}
      />

      <JoinServerModal
        isOpen={isJoinServerOpen}
        inviteCode={joinInviteCode}
        error={joinServerError}
        loading={joinServerLoading}
        onClose={() => { setIsJoinServerOpen(false); setJoinServerError(""); }}
        onInviteCodeChange={setJoinInviteCode}
        onSubmit={handleJoinServer}
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
