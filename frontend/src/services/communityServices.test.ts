import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import api, {
  channelsService,
  friendsService,
  messagesService,
  serversService,
} from "./api";

describe("serversService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("lists the current user's servers", async () => {
    const payload = [{ id: "server-1", name: "Nexus" }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(serversService.list()).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/servers");
  });

  it("creates a server", async () => {
    const payload = { id: "server-1", name: "Nexus" };
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: payload });

    await expect(serversService.create("Nexus")).resolves.toEqual(payload);
    expect(postSpy).toHaveBeenCalledWith("/servers", { name: "Nexus" });
  });

  it("joins a server with an invite code", async () => {
    const payload = { id: "server-2", name: "Gaming" };
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: payload });

    await expect(serversService.join("ABC123")).resolves.toEqual(payload);
    expect(postSpy).toHaveBeenCalledWith("/servers/join", {
      invite_code: "ABC123",
    });
  });

  it("updates a member role", async () => {
    const payload = { ok: true };
    const putSpy = jest.spyOn(api, "put").mockResolvedValueOnce({ data: payload });

    await expect(
      serversService.updateRole("server-1", "user-1", "admin")
    ).resolves.toEqual(payload);
    expect(putSpy).toHaveBeenCalledWith(
      "/servers/server-1/members/user-1/role",
      { role: "admin" }
    );
  });

  it("kicks a member from a server", async () => {
    const deleteSpy = jest.spyOn(api, "delete").mockResolvedValueOnce({ data: {} });

    await serversService.kick("server-1", "user-2");

    expect(deleteSpy).toHaveBeenCalledWith("/servers/server-1/members/user-2");
  });

  it("bans a member permanently when no duration is given", async () => {
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: {} });

    await serversService.ban("server-1", "user-2");

    expect(postSpy).toHaveBeenCalledWith(
      "/servers/server-1/members/user-2/ban",
      { duration_minutes: undefined }
    );
  });

  it("bans a member temporarily when a duration is given", async () => {
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: {} });

    await serversService.ban("server-1", "user-2", 60);

    expect(postSpy).toHaveBeenCalledWith(
      "/servers/server-1/members/user-2/ban",
      { duration_minutes: 60 }
    );
  });

  it("lists the bans of a server", async () => {
    const payload = [{ user_id: "user-2", banned_until: null }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(serversService.bans("server-1")).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/servers/server-1/bans");
  });

  it("unbans a user from a server", async () => {
    const payload = { ok: true };
    const deleteSpy = jest.spyOn(api, "delete").mockResolvedValueOnce({ data: payload });

    await expect(serversService.unban("server-1", "user-2")).resolves.toEqual(payload);
    expect(deleteSpy).toHaveBeenCalledWith("/servers/server-1/bans/user-2");
  });

  it("transfers server ownership to another member", async () => {
    const payload = { ok: true };
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: payload });

    await expect(
      serversService.transferOwnership("server-1", "user-3")
    ).resolves.toEqual(payload);
    expect(postSpy).toHaveBeenCalledWith("/servers/server-1/transfer", {
      new_owner_id: "user-3",
    });
  });
});

describe("channelsService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("lists channels for a server", async () => {
    const payload = [{ id: "channel-1", name: "general" }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(channelsService.list("server-1")).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/servers/server-1/channels");
  });

  it("creates a text channel by default", async () => {
    const payload = { id: "channel-1", name: "general", type: "text" };
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: payload });

    await expect(channelsService.create("server-1", "general")).resolves.toEqual(
      payload
    );
    expect(postSpy).toHaveBeenCalledWith("/servers/server-1/channels", {
      name: "general",
      type: "text",
    });
  });

  it("updates a channel name", async () => {
    const payload = { id: "channel-1", name: "annonces" };
    const putSpy = jest.spyOn(api, "put").mockResolvedValueOnce({ data: payload });

    await expect(channelsService.update("channel-1", "annonces")).resolves.toEqual(
      payload
    );
    expect(putSpy).toHaveBeenCalledWith("/channels/channel-1", {
      name: "annonces",
    });
  });

  it("deletes a channel", async () => {
    const deleteSpy = jest.spyOn(api, "delete").mockResolvedValueOnce({ data: {} });

    await channelsService.delete("channel-1");

    expect(deleteSpy).toHaveBeenCalledWith("/channels/channel-1");
  });
});

describe("messagesService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("loads the message history for a channel", async () => {
    const payload = [{ id: "message-1", content: "hello" }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(messagesService.history("channel-1")).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/channels/channel-1/messages");
  });

  it("adds a reaction to a message", async () => {
    const payload = { ok: true };
    const putSpy = jest.spyOn(api, "put").mockResolvedValueOnce({ data: payload });

    await expect(
      messagesService.addReaction("message-1", ":fire:")
    ).resolves.toEqual(payload);
    expect(putSpy).toHaveBeenCalledWith("/messages/message-1/reactions", {
      emoji: ":fire:",
    });
  });

  it("removes a reaction from a message", async () => {
    const payload = { ok: true };
    const deleteSpy = jest
      .spyOn(api, "delete")
      .mockResolvedValueOnce({ data: payload });

    await expect(
      messagesService.removeReaction("message-1", ":fire:")
    ).resolves.toEqual(payload);
    expect(deleteSpy).toHaveBeenCalledWith("/messages/message-1/reactions", {
      data: { emoji: ":fire:" },
    });
  });

  it("edits the content of a message", async () => {
    const putSpy = jest.spyOn(api, "put").mockResolvedValueOnce({ data: {} });

    await messagesService.update("message-1", "nouveau contenu");

    expect(putSpy).toHaveBeenCalledWith("/messages/message-1", {
      content: "nouveau contenu",
    });
  });

  it("deletes a message", async () => {
    const deleteSpy = jest.spyOn(api, "delete").mockResolvedValueOnce({ data: {} });

    await messagesService.delete("message-1");

    expect(deleteSpy).toHaveBeenCalledWith("/messages/message-1");
  });
});

describe("friendsService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it("lists friends", async () => {
    const payload = [{ id: "friend-1", username: "alice" }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(friendsService.list()).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/friends");
  });

  it("lists incoming friend requests", async () => {
    const payload = [{ id: "request-1" }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(friendsService.incomingRequests()).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/friends/requests/incoming");
  });

  it("sends a friend request", async () => {
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: {} });

    await expect(friendsService.sendRequest("user-9")).resolves.toBeUndefined();
    expect(postSpy).toHaveBeenCalledWith("/friends", { friend_id: "user-9" });
  });

  it("accepts a friend request", async () => {
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: {} });

    await expect(friendsService.acceptRequest("request-1")).resolves.toBeUndefined();
    expect(postSpy).toHaveBeenCalledWith("/friends/requests/request-1/accept");
  });

  it("removes a friend", async () => {
    const deleteSpy = jest
      .spyOn(api, "delete")
      .mockResolvedValueOnce({ data: {} });

    await expect(friendsService.remove("friend-1")).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith("/friends/friend-1");
  });

  it("lists outgoing friend requests", async () => {
    const payload = [{ id: "request-2" }];
    const getSpy = jest.spyOn(api, "get").mockResolvedValueOnce({ data: payload });

    await expect(friendsService.outgoingRequests()).resolves.toEqual(payload);
    expect(getSpy).toHaveBeenCalledWith("/friends/requests/outgoing");
  });

  it("rejects a friend request", async () => {
    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: {} });

    await expect(friendsService.rejectRequest("request-1")).resolves.toBeUndefined();
    expect(postSpy).toHaveBeenCalledWith("/friends/requests/request-1/reject");
  });

  it("cancels an outgoing friend request", async () => {
    const deleteSpy = jest.spyOn(api, "delete").mockResolvedValueOnce({ data: {} });

    await expect(friendsService.cancelRequest("request-2")).resolves.toBeUndefined();
    expect(deleteSpy).toHaveBeenCalledWith("/friends/requests/request-2");
  });
});
