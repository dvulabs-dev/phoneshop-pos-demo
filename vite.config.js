import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' => the built `dist` folder works on any static host (Netlify, Vercel, GitHub Pages, S3, ...)
export default defineConfig({ base: './', plugins: [react()] });
