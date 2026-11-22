// Notificaciones push en la app (docs/specs/mobile-app.md, E4). En la web y en el modo demo no hacen nada.

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerPlugin } from '@capacitor/core';
import { App } from '@capacitor/app';
import { PushNotifications } from '@capacitor/push-notifications';
import { create } from 'zustand';
import i18n from 'i18next';
import { api } from '../api';
import { isNative, nativePlatform } from './index';

/** Hay push solo dentro de la app y con servidor (el modo demo no tiene backend). */
export const pushAvailable = () => isNative() && Boolean(import.meta.env.VITE_API_URL);

/** Estado del permiso del sistema. `prompt`: todavia no se pregunto. */
export type PushPermission = 'granted' | 'denied' | 'prompt';

const TOKEN_KEY = 'roampass-push-token';
/** Ya se mostro la pantalla previa de 4.2 (con "Activar" o "Ahora no"): no se vuelve a mostrar sola. */
const ASKED_KEY = 'roampass-push-asked';

const storage = {
  get: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set: (key: string, value: string | null) => {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    } catch {
      // sin almacenamiento: solo se pierde el recuerdo, no la funcion
    }
  },
};

export async function getPushPermission(): Promise<PushPermission> {
  if (!pushAvailable()) return 'denied';
  const { receive } = await PushNotifications.checkPermissions();
  if (receive === 'granted') return (await notificationsEnabled()) ? 'granted' : 'denied';
  return receive === 'denied' ? 'denied' : 'prompt';
}

/** Pide el permiso del sistema y, si lo dan, registra el dispositivo. */
export async function enablePush(): Promise<PushPermission> {
  if (!pushAvailable()) return 'denied';
  storage.set(ASKED_KEY, '1');
  let permission = await getPushPermission();
  if (permission === 'prompt') {
    const { receive } = await PushNotifications.requestPermissions();
    permission = receive === 'granted' ? 'granted' : 'denied';
  }
  if (permission === 'granted') await PushNotifications.register();
  return permission;
}

/**
 * Al cerrar sesion (MA-03): borra el token de este celular en el servidor. Se llama ANTES de borrar
 * la sesion local: el pedido sale con el token de la sesion que se cierra.
 */
export function forgetPushDevice() {
  const token = storage.get(TOKEN_KEY);
  storage.set(TOKEN_KEY, null);
  if (token && pushAvailable()) void api.unregisterDevice(token).catch(() => {});
}

/** Al eliminar la cuenta el servidor ya borro sus dispositivos: solo se olvida el token local. */
export const clearPushDevice = () => storage.set(TOKEN_KEY, null);

/** Ajustes de notificaciones de la app en el telefono (plugin propio, AppSettingsPlugin.java; solo Android). */
const AppSettings = registerPlugin<{
  areNotificationsEnabled(): Promise<{ enabled: boolean }>;
  openNotificationSettings(): Promise<void>;
}>('AppSettings');
export const openNotificationSettings = () => AppSettings.openNotificationSettings();
/** Apagadas a mano en los ajustes (en iOS el permiso ya lo refleja). */
const notificationsEnabled = () =>
  nativePlatform() === 'android' ? AppSettings.areNotificationsEnabled().then((r) => r.enabled, () => true) : Promise.resolve(true);

// ── Pantalla previa al permiso (4.2) ──

interface PushPromptState {
  open: boolean;
  close: () => void;
}

export const usePushPrompt = create<PushPromptState>()((set) => ({
  open: false,
  close: () => {
    storage.set(ASKED_KEY, '1');
    set({ open: false });
  },
}));

/**
 * Momento con sentido para pedir el permiso (D8): al entrar a una sala online o al tocar "Invitar a un
 * amigo". Muestra la pantalla previa solo si nunca se mostro y el sistema todavia no pregunto.
 */
export function maybeAskForPush() {
  if (!pushAvailable() || storage.get(ASKED_KEY)) return;
  void getPushPermission().then((p) => {
    if (p === 'prompt') usePushPrompt.setState({ open: true });
  });
}

// ── Registro, canal y toque en la notificacion ──

/** Solo enlaces internos de la app ("/online/abc"), nunca otro sitio. */
const safeLink = (link: unknown): string | null =>
  typeof link === 'string' && link.startsWith('/') && !link.startsWith('//') ? link : null;

/**
 * Se monta una vez dentro del router. Con sesion iniciada y el permiso dado, registra el dispositivo
 * (tambien al volver a abrir la app, para mantener el token al dia). Tocar una notificacion abre la
 * pantalla de su `link` (D10).
 */
export function useNativePush(authToken: string | null) {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const authRef = useRef(authToken);
  authRef.current = authToken;

  useEffect(() => {
    if (!pushAvailable()) return;

    // Canal de Android (8+): el servidor manda todo por "roamle".
    if (nativePlatform() === 'android') {
      void PushNotifications.createChannel({
        id: 'roamle',
        name: i18n.t('profile.notifications.channelName'),
        description: i18n.t('profile.notifications.channelDescription'),
        importance: 4,
        visibility: 1,
        vibration: true,
      }).catch(() => {});
    }

    const handles = [
      PushNotifications.addListener('registration', ({ value }) => {
        if (!authRef.current) return;
        void (async () => {
          const { version } = await App.getInfo();
          await api.registerDevice({ token: value, platform: nativePlatform() === 'ios' ? 'IOS' : 'ANDROID', appVersion: version });
          storage.set(TOKEN_KEY, value);
        })().catch(() => {});
      }),
      PushNotifications.addListener('pushNotificationActionPerformed', ({ notification }) => {
        const link = safeLink(notification.data?.link);
        if (link) navigateRef.current(link);
      }),
    ];
    return () => {
      for (const h of handles) void h.then((x) => x.remove());
    };
  }, []);

  // Con sesion y permiso: registrar (al iniciar sesion y cada vez que se abre la app).
  useEffect(() => {
    if (!pushAvailable() || !authToken) return;
    const sync = () =>
      void getPushPermission()
        .then((p) => (p === 'granted' ? PushNotifications.register() : undefined))
        .catch(() => {});
    sync();
    const resume = App.addListener('resume', sync);
    return () => void resume.then((h) => h.remove());
  }, [authToken]);
}
