const loading=document.querySelector('#landing-load'),bar=loading.querySelector('progress'),phase=document.querySelector('#landing-phase');
let completed=0,failed=false;
function settle(ok){completed++;failed ||= !ok;bar.value=completed;phase.textContent=completed===1?'布置首页画面':'首页准备完成';if(completed===2){if(failed)phase.textContent='部分资源未就绪，可以直接尝试驾驶';else loading.hidden=true;}}
const cover=new Image();cover.onload=async()=>{try{await cover.decode();}catch{}settle(true);};cover.onerror=()=>settle(false);cover.src='/key-art.png';
fetch('/readyz',{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async response=>{await response.json();document.querySelector('#status').textContent=response.ok?'点击开始驾驶，可查看资源下载进度。':'赛道资源正在准备；现在可浏览首页，稍后重试驾驶。';settle(response.ok);}).catch(()=>{document.querySelector('#status').textContent='暂时无法连接赛道，请稍后重试。';settle(false);});
