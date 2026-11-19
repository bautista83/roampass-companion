import type { Card, GameState, InviteSummary } from '@roampass/shared';
import {
  ApiError,
  type AuthSession,
  type PlayerStatsSummary,
  type RecentGame,
  type RegisterResult,
  type AdminEmailInvite,
  type EmailInviteInfo,
  type EmailInviteStats,
  type MyEmailInvite,
  type RoamPassApi,
  type SentInvite,
  type SentInvites,
  type User,
} from './types';

export function createHttpApi(baseUrl: string, getToken: () => string | null): RoamPassApi {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = getToken();
    let res: Response;
    try {
      res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...init.headers,
        },
      });
    } catch {
      throw new ApiError('Sin conexión con el servidor', 0, 'NETWORK');
    }
    if (res.status === 204) return undefined as T;
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(body.error ?? `Error ${res.status}`, res.status, body.code, body.params);
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
    searchUsers: async (q) => (await request<{ users: { id: string; username: string }[] }>(`/users/search?q=${encodeURIComponent(q)}`)).users,
    createOnlineGame: (setup) => request<{ sessionId: string }>('/online', json('POST', setup)),
    getCurrentOnline: async () => (await request<{ current: Awaited<ReturnType<RoamPassApi['getCurrentOnline']>> }>('/online/current')).current,
    cancelOnlineGame: (id) => request<void>(`/online/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    leaveOnlineLobby: (id) => request<void>(`/online/${encodeURIComponent(id)}/leave`, { method: 'POST' }),
    inviteToOnline: async (id, toUserId, initialMiles = 0) => {
      await request<unknown>(`/online/${encodeURIComponent(id)}/invites`, json('POST', { toUserId, initialMiles }));
    },
    inviteToOnlineByEmail: async (id, email, initialMiles = 0) => {
      await request<unknown>(`/online/${encodeURIComponent(id)}/email-invites`, json('POST', { email, initialMiles }));
    },
    listSentInvites: async (id) => {
      const body = await request<{ invites: SentInvite[]; emails?: SentInvites['emails'] }>(`/online/${encodeURIComponent(id)}/invites`);
      return { users: body.invites, emails: body.emails ?? [] };
    },
    listInvites: async () => (await request<{ invites: InviteSummary[] }>('/invites')).invites,
    acceptInvite: (inviteId, pawn) => request<{ sessionId: string }>(`/invites/${encodeURIComponent(inviteId)}/accept`, json('POST', pawn)),
    declineInvite: (inviteId) => request<void>(`/invites/${encodeURIComponent(inviteId)}/decline`, { method: 'POST' }),
    cancelInvite: (inviteId) => request<void>(`/invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' }),
    rejoinOnline: (id) => request<void>(`/online/${encodeURIComponent(id)}/rejoin`, { method: 'POST' }),
    hideOnline: (id) => request<void>(`/online/${encodeURIComponent(id)}/hide`, { method: 'POST' }),
    async getStreetViewPhoto(id) {
      const token = getToken();
      const res = await fetch(`${baseUrl}/online/${encodeURIComponent(id)}/streetview-photo`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      return res.ok ? URL.createObjectURL(await res.blob()) : null;
    },

    inviteFriend: async (email) => {
      await request<unknown>('/email-invites', json('POST', { email }));
    },
    listMyEmailInvites: async () => (await request<{ invites: MyEmailInvite[] }>('/email-invites/mine')).invites,
    getEmailInvite: (token) => request<EmailInviteInfo>(`/email-invites/token?token=${encodeURIComponent(token)}`),
    optOutInvites: (token) => request<void>('/email-invites/opt-out', json('POST', { token })),
    listEmailInvites: async (filter = {}) => {
      const q = new URLSearchParams(Object.entries(filter).filter((e): e is [string, string] => Boolean(e[1])));
      return (await request<{ invites: AdminEmailInvite[] }>(`/admin/email-invites?${q}`)).invites;
    },
    getEmailInviteStats: () => request<EmailInviteStats>('/admin/email-invites/stats'),

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
