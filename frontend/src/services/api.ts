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
    const response = await api.post('/auth/register', {
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

  logout: () => {
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
};

export const serversService = {
  list: () => api.get('/servers').then(r => r.data),
  create: (name: string) => api.post('/servers', { name }).then(r => r.data),
  join: (inviteCode: string) => api.post('/servers/join', { invite_code: inviteCode }).then(r => r.data),
  leave: (serverId: string) => api.delete(`/servers/${serverId}/leave`),
  delete: (serverId: string) => api.delete(`/servers/${serverId}`),
  members: (serverId: string) => api.get(`/servers/${serverId}/members`).then(r => r.data),
  updateRole: (serverId: string, userId: string, role: string) =>
    api.put(`/servers/${serverId}/members/${userId}/role`, { role }).then(r => r.data),
};

export const channelsService = {
  list: (serverId: string) => api.get(`/servers/${serverId}/channels`).then(r => r.data),
  create: (serverId: string, name: string, type = 'text') =>
    api.post(`/servers/${serverId}/channels`, { name, type }).then(r => r.data),
  delete: (channelId: string) => api.delete(`/servers/channels/${channelId}`),
};

export const messagesService = {
  history: (channelId: string) => api.get(`/servers/channels/${channelId}/messages`).then(r => r.data),
};

export const friendsService = {
  list: async () => {
    const response = await api.get('/friends');
    return response.data;
  },

  add: async (friendId: string) => {
    const response = await api.post('/friends', { friend_id: friendId });
    return response.data;
  },

  remove: async (friendId: string) => {
    await api.delete(`/friends/${friendId}`);
  },
};

export default api;
