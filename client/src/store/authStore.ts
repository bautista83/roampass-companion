import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, type ProfileUpdate, type RegisterData, type User } from '../api';

interface AuthState {
  token: string | null;
  user: User | null;
  /** `identifier`: usuario o correo. */
  login: (identifier: string, password: string) => Promise<void>;
  /** Devuelve el aviso de "revisa tu correo", o null si ya inicio sesion (modo demo). */
  register: (data: RegisterData) => Promise<string | null>;
  /** Revalida la sesion guardada (p. ej. si un admin desactivo la cuenta). */
  refresh: () => Promise<void>;
  /** Mi perfil: estilo visual y contraseña del usuario logueado. */
  updateProfile: (data: ProfileUpdate) => Promise<void>;
  /** Reemplaza el usuario guardado (p. ej. tras subir la foto). */
  setUser: (user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      async login(identifier, password) {
        set(await api.login(identifier, password));
      },
      async register(data) {
        const result = await api.register(data);
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
      setUser(user) {
        set({ user });
      },
      logout() {
        set({ token: null, user: null });
      },
    }),
    { name: 'roampass-auth', partialize: ({ token, user }) => ({ token, user }) },
  ),
);
