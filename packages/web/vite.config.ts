import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Vite does not read PORT on its own. Honouring it lets a supervising process (CI, a
// preview harness) assign a free port instead of Vite silently falling back to 5174
// when its default is taken.
const port = process.env.PORT ? Number(process.env.PORT) : undefined;

export default defineConfig({
  plugins: [react()],
  ...(port ? { server: { port, strictPort: true } } : {}),
});
