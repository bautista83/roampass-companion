import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type User } from '../api';

interface AuthState {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  /** Revalida la sesion guardada (p. ej. si un admin desactivo la cuenta). */
  refresh: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      async login(username, password) {
        set(await api.login(username, password));
      },
      async register(username, password) {
        set(await api.register(username, password));
      },
      async refresh() {
        try {
          set({ user: await api.me() });
        } catch {
          set({ token: null, user: null });
        }
      },
      logout() {
        set({ token: null, user: null });
      },
    }),
    { name: 'roampass-auth', partialize: ({ token, user }) => ({ token, user }) },
  ),
);
