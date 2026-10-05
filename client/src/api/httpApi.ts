import type { Card, GameState } from '@roampass/shared';
import { ApiError, type AuthSession, type PlayerStatsSummary, type RoamPassApi, type User } from './types';

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
    if (!res.ok) throw new ApiError(body.error ?? `Error ${res.status}`, res.status);
    return body as T;
  }
  const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });

  return {
    mode: 'remote',
    login: (username, password) => request<AuthSession>('/auth/login', json('POST', { username, password })),
    register: (username, password) => request<AuthSession>('/auth/register', json('POST', { username, password })),
    me: async () => (await request<{ user: User }>('/auth/me')).user,

    listUsers: async () => (await request<{ users: User[] }>('/users')).users,
    createUser: async (data) => (await request<{ user: User }>('/users', json('POST', data))).user,
    updateUser: async (id, data) => (await request<{ user: User }>(`/users/${id}`, json('PATCH', data))).user,
    deleteUser: (id) => request<void>(`/users/${id}`, { method: 'DELETE' }),

    getCards: async () => (await request<{ cards: Card[] }>('/cards')).cards,
    saveGame: (state, selfPlayerId) => request<void>(`/games/${state.id}`, json('PUT', { state, selfPlayerId })),
    getActiveGame: async () => (await request<{ state: GameState | null }>('/games/active')).state,
    getMyStats: () => request<PlayerStatsSummary>('/games/stats/me'),
  };
}
