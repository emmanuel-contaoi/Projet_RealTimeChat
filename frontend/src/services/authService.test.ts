import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import api, { authService } from "./api";

describe("authService", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("registers a user and stores the session in localStorage when a token is returned", async () => {
    const payload = {
      token: "token-123",
      user: {
        id: "user-1",
        email: "manu@example.com",
      },
    };

    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({
      data: payload,
    });

    await expect(
      authService.register(
        "manu@example.com",
        "secret123",
        "Manu",
        "Dupont",
        "manu"
      )
    ).resolves.toEqual(payload);

    expect(postSpy).toHaveBeenCalledWith("/auth/signup", {
      email: "manu@example.com",
      password: "secret123",
      first_name: "Manu",
      last_name: "Dupont",
      username: "manu",
    });
    expect(window.localStorage.getItem("token")).toBe("token-123");
    expect(window.localStorage.getItem("user")).toBe(
      JSON.stringify(payload.user)
    );
  });

  it("logs in a user and stores the returned session", async () => {
    const payload = {
      token: "token-456",
      user: {
        id: "user-2",
        email: "alice@example.com",
      },
    };

    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({
      data: payload,
    });

    await expect(
      authService.login("alice@example.com", "password")
    ).resolves.toEqual(payload);

    expect(postSpy).toHaveBeenCalledWith("/auth/login", {
      email: "alice@example.com",
      password: "password",
    });
    expect(window.localStorage.getItem("token")).toBe("token-456");
    expect(window.localStorage.getItem("user")).toBe(
      JSON.stringify(payload.user)
    );
  });

  it("clears localStorage on logout when the api call succeeds", async () => {
    window.localStorage.setItem("token", "token-123");
    window.localStorage.setItem("user", JSON.stringify({ id: "user-1" }));

    const postSpy = jest.spyOn(api, "post").mockResolvedValueOnce({ data: {} });

    await authService.logout();

    expect(postSpy).toHaveBeenCalledWith("/auth/logout");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("user")).toBeNull();
  });

  it("still clears localStorage on logout when the api call fails", async () => {
    window.localStorage.setItem("token", "token-123");
    window.localStorage.setItem("user", JSON.stringify({ id: "user-1" }));

    const postSpy = jest
      .spyOn(api, "post")
      .mockRejectedValueOnce(new Error("network error"));

    await expect(authService.logout()).resolves.toBeUndefined();

    expect(postSpy).toHaveBeenCalledWith("/auth/logout");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("user")).toBeNull();
  });

  it("returns the parsed current user from localStorage", () => {
    window.localStorage.setItem(
      "user",
      JSON.stringify({ id: "user-3", username: "manu" })
    );

    expect(authService.getCurrentUser()).toEqual({
      id: "user-3",
      username: "manu",
    });
  });

  it("returns null when there is no current user in localStorage", () => {
    expect(authService.getCurrentUser()).toBeNull();
  });

  it("maps French field names to the English API payload and updates localStorage", async () => {
    const updatedUser = { id: "user-1", email: "manu@example.com", username: "manu" };
    const putSpy = jest.spyOn(api, "put").mockResolvedValueOnce({ data: updatedUser });

    await expect(
      authService.updateProfile({
        nom: "Dupont",
        prenom: "Manu",
        email: "manu@example.com",
        username: "manu",
      })
    ).resolves.toEqual(updatedUser);

    expect(putSpy).toHaveBeenCalledWith("/users/me", {
      first_name: "Manu",
      last_name: "Dupont",
      email: "manu@example.com",
      username: "manu",
    });
    expect(window.localStorage.getItem("user")).toBe(JSON.stringify(updatedUser));
  });

  it("includes the new password in the payload only when provided", async () => {
    const updatedUser = { id: "user-1", email: "manu@example.com" };
    const putSpy = jest.spyOn(api, "put").mockResolvedValueOnce({ data: updatedUser });

    await authService.updateProfile({
      nom: "Dupont",
      prenom: "Manu",
      email: "manu@example.com",
      username: "manu",
      newPassword: "newSecret99",
    });

    expect(putSpy).toHaveBeenCalledWith("/users/me", {
      first_name: "Manu",
      last_name: "Dupont",
      email: "manu@example.com",
      username: "manu",
      password: "newSecret99",
    });
  });
});
