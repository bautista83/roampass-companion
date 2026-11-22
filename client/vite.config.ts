import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Lee el .env de la raiz del proyecto. Vite solo expone al navegador las variables con
  // prefijo VITE_, asi que los secretos del servidor del mismo archivo nunca llegan al bundle.
  envDir: fileURLToPath(new URL('..', import.meta.url)),
  server: { port: 5173 },
  resolve: {
    alias: {
      // Push solo en la app nativa: el SDK web de Firebase no se instala (src/native/firebaseWebStub.ts).
      'firebase/messaging': fileURLToPath(new URL('./src/native/firebaseWebStub.ts', import.meta.url)),
    },
  },
});
