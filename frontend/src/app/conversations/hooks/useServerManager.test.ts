import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { channelsService, serversService } from "@/services/api";
import type { ChannelMessage } from "../types";

import useServerManager from "./useServerManager";

const joinChannel = jest.fn();
const loadMessages = jest.fn();
const syncChannel = jest.fn();
const setActiveChannel = jest.fn();
const setMessages = jest.fn();

describe("useServerManager", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    joinChannel.mockReset();
    loadMessages.mockReset();
    syncChannel.mockReset();
    setActiveChannel.mockReset();
    setMessages.mockReset();
    jest.spyOn(globalThis, "alert").mockImplementation(() => {});
    jest.spyOn(globalThis, "confirm").mockImplementation(() => true);

    jest.spyOn(serversService, "list").mockResolvedValue([
      {
        id: "server-1",
        name: "Backend",
        invite_code: "abc123",
        created_at: null,
      },
    ]);
    jest.spyOn(serversService, "members").mockResolvedValue([
      {
        user_id: "current-user",
        username: "me",
        role: "owner",
        is_online: true,
      },
      {
        user_id: "user-2",
        username: "bob",
        role: "member",
        is_online: false,
      },
    ]);
    jest.spyOn(serversService, "join").mockResolvedValue({
      id: "server-2",
      name: "Infra",
      invite_code: "zzz999",
      created_at: null,
    });
    jest.spyOn(serversService, "create").mockResolvedValue({
      id: "server-3",
      name: "QA",
      invite_code: "qqq111",
      created_at: null,
    });
    jest.spyOn(serversService, "updateRole").mockResolvedValue(undefined as never);
    jest.spyOn(serversService, "transferOwnership").mockResolvedValue(undefined as never);
    jest.spyOn(serversService, "ban").mockResolvedValue(undefined as never);
    jest.spyOn(serversService, "kick").mockResolvedValue(undefined as never);
    jest.spyOn(serversService, "delete").mockResolvedValue(undefined as never);
    jest.spyOn(serversService, "leave").mockResolvedValue(undefined as never);
    jest.spyOn(channelsService, "list").mockImplementation(async (serverId: string) => {
      if (serverId === "server-3") {
        return [
          {
            id: "channel-2",
            server_id: "server-3",
            name: "general",
            type: "text",
          },
        ];
      }

      return [
        {
          id: "channel-1",
          server_id: "server-1",
          name: "general",
          type: "text",
        },
      ];
    });
    jest
      .spyOn(channelsService, "create")
      .mockImplementation(async (serverId: string, name: string) => {
        if (serverId === "server-3" && name === "general") {
          return {
            id: "channel-2",
            server_id: "server-3",
            name: "general",
            type: "text",
          };
        }

        return {
          id: "channel-3",
          server_id: serverId,
          name,
          type: "text",
        };
      });
    jest.spyOn(channelsService, "update").mockResolvedValue({
      id: "channel-1",
      server_id: "server-1",
      name: "renamed",
      type: "text",
    });
    jest.spyOn(channelsService, "delete").mockResolvedValue(undefined as never);
  });

  const renderServerManager = () =>
    renderHook(() =>
      useServerManager({
        isReady: true,
        isConnected: true,
        currentUserId: "current-user",
        joinChannel,
        loadMessages,
        syncChannel,
        setActiveChannel,
        setMessages: setMessages as React.Dispatch<React.SetStateAction<ChannelMessage[]>>,
      })
    );

  it("loads servers, channels and members and computes permissions", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.serverList).toHaveLength(1);
      expect(result.current.selectedServer).toBe("server-1");
      expect(result.current.channels).toHaveLength(1);
      expect(result.current.selectedChannel).toBe("channel-1");
      expect(result.current.members).toHaveLength(2);
      expect(result.current.currentUserRole).toBe("owner");
      expect(result.current.canManageChannels).toBe(true);
    });

    expect(loadMessages).toHaveBeenCalledWith("channel-1");
    expect(syncChannel).toHaveBeenCalledWith("channel-1");
    expect(setActiveChannel).toHaveBeenCalledWith("channel-1");
  });

  it("joins a server, prepends it to the list and closes the modal", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.serverList).toHaveLength(1);
    });

    act(() => {
      result.current.setIsJoinServerOpen(true);
      result.current.setJoinInviteCode("  invite-123  ");
    });

    await act(async () => {
      await result.current.handleJoinServer({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(serversService.join).toHaveBeenCalledWith("invite-123");
    expect(result.current.serverList[0].id).toBe("server-2");
    expect(result.current.selectedServer).toBe("server-2");
    expect(result.current.isJoinServerOpen).toBe(false);
    expect(result.current.joinInviteCode).toBe("");
    expect(result.current.joinServerError).toBe("");
  });

  it("creates a server with a default general channel and joins it when connected", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.serverList).toHaveLength(1);
    });

    act(() => {
      result.current.setNewServerName("  QA  ");
    });

    await act(async () => {
      await result.current.handleCreateServer({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(serversService.create).toHaveBeenCalledWith("QA");
    expect(channelsService.create).toHaveBeenCalledWith("server-3", "general");
    expect(result.current.serverList[0].id).toBe("server-3");
    expect(result.current.selectedServer).toBe("server-3");
    expect(result.current.selectedChannel).toBe("channel-2");
    expect(joinChannel).toHaveBeenCalledWith("channel-2");
  });

  it("adds local channels in creation mode without duplicates and creates server channels in server mode", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
    });

    act(() => {
      result.current.openCreateChannelInModal();
      result.current.setNewChannelName("General");
    });

    await act(async () => {
      await result.current.handleAddChannel({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    act(() => {
      result.current.openCreateChannelInModal();
      result.current.setNewChannelName("general");
    });

    await act(async () => {
      await result.current.handleAddChannel({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.channelList).toEqual(["General"]);

    act(() => {
      result.current.openCreateChannelOnServer();
      result.current.setNewChannelName("support");
    });

    await act(async () => {
      await result.current.handleAddChannel({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(channelsService.create).toHaveBeenCalledWith("server-1", "support");
    expect(result.current.selectedChannel).toBe("channel-3");
    expect(result.current.channels.some((channel) => channel.id === "channel-3")).toBe(true);
  });

  it("updates local state when websocket events kick or ban the current user", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
      expect(result.current.selectedChannel).toBe("channel-1");
    });

    act(() => {
      result.current.handleWsEvent({
        type: "member_kicked",
        user_id: "current-user",
        server_id: "server-1",
      });
    });

    expect(result.current.serverList).toEqual([]);
    expect(result.current.selectedServer).toBe("");
    expect(result.current.channels).toEqual([]);
    expect(result.current.selectedChannel).toBe("");
    expect(result.current.members).toEqual([]);
    expect(setMessages).toHaveBeenCalledWith([]);
  });

  it("updates members locally when changing a role", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.members).toHaveLength(2);
    });

    await act(async () => {
      await result.current.handleUpdateRole("user-2", "admin");
    });

    expect(serversService.updateRole).toHaveBeenCalledWith("server-1", "user-2", "admin");
    expect(result.current.members.find((member) => member.user_id === "user-2")?.role).toBe(
      "admin"
    );
  });

  it("leaves the selected server and clears dependent state", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
      expect(result.current.selectedChannel).toBe("channel-1");
    });

    await act(async () => {
      await result.current.handleLeaveServer("server-1");
    });

    expect(serversService.leave).toHaveBeenCalledWith("server-1");
    expect(result.current.serverList).toEqual([]);
    expect(result.current.selectedServer).toBe("");
    expect(result.current.channels).toEqual([]);
    expect(result.current.selectedChannel).toBe("");
    expect(result.current.members).toEqual([]);
    expect(setMessages).toHaveBeenCalledWith([]);
  });

  it("honors confirmation guards when deleting a server or a channel", async () => {
    const { result } = renderServerManager();
    const confirmMock = globalThis.confirm as jest.Mock;

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
      expect(result.current.selectedChannel).toBe("channel-1");
    });

    confirmMock.mockReturnValueOnce(false).mockReturnValueOnce(false);

    await act(async () => {
      await result.current.handleDeleteServer("server-1");
      await result.current.handleDeleteChannel("channel-1");
    });

    expect(serversService.delete).not.toHaveBeenCalled();
    expect(channelsService.delete).not.toHaveBeenCalled();
    expect(result.current.selectedServer).toBe("server-1");
    expect(result.current.selectedChannel).toBe("channel-1");
  });

  it("deletes the selected channel and server when confirmed", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
      expect(result.current.selectedChannel).toBe("channel-1");
    });

    await act(async () => {
      await result.current.handleDeleteChannel("channel-1");
    });

    expect(channelsService.delete).toHaveBeenCalledWith("channel-1");
    expect(result.current.channels).toEqual([]);
    expect(result.current.selectedChannel).toBe("");
    expect(setMessages).toHaveBeenCalledWith([]);

    await act(async () => {
      await result.current.handleDeleteServer("server-1");
    });

    expect(serversService.delete).toHaveBeenCalledWith("server-1");
    expect(result.current.serverList).toEqual([]);
    expect(result.current.selectedServer).toBe("");
    expect(result.current.members).toEqual([]);
  });

  it("refreshes members after ownership transfer and removes members after ban or kick", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.members).toHaveLength(2);
    });

    (
      serversService.members as jest.MockedFunction<typeof serversService.members>
    ).mockResolvedValueOnce([
      {
        user_id: "current-user",
        username: "me",
        role: "admin",
        is_online: true,
      },
      {
        user_id: "user-2",
        username: "bob",
        role: "owner",
        is_online: false,
      },
    ]);

    await act(async () => {
      await result.current.handleTransferOwnership("user-2");
    });

    expect(serversService.transferOwnership).toHaveBeenCalledWith("server-1", "user-2");
    expect(result.current.members.find((member) => member.user_id === "user-2")?.role).toBe(
      "owner"
    );

    await act(async () => {
      await result.current.handleBanMember("user-2", 30);
    });

    expect(serversService.ban).toHaveBeenCalledWith("server-1", "user-2", 30);
    expect(result.current.members.some((member) => member.user_id === "user-2")).toBe(false);

    (
      serversService.members as jest.MockedFunction<typeof serversService.members>
    ).mockResolvedValueOnce([
      {
        user_id: "current-user",
        username: "me",
        role: "admin",
        is_online: true,
      },
      {
        user_id: "user-3",
        username: "charlie",
        role: "member",
        is_online: false,
      },
    ]);

    act(() => {
      result.current.handleWsEvent({
        type: "member_joined",
        server_id: "server-1",
        user_id: "user-3",
        username: "charlie",
        role: "member",
      });
    });

    await act(async () => {
      await result.current.handleKickMember("user-3");
    });

    expect(serversService.kick).toHaveBeenCalledWith("server-1", "user-3");
    expect(result.current.members.some((member) => member.user_id === "user-3")).toBe(false);
  });

  it("applies websocket create, update, presence and delete events to the current server", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
      expect(result.current.selectedChannel).toBe("channel-1");
    });

    act(() => {
      result.current.handleWsEvent({
        type: "channel_created",
        server_id: "server-1",
        channel_id: "channel-4",
        name: "random",
        channel_type: "text",
      });
      result.current.handleWsEvent({
        type: "channel_created",
        server_id: "server-1",
        channel_id: "channel-4",
        name: "random",
        channel_type: "text",
      });
      result.current.handleWsEvent({
        type: "member_joined",
        server_id: "server-1",
        user_id: "user-3",
        username: "charlie",
        role: "member",
      });
      result.current.handleWsEvent({
        type: "member_role_updated",
        server_id: "server-1",
        user_id: "user-3",
        role: "admin",
      });
      result.current.handleWsEvent({
        type: "user_disconnected",
        user_id: "user-3",
      });
      result.current.handleWsEvent({
        type: "user_connected",
        user_id: "user-3",
      });
      result.current.handleWsEvent({
        type: "channel_updated",
        server_id: "server-1",
        channel_id: "channel-4",
        name: "annonces",
        channel_type: "voice",
      });
      result.current.handleWsEvent({
        type: "server_updated",
        server_id: "server-1",
        name: "Backend Prime",
      });
      result.current.handleWsEvent({
        type: "member_left",
        server_id: "server-1",
        user_id: "user-3",
      });
      result.current.handleWsEvent({
        type: "channel_deleted",
        channel_id: "channel-1",
      });
      result.current.handleWsEvent({
        type: "server_deleted",
        server_id: "server-1",
      });
    });

    expect(result.current.channels.some((channel) => channel.id === "channel-4")).toBe(false);
    expect(result.current.selectedChannel).toBe("");
    expect(result.current.selectedServer).toBe("");
    expect(result.current.serverList).toEqual([]);
    expect(result.current.members).toEqual([]);
    expect(setMessages).toHaveBeenCalledWith([]);
  });

  it("removes the current user locally when a ban websocket event targets them", async () => {
    const { result } = renderServerManager();

    await waitFor(() => {
      expect(result.current.selectedServer).toBe("server-1");
    });

    act(() => {
      result.current.handleWsEvent({
        type: "member_banned",
        user_id: "current-user",
        server_id: "server-1",
      });
    });

    expect(result.current.serverList).toEqual([]);
    expect(result.current.selectedServer).toBe("");
    expect(result.current.channels).toEqual([]);
    expect(result.current.members).toEqual([]);
    expect(setMessages).toHaveBeenCalledWith([]);
  });

  it("shows an alert when handleLeaveServer fails", async () => {
    jest.spyOn(serversService, "leave").mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.selectedServer).toBe("server-1"));

    await act(async () => {
      await result.current.handleLeaveServer("server-1");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de quitter ce serveur.");
  });

  it("shows a string error alert when handleLeaveServer fails with a string response", async () => {
    jest
      .spyOn(serversService, "leave")
      .mockRejectedValueOnce({ response: { data: "Vous êtes le propriétaire." } });
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.selectedServer).toBe("server-1"));

    await act(async () => {
      await result.current.handleLeaveServer("server-1");
    });

    expect(alertMock).toHaveBeenCalledWith("Vous êtes le propriétaire.");
  });

  it("shows an alert when handleDeleteServer fails", async () => {
    jest.spyOn(serversService, "delete").mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.selectedServer).toBe("server-1"));

    await act(async () => {
      await result.current.handleDeleteServer("server-1");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de supprimer ce serveur.");
  });

  it("does nothing when handleJoinServer is called with an empty invite code", async () => {
    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.serverList).toHaveLength(1));

    await act(async () => {
      await result.current.handleJoinServer({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(serversService.join).not.toHaveBeenCalled();
  });

  it("does nothing when handleUpdateRole is called with no selected server", async () => {
    jest.spyOn(serversService, "list").mockResolvedValue([]);

    const { result } = renderHook(() =>
      useServerManager({
        isReady: true,
        isConnected: true,
        currentUserId: "current-user",
        joinChannel,
        loadMessages,
        syncChannel,
        setActiveChannel,
        setMessages: setMessages as React.Dispatch<React.SetStateAction<ChannelMessage[]>>,
      })
    );
    await waitFor(() => expect(result.current.serverList).toHaveLength(0));

    await act(async () => {
      await result.current.handleUpdateRole("user-2", "admin");
    });

    expect(serversService.updateRole).not.toHaveBeenCalled();
  });

  it("shows an alert when handleUpdateRole fails", async () => {
    jest
      .spyOn(serversService, "updateRole")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.members).toHaveLength(2));

    await act(async () => {
      await result.current.handleUpdateRole("user-2", "admin");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de changer le role.");
  });

  it("shows an alert when handleJoinServer fails", async () => {
    jest
      .spyOn(serversService, "join")
      .mockRejectedValueOnce({ response: { data: "Code invalide" } });
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.serverList).toHaveLength(1));

    act(() => {
      result.current.setJoinInviteCode("bad-code");
    });

    await act(async () => {
      await result.current.handleJoinServer({
        preventDefault: jest.fn(),
      } as unknown as React.FormEvent<HTMLFormElement>);
    });

    expect(result.current.joinServerError).toBe("Code invalide");
    expect(alertMock).not.toHaveBeenCalled();
  });

  it("shows an alert when handleDeleteChannel fails", async () => {
    jest
      .spyOn(channelsService, "delete")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.selectedChannel).toBe("channel-1"));

    await act(async () => {
      await result.current.handleDeleteChannel("channel-1");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de supprimer ce channel.");
  });

  it("shows an alert when handleUpdateServer fails", async () => {
    jest
      .spyOn(serversService, "update")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.selectedServer).toBe("server-1"));

    await act(async () => {
      await result.current.handleUpdateServer("server-1", "New Name");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de renommer ce serveur.");
  });

  it("shows an alert when handleUpdateChannel fails", async () => {
    jest
      .spyOn(channelsService, "update")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.selectedChannel).toBe("channel-1"));

    await act(async () => {
      await result.current.handleUpdateChannel("channel-1", "renamed");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de renommer ce channel.");
  });

  it("shows an alert when handleBanMember fails", async () => {
    jest
      .spyOn(serversService, "ban")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.members).toHaveLength(2));

    await act(async () => {
      await result.current.handleBanMember("user-2", 30);
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible de bannir ce membre.");
  });

  it("shows an alert when handleKickMember fails", async () => {
    jest
      .spyOn(serversService, "kick")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.members).toHaveLength(2));

    await act(async () => {
      await result.current.handleKickMember("user-2");
    });

    expect(alertMock).toHaveBeenCalledWith("Impossible d'expulser ce membre.");
  });

  it("shows an alert when handleTransferOwnership fails", async () => {
    jest
      .spyOn(serversService, "transferOwnership")
      .mockRejectedValueOnce(new Error("fail"));
    const alertMock = globalThis.alert as jest.Mock;

    const { result } = renderServerManager();
    await waitFor(() => expect(result.current.members).toHaveLength(2));

    await act(async () => {
      await result.current.handleTransferOwnership("user-2");
    });

    expect(alertMock).toHaveBeenCalledWith(
      "Impossible de transferer la propriete."
    );
  });
});
