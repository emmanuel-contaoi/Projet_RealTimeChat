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
  content: string;
  created_at?: string;
  reactions: MessageReaction[];
};

export type Friend = {
  id: string;
  name: string;
  status: string;
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
  role: string;
  is_online: boolean;
};

export type UserSearchResult = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
};
