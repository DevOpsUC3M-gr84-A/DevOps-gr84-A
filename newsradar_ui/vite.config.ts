import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/DevOps-gr84-A/' : '/',
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
  ],
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return;
          }

          if (id.includes('react') || id.includes('react-dom')) {
            return 'vendor_react';
          }

          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'vendor_chartjs';
          }

          if (id.includes('lucide-react')) {
            return 'vendor_icons';
          }

          return 'vendor';
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
}))