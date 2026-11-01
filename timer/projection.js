// Only the opening same-origin teacher window can supply frames.
const output=document.getElementById('time'),status=document.getElementById('connectionStatus');
let lastFrame=0;
export function isTeacherMessage(event,origin,opener){return Boolean(opener)&&event.origin===origin&&event.source===opener;}
function disconnected(){output.hidden=true;status.hidden=false;status.textContent='操作画面との接続が切れました。操作画面で「投影画面を開く」を押してください。';}
window.addEventListener('message',event=>{
 if(!isTeacherMessage(event,location.origin,window.opener))return;
 const data=event.data;
 if(data?.type==='zurukichi-disconnected'){disconnected();return;}
 if(data?.type!=='zurukichi-frame'||typeof data.svg!=='string')return;
 // SVG is serialized from the trusted teacher output; notice text was inserted with textContent.
 if(output.innerHTML!==data.svg)output.innerHTML=data.svg;
 document.documentElement.setAttribute('data-theme',data.theme==='light'?'light':'dark');
 output.style.color=data.color||'#ffffff';output.setAttribute('aria-label',data.label||'タイマー');
 lastFrame=Date.now();output.hidden=false;status.hidden=true;
});
if(window.opener){window.opener.postMessage({type:'zurukichi-ready'},location.origin);}else disconnected();
setInterval(()=>{if(!window.opener||window.opener.closed||(lastFrame&&Date.now()-lastFrame>5000))disconnected();},1000);
