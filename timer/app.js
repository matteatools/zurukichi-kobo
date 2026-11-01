import{PALETTE,TEXT_LIMIT,textParts,limitText,noticeText,validatePoints,decodePoints,freshRun,syncRun,advanceRun}from'./milestones.js';
import{adjustRemaining,setWatchRate,setRate,hideDigits,createTimer,tick,start,stop,configure,clamp,formatted,progress,ovalPath,remaining,createWatch,watchElapsed,startWatch,stopWatch,formatMillis}from'./engine.js';
const $=id=>document.getElementById(id);
let timer=createTimer(),watch=createWatch(),mode='countdown',centiseconds=false,lastText='',font='simple';
let hideEnabled=false,hideAfter=1,hideBefore=1,reverse=false,showCircle=true;
let partyCounts=new Set();
const monotonicNow=()=>performance.now();
const POINT_KEY='zurukichi-milestones-v1';let points=[],pointLoadError='';try{points=decodePoints(localStorage.getItem(POINT_KEY));}catch(e){pointLoadError=e.message;}
let runs={countdown:freshRun(),stopwatch:freshRun()},audio=null,audioRequest=0,draftPoints=[],pointSerial=Date.now();
function elapsedFor(which,now=Date.now()){return which==='countdown'?Math.max(0,timer.configured-remaining(timer,now)):watchElapsed(watch,monotonicNow());}
function unlockSound(){try{audio??=new(window.AudioContext||window.webkitAudioContext)();audio.resume();return true;}catch{return false;}}
const SOUND_PATTERNS=[[[880,0,.3]],[[660,0,.15],[880,.2,.25]],[[880,0,.12],[880,.22,.12]],[[1047,0,.18],[784,.23,.3]],[[523,0,.14],[659,.18,.14],[784,.36,.3]]];
function notifySound(ticket=++audioRequest,type=1){if(!audio)return false;if(audio.state!=='running'){audio.resume().then(()=>{if(ticket===audioRequest&&audio.state==='running')notifySound(ticket,type);}).catch(()=>{});return false;}try{const t=audio.currentTime;for(const[f,offset,length]of SOUND_PATTERNS[type-1]||SOUND_PATTERNS[0]){const o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=f;g.gain.setValueAtTime(0,t+offset);g.gain.linearRampToValueAtTime(.10,t+offset+.02);g.gain.exponentialRampToValueAtTime(.001,t+offset+length);o.start(t+offset);o.stop(t+offset+length+.02);}return true;}catch{return false;}}
function partyCountSound(count){
 if(!audio||audio.state!=='running')return false; // Never queue stale counts after an audio unlock.
 try{const t=audio.currentTime,o=audio.createOscillator(),g=audio.createGain();o.connect(g);g.connect(audio.destination);o.frequency.value=880;
 const peak=.025+(10-count)*(.055/9); // Gentle rise, capped below the existing .10 notice tone.
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.13);o.start(t);o.stop(t+.15);return true;}catch{return false;}
}
function updatePartyCount(now){
 if(mode!=='countdown'||font!=='party'||!timer.running)return;
 const count=Math.ceil(remaining(timer,now)/1000);if(count<1||count>10)return;
 const fresh=!partyCounts.has(count);for(let n=count+1;n<=10;n++)partyCounts.add(n);
 if(fresh&&partyCountSound(count))partyCounts.add(count);
}

async function previewSound(type){if(!unlockSound()){$('pointsMessage').textContent='この環境では音を使えません。';return;}try{await audio.resume();$('pointsMessage').textContent=notifySound(undefined,type)?'':'端末の音量・音声設定を確認してください。';}catch{$('pointsMessage').textContent='音を再生できません。';}}

function updateStages(now){const result=advanceRun(runs[mode],points,mode,timer.configured,elapsedFor(mode,now));runs[mode]=result.run;if(result.event){audioRequest++;if(result.event.sound)notifySound(audioRequest,result.event.soundType||1);}$('time').style.color=reverse&&result.run.color==='#ffffff'?'#000000':result.run.color;$('stageLabel').textContent=result.run.label;$('stageLabel').hidden=!result.run.label;$('stageLabel').style.display=result.run.label?'':'none';$('digits').setAttribute('transform',result.run.label?'translate(65,-24) scale(.78)':'');if(result.run.label){const label=$('stageLabel');label.setAttribute('font-size','36');const width=typeof label.getComputedTextLength==='function'?label.getComputedTextLength():textParts(result.run.label).length*36;label.setAttribute('font-size',String(Math.min(36,36*440/Math.max(1,width))));}}

const fields=[$('minutes'),$('seconds')],settings=['minuteMinus','minutePlus','secondMinus','secondPlus'].map($);
// Rounded seven-segment digits are local SVG: no font download or layout shift.
const patterns=['abcdef','bc','abdeg','abcdg','bcfg','acdfg','acdefg','abc','abcdefg','abcdfg'];
const segments={a:[23,0,64,18],b:[92,23,18,53],c:[92,104,18,53],d:[23,162,64,18],e:[0,104,18,53],f:[0,23,18,53],g:[23,81,64,18]};
// Local vector numerals: identical appearance on every device, no external font requests.
const roundGlyphs=[
'M55 22 C29 22 20 43 20 90 S29 158 55 158 S90 137 90 90 S81 22 55 22 Z',
'M30 45 Q47 39 59 22 L59 158 M29 158 H88',
'M22 49 C25 15 88 10 88 51 C88 77 22 113 22 145 Q22 158 35 158 H90',
'M23 32 C64 8 91 27 86 58 Q83 81 53 86 C98 85 103 151 60 158 Q37 163 21 147',
'M74 158 V22 L20 114 H94',
'M87 22 H25 V82 C83 61 103 102 87 136 C73 166 39 164 21 146',
'M87 28 C24 3 14 75 21 126 C27 169 86 170 90 124 C94 81 37 72 22 107',
'M20 22 H90 Q62 79 42 158',
'M55 22 C11 22 12 77 55 87 C106 99 99 158 55 158 C11 158 4 99 55 87 C98 77 99 22 55 22 Z',
'M23 152 C86 177 96 105 89 54 C83 11 24 10 20 56 C16 99 73 108 88 73'
];
// Original angular cut-paper numerals; no external game assets.
const fashionGlyphs=["<g transform=\"translate(9.900000000000006 23.400000000000006) scale(0.82 0.87) rotate(-9 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M35 22 H75 L90 37 V143 L75 158 H35 L20 143 V37 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M35 22 H75 L90 37 V143 L75 158 H35 L20 143 V37 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(14.850000000000001 34.19999999999999) scale(0.73 0.81) rotate(10 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M30 43 L60 22 V158 M30 158 H90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M30 43 L60 22 V158 M30 158 H90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(11 27) scale(0.8 0.85) rotate(-10 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M20 38 L36 22 H74 L90 38 V67 L20 139 V158 H90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M20 38 L36 22 H74 L90 38 V67 L20 139 V158 H90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(12.100000000000001 18) scale(0.78 0.9) rotate(8 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M20 22 H90 V65 L55 90 L90 112 V142 L74 158 H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M20 22 H90 V65 L55 90 L90 112 V142 L74 158 H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(8.800000000000004 32.400000000000006) scale(0.84 0.82) rotate(-8 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M75 158 V22 L20 107 H94\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M75 158 V22 L20 107 H94\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(13.200000000000003 19.80000000000001) scale(0.76 0.89) rotate(10 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M90 22 H20 V85 H75 L90 101 V141 L73 158 H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M90 22 H20 V85 H75 L90 101 V141 L73 158 H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(10.449999999999996 30.599999999999994) scale(0.81 0.83) rotate(-10 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M87 22 H40 L20 45 V140 L38 158 H74 L90 142 V102 L74 85 H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M87 22 H40 L20 45 V140 L38 158 H74 L90 142 V102 L74 85 H20\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(12.649999999999999 18) scale(0.77 0.9) rotate(10 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M20 22 H90 L40 158\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M20 22 H90 L40 158\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(9.350000000000001 28.80000000000001) scale(0.83 0.84) rotate(-7 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M35 22 H75 L90 37 V70 L55 90 L20 70 V37 Z M55 90 L90 110 V142 L75 158 H35 L20 142 V110 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M35 22 H75 L90 37 V70 L55 90 L20 70 V37 Z M55 90 L90 110 V142 L75 158 H35 L20 142 V110 Z\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>","<g transform=\"translate(12.100000000000001 21.599999999999994) scale(0.78 0.88) rotate(9 55 90)\"><svg x=\"-4\" y=\"-3\" width=\"110\" height=\"88\" viewBox=\"0 0 110 88\" overflow=\"hidden\"><path d=\"M23 158 H70 L90 135 V40 L72 22 H36 L20 38 V78 L36 95 H90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg><svg x=\"5\" y=\"92\" width=\"110\" height=\"92\" viewBox=\"0 88 110 92\" overflow=\"hidden\"><path d=\"M23 158 H70 L90 135 V40 L72 22 H36 L20 38 V78 L36 95 H90\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"30\" stroke-linecap=\"square\" stroke-linejoin=\"bevel\"/><path d=\"M 12 91 L 108 68 L 108 79 L 12 103 Z M 80 8 L 100 17 L 89 35 Z\" fill=\"var(--canvas-bg,#000)\"/></svg></g>"];
// Bold original party display strokes, static rainbow colors and white edging.
const partyColors=['#ff5a9e','#59d9ff','#ffe35b','#b69bff','#5dffc2','#ff9b51'];
const partyGlyphs=[
'M40 25 Q22 25 22 48 V132 Q22 155 42 155 H68 Q88 155 88 132 V48 Q88 25 68 25 Z',
'M29 48 L57 25 V155 M30 155 H88',
'M24 42 Q31 22 57 25 Q88 25 88 53 Q88 71 65 91 L24 134 V155 H90',
'M24 26 H85 L59 83 Q91 87 91 120 Q91 156 56 156 H23',
'M70 155 V25 L22 110 H94',
'M88 25 H25 V84 H58 Q91 84 91 119 Q91 154 59 155 H24',
'M83 27 H52 Q22 27 22 65 V126 Q22 156 54 156 Q88 156 88 122 Q88 91 56 91 H24',
'M23 25 H90 L46 155 M42 87 H78',
'M55 25 Q25 25 25 55 Q25 78 55 88 Q88 100 88 123 Q88 155 55 155 Q22 155 22 123 Q22 100 55 88 Q85 78 85 55 Q85 25 55 25 Z',
'M25 153 H58 Q88 153 88 115 V54 Q88 24 56 24 Q22 24 22 58 Q22 89 54 89 H86'
];
function partyGlyph(n,slot){const d=partyGlyphs[n],color=partyColors[slot%partyColors.length],tilt=slot%2?4:-4;return `<g transform="translate(5,5) scale(.90) rotate(${tilt} 55 90)"><path d="${d}" fill="none" stroke="#44234f" stroke-width="40" stroke-linecap="round" stroke-linejoin="round" transform="translate(3,4)"/><path d="${d}" fill="none" stroke="#fff" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/></g>`;}
function glyph(n,slot=0){if(font==='party')return partyGlyph(n,slot);if(font==='simple')return [...patterns[n]].map(k=>{const[x,y,w,h]=segments[k];return`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>`}).join('');if(font==='stylish')return fashionGlyphs[n];return`<path d="${roundGlyphs[n]}" fill="none" stroke="currentColor" stroke-width="${font==='heavy'?30:20}" stroke-linecap="round" stroke-linejoin="round"/>`;}
function draw(text){
if(font==='party'&&mode==='countdown'&&/^\d{1,2}$/.test(text)){
 const chars=[...text],width=chars.length*124-14,scale=1.5;
 $('digits').innerHTML=`<g data-party-count="${text}" transform="translate(${295-width*scale/2},-45) scale(${scale})">${chars.map((n,i)=>`<g transform="translate(${i*124},0)">${partyGlyph(Number(n),i)}</g>`).join('')}</g>`;
}
else if(/^\d{2}:\d{2}$/.test(text))$('digits').innerHTML=[...text].map((n,i)=>i===2?`<circle cx="295" cy="58" r="${font==='heavy'?13:10}"/><circle cx="295" cy="122" r="${font==='heavy'?13:10}"/>`:`<g transform="translate(${[0,137,0,343,480][i]},0)">${glyph(Number(n),i)}</g>`).join('');
else{let x=0,fraction=false,slot=0;const parts=[];for(const ch of text){let width;if(ch===':'){width=36;parts.push(`<g transform="translate(${x},0)"><circle cx="18" cy="58" r="9"/><circle cx="18" cy="122" r="9"/></g>`);}else if(ch==='.'){width=20;parts.push(`<circle cx="${x+10}" cy="160" r="8"/>`);fraction=true;}else{width=fraction?66:110;parts.push(`<g transform="translate(${x},${fraction?72:0}) scale(${fraction?.6:1})">${glyph(Number(ch),slot++)}</g>`);}x+=width+14;}const width=x-14,scale=Math.min(1,590/width);$('digits').innerHTML=`<g transform="translate(${(590-width*scale)/2},${90*(1-scale)}) scale(${scale})">${parts.join('')}</g>`;}
const [whole,cs]=text.split('.'),bits=whole.split(':'),m=bits.length>1?Number(bits[0]):0,s=Number(bits.at(-1));$('time').setAttribute('aria-label',`${mode==='countdown'?'残り':'経過'}${m}分${s}${cs?'.'+cs:''}秒`);
}
function render(){const now=Date.now();timer=tick(timer,now);updateStages(now);updatePartyCount(now);const sw=mode==='stopwatch',running=sw?watch.running:timer.running,ratio=sw||!showCircle?0:progress(timer,now);$('progress').setAttribute('d',ovalPath(ratio));$('progress').setAttribute('opacity',ratio>0?'1':'0');const partyFinal=!sw&&font==='party'&&remaining(timer,now)<=10000;const text=partyFinal?String(Math.ceil(remaining(timer,now)/1000)):sw?formatMillis(watchElapsed(watch,monotonicNow()),centiseconds):centiseconds?formatMillis(remaining(timer,now),true,true):formatted(timer,now);const key=mode+centiseconds+partyFinal+text;if(key!==lastText){draw(text);lastText=key;}fields.forEach(e=>e.disabled=running);settings.forEach(e=>e.disabled=running);$('timeSettings').hidden=sw;$('countdownHide').hidden=sw;$('timeAdjustments').hidden=sw;for(const[id,rate]of[['rateSlow',.9],['rateNormal',1],['rateFast',1.1]])$(id).setAttribute('aria-pressed',String(((sw?watch:timer).rate||1)===rate));const concealed=!sw&&hideDigits(timer,now,hideEnabled,hideAfter,hideBefore,runs.countdown.started);$('digits').style.visibility=concealed?'hidden':'';if(concealed)$('time').setAttribute('aria-label','残り時間は非表示');else if($('digits').wasConcealed)draw(text);$('digits').wasConcealed=concealed;$('hideSettings').hidden=!hideEnabled;$('hideNote').textContent=hideAfter*60000>=timer.configured-hideBefore*60000?'区間がないため、この設定時間では隠しません。':`数字だけ非表示。${showCircle?'楕円・':''}お知らせは残ります。`;$('start').disabled=running||(!sw&&timer.configured===0);$('stop').disabled=!running;$('resetWatch').hidden=!sw;for(const[id,value]of[['countdownMode','countdown'],['stopwatchMode','stopwatch']]){$(id).disabled=running;$(id).setAttribute('aria-pressed',String(mode===value));}}
function edit(){if(mode!=='countdown'||timer.running)return;const m=clamp($('minutes').value,99),s=clamp($('seconds').value,59);$('minutes').value=m;$('seconds').value=s;audioRequest++;timer=configure(timer,m,s);runs.countdown=freshRun();partyCounts.clear();render();}
fields.forEach(e=>{e.addEventListener('change',edit);e.addEventListener('keydown',ev=>{if(ev.key==='Enter'){e.blur();edit();}});});
for(const [id,field,delta,max]of[['minuteMinus','minutes',-1,99],['minutePlus','minutes',1,99],['secondMinus','seconds',-1,59],['secondPlus','seconds',1,59]])$(id).addEventListener('click',()=>{if(timer.running)return;$(field).value=clamp(Number($(field).value)+delta,max);edit();});
$('start').addEventListener('click',()=>{if(points.some(p=>p.sound)||(mode==='countdown'&&font==='party'))unlockSound();if(mode==='countdown'&&remaining(timer,Date.now())<=0){runs.countdown=freshRun();partyCounts.clear();}runs[mode].started=true;if(mode==='stopwatch')watch=startWatch(watch,monotonicNow());else timer=start(timer,Date.now());render();});$('stop').addEventListener('click',()=>{if(mode==='stopwatch')watch=stopWatch(watch,monotonicNow());else timer=stop(timer,Date.now());render();});
document.addEventListener('visibilitychange',render);window.addEventListener('pageshow',render);setInterval(render,16);render();

const menu=$('fontMenu'),menuButton=$('menuButton'),choices=[...document.querySelectorAll('[data-font]')];
function closeMenu(restoreFocus=true){menu.hidden=true;menuButton.setAttribute('aria-expanded','false');if(restoreFocus)menuButton.focus();}
menuButton.addEventListener('click',()=>{if(!menu.hidden){closeMenu();return;}menu.hidden=false;menuButton.setAttribute('aria-expanded','true');menu.scrollTop=0;$('closeMenu').focus({preventScroll:true});});
$('closeMenu').addEventListener('click',()=>closeMenu());
choices.forEach(b=>b.addEventListener('click',()=>{font=b.dataset.font;if(font==='party'&&mode==='countdown')unlockSound();choices.forEach(c=>c.setAttribute('aria-pressed',String(c===b)));lastText='';render();closeMenu();}));
document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target)&&!menuButton.contains(e.target))closeMenu(false);});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){e.preventDefault();closeMenu();}});

function switchMode(next){if((mode==='stopwatch'?watch:timer).running)return;audioRequest++;mode=next;runs[mode].label='';lastText='';render();closeMenu();}
$('countdownMode').addEventListener('click',()=>switchMode('countdown'));
$('stopwatchMode').addEventListener('click',()=>switchMode('stopwatch'));
$('centiseconds').addEventListener('change',()=>{centiseconds=$('centiseconds').checked;lastText='';render();});
$('resetWatch').addEventListener('click',()=>{audioRequest++;watch={...createWatch(),...(watch.rate?{rate:watch.rate}:{})};runs.stopwatch=freshRun();lastText='';render();closeMenu();});

function pointElement(tag,text){const el=document.createElement(tag);if(text)el.textContent=text;return el;}
function pointLabel(text,control){const label=pointElement('label',text);label.append(control);return label;}
function renderPointRows(){
 const box=$('pointRows');box.replaceChildren();
 draftPoints.forEach((p,i)=>{
  const row=pointElement('section');row.className='point-row';
  const header=pointElement('div');header.className='point-head';header.append(pointElement('span',`${i+1}`));
  const del=pointElement('button','×');del.type='button';del.className='point-remove';del.setAttribute('aria-label',`${i+1}番目のお知らせを削除`);del.onclick=()=>{draftPoints.splice(i,1);renderPointRows();};header.append(del);row.append(header);
  const time=pointElement('div');time.className='point-time';
  const basis=pointElement('select');basis.setAttribute('aria-label',`${i+1}番目のタイミング`);
  for(const[v,t]of[['elapsed','スタートから'],['remaining','ゴールから']]){const opt=pointElement('option',t);opt.value=v;basis.append(opt);}basis.value=p.basis;basis.onchange=()=>{p.basis=basis.value;renderPointRows();};
  const mins=pointElement('input');mins.type='number';mins.min=0;mins.max=999;mins.step=1;mins.inputMode='numeric';mins.value=Math.floor(p.seconds/60);mins.setAttribute('aria-label',`${i+1}番目の分`);
  const remainder=p.seconds%60;
  mins.oninput=()=>{const m=Number(mins.value);p.seconds=mins.value!==''&&Number.isInteger(m)&&m>=0&&m<=999?m*60+(Number.isFinite(remainder)?remainder:0):NaN;};
  time.append(basis,mins,pointElement('span','分'));
  if(remainder){const secs=pointElement('input');secs.type='number';secs.min=0;secs.max=59;secs.step=1;secs.value=remainder;secs.setAttribute('aria-label',`${i+1}番目の秒`);secs.oninput=()=>{const m=Number(mins.value),v=Number(secs.value);p.seconds=mins.value!==''&&secs.value!==''&&Number.isInteger(m)&&m>=0&&m<=999&&Number.isInteger(v)&&v>=0&&v<=59?m*60+v:NaN;};mins.oninput=secs.oninput;time.append(secs,pointElement('span','秒'));}
  time.append(pointElement('span',p.basis==='elapsed'?'後':'前'));row.append(time);
  const colorLine=pointElement('div');colorLine.className='point-option';const colorCheck=pointElement('input');colorCheck.type='checkbox';colorCheck.checked=p.colorEnabled!==false;colorCheck.setAttribute('aria-label',`${i+1}番目の色を変える`);colorCheck.onchange=()=>{p.colorEnabled=colorCheck.checked;renderPointRows();};colorLine.append(pointLabel('色',colorCheck));
  if(p.colorEnabled!==false){const swatches=pointElement('div');swatches.className='color-swatches';PALETTE.forEach((v,j)=>{const b=pointElement('button');b.type='button';b.className='color-swatch';b.style.backgroundColor=v;b.setAttribute('aria-label',['赤','橙','黄','緑','青','紫','白','ピンク'][j]);b.setAttribute('aria-pressed',String(p.color===v));b.onclick=()=>{p.color=v;renderPointRows();};swatches.append(b);});colorLine.append(swatches);}row.append(colorLine);
  const soundLine=pointElement('div');soundLine.className='point-option';const sound=pointElement('input');sound.type='checkbox';sound.checked=p.sound;sound.setAttribute('aria-label',`${i+1}番目の音を鳴らす`);sound.onchange=()=>{p.sound=sound.checked;renderPointRows();};soundLine.append(pointLabel('音',sound));
  if(p.sound){const choice=pointElement('select');choice.setAttribute('aria-label',`${i+1}番目の音の種類`);for(let n=1;n<=5;n++){const opt=pointElement('option',`音${n}`);opt.value=String(n);choice.append(opt);}choice.value=String(p.soundType||1);choice.onchange=()=>p.soundType=Number(choice.value);soundLine.append(choice);const play=pointElement('button','▶');play.type='button';play.setAttribute('aria-label',`${i+1}番目の音を試す`);play.onclick=()=>previewSound(p.soundType||1);soundLine.append(play);}row.append(soundLine);
  const textLine=pointElement('div');textLine.className='point-option';const textCheck=pointElement('input');textCheck.type='checkbox';textCheck.checked=p.textEnabled!==false&&Boolean(p.textEnabled||noticeText(p));textCheck.setAttribute('aria-label',`${i+1}番目の文字を表示`);textCheck.onchange=()=>{p.textEnabled=textCheck.checked;if(p.text===undefined)p.text=limitText(p.name);renderPointRows();};textLine.append(pointLabel('文字',textCheck));
  if(textCheck.checked){const wrap=pointElement('div');wrap.className='notice-input';const input=pointElement('input');input.type='text';input.value=limitText(p.text??p.name);input.placeholder='あと5分';input.setAttribute('aria-label',`${i+1}番目の文字（12文字まで）`);const count=pointElement('span',`${textParts(input.value).length}/${TEXT_LIMIT}`);const saveText=()=>{if(input.composing)return;input.value=limitText(input.value);p.text=input.value;count.textContent=`${textParts(input.value).length}/${TEXT_LIMIT}`;};input.oncompositionstart=()=>input.composing=true;input.oncompositionend=()=>{input.composing=false;saveText();};input.oninput=saveText;wrap.append(input,count);textLine.append(wrap);}row.append(textLine);
  if(mode==='stopwatch'&&p.basis==='remaining'){const note=pointElement('span','ゴール前のお知らせはタイマーで使えます。');note.className='point-mode-note';row.append(note);}box.append(row);
 });$('addPoint').disabled=draftPoints.length>=6;
}

function closeStages(){$('stagesDialog').close();menuButton.focus();}
$('openStages').addEventListener('click',()=>{closeMenu(false);draftPoints=points.map(p=>({...p}));$('pointsMessage').textContent=pointLoadError;renderPointRows();$('stagesDialog').showModal();});
$('addPoint').addEventListener('click',()=>{if(draftPoints.length>=6)return;draftPoints.push({id:'p'+(++pointSerial),name:'',basis:'elapsed',seconds:60,color:'#ff6666',colorEnabled:false,sound:false,soundType:1,textEnabled:false,text:''});renderPointRows();});
$('cancelPoints').addEventListener('click',closeStages);
$('stagesDialog').addEventListener('cancel',()=>menuButton.focus());

$('savePoints').addEventListener('click',()=>{try{const next=validatePoints(draftPoints);localStorage.setItem(POINT_KEY,JSON.stringify({version:1,points:next}));audioRequest++;points=next;if(points.some(p=>p.sound))unlockSound();pointLoadError='';for(const m of['countdown','stopwatch'])runs[m]=syncRun(points,m,timer.configured,elapsedFor(m),runs[m].started);render();closeStages();}catch(e){$('pointsMessage').textContent=e.message||'設定を保存できません。';}});

for(const[id,rate]of[['rateSlow',.9],['rateNormal',1],['rateFast',1.1]])$(id).addEventListener('click',()=>{if(mode==='stopwatch')watch=setWatchRate(watch,rate,monotonicNow());else timer=setRate(timer,rate,Date.now());render();});
$('hideEnabled').addEventListener('change',()=>{hideEnabled=$('hideEnabled').checked;render();});
for(const id of ['hideAfter','hideBefore'])$(id).addEventListener('change',()=>{const value=clamp($(id).value,99);$(id).value=value;if(id==='hideAfter')hideAfter=value;else hideBefore=value;render();});

for(const[unit,seconds]of[['10s',10],['30s',30],['1m',60],['3m',180],['5m',300]])for(const[sign,direction]of[['add',1],['subtract',-1]])$(sign+unit).addEventListener('click',()=>{
 if(mode!=='countdown')return;
 timer=adjustRemaining(timer,seconds*direction,Date.now());
 const total=Math.ceil(timer.configured/1000);$('minutes').value=Math.floor(total/60);$('seconds').value=total%60;
 render();
});

$('reverseColors').addEventListener('click',()=>{
 reverse=!reverse;const theme=reverse?'light':'dark';
 document.documentElement.setAttribute('data-theme',theme);$('time').setAttribute('data-theme',theme);
 $('reverseColors').setAttribute('aria-pressed',String(reverse));render();
});

$('showCircle').addEventListener('change',()=>{showCircle=$('showCircle').checked;render();});
