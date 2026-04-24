export type Server = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string | null;
};

export type Channel = {
  id: string;
  server_id: string;
  name: string;
  type: string;
};

export type MessageReaction = {
  emoji: string;
  user_ids: string[];
};

export type ChannelMessage = {
  id?: string;
  channel_id: string;
  user_id: string;
  username: string;
  avatar_url?: string | null; // 🔴 AJOUT ICI
  content: string;
  created_at?: string;
  reactions: MessageReaction[];
};

export type Friend = {
  id: string;
  name: string;
  status: string;
  avatar_url?: string | null; // 🔴 AJOUT ICI
};

export type DmChannel = {
  id: string;
  user1_id: string;
  user2_id: string;
  created_at: string;
};

export type FriendRequest = {
  id: string;
  status: string;
  created_at: string;
  responded_at?: string | null;
  user: UserSearchResult;
};

export type Member = {
  user_id: string;
  username: string;
  avatar_url?: string | null; // 🔴 AJOUT ICI
  role: string;
  is_online: boolean;
};

export type UserSearchResult = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url?: string | null; // 🔴 AJOUT ICI
  created_at: string;
};