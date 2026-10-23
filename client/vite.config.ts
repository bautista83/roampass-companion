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
});
