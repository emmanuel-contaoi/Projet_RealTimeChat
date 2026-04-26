import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import axios from "axios";

import { authService, gifService, mapGiphyGif } from "./api";

describe("mapGiphyGif", () => {
  it("maps the animated and preview urls from the Giphy payload", () => {
    expect(
      mapGiphyGif({
        id: "gif-1",
        title: "Wave",
        images: {
          fixed_width: {
            url: "https://media.example.com/wave.gif",
            width: "200",
            height: "120",
          },
          fixed_width_small_still: {
            url: "https://media.example.com/wave-still.gif",
          },
        },
      })
    ).toEqual({
      id: "gif-1",
      title: "Wave",
      previewUrl: "https://media.example.com/wave-still.gif",
      url: "https://media.example.com/wave.gif",
      width: 200,
      height: 120,
    });
  });

  it("falls back to the animated url when no still image exists", () => {
    expect(
      mapGiphyGif({
        id: "gif-2",
        title: "",
        images: {
          original: {
            url: "https://media.example.com/original.gif",
            width: "480",
            height: "270",
          },
        },
      })
    ).toEqual({
      id: "gif-2",
      title: "GIF",
      previewUrl: "https://media.example.com/original.gif",
      url: "https://media.example.com/original.gif",
      width: 480,
      height: 270,
    });
  });

  it("returns null when the animated asset is missing", () => {
    expect(
      mapGiphyGif({
        id: "gif-3",
        title: "Broken",
        images: {
          fixed_width_small_still: {
            url: "https://media.example.com/broken-still.gif",
          },
        },
      })
    ).toBeNull();
  });
});

describe("authService.getCurrentUser", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when no user is stored in localStorage", () => {
    expect(authService.getCurrentUser()).toBeNull();
  });

  it("returns the parsed user object when one is stored", () => {
    const user = { id: "u1", email: "test@example.com" };
    window.localStorage.setItem("user", JSON.stringify(user));
    expect(authService.getCurrentUser()).toEqual(user);
  });
});

describe("gifService", () => {
  it("isConfigured returns false when GIPHY_API_KEY is not set", () => {
    expect(gifService.isConfigured()).toBe(false);
  });

  it("trending throws when GIPHY_API_KEY is missing", async () => {
    await expect(gifService.trending()).rejects.toThrow(
      "NEXT_PUBLIC_GIPHY_API_KEY is missing"
    );
  });

  it("search throws when GIPHY_API_KEY is missing", async () => {
    await expect(gifService.search("cats")).rejects.toThrow(
      "NEXT_PUBLIC_GIPHY_API_KEY is missing"
    );
  });
});
