export type Server = {
  name: string;
  members: string;
  status: string;
  channels: string[];
};

export type Friend = {
  id: string;
  name: string;
  status: string;
  lastMessage: string;
};

export type ChannelMessage = {
  sender: string;
  text: string;
  time: string;
  me: boolean;
};

export type UserSearchResult = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  created_at: string;
};
