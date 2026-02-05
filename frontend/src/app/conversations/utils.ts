import type { UserSearchResult } from "./types";

export const formatUserLabel = (user: UserSearchResult) => {
  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return user.username || fullName || user.email;
};
