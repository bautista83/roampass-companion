import { useAuthStore } from '../store/authStore';
import { createHttpApi } from './httpApi';
import { createLocalApi } from './localApi';
import type { RoamPassApi } from './types';

// Tipos explicitos: api <-> authStore se importan mutuamente y TS no puede inferirlos en ciclo.
const getToken = (): string | null => useAuthStore.getState().token;
const baseUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, '');

/** Con VITE_API_URL se usa el backend real; sin ella, el modo demo en localStorage. */
export const api: RoamPassApi = baseUrl ? createHttpApi(baseUrl, getToken) : createLocalApi(getToken);

export { ApiError } from './types';
export type * from './types';
