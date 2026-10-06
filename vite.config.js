import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';
import { createNasaHandler, createNasaService } from './server/nasa.js';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'NASA_');
  const handler = createNasaHandler(createNasaService({ apiKey: () => process.env.NASA_API_KEY || env.NASA_API_KEY || 'DEMO_KEY' }));
  const install = server => {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] === '/api/nasa') return handler(req, res).catch(() => {
        res.statusCode = 503;
        res.end(JSON.stringify({ error: 'NASA feed unavailable.' }));
      });
      next();
    });
  };
  return {
    plugins: [{ name: 'nasa-feeds', configureServer: install, configurePreviewServer: install }],
    build: {
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          infographic: resolve(__dirname, 'infographic.html'),
        },
      },
    },
  };
});
