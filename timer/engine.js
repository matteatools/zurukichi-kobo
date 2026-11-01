export function createTimer(seconds=300){return{configured:seconds*1000,remaining:seconds*1000,running:false,deadline:null};}
export function remaining(t,now){return t.running?Math.max(0,t.rateAnchor!=null?t.remaining-(now-t.rateAnchor)*(t.rate||1):t.deadline-now):t.remaining;}
export function tick(t,now){if(t.running&&remaining(t,now)===0)return{...t,running:false,remaining:0,deadline:null};return t;}
export function start(t,now){if(t.running)return t;const ms=t.remaining>0?t.remaining:t.configured;if(ms<=0)return t;return{...t,remaining:ms,running:true,deadline:now+ms/(t.rate||1),...(t.rate?{rateAnchor:now}:{})};}
export function stop(t,now){if(!t.running)return t;return{...t,remaining:remaining(t,now),running:false,deadline:null};}
export function configure(t,minutes,seconds){if(t.running)return t;return {...createTimer(clamp(minutes,99)*60+clamp(seconds,59)),...(t.rate?{rate:t.rate}:{})};}
export function clamp(v,max){return Math.min(max,Math.max(0,Math.trunc(Number(v)||0)));}
export function formatted(t,now){const s=Math.ceil(remaining(t,now)/1000);return`${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}

export function progress(t,now){return t.configured>0?Math.min(1,Math.max(0,remaining(t,now)/t.configured)):0;}

export function ovalPath(ratio){const r=Math.max(0,Math.min(1,ratio));if(r<=0)return '';if(r>=1)return 'M 295 -103 A 393 193 0 1 0 295 283 A 393 193 0 1 0 295 -103';const a=2*Math.PI*r,x=295-393*Math.sin(a),y=90-193*Math.cos(a);return `M 295 -103 A 393 193 0 ${r>.5?1:0} 0 ${x.toFixed(4)} ${y.toFixed(4)}`;}

export function createWatch(){return{elapsed:0,running:false,anchor:null};}
export function watchElapsed(w,now){return w.elapsed+(w.running?Math.max(0,now-w.anchor)*(w.rate||1):0);}
export function startWatch(w,now){return w.running?w:{...w,running:true,anchor:now};}
export function stopWatch(w,now){return w.running?{...w,elapsed:watchElapsed(w,now),running:false,anchor:null}:w;}
export function formatMillis(ms,centiseconds=false,countdown=false){const units=Math.max(0,(countdown?Math.ceil:Math.floor)(ms/(centiseconds?10:1000)));const totalSeconds=centiseconds?Math.floor(units/100):units,m=Math.floor(totalSeconds/60),s=totalSeconds%60;if(!centiseconds)return`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;return`${m?m+':'+String(s).padStart(2,'0'):s}.${String(units%100).padStart(2,'0')}`;}

export function setRate(t,rate,now){if(![.9,1,1.1].includes(rate))return t;const ms=remaining(t,now);return{...t,rate,remaining:ms,rateAnchor:now,deadline:t.running?now+ms/rate:null};}
export function hideDigits(t,now,enabled,after,before,started){const from=after*60000,to=t.configured-before*60000;return Boolean(enabled&&started&&from<to&&t.configured>0&&t.configured-remaining(t,now)>=from&&t.configured-remaining(t,now)<to);}

export function setWatchRate(w,rate,now){if(![.9,1,1.1].includes(rate))return w;return{...w,rate,elapsed:watchElapsed(w,now),anchor:w.running?now:null};}

// Extend/shorten only the remaining part; elapsed time and rate are preserved.
export function adjustRemaining(t,seconds,now){
 if(!Number.isFinite(seconds))return t;
 const current=tick(t,now),left=remaining(current,now),elapsed=Math.max(0,current.configured-left);
 const next=Math.min(Math.max(0,5999000-elapsed),Math.max(0,left+seconds*1000));
 const running=current.running&&next>0;
 return{...current,configured:elapsed+next,remaining:next,running,rate:current.rate||1,rateAnchor:now,deadline:running?now+next/(current.rate||1):null};
}
