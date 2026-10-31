import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const validId = (id) => typeof id === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/.test(id);
export function validRelative(file) {
  return typeof file === 'string' && file.length < 512 && !/[\\\x00-\x1f]/.test(file)
    && file.split('/').every((part) => part && part !== '.' && part !== '..' && !part.startsWith('.'));
}
export async function checksum(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function containedFile(root, relative) {
  if (!validRelative(relative)) throw new Error('Invalid resource path');
  const base = await realpath(root);
  let candidate = base;
  for (const component of relative.split('/')) {
    candidate = path.join(candidate, component);
    if ((await lstat(candidate)).isSymbolicLink()) throw new Error('Symbolic links are not published');
  }
  const resolved = await realpath(candidate);
  if (!resolved.startsWith(base + path.sep) || !(await stat(resolved)).isFile()) throw new Error('Resource outside release');
  return resolved;
}
export async function readRelease(root, id, { hashes = false } = {}) {
  if (!validId(id)) throw new Error('Invalid build id');
  const directory = path.resolve(root, id);
  if ((await lstat(directory)).isSymbolicLink()) throw new Error('Release cannot be a symbolic link');
  const manifestFile = await containedFile(directory, 'build-manifest.json');
  if ((await stat(manifestFile)).size > 2 * 1024 * 1024) throw new Error('Manifest too large');
  const manifest = JSON.parse(await readFile(manifestFile, 'utf8'));
  if (manifest.schema !== 1 || manifest.build_id !== id || !validRelative(manifest.entry)
      || typeof manifest.threads !== 'boolean' || manifest.pwa_enabled !== false
      || !Array.isArray(manifest.files) || manifest.files.length > 10000) throw new Error('Invalid build manifest');
  const files = new Map();
  for (const file of manifest.files) {
    if (!validRelative(file.path) || files.has(file.path) || file.path === 'build-manifest.json'
      || !Number.isSafeInteger(file.bytes) || file.bytes < 0 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid file entry');
    const filename = await containedFile(directory, file.path);
    if ((await stat(filename)).size !== file.bytes) throw new Error(`File size mismatch: ${file.path}`);
    if (hashes && await checksum(filename) !== file.sha256) throw new Error(`Hash mismatch: ${file.path}`);
    files.set(file.path, file);
  }
  if (!files.has(manifest.entry) || !manifest.entry.endsWith('.html')
      || ![...files.keys()].some((name) => name.endsWith('.wasm'))
      || ![...files.keys()].some((name) => name.endsWith('.pck'))
      || ![...files.keys()].some((name) => name.endsWith('.js'))) throw new Error('Incomplete Godot export');
  return { directory, manifest, files };
}
export async function currentRelease(root, pointer) {
  const current = JSON.parse(await readFile(pointer, 'utf8'));
  return readRelease(root, current.build_id);
}
