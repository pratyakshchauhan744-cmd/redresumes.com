import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import sitemap from 'vite-plugin-sitemap';

const prerenderRoutes = [
  '/',
  '/templates',
  '/builder',
  '/pricing',
  '/examples',
  '/job-finder',
  '/blog',
  '/contact',
  '/privacy',
  '/terms',
  '/login',
];
const sitemapRoutes = prerenderRoutes.filter((route) => route !== '/');

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  const siteUrl = (env.VITE_SITE_URL || 'https://redresumes.com').replace(/\/+$/, '');

  return {
    plugins: [
      react(),
      tailwindcss(),
      sitemap({
        hostname: siteUrl,
        dynamicRoutes: sitemapRoutes,
        generateRobotsTxt: true,
      }),
    ],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
