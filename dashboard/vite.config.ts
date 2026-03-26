import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@constants': path.resolve(__dirname, 'src/constants'),
      '@lib': path.resolve(__dirname, 'src/lib'),
      '@store': path.resolve(__dirname, 'src/store'),
      // Node.js polyfills for plotly.js → ndarray → typedarray-pool
      buffer: 'buffer/',
    },
  },
  build: {
    outDir: 'build',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — cached forever
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Heavy chart libs — loaded on demand
          'vendor-charts': ['recharts', 'plotly.js', 'react-plotly.js', 'd3'],
          // MUI — loaded when dashboard renders
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // Utility libs
          'vendor-utils': ['date-fns', 'xlsx', 'jspdf', 'html2canvas', 'zustand'],
        },
      },
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
