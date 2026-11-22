'use strict';
(()=>{
const $=id=>document.getElementById(id),M=window.SattoSample,NS='http://www.w3.org/2000/svg',launchKey='satto-sample-launch-v1',draftKey='satto-sample-draft-v1';
const say=s=>{$('status').textContent=s;};
const clamp=(v,lo,hi)=>Math.min(Math.max(lo,v),Math.max(lo,hi));
const node=(tag,attributes={},text)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attributes))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
const safeTags=new Set(['svg','g','rect','line','text','tspan','path','circle','ellipse']);
let paper, savedItems=[];
try {
  const launch=sessionStorage.getItem(launchKey);
  if(launch){paper=JSON.parse(launch);sessionStorage.removeItem(launchKey);sessionStorage.removeItem(draftKey);}
  else {const saved=JSON.parse(sessionStorage.getItem(draftKey)||'null');paper=saved?.paper;savedItems=saved?.items||[];}
} catch{}
try{window.opener=null;}catch{}
if(!paper||!(paper.w>=150&&paper.w<=400&&paper.h>=150&&paper.h<=400)||!Array.isArray(paper.regions)||typeof paper.svg!=='string'){
  $('empty').hidden=false;return;
}
// Drafts from before v23 did not store this property on their regions.
if(/^原稿用紙/.test(paper.title))paper.regions.forEach(r=>r.manuscript=true);
const {w,h}=paper,fields=Array.isArray(paper.fields)?paper.fields:[];
const shapeTools=new Set(['line','rect','ellipse','ink']);
const fieldModes=new Set(['ruby','date','body']);
const hasField={ruby:fields.some(r=>r.kind==='ruby'),date:fields.some(r=>r.kind==='contactV'||r.kind==='contactH'),body:fields.some(r=>r.kind==='contactV')};
const today=new Date();
$('fieldDate').value=[today.getFullYear(),today.getMonth()+1,today.getDate()].map((v,i)=>i?String(v).padStart(2,'0'):v).join('-');
const parsed=new DOMParser().parseFromString(paper.svg,'image/svg+xml');
if(parsed.documentElement.localName!=='svg'){$('empty').hidden=false;return;}
const svg=document.importNode(parsed.documentElement,true);
for(const elem of [svg,...svg.querySelectorAll('*')]){
  if(!safeTags.has(elem.localName)||elem.namespaceURI!==NS){elem.remove();continue;}
  for(const a of [...elem.attributes])if(a.localName==='href'||/^on/i.test(a.name)||a.name==='style'||/url\(/i.test(a.value))elem.removeAttributeNode(a);
}
svg.setAttribute('aria-label','ノートの編集用プレビュー');
const layer=node('g',{'data-edit-layer':''}),selection=node('g',{class:'selection'});const eraseCursor=node('circle',{fill:'none',stroke:'#2671a0','stroke-width':'.45','stroke-dasharray':'1.2 .8','pointer-events':'none','data-erase-guide':'',visibility:'hidden'});svg.append(layer,selection,eraseCursor);$('canvas').append(svg);
$('sampleTitle').textContent=paper.title+' ｜ 選んだ用紙を背景に編集できます。';
$('samplePrint').textContent=`@page{size:${w}mm ${h}mm;margin:0}`;
$('editor').hidden=false;
const allowedImages=new Set(['image/png','image/jpeg','image/webp','image/gif']);
let items=Array.isArray(savedItems)?savedItems:[],past=[],future=[],selected=null,tool='text',drag=null,tap=null,pending=null,dirty=false,anglePreview=null,moveByTap=false,eraseMode='ink';
const nextId=()=>crypto.randomUUID?.()||String(Math.random()).slice(2);
function persist(){
  try{sessionStorage.setItem(draftKey,JSON.stringify({paper,items}));dirty=false;}
  catch{dirty=true;say('画像が多いため、このタブの一時保存枠を超えました。閉じる前にPNGか印刷で保存してください。');}
}
function commit(newItems){
  anglePreview=null;past.push(items);if(past.length>35)past.shift();future=[];items=newItems;render();persist();
}
function replay(from,to){
  if(!from.length)return;
  anglePreview=null;moveByTap=false;drag=null;tap=null;to.push(items);items=from.pop();selected=null;sync();render();persist();
}
function info(){
  return {
    text:'文字を入力し、用紙の置きたい場所をタップ。対応するマス内なら1文字ずつ入ります。',
    ruby:'よみがなを入力し、大きな漢字マスをタップ。右側の細い欄に入ります。',
    date:'日付を選び、書きたい日の月・日・曜日の欄をタップします。',
    body:'れんらくの内容を書き、用紙の本文欄をタップ。選んだ列に縦書きで入ります。',
    pan:'用紙には書き込まず、スクロールできます。',
    select:'文字をドラッグするか、選んで「タップで移動」。用紙をスクロールするときは「スクロール」を選びます。',
    erase:eraseMode==='ink'?'ペンの線や図形の輪郭で、消したい部分だけをなぞります。':'消したい文字をクリック・タップすると、ひとまとまりずつ消せます。',
    ink:'用紙の上をマウス・指・ペンでなぞると、自由に線を描けます。',
    line:'用紙上で、線を引く始点から終点までドラッグします。',
    rect:'用紙上をドラッグして、四角の大きさを決めます。',
    ellipse:'用紙上をドラッグして、丸の大きさを決めます。',
    image:pending?'用紙をタップして画像を置きます。':'画像を選ぶか、コピーした画像を貼り付けてください。'
  }[tool];
}
function chosen(){return items.find(i=>i.id===selected);}
function isFreeText(i){return i?.type==='text'&&!M.textTarget(paper.regions,i);}
function canTapMove(i){return i?.type==='field'||isFreeText(i);}
function sync(){
  const i=chosen(),text=tool==='text'||(tool==='select'&&i?.type==='text'),shape=shapeTools.has(tool);
  const aligned=fieldModes.has(tool);
  $('fieldTools').hidden=!Object.values(hasField).some(Boolean);
  $('alignedControls').hidden=!aligned;
  $('fieldTextLabel').hidden=tool==='date';
  $('fieldDateLabel').hidden=tool!=='date';
  $('fieldTextTitle').textContent=tool==='body'?'れんらくの内容':'よみがな';
  $('fieldText').placeholder=tool==='body'?'例：あしたは としょの ほんを もちます':'例：やま';
  $('fieldText').maxLength=tool==='body'?80:24;
  for(const b of $('fieldTools').querySelectorAll('button')){
    b.hidden=!hasField[b.dataset.field];b.setAttribute('aria-pressed',String(b.dataset.field===tool));
  }
  $('textControls').hidden=!text;$('imageControls').hidden=tool!=='image';$('imageEdit').hidden=!(tool==='select'&&i?.type==='image');
  $('colorLabel').hidden=!(text||shape||aligned);$('sizeLabel').hidden=!(text||shape);
  $('sizeText').textContent=shape?'線の太さ（mm）':'文字サイズ（自由配置・mm）';
  $('size').min=shape?'.25':'1';$('size').max=shape?'5':'25';$('size').step=shape?'.05':'.5';
  $('size').value=shape?String(strokeSize):String(textSize);
  $('eraserModes').hidden=tool!=='erase';
  $('eraserSizeLabel').hidden=!(tool==='erase'&&eraseMode==='ink');
  svg.dataset.eraseMode=eraseMode;
  for(const b of $('eraserModes').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.eraseMode===eraseMode));
  if(tool!=='erase'||eraseMode!=='ink')eraseCursor.setAttribute('visibility','hidden');
  syncSpacing();syncFont();
  $('updateText').hidden=!(tool==='select'&&i?.type==='text');
  $('selectionControls').hidden=!(tool==='select'&&i);
  const free=tool==='select'&&isFreeText(i);
  $('resizeControls').hidden=!(tool==='select'&&i?.type==='text');
  $('angleControls').hidden=!free;$('moveByTap').hidden=!(tool==='select'&&canTapMove(i));
  $('moveByTap').setAttribute('aria-pressed',String(moveByTap));
  $('moveByTap').textContent=moveByTap?'移動をやめる':'タップで移動';
  svg.dataset.placeMove=String(moveByTap);
  $('angleRange').value=$('angleNumber').value=String(M.angle(i?.angle));
  $('resetAngle').disabled=!M.angle(i?.angle);
  $('instructions').textContent=info();svg.dataset.tool=tool;
  for(const b of $('tools').querySelectorAll('button'))b.setAttribute('aria-pressed',String(b.dataset.tool===tool));
}
let textSize=5,strokeSize=.65,defaultLetter=0,defaultLine=125,defaultFont='klee',defaultLocalName='';
const listedFonts=new Set();
let fontDataUrl;
const fontFile='fonts/klee-one-regular.woff2';
function syncFont(){
  const i=tool==='select'?chosen():null;
  const show=tool==='text'||fieldModes.has(tool)||['text','field'].includes(i?.type);
  $('fontControls').hidden=!show;
  if(!show)return;
  const name=M.fontName(i?i.localFontName:defaultLocalName);
  const preset=i?M.fontKey(i.font):defaultFont;
  $('fontChoice').value=name?(listedFonts.has(name)?'local:'+name:'manual'):preset;
  $('localNameLabel').hidden=$('fontChoice').value!=='manual';
  $('localFontName').value=name;
}
function changeFont(font,localFontName=''){
  const i=tool==='select'?chosen():null;
  if(i&&['text','field'].includes(i.type)){
    if(font!==M.fontKey(i.font)||localFontName!==M.fontName(i.localFontName))
      commit(items.map(v=>v.id===i.id?{...i,font,localFontName}:v));
  }else{defaultFont=font;defaultLocalName=localFontName;}
  syncFont();
}
$('fontChoice').onchange=()=>{
  const value=$('fontChoice').value;
  if(value==='manual'){$('localNameLabel').hidden=false;$('localFontName').focus();return;}
  if(value.startsWith('local:'))changeFont('standard',M.fontName(value.slice(6)));
  else changeFont(M.fontKey(value));
};
function saveFontName(){
  const name=M.fontName($('localFontName').value);
  if(name)changeFont('standard',name);
}
$('localFontName').onchange=saveFontName;
$('localFontName').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();saveFontName();}};
$('listLocalFonts').onclick=async()=>{
  if(typeof window.queryLocalFonts!=='function'){
    $('fontChoice').value='manual';$('localNameLabel').hidden=false;$('localFontName').focus();
    say('このブラウザはフォント一覧に非対応です。端末のフォント名を入力して使えます。');return;
  }
  try{
    const names=[...new Set((await window.queryLocalFonts()).map(f=>M.fontName(f.family)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
    for(const name of names)if(!listedFonts.has(name)){
      const opt=document.createElement('option');opt.value='local:'+name;opt.textContent=name;
      $('fontChoice').append(opt);listedFonts.add(name);
    }
    say(names.length?'「フォント」に端末の書体を追加しました。':'端末のフォントを取得できませんでした。名前を入力できます。');
    syncFont();$('fontChoice').focus();
  }catch{
    $('fontChoice').value='manual';$('localNameLabel').hidden=false;$('localFontName').focus();
    say('一覧を取得できませんでした。端末のフォント名を入力して使えます。');
  }
};
function syncSpacing(){
  const item=tool==='select'?chosen():null;
  const show=(tool==='text'&&!$('snap').checked)||isFreeText(item);
  $('spacingControls').hidden=!show;
  if(show){
    $('letterSpace').value=String(item?M.letterSpace(item.letterSpace):defaultLetter);
    $('lineSpace').value=String(item?M.lineSpace(item.lineSpace):defaultLine);
  }
}
$('snap').addEventListener('change',syncSpacing);
function setSpacing(reset=false){
  const letter=reset?0:M.letterSpace($('letterSpace').value);
  const line=reset?125:M.lineSpace($('lineSpace').value);
  const i=tool==='select'?chosen():null;
  if(isFreeText(i)){
    if(M.letterSpace(i.letterSpace)!==letter||M.lineSpace(i.lineSpace)!==line)
      commit(items.map(v=>v.id===i.id?{...i,letterSpace:letter,lineSpace:line}:v));
  }else if(tool==='text'){defaultLetter=letter;defaultLine=line;}
  syncSpacing();
}
$('letterSpace').onchange=$('lineSpace').onchange=()=>setSpacing();
for(const id of ['letterSpace','lineSpace'])$(id).onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();setSpacing();}};
$('resetSpace').onclick=()=>setSpacing(true);
function setTool(t){
  anglePreview=null;moveByTap=false;tool=t;selected=null;drag=null;tap=null;pending=t==='image'?pending:null;sync();render();
}
function readSelection(){
  const i=chosen();
  if(i?.type==='text'){$('words').value=i.text;$('direction').value=i.dir;$('snap').checked=!isFreeText(i);$('color').value=i.color;textSize=i.size;}
  if(i?.type==='image')$('imageWidth').value=Math.round(i.w);
  sync();
}
function imageHref(s){return typeof s==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(s);}
function textStyle(i){return {fill:i.color,'font-family':M.fontFamily(i.font,i.localFontName),'pointer-events':'none'};}
const glyphMeter=document.createElement('canvas').getContext('2d');
const glyphMetrics=new Map();
function markNode(i,p,font,cell,char){
  const mark=M.markPlacement(char,p.vertical,p.markMode);
  if(!mark||!glyphMeter)return null;
  const style=textStyle(i),family=style['font-family'],key=family+'\n'+char;
  let metrics=glyphMetrics.get(key);
  if(!metrics){
    glyphMeter.font='100px '+family;
    glyphMeter.textAlign='left';
    glyphMeter.textBaseline='alphabetic';
    const {actualBoundingBoxLeft:l,actualBoundingBoxRight:r,actualBoundingBoxAscent:a,actualBoundingBoxDescent:d}=glyphMeter.measureText(char);
    if(!Number.isFinite(l+r+a+d)||l+r<=0||a+d<=0)return null;
    metrics={l,r,a,d};
    if(glyphMetrics.size>500)glyphMetrics.clear();
    glyphMetrics.set(key,metrics);
  }
  const {l,r,a,d}=metrics,rotated=mark.turn===90;
  const size=Math.min(font,cell*mark.maxW*100/(rotated?a+d:l+r),cell*mark.maxH*100/(rotated?l+r:a+d));
  const x=(l-r)*size/200,y=(a-d)*size/200;
  const transform=`translate(${p.x} ${p.y}) rotate(${p.rotate||0}) translate(${mark.x*cell} ${mark.y*cell}) rotate(${mark.turn})`;
  return node('text',{...style,x,y,'font-size':size,'text-anchor':'start','dominant-baseline':'alphabetic',transform,'data-cell-mark':p.markMode||(p.vertical?'vertical':'horizontal')},char);
}
function paint(i){
  const g=node('g',{'data-item':i.id,...(M.erasableObject(i)?{'data-erase-object':''}:{})});let bbox;
  if(i.type==='text'){
    const target=M.textTarget(paper.regions,i);
    if(target){
      const r=paper.regions[target.i],{points,clipped}=M.glyphs(r,target.c,target.row,i.text,i.dir);
      const font=r.cell*.71*(i.cellScale||1),radius=font*.64;
      for(const p of points){
        const mark=markNode(i,p,font,r.cell,p.char);
        if(mark){g.append(mark);continue;}
        const attrs={...textStyle(i),x:p.x,y:p.y,'font-size':font,'text-anchor':'middle','dominant-baseline':'central'};
        if(p.vertical){attrs['writing-mode']='vertical-rl';attrs.style='text-orientation:upright';}
        if(p.rotate)attrs.transform=`rotate(${p.rotate} ${p.x} ${p.y})`;
        g.append(node('text',attrs,p.char));
      }
      const xs=points.map(p=>p.x),ys=points.map(p=>p.y);
      if(xs.length){
        const extent=points.some(p=>p.markMode?.startsWith('hanging'))?Math.max(radius,r.cell):radius;
        bbox={x:Math.min(...xs)-extent,y:Math.min(...ys)-extent,w:Math.max(...xs)-Math.min(...xs)+2*extent,h:Math.max(...ys)-Math.min(...ys)+2*extent,glyphRadius:radius};
      }
      if(clipped)g.dataset.clipped='true';
    }else{
      const v=i.dir==='vertical',ls=i.text.split(/\r?\n/),font=i.size;
      const lead=font*M.lineSpace(i.lineSpace)/100,track=M.letterSpace(i.letterSpace)/100;
      let max=0;
      ls.forEach((s,l)=>{
        max=Math.max(max,Array.from(s).length);
        const a={...textStyle(i),x:i.x-(v?l*lead:0),y:i.y+(v?0:l*lead),'font-size':font};
        if(v){a['writing-mode']='vertical-rl';a.style='text-orientation:upright;';}else a['dominant-baseline']='hanging';
        if(track)a.style=(a.style||'')+'letter-spacing:'+track+'em';
        g.append(node('text',a,s));
      });
      const long=font*Math.max(1,max+Math.max(0,max-1)*track),wide=font+(ls.length-1)*lead;
      bbox=v?{x:i.x-(ls.length-1)*lead-font*.65,y:i.y,w:wide,h:long}:{x:i.x,y:i.y,w:long,h:wide};
    }
  }else if(i.type==='field'){
    const out=M.fieldLayout(fields[i.target?.i],i.target,i.mode,i.value);
    if(out&&!out.overflow){
      g.dataset.fieldItem=i.mode;bbox=out.box;
      for(const p of out.points){
        const mark=i.mode!=='date'&&markNode(i,p,out.size,out.size*1.08,p.text);
        if(mark){g.append(mark);continue;}
        const a={...textStyle(i),x:p.x,y:p.y,'font-size':out.size,'text-anchor':'middle','dominant-baseline':'central'};
        if(p.vertical){a['writing-mode']='vertical-rl';a.style='text-orientation:upright';}
        if(p.rotate)a.transform=`rotate(${p.rotate} ${p.x} ${p.y})`;
        g.append(node('text',a,p.text));
      }
    }
  }else if(i.type==='ink'&&Array.isArray(i.points)&&i.points.length){
    const d=M.inkPath(i.points,i.straight),opts={d,fill:'none','stroke-linecap':'round','stroke-linejoin':'round'};
    g.append(node('path',{...opts,stroke:i.color,'stroke-width':i.width,'pointer-events':'none','data-ink-path':''}));
    g.append(node('path',{...opts,stroke:'transparent','stroke-width':Math.max(4,i.width),'pointer-events':'stroke'}));
    const b=M.inkBounds(i.points),r=i.width/2;bbox={x:b.x-r,y:b.y-r,w:b.w+2*r,h:b.h+2*r};
  }else if(i.type==='image'&&imageHref(i.src)){
    g.append(node('image',{x:i.x,y:i.y,width:i.w,height:i.h,href:i.src}));
    bbox={x:i.x,y:i.y,w:i.w,h:i.h};
  }else if(['line','rect','ellipse'].includes(i.type)){
    const b={x:Math.min(i.x,i.x2),y:Math.min(i.y,i.y2),w:Math.abs(i.x2-i.x),h:Math.abs(i.y2-i.y)};
    const opts={stroke:i.color,'stroke-width':i.width,fill:'none','stroke-linecap':'round','pointer-events':'none'};
    if(i.type==='line'){
      g.append(node('line',{x1:i.x,y1:i.y,x2:i.x2,y2:i.y2,...opts}));
      g.append(node('line',{x1:i.x,y1:i.y,x2:i.x2,y2:i.y2,stroke:'transparent','stroke-width':4,'pointer-events':'stroke'}));
    }else if(i.type==='rect')g.append(node('rect',{x:b.x,y:b.y,width:b.w,height:b.h,...opts}));
    else g.append(node('ellipse',{cx:b.x+b.w/2,cy:b.y+b.h/2,rx:b.w/2,ry:b.h/2,...opts}));
    bbox=b;
  }
  if(bbox&&i.type!=='line'&&i.type!=='ink')g.prepend(node('rect',{x:bbox.x-.6,y:bbox.y-.6,width:bbox.w+1.2,height:bbox.h+1.2,fill:'transparent','pointer-events':'all',...(isFreeText(i)?{'data-free-hit':''}:{})}));
  const transform=isFreeText(i)?M.rotation(bbox,i.angle):'';
  if(transform)g.setAttribute('transform',transform);
  return {g,bbox,transform};
}
function render(){
  layer.replaceChildren();selection.replaceChildren();
  const draft=drag&&['move','resize'].includes(drag.kind)?drag.draft:anglePreview;
  const base=drag?.kind==='erase'?drag.items:items;
  const list=draft?base.map(i=>i.id===draft.id?draft:i):base;
  for(const i of list){
    const {g,bbox:b,transform}=paint(i);layer.append(g);
    if(i.id===selected&&b){
      const frame=node('g',transform?{transform}:{});
      frame.append(node('rect',{x:b.x-.7,y:b.y-.7,width:b.w+1.4,height:b.h+1.4,fill:'none',stroke:'#1f73ad','stroke-width':'.35','stroke-dasharray':'1.2 1'}));
      if(tool==='select'&&i.type==='text'&&!moveByTap){
        const c={cx:b.x+b.w+.7,cy:b.y+b.h+.7,r:1.45};
        frame.append(node('circle',{...c,fill:'#fff',stroke:'#266499','stroke-width':'.48','data-resize':''}));
      }
      selection.append(frame);
    }
  }
  if(drag?.kind==='shape')layer.append(paint(drag.draft).g);
  if(drag?.kind==='ink'){const ink=paint(drag.draft).g;layer.append(ink);drag.path=ink.querySelector('[data-ink-path]');}
  $('undo').disabled=!past.length;$('redo').disabled=!future.length;$('remove').disabled=!selected;
}
function point(e){
  const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;
  const q=p.matrixTransform(svg.getScreenCTM().inverse());
  return {x:clamp(q.x,0,w),y:clamp(q.y,0,h)};
}
function newText(p,id=nextId()){
  const text=$('words').value.trim();
  if(!text){say('先に入れたい文字を入力してください。');$('words').focus();return;}
  const item={id,type:'text',...p,text,color:$('color').value,size:textSize,dir:$('direction').value,snap:$('snap').checked,letterSpace:defaultLetter,lineSpace:defaultLine,font:defaultFont,localFontName:defaultLocalName};
  const at=M.textTarget(paper.regions,item);
  if(!at)item.snap=false;
  if(at&&M.glyphs(paper.regions[at.i],at.c,at.row,item.text,item.dir).clipped)say('残りのマスに入らない文字があります。置く場所を変えるか、文を分けてください。');
  else say('');
  return item;
}
function placeField(p){
  const target=M.fieldAt(fields,p.x,p.y,tool);
  if(!target){say(info());return;}
  const value=(tool==='date'?$('fieldDate'):$('fieldText')).value.trim();
  if(!value){say(tool==='date'?'先に書き込む日付を選んでください。':'先に入れたい文字を入力してください。');return;}
  const out=M.fieldLayout(fields[target.i],target,tool,value);
  if(!out||out.overflow){
    say(!out?(tool==='date'?'日付を確認してください。':'先に入れたい文字を入力してください。'):(tool==='ruby'?'読みが長すぎてこの欄に入りません。':'内容が長いため、この1列に入りません。短くしてからもう一度お試しください。'));return;
  }
  const same=items.find(i=>i.type==='field'&&i.mode===tool&&M.sameTarget(i.target,target));
  const item={id:same?.id||nextId(),type:'field',target,mode:tool,value,color:$('color').value,font:defaultFont,localFontName:defaultLocalName};
  selected=item.id;
  commit(same?items.map(i=>i.id===same.id?item:i):[...items,item]);
  say(tool==='ruby'?'よみがなを入れました。':tool==='date'?'月・日・曜日を入れました。':'縦書きのれんらくを入れました。');
}
function finishFieldMove(item,p){
  const res=M.moveField(fields,items,item,p.x,p.y);
  if(res.item&&res.item!==item){
    commit(items.map(v=>v.id===item.id?res.item:v));say('書き込みを移動しました。');return true;
  }
  render();
  say({occupied:'移動先にはすでに書き込みがあります。空いている欄を選んでください。',fit:'移動先の欄には収まりません。',target:'同じ種類の欄を移動先に選んでください。'}[res.error]||'');
  return !res.error;
}
function placeImage(p){
  if(!pending){$('imageFile').click();return;}
  const iw=Math.min(w*.42,85),scale=Math.min(iw/pending.rw,h*.45/pending.rh);
  const iw2=pending.rw*scale,ih2=pending.rh*scale;
  const item={id:nextId(),type:'image',x:clamp(p.x,0,w-iw2),y:clamp(p.y,0,h-ih2),w:iw2,h:ih2,src:pending.src};
  pending=null;tool='select';selected=item.id;
  say('画像を置きました。ドラッグで移動、幅の入力で大きさを変えられます。');
  commit([...items,item]);readSelection();
}
svg.addEventListener('pointerdown',e=>{
  if(e.button!==0||drag)return;
  if(tool==='pan')return;
  const p=point(e);
  if(tool==='text'||tool==='image'||fieldModes.has(tool)||moveByTap){
    tap={tool:moveByTap?'placeMove':tool,p,x:e.clientX,y:e.clientY,pid:e.pointerId};
    if(moveByTap){e.preventDefault();svg.setPointerCapture(e.pointerId);}
    return;
  }
  e.preventDefault();$('canvas').focus({preventScroll:true});
  if(tool==='erase'){
    if(eraseMode==='object'){
      const id=e.target.closest('[data-erase-object]')?.dataset.item;
      tap={tool:'eraseObject',id,x:e.clientX,y:e.clientY,pid:e.pointerId};
      return;
    }
    selected=null;drag={kind:'erase',p,pid:e.pointerId,items,changed:false};
    svg.setPointerCapture(e.pointerId);showEraser(p);eraseTo(p);return;
  }
  if(tool==='select'){
    anglePreview=null;
    if(e.target.closest('[data-resize]')&&chosen()?.type==='text'){
      const orig=chosen(),box=paint(orig).bbox;
      if(box){drag={kind:'resize',p,orig,draft:orig,box,pid:e.pointerId};svg.setPointerCapture(e.pointerId);return;}
    }
    const target=e.target.closest('[data-item]');selected=target?.dataset.item||null;
    if(!chosen()){sync();render();return;}
    drag={kind:'move',p,orig:chosen(),draft:chosen(),pid:e.pointerId};
  }else{
    selected=null;
    if(tool==='ink'){
      drag={kind:'ink',p,draft:{id:nextId(),type:'ink',points:[p],color:$('color').value,width:strokeSize},pid:e.pointerId};
      svg.setPointerCapture(e.pointerId);render();return;
    }
    const draft={id:nextId(),type:tool,...p,x2:p.x,y2:p.y,color:$('color').value,width:strokeSize};
    drag={kind:'shape',p,draft,pid:e.pointerId};
  }
  svg.setPointerCapture(e.pointerId);render();
});
const eraserRadius=()=>Number($('eraserSize').value);
function showEraser(p){
  eraseCursor.setAttribute('cx',p.x);eraseCursor.setAttribute('cy',p.y);
  eraseCursor.setAttribute('r',eraserRadius());eraseCursor.setAttribute('visibility','visible');
}
function eraseTo(p){
  const d=drag;
  let changed=false;
  const result=d.items.flatMap(i=>{
    const stroke=M.erasableStroke(i);
    if(!stroke)return [i];
    const segments=M.eraseInk(stroke,d.p,p,eraserRadius());
    if(segments===null)return [i];
    changed=true;
    return segments.map((points,n)=>({...stroke,id:n?nextId():i.id,straight:true,points}));
  });
  d.p=p;
  if(changed){d.items=result;d.changed=true;render();}
}
svg.addEventListener('pointerleave',()=>eraseCursor.setAttribute('visibility','hidden'));
function sampleInk(e,last=false){
  const pool=drag.draft.points;
  const events=e.getCoalescedEvents?.()||[];
  for(const event of events.length&&!last?events:[e]){
    const p=point(event),previous=pool.at(-1);
    if(Math.hypot(p.x-previous.x,p.y-previous.y)<(last?.06:.32))continue;
    if(pool.length>=4000)pool.splice(1,3998,...pool.slice(1,-1).filter((_,i)=>i%2===0));
    pool.push(p);
  }
  drag.path?.setAttribute('d',M.inkPath(pool));
}
function resizeDraft(d,p){
  const snapped=!!M.textTarget(paper.regions,d.orig);
  return M.resizeText(d.orig,d.box,p.x-d.p.x,p.y-d.p.y,{snapped,w,h});
}
svg.addEventListener('pointermove',e=>{
  if(tool==='erase'&&eraseMode==='ink'){
    if(drag&&drag.pid!==e.pointerId)return;
    const p=point(e);showEraser(p);
    if(drag?.kind==='erase')eraseTo(p);
    return;
  }
  if(!drag||drag.pid!==e.pointerId)return;
  const p=point(e),dx=p.x-drag.p.x,dy=p.y-drag.p.y;
  if(drag.kind==='ink'){sampleInk(e);return;}
  if(drag.kind==='resize'){drag.draft=resizeDraft(drag,p);render();return;}
  if(drag.kind==='shape')drag.draft={...drag.draft,x2:p.x,y2:p.y};
  else{
    const o=drag.orig;
    if(o.type==='ink')drag.draft=M.moveInk(o,dx,dy,w,h);
    else if(o.type==='field')drag.draft=M.moveField(fields,items,o,p.x,p.y).item||o;
    else if(isFreeText(o))drag.draft=M.freeTextPosition(o,o.x+dx,o.y+dy,w,h);
    else if(o.type==='text')drag.draft={...o,x:clamp(o.x+dx,0,w-1),y:clamp(o.y+dy,0,h-1)};
    else if(o.type==='image')drag.draft={...o,x:clamp(o.x+dx,0,w-o.w),y:clamp(o.y+dy,0,h-o.h)};
    else{
      const mx=clamp(dx,-Math.min(o.x,o.x2),w-Math.max(o.x,o.x2)),my=clamp(dy,-Math.min(o.y,o.y2),h-Math.max(o.y,o.y2));
      drag.draft={...o,x:o.x+mx,y:o.y+my,x2:o.x2+mx,y2:o.y2+my};
    }
  }
  render();
});
svg.addEventListener('pointerup',e=>{
  if(tap?.pid===e.pointerId){
    const t=tap;tap=null;
    const tapped=Math.hypot(t.x-e.clientX,t.y-e.clientY)<12;
    if(t.tool==='eraseObject'){
      if(tapped&&tool==='erase'&&eraseMode==='object'&&t.id){
        const next=M.eraseObject(items,t.id);
        if(next!==items){commit(next);say('文字を消しました。');}
      }
      return;
    }
    if(tapped&&t.tool==='placeMove'&&moveByTap){
      const i=chosen(),b=i&&paint(i).bbox;
      moveByTap=false;
      if(isFreeText(i)&&b){
        const moved=M.freeTextPosition(i,t.p.x+i.x-b.x-b.w/2,t.p.y+i.y-b.y-b.h/2,w,h);
        commit(items.map(v=>v.id===i.id?moved:v));say('文字を移動しました。');
      }else if(i?.type==='field'&&!finishFieldMove(i,t.p))moveByTap=true;
      sync();return;
    }
    if(tapped&&t.tool===tool){
      if(fieldModes.has(tool))placeField(t.p);
      else if(tool==='image')placeImage(t.p);
      else {
        const i=newText(t.p);
        if(i){
          if(isFreeText(i)){
            tool='select';selected=i.id;say('文字を置きました。ドラッグ、または「タップで移動」で動かせます。');
          }
          commit([...items,i]);
          if(tool==='select')readSelection();
        }
      }
    }
    return;
  }
  if(!drag||drag.pid!==e.pointerId)return;
  if(drag.kind==='ink')sampleInk(e,true);
  if(drag.kind==='erase')eraseTo(point(e));
  const d=drag;drag=null;
  if(d.kind==='erase'){
    if(e.pointerType!=='mouse')eraseCursor.setAttribute('visibility','hidden');
    if(d.changed){commit(d.items);say('なぞった部分を消しました。');}
    return;
  }
  if(d.kind==='ink'){commit([...items,d.draft]);return;}
  if(d.kind==='resize'){
    const changed=resizeDraft(d,point(e));
    if(changed!==d.orig){commit(items.map(i=>i.id===changed.id?changed:i));say('文字の大きさを変えました。');}else render();
    readSelection();return;
  }
  if(d.kind==='shape'){
    const a=d.draft,dx=Math.abs(a.x-a.x2),dy=Math.abs(a.y-a.y2);
    if(a.type==='line'?Math.hypot(dx,dy)>=1:dx>=1&&dy>=1)commit([...items,a]);else render();
  }else{
    if(d.orig.type==='field'){
      const p=point(e);
      if(Math.hypot(p.x-d.p.x,p.y-d.p.y)>.8)finishFieldMove(d.orig,p);else{say('ドラッグするか「タップで移動」で、同じ種類の欄へ移せます。');render();}
      readSelection();return;
    }
    const a=d.orig.type==='ink'?d.orig.points[0]:d.orig,b=d.orig.type==='ink'?d.draft.points[0]:d.draft;
    if(Math.hypot(a.x-b.x,a.y-b.y)>.2){
      commit(items.map(i=>i.id===selected?d.draft:i));
      if(layer.querySelector('[data-clipped=true]'))say('残りのマスに入らない文字があります。');
    }else render();
    readSelection();
  }
});
svg.addEventListener('pointercancel',()=>{drag=null;tap=null;eraseCursor.setAttribute('visibility','hidden');readSelection();render();});
$('eraserModes').addEventListener('click',e=>{
  const mode=e.target.closest('[data-erase-mode]')?.dataset.eraseMode;
  if(mode==='ink'||mode==='object'){eraseMode=mode;drag=null;tap=null;say('');sync();render();}
});
$('tools').addEventListener('click',e=>{const t=e.target.closest('button[data-tool]')?.dataset.tool;if(t){say('');setTool(t);}});
$('fieldTools').addEventListener('click',e=>{
  const mode=e.target.closest('button[data-field]')?.dataset.field;
  if(mode&&hasField[mode]){setTool(mode);say(info());}
});
$('size').addEventListener('input',()=>{
  if(!Number($('size').value))return;
  if(shapeTools.has(tool))strokeSize=clamp(Number($('size').value),.25,5);
  else textSize=clamp(Number($('size').value),1,25);
});
$('updateText').onclick=()=>{
  const o=chosen();if(o?.type!=='text')return;
  const i=newText({x:o.x,y:o.y},o.id);
  if(i){i.font=o.font;i.localFontName=o.localFontName;if(isFreeText(i)){i.angle=M.angle(o.angle);if(isFreeText(o)){i.letterSpace=o.letterSpace;i.lineSpace=o.lineSpace;}}else if(o.cellScale)i.cellScale=o.cellScale;commit(items.map(a=>a.id===i.id?i:a));readSelection();}
};
function stepSize(increase){
  const i=chosen();if(i?.type!=='text')return;
  const box=paint(i).bbox;if(!box)return;
  const snapped=!!M.textTarget(paper.regions,i),f=increase?.14:-.14;
  const a=M.angle(i.angle)*Math.PI/180;
  const dx=snapped?box.glyphRadius*f:(box.w*Math.cos(a)-box.h*Math.sin(a))*f;
  const dy=snapped?dx:(box.w*Math.sin(a)+box.h*Math.cos(a))*f;
  const item=M.resizeText(i,box,dx,dy,{snapped,w,h});
  if(item!==i){commit(items.map(v=>v.id===i.id?item:v));readSelection();say('文字の大きさを変えました。');}
}
$('sizeUp').onclick=()=>stepSize(true);$('sizeDown').onclick=()=>stepSize(false);
$('moveByTap').onclick=()=>{
  if(!canTapMove(chosen()))return;
  moveByTap=!moveByTap;tap=null;sync();render();
  say(moveByTap?(chosen().type==='field'?'移動先の同じ種類の欄をタップしてください。':'文字を移したい場所を、用紙の上でタップしてください。'):'');
};
function setAngle(value){
  const i=chosen();anglePreview=null;
  if(!isFreeText(i))return;
  const angle=M.angle(value);
  if(angle!==M.angle(i.angle))commit(items.map(v=>v.id===i.id?{...i,snap:false,angle}:v));
  else render();
  sync();
}
$('angleRange').oninput=()=>{
  const i=chosen();if(!isFreeText(i))return;
  const angle=M.angle($('angleRange').value);
  anglePreview={...i,snap:false,angle};$('angleNumber').value=String(angle);$('resetAngle').disabled=!angle;render();
};
$('angleRange').onchange=()=>setAngle($('angleRange').value);
$('angleNumber').onchange=()=>{
  const raw=$('angleNumber').value;setAngle(raw===''?chosen()?.angle:raw);
};
$('angleNumber').oninput=()=>{
  const i=chosen(),raw=$('angleNumber').value;if(!isFreeText(i)||raw==='')return;
  const angle=M.angle(raw);
  anglePreview={...i,snap:false,angle};$('angleRange').value=String(angle);$('resetAngle').disabled=!angle;render();
};
$('angleNumber').onkeydown=e=>{
  if(e.key==='Enter'){e.preventDefault();setAngle(e.currentTarget.value||chosen()?.angle);}
};
$('resetAngle').onclick=()=>setAngle(0);
$('imageWidth').onchange=()=>{
  const i=chosen();if(i?.type!=='image')return;
  const ratio=i.h/i.w,nw=clamp(Number($('imageWidth').value)||i.w,5,Math.min(w,h/ratio)),nh=nw*ratio;
  commit(items.map(v=>v.id===i.id?{...i,w:nw,h:nh,x:clamp(i.x,0,w-nw),y:clamp(i.y,0,h-nh)}:v));readSelection();
};
async function loadImage(file){
  if(!allowedImages.has(file?.type)){say('PNG、JPEG、WebP、GIFの画像を選んでください。');return;}
  if(file.size>20*1024*1024){say('20MB以下の画像を選んでください。');return;}
  const url=URL.createObjectURL(file);
  try{
    const img=new Image();img.src=url;await img.decode();
    const f=Math.min(1,1200/Math.max(img.naturalWidth,img.naturalHeight)),rw=Math.max(1,Math.round(img.naturalWidth*f)),rh=Math.max(1,Math.round(img.naturalHeight*f));
    const canvas=document.createElement('canvas');canvas.width=rw;canvas.height=rh;canvas.getContext('2d').drawImage(img,0,0,rw,rh);
    setTool('image');pending={src:canvas.toDataURL('image/webp',.85),rw,rh};sync();say('画像を読み込みました。用紙の置きたい場所をタップしてください。');
  }catch{say('画像を開けませんでした。別の画像を試してください。');}
  finally{URL.revokeObjectURL(url);}
}
$('imageFile').onchange=e=>{const f=e.target.files[0];if(f)loadImage(f);e.target.value='';};
document.addEventListener('paste',e=>{const f=[...(e.clipboardData?.items||[])].find(i=>i.kind==='file'&&allowedImages.has(i.type))?.getAsFile();if(f){e.preventDefault();loadImage(f);}});
function remove(){if(!selected)return;const id=selected;selected=null;moveByTap=false;commit(items.filter(i=>i.id!==id));sync();}
$('remove').onclick=remove;
$('undo').onclick=()=>replay(past,future);
$('redo').onclick=()=>replay(future,past);
document.addEventListener('keydown',e=>{
  if(/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;
  if(e.key==='Delete'&&selected){e.preventDefault();remove();}
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?replay(future,past):replay(past,future);}
});
$('zoom').onchange=()=>{$('canvas').style.width=(Number($('zoom').value)*100)+'%';};
function exportSvg(){
  const copy=svg.cloneNode(true);copy.querySelector('.selection')?.remove();copy.querySelector('[data-erase-guide]')?.remove();copy.removeAttribute('data-tool');return copy;
}
$('print').onclick=async()=>{
  await document.fonts.ready;
  glyphMetrics.clear();render();
  const out=$('printSheets');out.replaceChildren(exportSvg());
  if(paper.pageCount===2)out.append(exportSvg());
  window.print();
};
async function embedKlee(copy){
  if(!items.some(i=>!i.localFontName&&(i.font==='klee'||i.font==='school')))return;
  if(!fontDataUrl){
    const response=await fetch(fontFile);
    if(!response.ok)throw Error('font');
    const blob=await response.blob();
    fontDataUrl=await new Promise((resolve,reject)=>{
      const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;
      reader.readAsDataURL(new Blob([blob],{type:'font/woff2'}));
    });
  }
  copy.prepend(node('style',{},'@font-face{font-family:"Sattoto Klee One";src:url("'+fontDataUrl+'") format("woff2");font-weight:400;font-style:normal}'));
}
$('savePng').onclick=async()=>{
  $('savePng').disabled=true;
  const img=new Image();let src;
  try{
    await document.fonts.ready;
    glyphMetrics.clear();render();
    const copy=exportSvg();await embedKlee(copy);
    src=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)],{type:'image/svg+xml;charset=utf-8'}));
    img.src=src;await img.decode();const cv=document.createElement('canvas');cv.width=Math.round(w*8);cv.height=Math.round(h*8);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);
    const blob=await new Promise(resolve=>cv.toBlob(resolve,'image/png'));if(!blob)throw Error('empty');
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='ノート見本.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
    say('PNGを書き出しました。');
  }catch{say('PNGの保存ができませんでした。「見本を印刷」からPDFに保存できます。');}
  finally{if(src)URL.revokeObjectURL(src);$('savePng').disabled=false;}
};
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
sync();render();persist();
const refreshGlyphs=()=>{glyphMetrics.clear();render();};
document.fonts?.addEventListener?.('loadingdone',refreshGlyphs);
document.fonts?.ready.then(refreshGlyphs);
})();
