import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Single-file builds disable code-splitting and the service worker because the
// inlined entry cannot import chunks that do not exist next to the HTML file.
const isSingleFile = ['build:single', 'build:local-test', 'build:review-copy'].includes(process.env.npm_lifecycle_event || '');

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      ...(isSingleFile ? [{
        // No service worker in the single-file build: give main.tsx a no-op register function.
        name: 'om-stub-pwa-register',
        resolveId(id: string) {
          return id === 'virtual:pwa-register' ? '\0om-pwa-register-stub' : null;
        },
        load(id: string) {
          return id === '\0om-pwa-register-stub' ? 'export const registerSW = () => () => {};' : null;
        },
      }] : [VitePWA({
        // Never replace an active app session without the user choosing to reload.
        registerType: 'prompt',
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',
        includeAssets: [],
        manifest: false,
        injectManifest: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
          globIgnores: ['**/om-lifeos-complete.html', '**/vendor-firebase-*.js'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          rollupFormat: 'es',
        },
        integration: {
          configureCustomSWViteBuild(inlineConfig) {
            const output = inlineConfig.build?.rollupOptions?.output;
            if (!output || Array.isArray(output)) return;
            const workerOutput = output as typeof output & {
              inlineDynamicImports?: boolean;
              codeSplitting?: boolean;
            };
            delete workerOutput.inlineDynamicImports;
            workerOutput.codeSplitting = false;
          },
        },
        devOptions: {
          enabled: false,
        },
      })]),
    ],
    resolve: {
      alias: {
        '@': rootDir,
      },
    },
    build: {
      target: 'es2020', // broad device support (iOS 14+, Chrome 80+, Firefox 80+); 'esnext' can white-screen older phones
      minify: 'terser' as const,
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true,
          passes: 2,
        },
        format: {
          comments: false,
        },
      },
      cssCodeSplit: true,
      reportCompressedSize: false,
      sourcemap: false,
      // Single-file exports intentionally bundle every lazy feature together;
      // keep the normal per-chunk warning threshold for code-split builds.
      chunkSizeWarningLimit: isSingleFile ? 3000 : 1000,
      modulePreload: isSingleFile ? (false as const) : undefined,
      rollupOptions: {
        output: {
          ...(isSingleFile ? { codeSplitting: false } : {}),
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          manualChunks: isSingleFile ? undefined : (id: string) => {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) {
                return 'vendor-icons';
              }
              if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) {
                return 'vendor-react';
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase';
              }
            }
            if (id.includes('nepaliDate')) {
              return 'feature-date';
            }
            if (id.includes('exportHtml')) {
              return 'feature-export';
            }
          },
        },
      },
    },
    clearScreen: false,
    server: {
      port: 3000,
      strictPort: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    envPrefix: ['VITE_'],
  };
});
