import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, stat, rename, rm } from 'node:fs/promises';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checksum, readRelease, validId } from '../../web-host/lib/releases.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
process.chdir(root);
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const dirty = !!git('status', '--porcelain');
if (dirty && !process.argv.includes('--allow-dirty')) throw new Error('Commit source first, or use --allow-dirty for a development build.');
const commit = git('rev-parse', 'HEAD');
const version = (await readFile('.godot-version', 'utf8')).trim();
const godot = process.env.GODOT_BIN || 'godot';
const actual = execFileSync(godot, ['--version'], { encoding: 'utf8' }).trim();
if (!actual.startsWith(version + '.stable.')) throw new Error(`Expected Godot ${version}; got ${actual}`);
const id = process.env.BUILD_ID || `${commit.slice(0, 10)}-${new Date().toISOString().replace(/[-:.]/g, '')}${dirty ? '-dev' : ''}`;
if (!validId(id)) throw new Error('Invalid BUILD_ID');
const releases = path.resolve(process.env.GAME_RELEASE_ROOT || 'builds/web');
const staging = path.join(releases, `.staging-${randomUUID()}`);
const output = path.join(staging, id);
await mkdir(output, { recursive: true });
await mkdir('logs', { recursive: true });
// A fresh npm install must never be indexed or packed by Godot.
await mkdir('node_modules', { recursive: true });
await writeFile('node_modules/.gdignore', '');
try {
  for (const [label, args] of [['import', ['--headless', '--editor', '--import']], ['export', ['--headless', '--export-release', 'Web', path.join(output, 'index.html')]]]) {
    console.log(`Godot ${label}…`);
    const result = spawnSync(godot, ['--path', root, ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    const log = (result.stdout || '') + (result.stderr || '');
    await writeFile(`logs/web-${label}.log`, log);
    if (result.error || result.status !== 0 || /SCRIPT ERROR:|Parse Error:|Failed to export|ERROR:/i.test(log)) {
      console.error(log.slice(-10000)); throw new Error(`Godot ${label} failed; see logs/web-${label}.log`);
    }
  }
  for (const name of await readdir(output)) {
    if (!/\.(html|js|wasm|pck)$/.test(name)) continue;
    const data = await readFile(path.join(output, name));
    await writeFile(path.join(output, name + '.gz'), gzipSync(data, { level: 6 }));
    await writeFile(path.join(output, name + '.br'), brotliCompressSync(data, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } }));
  }
  const files = [];
  for (const name of (await readdir(output)).sort()) {
    const filename = path.join(output, name);
    files.push({ path: name, bytes: (await stat(filename)).size, sha256: await checksum(filename) });
  }
  const manifest = { schema: 1, build_id: id, source_commit: commit, source_dirty: dirty, engine: actual,
    built_at: new Date().toISOString(), renderer: 'gl_compatibility', threads: false, pwa_enabled: false,
    entry: 'index.html', validation_status: 'not-run', save_scope: 'browser-origin-indexeddb', files };
  await writeFile(path.join(output, 'build-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  await readRelease(staging, id, { hashes: true });
  await rename(output, path.join(releases, id));
  console.log(`Built ${id}\nActivate: npm run web:activate -- ${id}`);
} finally { await rm(staging, { recursive: true, force: true }); }
