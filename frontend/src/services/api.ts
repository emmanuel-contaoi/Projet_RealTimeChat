'use client';

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export const authService = {
  register: async (email: string, password: string, firstName?: string, lastName?: string, username?: string) => {
    const response = await api.post('/auth/signup', {
      email,
      password,
      first_name: firstName,
      last_name: lastName,
      username
    });
    if (typeof window !== 'undefined' && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (typeof window !== 'undefined' && response.data.token) {
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // On ignore les erreurs, on vide le localStorage dans tous les cas
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
  },

  getCurrentUser: () => {
    if (typeof window !== 'undefined') {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    }
    return null;
  },

  // 🔴 MODIFIÉ : On ajoute "newPassword" en option
  updateProfile: async (userData: { nom: string; prenom: string; email: string; username: string; newPassword?: string }) => {
    const payload: Record<string, string> = {
      first_name: userData.prenom, // On map le français à l'anglais du backend
      last_name: userData.nom,
      email: userData.email,
      username: userData.username
    };

    // Si l'utilisateur a tapé un nouveau mot de passe, on l'ajoute au payload
    if (userData.newPassword) {
      payload.password = userData.newPassword;
    }

    const response = await api.put('/users/me', payload);

    // Si le backend renvoie le nouvel utilisateur, on met à jour le cache local
    if (typeof window !== 'undefined' && response.data) {
      localStorage.setItem('user', JSON.stringify(response.data));
    }

    return response.data;
  },
};

export const serversService = {
  list: () => api.get('/servers').then(r => r.data),
  get: (serverId: string) => api.get(`/servers/${serverId}`).then(r => r.data),
  create: (name: string) => api.post('/servers', { name }).then(r => r.data),
  update: (serverId: string, name: string) => api.put(`/servers/${serverId}`, { name }).then(r => r.data),
  join: (inviteCode: string) => api.post('/servers/join', { invite_code: inviteCode }).then(r => r.data),
  leave: (serverId: string) => api.delete(`/servers/${serverId}/leave`),
  delete: (serverId: string) => api.delete(`/servers/${serverId}`),
  members: (serverId: string) => api.get(`/servers/${serverId}/members`).then(r => r.data),
  updateRole: (serverId: string, userId: string, role: string) =>
    api.put(`/servers/${serverId}/members/${userId}/role`, { role }).then(r => r.data),
  transferOwnership: (serverId: string, newOwnerId: string) =>
    api.post(`/servers/${serverId}/transfer`, { new_owner_id: newOwnerId }).then(r => r.data),
  kick: (serverId: string, userId: string) =>
    api.delete(`/servers/${serverId}/members/${userId}`),
  // duration_minutes = undefined → ban permanent, sinon ban temporaire
  ban: (serverId: string, userId: string, duration_minutes?: number) =>
    api.post(`/servers/${serverId}/members/${userId}/ban`, { duration_minutes }),
  bans: (serverId: string) => 
    api.get(`/servers/${serverId}/bans`).then(r => r.data),
  /** Supprime le bannissement d'un utilisateur */
  unban: (serverId: string, userId: string) => 
    api.delete(`/servers/${serverId}/bans/${userId}`).then(r => r.data),
};

export const channelsService = {
  list: (serverId: string) => api.get(`/servers/${serverId}/channels`).then(r => r.data),
  create: (serverId: string, name: string, type = 'text') =>
    api.post(`/servers/${serverId}/channels`, { name, type }).then(r => r.data),
  update: (channelId: string, name: string) =>
    api.put(`/channels/${channelId}`, { name }).then(r => r.data),
  delete: (channelId: string) => api.delete(`/channels/${channelId}`),
};

export const messagesService = {
  history: (channelId: string) => api.get(`/channels/${channelId}/messages`).then(r => r.data),
  update: (messageId: string, content: string) => api.put(`/messages/${messageId}`, { content }),
  delete: (messageId: string) => api.delete(`/messages/${messageId}`),
  addReaction: (messageId: string, emoji: string) =>
    api.put(`/messages/${messageId}/reactions`, { emoji }).then(r => r.data),
  removeReaction: (messageId: string, emoji: string) =>
    api.delete(`/messages/${messageId}/reactions`, { data: { emoji } }).then(r => r.data),
};

type GiphyGifApiItem = {
  id: string;
  title: string;
  images?: {
    fixed_width_small_still?: { url?: string };
    fixed_height_small_still?: { url?: string };
    fixed_width?: { url?: string; width?: string; height?: string };
    fixed_height?: { url?: string; width?: string; height?: string };
    original?: { url?: string; width?: string; height?: string };
  };
};

export type GifItem = {
  id: string;
  title: string;
  previewUrl: string;
  url: string;
  width: number;
  height: number;
};

const GIPHY_API_URL = 'https://api.giphy.com/v1/gifs';
const GIPHY_API_KEY = process.env.NEXT_PUBLIC_GIPHY_API_KEY || '';

export const mapGiphyGif = (gif: GiphyGifApiItem): GifItem | null => {
  const animated = gif.images?.fixed_width ?? gif.images?.fixed_height ?? gif.images?.original;
  const still = gif.images?.fixed_width_small_still ?? gif.images?.fixed_height_small_still;

  const url = animated?.url;
  if (!url) return null;

  const width = Number.parseInt(animated?.width ?? '0', 10) || 0;
  const height = Number.parseInt(animated?.height ?? '0', 10) || 0;

  return {
    id: gif.id,
    title: gif.title || 'GIF',
    previewUrl: still?.url ?? url,
    url,
    width,
    height,
  };
};

const fetchGiphy = async (endpoint: 'trending' | 'search', params: Record<string, string | number>) => {
  if (!GIPHY_API_KEY) {
    throw new Error('NEXT_PUBLIC_GIPHY_API_KEY is missing');
  }

  const response = await axios.get<{ data: GiphyGifApiItem[] }>(`${GIPHY_API_URL}/${endpoint}`, {
    params: {
      api_key: GIPHY_API_KEY,
      rating: 'pg-13',
      ...params,
    },
  });

  return response.data.data
    .map(mapGiphyGif)
    .filter((gif): gif is GifItem => gif !== null);
};

export const gifService = {
  isConfigured: () => Boolean(GIPHY_API_KEY),
  trending: (limit = 24) => fetchGiphy('trending', { limit }),
  search: (query: string, limit = 24) => fetchGiphy('search', { q: query, limit }),
};

export const friendsService = {
  list: async () => {
    const response = await api.get('/friends');
    return response.data;
  },

  sendRequest: async (friendId: string) => {
    await api.post('/friends', { friend_id: friendId });
  },

  incomingRequests: async () => {
    const response = await api.get('/friends/requests/incoming');
    return response.data;
  },

  outgoingRequests: async () => {
    const response = await api.get('/friends/requests/outgoing');
    return response.data;
  },

  acceptRequest: async (requestId: string) => {
    await api.post(`/friends/requests/${requestId}/accept`);
  },

  rejectRequest: async (requestId: string) => {
    await api.post(`/friends/requests/${requestId}/reject`);
  },

  cancelRequest: async (requestId: string) => {
    await api.delete(`/friends/requests/${requestId}`);
  },

  remove: async (friendId: string) => {
    await api.delete(`/friends/${friendId}`);
  },
};

export default api;