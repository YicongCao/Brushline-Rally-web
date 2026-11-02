import express from 'express';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { renderShell } from './lib/shell.mjs';
import { fileURLToPath } from 'node:url';
import { containedFile, currentRelease, readRelease } from './lib/releases.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.wasm': 'application/wasm', '.pck': 'application/octet-stream', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };

export function createApp(options = {}) {
  const site = path.resolve(options.site ?? process.env.SITE_ROOT ?? path.join(projectRoot, 'web-host/site'));
  const releases = path.resolve(options.releases ?? process.env.GAME_RELEASE_ROOT ?? path.join(projectRoot, 'builds/web'));
  const pointer = path.resolve(options.pointer ?? process.env.CURRENT_MANIFEST ?? path.join(projectRoot, 'builds/web-state/current.json'));
  const shell = options.shell ?? process.env.GAME_SHELL;
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin' });
    if (!['GET', 'HEAD'].includes(req.method)) return res.set('Allow', 'GET, HEAD').status(405).end();
    next();
  });
  app.get('/healthz', (_req, res) => res.set('Cache-Control', 'no-store').json({ status: 'ok', service: 'brushline-rally-web' }));
  app.get('/readyz', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try {
      const { manifest } = await currentRelease(releases, pointer);
      res.json({ status: 'ready', build_id: manifest.build_id, threads: manifest.threads, game_verified: manifest.validation_status === 'browser-smoke-passed' });
    } catch { res.status(503).json({ status: 'waiting-for-build' }); }
  });
  app.get('/', async (_req, res) => {
    res.set('Cache-Control', 'no-store');
    try { const {manifest} = await currentRelease(releases, pointer); return res.redirect(302, `/play/${manifest.build_id}/`); }
    catch { return res.status(503).send('试玩资源正在准备，请稍后重试。'); }
  });
  app.use('/play', async (req, res, next) => {
    try {
      if (req.path === '/') {
        res.set('Cache-Control', 'no-store');
        try {
          const release = await currentRelease(releases, pointer);
          return res.redirect(302, `/play/${release.manifest.build_id}/`);
        } catch { return res.status(503).type('html').send('<!doctype html><meta charset="utf-8"><title>正在准备试玩</title><h1>试玩资源正在准备</h1><p>请稍后重试。</p><a href="/">返回首页</a>'); }
      }
      let decoded;
      try { decoded = decodeURIComponent(req.path); } catch { return res.status(400).end(); }
      const [id, ...parts] = decoded.slice(1).split('/');
      let release;
      try { release = await readRelease(releases, id); } catch { return res.status(404).set('Cache-Control', 'no-store').end(); }
      if (!parts.length) return res.set('Cache-Control', 'no-store').redirect(302, `/play/${id}/`);
      const relative = parts.join('/') || release.manifest.entry;
      if (!release.files.has(relative)) return res.status(404).set('Cache-Control', 'no-store').end();
      // Optional hosting-shell updates keep immutable WASM/PCK and saved games intact.
      if (shell && relative === release.manifest.entry && relative.endsWith('.html')) {
        const exported = await readFile(await containedFile(release.directory, relative), 'utf8');
        const template = await readFile(shell, 'utf8');
        if (release.manifest.threads) res.set({ 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
        return res.set('Cache-Control','no-cache').type('html').send(renderShell(template, exported));
      }
      const available = ['br', 'gzip'].filter((encoding) => release.files.has(relative + (encoding === 'br' ? '.br' : '.gz')));
      if (req.headers.range && req.acceptsEncodings('identity')) available.length = 0;
      const encoding = req.acceptsEncodings(...available, 'identity');
      if (!encoding) return res.status(406).set('Cache-Control', 'no-store').end();
      const suffix = encoding === 'br' ? '.br' : encoding === 'gzip' ? '.gz' : '';
      const file = await containedFile(release.directory, relative + suffix);
      const isHtml = relative.endsWith('.html');
      res.set('Cache-Control', isHtml ? 'no-cache' : 'public, max-age=31536000, immutable');
      res.set('Content-Type', mime[path.extname(relative)] ?? 'application/octet-stream');
      res.vary('Accept-Encoding');
      if (suffix) res.set('Content-Encoding', encoding);
      if (release.manifest.threads) res.set({ 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Embedder-Policy': 'require-corp' });
      res.sendFile(file, { cacheControl: false, dotfiles: 'deny', acceptRanges: !suffix }, (error) => error && next(error));
    } catch (error) { next(error); }
  });
  app.use(express.static(site, { dotfiles: 'deny', fallthrough: false, setHeaders(res, file) {
    res.setHeader('Cache-Control', file.endsWith('.html') ? 'no-cache' : 'public, max-age=3600');
  } }));
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    const status = [400, 403, 404, 416].includes(error.status) ? error.status : 500;
    if (status === 500) console.error('Request failed:', error.message);
    res.removeHeader('Content-Encoding');
    res.status(status).set('Cache-Control', 'no-store').type('text').send(status === 404 ? 'Not found' : 'Request failed');
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const host = process.env.HOST || '127.0.0.1';
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid PORT');
  const server = createApp().listen(port, host, () => console.log(`Brushline Rally Web: http://${host}:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
