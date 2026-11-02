import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createApp } from '../../web-host/server.mjs';
import { readRelease } from '../../web-host/lib/releases.mjs';
const scratch = await mkdtemp(join(tmpdir(), 'brushline-host-'));
const releases = join(scratch, 'releases'), pointer = join(scratch, 'state/current.json'), site = join(scratch, 'site');
await mkdir(releases); await mkdir(site); await writeFile(join(site, 'index.html'), '<h1>landing</h1>');
const source = Buffer.from('0123456789-browser-fixture');
async function fixture(id, threads = false) {
  const directory = join(releases, id); await mkdir(directory);
  const entries = new Map([['index.html', Buffer.from('<canvas></canvas>')], ['index.wasm', source], ['index.js', source], ['index.pck', source], ['index.wasm.gz', gzipSync(source)], ['index.wasm.br', brotliCompressSync(source)]]);
  const files = [];
  for (const [name, bytes] of entries) { await writeFile(join(directory, name), bytes); files.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}); }
  await writeFile(join(directory,'build-manifest.json'), JSON.stringify({schema:1,build_id:id,entry:'index.html',threads,pwa_enabled:false,files}));
}
function activate(id) {
  return spawnSync(process.execPath, [fileURLToPath(new URL('./activate.mjs',import.meta.url)), id], {env:{...process.env,GAME_RELEASE_ROOT:releases,CURRENT_MANIFEST:pointer},encoding:'utf8'});
}
const server = createApp({site,releases,pointer}).listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
const port=server.address().port;
function request(path,headers={},method='GET') { return new Promise((resolve,reject)=>{const req=http.request({host:'127.0.0.1',port,path,headers,method},res=>{const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks)}));});req.on('error',reject);req.end();}); }
let checks=0;
function equal(actual,expected){assert.deepEqual(actual,expected);checks++;}
try {
  equal((await request('/healthz')).status,200); equal((await request('/readyz')).status,503); equal((await request('/play/')).status,503);
  await fixture('one'); await fixture('two',true); equal(activate('one').status,0);
  equal((await request('/')).headers.location,'/play/one/'); equal((await request('/')).headers['cache-control'],'no-store');
  equal((await request('/readyz')).status,200); equal(JSON.parse((await request('/readyz')).body).game_verified,false);
  equal((await request('/play/')).headers.location,'/play/one/'); equal((await request('/play/one')).headers.location,'/play/one/');
  equal((await request('/play/one/')).headers['cache-control'],'no-cache');
  const wasm=await request('/play/one/index.wasm'); equal(wasm.headers['content-type'],'application/wasm');equal(wasm.body,source);equal(wasm.headers['cross-origin-embedder-policy'],undefined);
  equal(wasm.headers['cache-control'],'public, max-age=31536000, immutable');
  for(const [encoding,bytes] of [['gzip',gzipSync(source)],['br',brotliCompressSync(source)]]){const compressed=await request('/play/one/index.wasm',{'Accept-Encoding':encoding});equal(compressed.headers['content-encoding'],encoding);equal(compressed.body,bytes);equal(compressed.headers.vary,'Accept-Encoding');}
  equal((await request('/play/one/index.wasm',{'Accept-Encoding':'br;q=0,gzip;q=0,identity;q=0'})).status,406);
  equal((await request('/play/one/index.wasm',{},'HEAD')).body.length,0);
  const range=await request('/play/one/index.wasm',{Range:'bytes=0-3','Accept-Encoding':'br'});equal(range.status,206);equal(range.body,source.subarray(0,4));equal(range.headers['content-encoding'],undefined);
  equal((await request('/play/one/index.wasm',{Range:'bytes=1000-2000'})).status,416);
  for(const route of ['/play/one/missing.pck','/play/one/%2e%2e/package.json','/play/one/.env','/package.json','/play/one/build-manifest.json'])equal((await request(route)).status,404);
  equal((await request('/.git/config')).status,403); equal((await request('/play/one/%ZZ')).status,400); equal((await request('/healthz',{},'POST')).status,405);
  equal(activate('two').status,0);equal((await request('/play/')).headers.location,'/play/two/');equal((await request('/play/two/index.wasm')).headers['cross-origin-embedder-policy'],'require-corp');equal((await request('/play/one/index.wasm')).status,200);
  equal(activate('one').status,0);equal((await request('/play/')).headers.location,'/play/one/');
  await writeFile(join(releases,'two/index.pck'),Buffer.alloc(source.length,1));equal(activate('two').status,1);equal((await request('/play/')).headers.location,'/play/one/');
  await symlink(join(releases,'one'),join(releases,'linked'));await assert.rejects(readRelease(releases,'linked'));checks++;
  await rm(join(releases,'one/index.pck'));equal((await request('/readyz')).status,503);equal((await request('/play/one/index.wasm')).status,404);
  console.log(`PASS ${checks} hosting checks: readiness, MIME, encoding, range, isolation, path containment, activation and rollback. Fixtures do not validate game rendering.`);
} finally {await new Promise(resolve=>server.close(resolve));await rm(scratch,{recursive:true,force:true});}
