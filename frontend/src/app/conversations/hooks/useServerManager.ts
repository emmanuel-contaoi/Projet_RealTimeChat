import type { FormEvent } from "react";
import { useEffect, useState, useCallback } from "react";
import { serversService, channelsService } from "@/services/api";
import type { Server, Channel, Member } from "../types";

type UseServerManagerParams = {
  isReady: boolean;
  isConnected: boolean;
  currentUserId: string;
  joinChannel: (channelId: string) => void;
  loadMessages: (channelId: string) => void;
  syncChannel: (channelId: string) => void;
  setActiveChannel: (channelId: string) => void;
  setMessages: React.Dispatch<React.SetStateAction<import("../types").ChannelMessage[]>>;
};

export default function useServerManager({
  isReady,
  isConnected,
  currentUserId,
  joinChannel,
  loadMessages,
  syncChannel,
  setActiveChannel,
  setMessages,
}: UseServerManagerParams) {
  const [serverList, setServerList] = useState<Server[]>([]);
  const [selectedServer, setSelectedServer] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState("");
  const [members, setMembers] = useState<Member[]>([]);

  // State des modals (creation, rejoindre, ajouter channel)
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

  // Charge la liste des serveurs depuis l'API
  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const data = await serversService.list();
        setServerList(data);
        if (data.length) {
          setSelectedServer(data[0].id);
        }
      } catch (err) {
        console.error("[API] Failed to load servers:", err);
      }
    })();
  }, [isReady]);

  // Charge les channels et les membres quand on change de serveur
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

  // Synchronise le channel actif avec le hook de chat
  useEffect(() => {
    setActiveChannel(selectedChannel);
  }, [selectedChannel, setActiveChannel]);

  // Charge les messages et synchronise le WS quand on change de channel
  useEffect(() => {
    loadMessages(selectedChannel);
  }, [selectedChannel, loadMessages]);

  useEffect(() => {
    syncChannel(selectedChannel);
  }, [selectedChannel, isConnected, syncChannel]);

  // Valeurs calculees a partir du state
  const selectedServerName =
    serverList.find((s) => s.id === selectedServer)?.name ?? "";
  const currentUserRole =
    members.find((m) => m.user_id === currentUserId)?.role ?? "";
  const canManageChannels =
    currentUserRole === "owner" || currentUserRole === "admin";

  // Fonctions pour gerer les serveurs, channels, roles, etc.
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
        if (prev.some((c) => c.toLowerCase() === trimmedName.toLowerCase()))
          return prev;
        return [...prev, trimmedName];
      });
    }

    setNewChannelName("");
    setIsAddChannelOpen(false);
  };

  const handleUpdateServer = async (serverId: string, newName: string) => {
    try {
      const updated: Server = await serversService.update(serverId, newName);
      setServerList((prev) =>
        prev.map((s) => (s.id === serverId ? { ...s, name: updated.name } : s))
      );
    } catch (err: any) {
      console.error("[API] Update server error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de renommer ce serveur.");
    }
  };

  const handleUpdateChannel = async (channelId: string, newName: string) => {
    try {
      const updated: Channel = await channelsService.update(channelId, newName);
      setChannels((prev) =>
        prev.map((c) => (c.id === channelId ? { ...c, name: updated.name } : c))
      );
    } catch (err: any) {
      console.error("[API] Update channel error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de renommer ce channel.");
    }
  };

  const handleTransferOwnership = async (userId: string) => {
    if (!selectedServer) return;
    if (!confirm("Transferer la propriete de ce serveur ? Vous deviendrez admin.")) return;
    try {
      await serversService.transferOwnership(selectedServer, userId);
      // On recharge les membres pour avoir les roles a jour
      const memberData = await serversService.members(selectedServer);
      setMembers(memberData);
    } catch (err: any) {
      console.error("[API] Transfer ownership error:", err);
      const msg = err.response?.data;
      alert(typeof msg === "string" ? msg : "Impossible de transferer la propriete.");
    }
  };

  const openCreateChannelOnServer = useCallback(() => {
    setAddChannelTarget("server");
    setNewChannelName("");
    setIsAddChannelOpen(true);
  }, []);

  const openCreateChannelInModal = useCallback(() => {
    setAddChannelTarget("creation");
    setIsAddChannelOpen(true);
  }, []);

  return {
    // State des serveurs
    serverList,
    selectedServer,
    selectedServerName,
    setSelectedServer,

    // State des channels
    channels,
    selectedChannel,
    setSelectedChannel,

    // Membres
    members,
    currentUserRole,
    canManageChannels,

    // State des modals
    isCreateServerOpen,
    setIsCreateServerOpen,
    newServerName,
    setNewServerName,
    channelList,
    isAddChannelOpen,
    setIsAddChannelOpen,
    newChannelName,
    setNewChannelName,
    isJoinServerOpen,
    setIsJoinServerOpen,
    joinInviteCode,
    setJoinInviteCode,
    joinServerError,
    setJoinServerError,
    joinServerLoading,

    // Fonctions
    handleLeaveServer,
    handleDeleteServer,
    handleDeleteChannel,
    handleUpdateRole,
    handleUpdateServer,
    handleUpdateChannel,
    handleTransferOwnership,
    handleJoinServer,
    handleCreateServer,
    handleAddChannel,
    openCreateChannelOnServer,
    openCreateChannelInModal,
  };
}
