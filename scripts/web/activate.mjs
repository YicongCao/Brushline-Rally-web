import { mkdir, open, rename, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { readRelease } from '../../web-host/lib/releases.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const id = process.argv[2];
if (!id) throw new Error('Usage: npm run web:activate -- <build-id>');
const releases = process.env.GAME_RELEASE_ROOT || path.join(root, 'builds/web');
const pointer = process.env.CURRENT_MANIFEST || path.join(root, 'builds/web-state/current.json');
await readRelease(releases, id, { hashes: true });
await mkdir(path.dirname(pointer), { recursive: true });
const temporary = `${pointer}.${randomUUID()}.tmp`;
try {
  const file = await open(temporary, 'wx', 0o600);
  try { await file.writeFile(JSON.stringify({ build_id: id, activated_at: new Date().toISOString() }) + '\n'); await file.sync(); }
  finally { await file.close(); }
  await rename(temporary, pointer);
} finally { await unlink(temporary).catch(() => {}); }
console.log(`Activated ${id}. Previous releases remain available for rollback.`);
