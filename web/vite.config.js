import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cursor / macOS periodically touch source-file metadata (ctime / xattr) without
// changing their contents. Vite's watcher treats those touches as edits and fires
// phantom HMR updates or full reloads, which occasionally serve a half-updated
// module and blank the page. This plugin cancels any hot update whose file content
// is byte-for-byte identical to what we last served.
const skipUnchangedHmr = () => {
  const hashes = new Map();

  const digest = (file) => {
    try {
      return createHash('sha1').update(readFileSync(file)).digest('hex');
    } catch {
      return '';
    }
  };

  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else hashes.set(full, digest(full));
    }
  };

  return {
    name: 'skip-unchanged-hmr',
    configureServer(server) {
      // Seed hashes so the first phantom touch after startup is also caught.
      try {
        walk(path.resolve(server.config.root, 'src'));
      } catch {
        /* ignore */
      }
      // tsconfig touches force a full page reload; stop watching it entirely.
      server.watcher.unwatch(path.resolve(server.config.root, 'tsconfig.json'));
    },
    async handleHotUpdate(ctx) {
      const next = await ctx
        .read()
        .then((body) => createHash('sha1').update(body).digest('hex'))
        .catch(() => digest(ctx.file));
      const prev = hashes.get(ctx.file);
      hashes.set(ctx.file, next);
      // Same bytes as before => metadata-only touch, cancel the update.
      if (prev && next && prev === next) return [];
      return undefined;
    },
  };
};

export default defineConfig({
  plugins: [react(), skipUnchangedHmr()],
  server: {
    port: 5173,
    strictPort: true,
    host: '127.0.0.1',
    hmr: {
      host: '127.0.0.1',
      port: 5173,
      protocol: 'ws',
    },
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/tsconfig*.json', '**/vite.config.*'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        timeout: 720_000,
        proxyTimeout: 720_000,
      },
    },
  },
});
