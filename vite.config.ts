import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three-core': ['three'],
          'three-tools': [
            'three/addons/controls/OrbitControls.js',
            'three/addons/environments/RoomEnvironment.js',
            'three/addons/exporters/STLExporter.js',
            'three/addons/exporters/OBJExporter.js',
          ],
        },
      },
    },
  },
});
