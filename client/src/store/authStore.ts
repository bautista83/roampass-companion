import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type ProfileUpdate, type User } from '../api';

interface AuthState {
  token: string | null;
  user: User | null;
  login: (username: string, password: string) => Promise<void>;
  /** Devuelve el aviso de "pendiente de aprobacion", o null si ya inicio sesion (modo demo). */
  register: (username: string, password: string) => Promise<string | null>;
  /** Revalida la sesion guardada (p. ej. si un admin desactivo la cuenta). */
  refresh: () => Promise<void>;
  /** Mi perfil: estilo visual y contraseña del usuario logueado. */
  updateProfile: (data: ProfileUpdate) => Promise<void>;
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
        const result = await api.register(username, password);
        if ('pending' in result) return result.message;
        set(result);
        return null;
      },
      async refresh() {
        try {
          set({ user: await api.me() });
        } catch {
          set({ token: null, user: null });
        }
      },
      async updateProfile(data) {
        set({ user: await api.updateMe(data) });
      },
      logout() {
        set({ token: null, user: null });
      },
    }),
    { name: 'roampass-auth', partialize: ({ token, user }) => ({ token, user }) },
  ),
);
