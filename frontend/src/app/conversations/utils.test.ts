import { describe, expect, it } from "@jest/globals";

import { formatUserLabel, isGifUrl } from "./utils";

describe("formatUserLabel", () => {
  it("returns the username when available", () => {
    expect(
      formatUserLabel({
        id: "1",
        email: "manu@example.com",
        first_name: "Manu",
        last_name: "Martin",
        username: "manu",
        created_at: "2026-03-16T10:00:00Z",
      })
    ).toBe("manu");
  });

  it("falls back to the full name when username is missing", () => {
    expect(
      formatUserLabel({
        id: "1",
        email: "manu@example.com",
        first_name: "Manu",
        last_name: "Martin",
        username: null,
        created_at: "2026-03-16T10:00:00Z",
      })
    ).toBe("Manu Martin");
  });

  it("falls back to the email when no display name is available", () => {
    expect(
      formatUserLabel({
        id: "1",
        email: "manu@example.com",
        first_name: null,
        last_name: null,
        username: null,
        created_at: "2026-03-16T10:00:00Z",
      })
    ).toBe("manu@example.com");
  });
});

describe("isGifUrl", () => {
  it("accepts direct gif files and known gif providers", () => {
    expect(isGifUrl("https://cdn.example.com/funny.gif")).toBe(true);
    expect(isGifUrl("https://giphy.com/media/abc123")).toBe(true);
    expect(isGifUrl("https://tenor.com/view/wave-123")).toBe(true);
  });

  it("rejects non-http urls and non-gif links", () => {
    expect(isGifUrl("/images/funny.gif")).toBe(false);
    expect(isGifUrl("https://example.com/funny.png")).toBe(false);
  });
});
