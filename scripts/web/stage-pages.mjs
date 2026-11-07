import { copyFile, cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readRelease } from '../../web-host/lib/releases.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const [buildId, destination = 'builds/pages'] = process.argv.slice(2);
const releases = path.resolve(root, process.env.GAME_RELEASE_ROOT || 'builds/web');
const output = path.resolve(root, destination);
const { directory, manifest, files } = await readRelease(releases, buildId, { hashes: true });
if (manifest.source_dirty || manifest.threads || manifest.renderer !== 'gl_compatibility' || manifest.entry !== 'index.html') {
  throw new Error('Pages requires a clean single-threaded Compatibility build with an index.html entry');
}

const html = await readFile(path.join(directory, manifest.entry), 'utf8');
await mkdir(output);
for (const name of files.keys()) {
  if (name === manifest.entry || name.endsWith('.br') || name.endsWith('.gz')) continue;
  await mkdir(path.dirname(path.join(output, name)), { recursive: true });
  await copyFile(path.join(directory, name), path.join(output, name));
}
// The Node server serves this directory from the domain root. Pages serves it
// next to the Godot files so the same export works under a repository prefix.
await cp(path.join(root, 'web-host/site/loader-art'), path.join(output, 'loader-art'), { recursive: true });
await writeFile(path.join(output, manifest.entry), html.replaceAll('/loader-art/', './loader-art/'));
await writeFile(path.join(output, 'version.json'), JSON.stringify({
  build_id: manifest.build_id,
  source_commit: manifest.source_commit,
}) + '\n');
console.log('Staged GitHub Pages artifact at', output);
