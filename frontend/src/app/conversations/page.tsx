"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { authService } from "@/services/api";
import useChat from "./hooks/useChat";
import useServerManager from "./hooks/useServerManager";
import useFriendSearch from "./hooks/useFriendSearch";
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

export default function ConversationsPage() {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"servers" | "friends">("servers");
  const [activeDmChannel, setActiveDmChannel] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [auth, setAuth] = useState({ isReady: false, currentUserId: "" });
  const { isReady, currentUserId } = auth;

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user = token ? authService.getCurrentUser() : null;
    if (token && user?.id) {
      setAuth({ isReady: true, currentUserId: user.id });
    } else {
      router.replace("/login");
    }
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

  const serverWsHandlerRef = useRef<((event: { type: string; [key: string]: unknown }) => void) | null>(null);

  const chat = useChat({
    onExtraWsEvent: useCallback((e: { type: string; [key: string]: unknown }) => serverWsHandlerRef.current?.(e), []),
  });

  const server = useServerManager({
    isReady,
    isConnected: chat.isConnected,
    currentUserId,
    joinChannel: chat.joinChannel,
    loadMessages: chat.loadMessages,
    syncChannel: chat.syncChannel,
    setActiveChannel: chat.setActiveChannel,
    setMessages: chat.setMessages,
  });

  useEffect(() => {
    serverWsHandlerRef.current = server.handleWsEvent;
  }, [server.handleWsEvent]);

  const friends = useFriendSearch({ isReady, activeTab, onlineUserIds: chat.onlineUserIds });

  const handleLogout = async () => {
    await authService.logout();
    router.push("/");
  };

  const handleSwitchAccount = async () => {
    await authService.logout();
    router.push("/login");
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    router.push("/register");
  };

  const handleSelectFriend = async (friend: any) => {
    friends.setSelectedFriend(friend);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch("http://localhost:3001/dms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ target_user_id: friend.id })
      });

      if (!response.ok) {
        throw new Error("Impossible de récupérer la conversation privée");
      }

      const dmChannel = await response.json();

      setActiveDmChannel(dmChannel.id); 

      chat.setMessages([]);
      await chat.loadMessages(dmChannel.id);
      
      chat.syncChannel(dmChannel.id);
      chat.setActiveChannel(dmChannel.id);

    } catch (error) {
      console.error(error);
    }
  };

  if (!isReady) {
    return <LoadingScreen />;
  }

  return (
    <div className="relative flex h-screen max-h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
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
        className={`relative z-10 grid w-full max-w-none min-h-0 flex-1 gap-6 overflow-hidden px-8 pb-6 md:px-12 ${
          activeTab === "friends"
            ? "grid-cols-[320px_1fr]"
            : "grid-cols-[260px_200px_1fr_240px]"
        }`}
      >
        <Sidebar
          activeTab={activeTab}
          serverList={server.serverList}
          friendList={friends.friendList}
          selectedServer={server.selectedServer}
          selectedFriend={friends.selectedFriend}
          currentUserRole={server.currentUserRole}
          onTabChange={async (tab) => {
            setActiveTab(tab);
            if (tab === "servers") {
              setActiveDmChannel(null);
              if (server.selectedChannel) {
                chat.setMessages([]);
                await chat.loadMessages(server.selectedChannel);
                chat.syncChannel(server.selectedChannel);
                chat.setActiveChannel(server.selectedChannel);
              }
            }
          }}
          onSelectServer={(serverId) => {
            server.setSelectedServer(serverId);
            setActiveTab("servers");
            setActiveDmChannel(null);
          }}
          onCreateServer={() => server.setIsCreateServerOpen(true)}
          onJoinServer={() => server.setIsJoinServerOpen(true)}
          onLeaveServer={server.handleLeaveServer}
          onDeleteServer={server.handleDeleteServer}
          onUpdateServer={server.handleUpdateServer}
          onSelectFriend={handleSelectFriend}
          onRemoveFriend={friends.handleRemoveFriend}
        />

        {activeTab === "servers" ? (
          <ChannelsPanel
            channels={server.channels}
            selectedChannel={server.selectedChannel}
            canManageChannels={server.canManageChannels}
            onSelectChannel={server.setSelectedChannel}
            onDeleteChannel={server.handleDeleteChannel}
            onUpdateChannel={server.handleUpdateChannel}
            onCreateChannel={server.openCreateChannelOnServer}
          />
        ) : null}

        {activeTab === "servers" ? (
          <ChatPanel
            channelName={server.channels.find((c) => c.id === server.selectedChannel)?.name ?? ""}
            selectedChannel={server.selectedChannel}
            selectedServer={server.selectedServerName}
            messages={chat.messages}
            currentUserId={currentUserId}
            currentUserRole={server.currentUserRole}
            typingUsers={chat.typingUserNames}
            onSendMessage={chat.handleSendMessage}
            onTyping={chat.handleTyping}
            onEditMessage={chat.handleEditMessage}
            onDeleteMessage={chat.handleDeleteMessage}
          />
        ) : activeDmChannel && friends.selectedFriend ? (
          <ChatPanel
            channelName="Messages Privés"
            selectedChannel={activeDmChannel}
            selectedServer="Messages Privés"
            messages={chat.messages}
            currentUserId={currentUserId}
            currentUserRole="member"
            typingUsers={chat.typingUserNames}
            onSendMessage={chat.handleSendMessage}
            onTyping={chat.handleTyping}
            onEditMessage={chat.handleEditMessage}
            onDeleteMessage={chat.handleDeleteMessage}
          />
        ) : (
          <FriendsPanel
            friendSearch={friends.friendSearch}
            onFriendSearchChange={friends.setFriendSearch}
            friendSearchError={friends.friendSearchError}
            friendSearchLoading={friends.friendSearchLoading}
            friendResults={friends.friendResults}
            allUsersLoading={friends.allUsersLoading}
            allUsers={friends.allUsers}
            friendList={friends.friendList}
            incomingRequests={friends.incomingRequests}
            outgoingRequests={friends.outgoingRequests}
            onSendFriendRequest={friends.handleSendFriendRequest}
            onAcceptRequest={friends.handleAcceptFriendRequest}
            onRejectRequest={friends.handleRejectFriendRequest}
            onCancelRequest={friends.handleCancelFriendRequest}
          />
        )}

        {activeTab === "servers" ? (
          <MembersPanel
            members={server.members}
            onlineUserIds={chat.onlineUserIds}
            currentUserId={currentUserId}
            currentUserRole={server.currentUserRole}
            onUpdateRole={server.handleUpdateRole}
            onTransferOwnership={server.handleTransferOwnership}
            onKickMember={server.handleKickMember}
            onBanMember={server.handleBanMember}
          />
        ) : null}
      </main>

      <CreateServerModal
        isOpen={server.isCreateServerOpen}
        newServerName={server.newServerName}
        channelList={server.channelList}
        onClose={() => server.setIsCreateServerOpen(false)}
        onOpenAddChannel={server.openCreateChannelInModal}
        onServerNameChange={server.setNewServerName}
        onSubmit={server.handleCreateServer}
      />

      <JoinServerModal
        isOpen={server.isJoinServerOpen}
        inviteCode={server.joinInviteCode}
        error={server.joinServerError}
        loading={server.joinServerLoading}
        onClose={() => { server.setIsJoinServerOpen(false); server.setJoinServerError(""); }}
        onInviteCodeChange={server.setJoinInviteCode}
        onSubmit={server.handleJoinServer}
      />

      <AddChannelModal
        isOpen={server.isAddChannelOpen}
        newChannelName={server.newChannelName}
        onClose={() => server.setIsAddChannelOpen(false)}
        onChannelNameChange={server.setNewChannelName}
        onSubmit={server.handleAddChannel}
      />
    </div>
  );
}