import type { UserSearchResult } from "./types";

export const formatUserLabel = (user: UserSearchResult) => {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return user.username || fullName || user.email;
};

export const isGifUrl = (value: string) => {
  if (!/^https?:\/\//i.test(value)) return false;
  const url = value.toLowerCase();

  return (
    url.includes(".gif") ||
    url.includes("giphy.com/media/") ||
    url.includes("media.giphy.com/") ||
    url.includes("tenor.com/")
  );
};
