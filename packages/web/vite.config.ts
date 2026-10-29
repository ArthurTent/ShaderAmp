import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json';

export default defineConfig({
  plugins: [react()],
  define: {
    __SHADERAMP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    lib: {
      entry: { shaderamp: 'src/index.ts', react: 'src/react/index.tsx' },
      formats: ['es', 'cjs'],
      fileName: (fmt, name) => (fmt === 'es' ? `${name}.js` : `${name}.cjs`),
    },
    rollupOptions: {
      external: ['three', /^three\//, 'react', 'react-dom', 'react/jsx-runtime'],
    },
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2020',
  },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.test.ts'],
  },
});
