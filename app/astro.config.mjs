// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind()],
  vite: {
    plugins: [
      nodePolyfills({
        include: ['buffer', 'process', 'util'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            leaflet: ['leaflet', 'react-leaflet', 'react-leaflet-markercluster'],
            charts: ['chart.js', 'react-chartjs-2', 'chartjs-plugin-datalabels'],
            d3: ['d3-scale'],
            utils: ['clsx', 'tailwind-merge', 'date-fns'],
            radix: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-label', '@radix-ui/react-popover', '@radix-ui/react-select', '@radix-ui/react-slot', '@radix-ui/react-tabs', '@radix-ui/react-tooltip'],
            lucide: ['lucide-react'],
            fontawesome: ['@fortawesome/react-fontawesome', '@fortawesome/free-solid-svg-icons'],
            tooltip: ['react-tooltip'],
            swr: ['swr']
          }
        }
      },
      chunkSizeWarningLimit: 1000,
      cssCodeSplit: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          passes: 2
        }
      }
    },
    optimizeDeps: {
      include: ['date-fns', 'clsx', 'tailwind-merge', 'leaflet', 'react-leaflet']
    }
  }
});