// Reemplaza a 'firebase/messaging' en el build (ver vite.config.ts). La parte web del plugin
// @capacitor-firebase/messaging lo importa, pero en la web Roamle no usa push: asi no hace falta
// instalar ni empaquetar el SDK web de Firebase. Si algo lo llegara a usar, falla con un error claro.

const unsupported = () => {
  throw new Error('Notificaciones push no disponibles en la web');
};

export const isSupported = async () => false;
export const getMessaging = unsupported;
export const getToken = unsupported;
export const deleteToken = unsupported;
export const onMessage = unsupported;
