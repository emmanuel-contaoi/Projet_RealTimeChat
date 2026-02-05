import type { ChannelMessage, Friend, Server } from "../types";

export const initialServers: Server[] = [
  {
    name: "Gaming",
    members: "120 membres",
    status: "En ligne",
    channels: ["general", "annonces", "clips"],
  },
  {
    name: "Travail",
    members: "45 membres",
    status: "Actif",
    channels: ["general", "planning", "projets"],
  },
];

export const initialFriends: Friend[] = [
  {
    name: "Alex",
    status: "En ligne",
    lastMessage: "Salut !",
  },
  {
    name: "Sarah",
    status: "Actif",
    lastMessage: "Tu es dispo ce soir ?",
  },
  {
    name: "Nina",
    status: "Absent",
    lastMessage: "Je te reponds plus tard.",
  },
];

export const channelMessages: Record<string, ChannelMessage[]> = {
  general: [
    { sender: "Alex", text: "Salut !", time: "18:42", me: false },
    { sender: "Moi", text: "Salut, tu veux jouer ?", time: "18:43", me: true },
    {
      sender: "Alex",
      text: "Oui, une petite partie ?",
      time: "18:44",
      me: false,
    },
  ],
  annonces: [
    {
      sender: "Moi",
      text: "Bienvenue sur le serveur !",
      time: "10:12",
      me: true,
    },
  ],
  clips: [
    {
      sender: "Alex",
      text: "Regarde ce highlight.",
      time: "21:08",
      me: false,
    },
  ],
  planning: [
    {
      sender: "Sarah",
      text: "Reunion a 14h.",
      time: "09:15",
      me: false,
    },
  ],
  projets: [
    {
      sender: "Moi",
      text: "Je pousse la V2 demain.",
      time: "16:30",
      me: true,
    },
  ],
};
