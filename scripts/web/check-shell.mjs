import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderShell} from '../../web-host/lib/shell.mjs';
import {createApp} from '../../web-host/server.mjs';
import vm from 'node:vm';
const template=await readFile('web-shell/index.html','utf8');
const exported='<script src="index.js"></script>\nconst config={"executable":"index","fileSizes":{"index.wasm":40,"index.pck":60}};';
const rendered=renderShell(template,exported);
assert(!rendered.includes('$GODOT_'));
assert.throws(()=>renderShell(template,'<canvas>'),/Unsupported/);
assert.throws(()=>renderShell(template,exported.replace('index.js','https://untrusted/index.js')),/Unsupported/);
const nodes=new Map();
const node=id=>nodes.get(id)||nodes.set(id,{dataset:{},className:'',textContent:'',hidden:false,value:0,addEventListener(){},removeAttribute(k){delete this[k];},focus(){}}).get(id);
const context={document:{querySelector:node,addEventListener(){},hidden:false,hasFocus:()=>true},window:{},innerWidth:1280,innerHeight:720,addEventListener(){},setInterval(){},clearInterval(){},requestAnimationFrame:f=>f(),Date,console};
vm.createContext(context);
vm.runInContext(rendered.match(/<script>([\s\S]*?)<\/script>/)[1],context);
// Physical pixel sizing and sustained-load hysteresis, including inactive tabs.
context.innerWidth=960;context.innerHeight=720;context.window.devicePixelRatio=1;
vm.runInContext('resize()',context);assert.equal(node('#canvas').width,960);assert.equal(node('#canvas').height,720);
context.innerWidth=1400;context.innerHeight=600;
vm.runInContext('resize()',context);assert.equal(node('#canvas').width,1400);assert.equal(node('#canvas').height,600);
context.innerWidth=1920;context.innerHeight=1080;context.window.devicePixelRatio=2;
vm.runInContext('resize()',context);
assert.equal(node('#canvas').width,1920);assert.equal(node('#canvas').height,1080);
context.innerWidth=960;context.innerHeight=540;
vm.runInContext('resize()',context);assert.equal(node('#canvas').width,1920);
context.innerWidth=3840;context.innerHeight=2160;
vm.runInContext('resize()',context);assert.equal(node('#canvas').width,1920);
context.URLSearchParams=URLSearchParams;context.location={search:''};
for(let i=0;i<6;i++)context.window.brushlineFrameSample(30,40,1920,1080);
assert.equal(node('#canvas').width,1920); // Warm-up plus two slow windows is insufficient.
context.window.brushlineFrameSample(30,40,1920,1080);
assert.equal(node('#canvas').width,1600);assert.equal(node('#canvas').height,900);
for(let i=0;i<14;i++)context.window.brushlineFrameSample(60,17,1600,900);
assert.equal(node('#canvas').width,1920);
context.document.hidden=true;
for(let i=0;i<20;i++)context.window.brushlineFrameSample(1,1000,1920,1080);
assert.equal(node('#canvas').width,1920);context.document.hidden=false;
vm.runInContext('config.onProgress(25,40)',context); // First file total is not the entire download.
assert.equal(node('#progress').value,.25);assert.equal(node('#amount').textContent,'25%');
vm.runInContext('config.onProgress(100,100)',context);
assert.equal(node('#panel').dataset.phase,'engine');assert.equal(node('#progress').value,undefined);
vm.runInContext("runtimeFailure('fixture')",context);
assert.equal(node('#retry').hidden,false);assert.equal(node('#panel').dataset.phase,'error');
vm.runInContext('config.onProgress(100,100)',context);assert.equal(node('#panel').dataset.phase,'error');
const server=createApp({shell:new URL('../../web-shell/index.html',import.meta.url).pathname}).listen(0,'127.0.0.1');
await new Promise(r=>server.once('listening',r));
try{
 const response=await fetch(`http://127.0.0.1:${server.address().port}/play/`);
 assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-cache');
 assert((await response.text()).includes('赛前准备'));
}finally{server.close();}
console.log('PASS shell rendering, fixed byte denominator, engine phase, late progress after failure, HTTP integration');
