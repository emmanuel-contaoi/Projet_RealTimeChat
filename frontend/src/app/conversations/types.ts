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

export type ChannelMessage = {
  id?: string;
  channel_id: string;
  user_id: string;
  username: string;
  content: string;
  created_at?: string;
};

export type Friend = {
  id: string;
  name: string;
  status: string;
  lastMessage: string;
};

export type UserSearchResult = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
};
