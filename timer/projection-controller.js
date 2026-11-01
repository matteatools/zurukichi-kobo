// Projection mirrors the teacher's rendered SVG. It never runs a second clock or sound engine.
const button=document.getElementById('openProjection');
const note=document.getElementById('projectionNote');
let projection=null;
export function snapshot(output){return{type:'zurukichi-frame',theme:output.getAttribute('data-theme')==='light'?'light':'dark',svg:output.innerHTML,color:output.style.color,label:output.getAttribute('aria-label')||'タイマー'};}
function publish(){
 if(!projection)return;
 if(projection.closed){projection=null;button.textContent='投影画面を開く';note.textContent='PCの表示を「拡張」にして、開いた画面を投影先へ移動してください。';return;}
 projection.postMessage(snapshot(document.getElementById('time')),location.origin);
}
button.addEventListener('click',()=>{
 if(projection&&!projection.closed){projection.focus();publish();return;}
 projection=window.open(new URL('projection.html',location.href).href,'_blank','popup,width=1100,height=700');
 if(!projection){note.textContent='投影画面を開けませんでした。このサイトのポップアップを許可して、もう一度押してください。';return;}
 button.textContent='投影画面を表示';
 note.textContent='開いた画面を投影先へ移動してください。操作側は開いたまま使います。';
 publish();
});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.source===projection&&event.data?.type==='zurukichi-ready')publish();});
window.addEventListener('pagehide',()=>{if(projection&&!projection.closed)projection.postMessage({type:'zurukichi-disconnected'},location.origin);});
setInterval(publish,100);
