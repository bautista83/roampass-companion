import type { Card, GameState } from '@roampass/shared';
import {
  ApiError,
  type AuthSession,
  type PlayerStatsSummary,
  type RecentGame,
  type RegisterResult,
  type RoamPassApi,
  type User,
} from './types';

export function createHttpApi(baseUrl: string, getToken: () => string | null): RoamPassApi {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    const res = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...init.headers,
      },
    });
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `Error ${res.status}`, res.status, body.code);
    return body as T;
  }
  const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

  // Las fotos se piden con el token (no son publicas) y se muestran como blob:. Se cachean por version.
  const photoCache = new Map<string, Promise<string | null>>();
  async function fetchPhoto(userId: string, version: string): Promise<string | null> {
    const token = getToken();
    const res = await fetch(`${baseUrl}/users/${encodeURIComponent(userId)}/photo?v=${encodeURIComponent(version)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new ApiError(`Error ${res.status}`, res.status);
    return URL.createObjectURL(await res.blob());
  }

  return {
    mode: 'remote',
    login: (identifier, password) => request<AuthSession>('/auth/login', json('POST', { identifier, password })),
    register: (data) => request<RegisterResult>('/auth/register', json('POST', data)),
    verifyEmail: (token) => request<{ purpose: 'VERIFY_EMAIL' | 'CHANGE_EMAIL' }>('/auth/verify-email', json('POST', { token })),
    resendVerification: (identifier) => request<{ message: string }>('/auth/resend-verification', json('POST', { identifier })),
    forgotPassword: (identifier) => request<{ message: string }>('/auth/forgot-password', json('POST', { identifier })),
    resetPassword: async (token, password) => {
      await request<unknown>('/auth/reset-password', json('POST', { token, password }));
    },
    me: async () => (await request<{ user: User }>('/auth/me')).user,
    updateMe: async (data) => (await request<{ user: User }>('/auth/me', json('PATCH', data))).user,

    listUsers: async () => (await request<{ users: User[] }>('/users')).users,
    createUser: async (data) => (await request<{ user: User }>('/users', json('POST', data))).user,
    updateUser: async (id, data) => (await request<{ user: User }>(`/users/${id}`, json('PATCH', data))).user,
    deleteUser: (id) => request<void>(`/users/${id}`, { method: 'DELETE' }),

    getCards: async () => (await request<{ cards: Card[] }>('/cards')).cards,
    saveGame: (state, selfPlayerId) => request<void>(`/games/${state.id}`, json('PUT', { state, selfPlayerId })),
    getActiveGame: async () => (await request<{ state: GameState | null }>('/games/active')).state,
    getMyStats: () => request<PlayerStatsSummary>('/games/stats/me'),
    deleteGame: (id) => request<void>(`/games/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    getRecentGames: async (limit = 12) => (await request<{ games: RecentGame[] }>(`/games/recent?limit=${limit}`)).games,

    uploadPhoto: async (image) =>
      (await request<{ user: User }>('/auth/me/photo', { method: 'PUT', body: image, headers: { 'Content-Type': image.type || 'image/jpeg' } })).user,
    deleteMyPhoto: async () => (await request<{ user: User }>('/auth/me/photo', { method: 'DELETE' })).user,
    deleteUserPhoto: async (userId) =>
      (await request<{ user: User }>(`/users/${encodeURIComponent(userId)}/photo`, { method: 'DELETE' })).user,
    getPhotoUrl(userId, version) {
      const key = `${userId}:${version}`;
      let url = photoCache.get(key);
      if (!url) {
        url = fetchPhoto(userId, version);
        url.catch(() => photoCache.delete(key)); // un error no queda cacheado
        photoCache.set(key, url);
      }
      return url;
    },
  };
}
