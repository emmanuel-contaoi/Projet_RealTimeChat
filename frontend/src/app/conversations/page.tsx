"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Friend } from "./types";

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
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [activeTab, setActiveTab] = useState<"servers" | "friends">("servers");
  const [activeDmChannel, setActiveDmChannel] = useState<string | null>(null);
  
  // NOUVEL ÉTAT : On sauvegarde le pseudo et le statut de la personne cliquée
  const [currentDmUser, setCurrentDmUser] = useState<{name: string, status: string} | null>(null);
  
  const menuRef = useRef<HTMLDivElement | null>(null);
  const drawerRef = useRef<HTMLDivElement | null>(null);

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
  const friendWsHandlerRef = useRef<((event: { type: string; [key: string]: unknown }) => void) | null>(null);

  const chat = useChat({
    onExtraWsEvent: useCallback((e: { type: string; [key: string]: unknown }) => {
      serverWsHandlerRef.current?.(e);
      friendWsHandlerRef.current?.(e);
    }, []),
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

  useEffect(() => {
    friendWsHandlerRef.current = friends.handleWsEvent;
  }, [friends.handleWsEvent]);

  const handleLogout = async () => {
    await authService.logout();
    router.push("/");
  };

  const handleEditProfile = () => {
    setIsMenuOpen(false);
    router.push("/profile");
  };
  
  const handleSelectFriend = async (friend: Friend) => {
    friends.setSelectedFriend(friend.id); 
    
    if (window.innerWidth < 1024) {
      setIsMobileDrawerOpen(false);
    }

    if (!friend.id) {
      setActiveDmChannel(null);
      setCurrentDmUser(null);
      return;
    }

    // ON SAUVEGARDE LE VRAI PSEUDO DIRECTEMENT ICI
    const friendName = (friend as any).username || (friend as any).name || "Utilisateur";
    setCurrentDmUser({ name: friendName, status: friend.status || "Hors ligne" });

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

  // Utilisation de l'état stocké
  const currentFriendName = currentDmUser?.name || "";
  const currentFriendStatus = currentDmUser?.status || "Hors ligne";

  return (
    <div className="relative flex h-screen max-h-screen flex-col overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(21,209,255,0.16),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(47,123,255,0.18),_transparent_34%)]" />

      <ConversationsHeader />

      <main className="relative z-10 mx-2 mb-2 flex min-h-0 flex-1 overflow-hidden rounded-[26px] border border-[var(--stroke)] bg-[rgba(9,15,23,0.94)] shadow-[0_24px_64px_rgba(2,8,18,0.52)]">
        
        <button
          onClick={() => setIsMobileDrawerOpen(!isMobileDrawerOpen)}
          className="absolute right-4 top-3 z-[60] flex h-10 w-10 items-center justify-center text-slate-300 transition-all hover:scale-110 hover:text-[var(--brand-1)] active:scale-95 lg:hidden"
          aria-label="Menu"
        >
          {isMobileDrawerOpen ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          )}
        </button>

        {isMobileDrawerOpen && (
          <div
            className="absolute inset-0 z-40 bg-black/70 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
            onClick={() => setIsMobileDrawerOpen(false)}
          />
        )}

        <div
          ref={drawerRef}
          className={`absolute inset-y-0 left-0 z-50 flex h-full w-[85vw] sm:w-[340px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden scroll-smooth bg-[rgba(15,22,33,0.98)] transform transition-transform duration-300 ease-out [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] lg:static lg:w-auto lg:max-w-none lg:overflow-visible lg:bg-transparent lg:translate-x-0 lg:shadow-none ${
            isMobileDrawerOpen ? "translate-x-0 shadow-[10px_0_50px_rgba(0,0,0,0.8)]" : "-translate-x-full"
          }`}
        >
          <div className="snap-start snap-always flex-shrink-0 h-full w-full transition-all duration-300 lg:w-auto flex">
            <Sidebar
              activeTab={activeTab}
              serverList={server.serverList}
              friendList={friends.friendList}
              selectedServer={server.selectedServer}
              selectedFriend={friends.selectedFriend}
              currentUserRole={server.currentUserRole}
              isMenuOpen={isMenuOpen} 
              menuRef={menuRef}       
              unreadChannels={chat.unreadChannels}
              onToggleMenu={() => setIsMenuOpen((prev) => !prev)}
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
                
                if (window.innerWidth < 1024 && drawerRef.current) {
                  setTimeout(() => {
                    const drawerWidth = drawerRef.current?.clientWidth || 0;
                    drawerRef.current?.scrollTo({ left: drawerWidth, behavior: 'smooth' });
                  }, 50);
                }
              }}
              onCreateServer={() => server.setIsCreateServerOpen(true)}
              onJoinServer={() => server.setIsJoinServerOpen(true)}
              onLeaveServer={server.handleLeaveServer}
              onDeleteServer={server.handleDeleteServer}
              onUpdateServer={server.handleUpdateServer}
              onEditProfile={() => { setIsMenuOpen(false); setIsMobileDrawerOpen(false); handleEditProfile(); }}
              onLogout={() => { setIsMenuOpen(false); setIsMobileDrawerOpen(false); handleLogout(); }}
              onSelectFriend={handleSelectFriend}
              onRemoveFriend={friends.handleRemoveFriend}
            />
          </div>

          {activeTab === "servers" && (
            <div className="flex flex-col snap-start snap-always flex-shrink-0 h-full w-full lg:w-[240px] border-l border-[rgba(255,255,255,0.03)] bg-[rgba(20,28,39,0.98)] lg:bg-transparent lg:border-none">
              <div className="flex items-center px-4 py-3 border-b border-[rgba(255,255,255,0.05)] lg:hidden">
                <button
                  onClick={() => {
                    if (drawerRef.current) {
                      drawerRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                    }
                  }}
                  className="flex items-center gap-2 text-[0.85rem] font-medium text-slate-400 transition-colors hover:text-white"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"></polyline>
                  </svg>
                  Retour aux serveurs
                </button>
              </div>

              <div className="min-h-0 flex-1">
                <ChannelsPanel
                  channels={server.channels}
                  selectedChannel={server.selectedChannel}
                  canManageChannels={server.canManageChannels}
                  unreadChannels={chat.unreadChannels}
                  onSelectChannel={(channelId) => {
                    server.setSelectedChannel(channelId);
                    
                    if (window.innerWidth < 1024) {
                      setIsMobileDrawerOpen(false);
                      setTimeout(() => {
                        drawerRef.current?.scrollTo({ left: 0 });
                      }, 300);
                    }
                  }}
                  onDeleteChannel={server.handleDeleteChannel}
                  onUpdateChannel={server.handleUpdateChannel}
                  onCreateChannel={server.openCreateChannelOnServer}
                />
              </div>
            </div>
          )}
        </div>

        <div className="relative flex min-w-0 flex-1 flex-col bg-transparent">
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
              onAddReaction={chat.handleAddReaction}
              onRemoveReaction={chat.handleRemoveReaction}
            />
          ) : activeDmChannel && friends.selectedFriend ? (
            <ChatPanel
              channelName={currentFriendName}
              selectedChannel={activeDmChannel}
              selectedServer=""
              messages={chat.messages}
              currentUserId={currentUserId}
              currentUserRole="member"
              typingUsers={chat.typingUserNames}
              isDm={true}
              friendStatus={currentFriendStatus}
              onSendMessage={chat.handleSendMessage}
              onTyping={chat.handleTyping}
              onEditMessage={chat.handleEditMessage}
              onDeleteMessage={chat.handleDeleteMessage}
              onAddReaction={chat.handleAddReaction}
              onRemoveReaction={chat.handleRemoveReaction}
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
        </div>

        {activeTab === "servers" && (
          <div className="hidden w-[240px] flex-shrink-0 border-l border-[rgba(255,255,255,0.05)] xl:block">
            <MembersPanel
              serverId={server.selectedServer || ""}
              members={server.members}
              onlineUserIds={chat.onlineUserIds}
              currentUserId={currentUserId}
              currentUserRole={server.currentUserRole}
              onUpdateRole={server.handleUpdateRole}
              onTransferOwnership={server.handleTransferOwnership}
              onKickMember={server.handleKickMember}
              onBanMember={server.handleBanMember}
            />
          </div>
        )}
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