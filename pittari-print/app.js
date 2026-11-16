'use strict';
const $=id=>document.getElementById(id);
const sizes={A4:[210,297],A3:[297,420],B5:[182,257],B4:[257,364]};
const NS='http://www.w3.org/2000/svg';
function outlineWidth(){return Number($('outlineThickness').value)||4;}
function fontWeight(){return Number($('fontWeight').value)||400;}
let letterColors={},selectedLetters=new Set(),previousWords='';
const modeMargins={single:'5',poster:'10'};
let plannerMediaKey='';let currentPreview=0;let previewMode='single';
let media=null,pdfDoc=null,pdfTask=null,mediaToken=0,mediaBusy=false;
let localList=[], activeFont='sans-serif', generation=0, busy=false;
const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
const segmenter=Intl.Segmenter?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
function splitLetters(value){return (segmenter?[...segmenter.segment(value)].map(x=>x.segment):Array.from(value)).filter(x=>!/^\s+$/u.test(x));}
function dimensions(){const d=sizes[$('paper').value].slice();return $('orientation').value==='landscape'?d.reverse():d;}
// Use visible ink metrics, not SVG getBBox(): some SVG engines return the
// font em box including invisible leading, which made 100% unnecessarily small.
// All glyphs share one font size; only their ink centres are aligned per page.
function layout(chars,w,h,margin,family){
 ctx.font=`${fontWeight()} 1000px ${family}`;
 const measures=chars.map(c=>{const m=ctx.measureText(c);return {width:m.width,left:m.actualBoundingBoxLeft??0,right:m.actualBoundingBoxRight??m.width,ascent:m.actualBoundingBoxAscent??880,descent:m.actualBoundingBoxDescent??120};});
 const maxWidth=Math.max(...measures.map(m=>m.left+m.right),1);
 const maxHeight=Math.max(...measures.map(m=>m.ascent+m.descent),1);
 const stroke=$('letterStyle').value==='outline'?outlineWidth():0;
 const fontSize=Math.max(1,Math.min((w-margin*2-stroke)/maxWidth,(h-margin*2-stroke)/maxHeight)*1000);
 return {fontSize,measures,inkCentered:true};
}
function makeSVG(char,w,h,layout,index,charColor){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('width',w+'mm');svg.setAttribute('height',h+'mm');
 svg.setAttribute('role','img');svg.setAttribute('aria-label',char);
 const text=document.createElementNS(NS,'text');const m=layout.measures[index];
 text.setAttribute('x',w/2+(m.left-m.right)*layout.fontSize/2000);text.setAttribute('y',layout.inkCentered?h/2+(m.ascent-m.descent)*layout.fontSize/2000:layout.baseline);
 text.setAttribute('font-family',activeFont);text.setAttribute('font-weight',fontWeight());text.setAttribute('font-size',layout.fontSize);const outlined=$('letterStyle').value==='outline';text.setAttribute('fill',outlined?'#ffffff':(charColor||$('color').value));if(outlined){text.setAttribute('stroke',charColor||$('color').value);text.setAttribute('stroke-width',outlineWidth());text.setAttribute('stroke-linejoin','round');text.setAttribute('paint-order','stroke fill');}text.style.whiteSpace='pre';text.textContent=char;svg.append(text);return svg;
}
// Layout and rendering share explicit grapheme origins so spacing is identical
// in overview, page previews, and print, including fonts with narrow glyphs.
function posterLayout(lines,W,H){
 ctx.font=`${fontWeight()} 1000px ${activeFont}`;
 const tracking=Number($('tracking').value)*10, gap=Number($('leading').value)*10;
 let ascent=1,descent=0;
 let sourceOffset=0;const runs=lines.map(line=>{const baseOffset=sourceOffset;sourceOffset+=line.length+1;
  const chars=segmenter?[...segmenter.segment(line)].map(s=>s.segment):Array.from(line);
  let pen=0,left=Infinity,right=-Infinity;
  let charOffset=0;const glyphs=chars.map(char=>{const sourceIndex=baseOffset+charOffset;charOffset+=char.length;const m=ctx.measureText(char),x=pen;pen+=m.width+tracking;
   if(char.trim()){left=Math.min(left,x-m.actualBoundingBoxLeft);right=Math.max(right,x+m.actualBoundingBoxRight);ascent=Math.max(ascent,m.actualBoundingBoxAscent);descent=Math.max(descent,m.actualBoundingBoxDescent);}
   return {char,x,sourceIndex};
  });
  if(!Number.isFinite(left)){left=0;right=0;}
  return {glyphs,left,right};
 });
 const maxWidth=Math.max(...runs.map(r=>r.right-r.left),1),unit=ascent+descent,total=unit*lines.length+gap*(lines.length-1);
 const fontSize=Math.min((W-outlineWidth())/maxWidth,(H-outlineWidth())/total)*1000*.995;
 return {runs,fontSize,baseline:(H-total*fontSize/1000)/2+ascent*fontSize/1000,lineHeight:(unit+gap)*fontSize/1000};
}
function posterSVG(lines,W,H,l){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('width',W+'mm');svg.setAttribute('height',H+'mm');
 l.runs.forEach((run,i)=>{
  const t=makeSVG('',W,H,{fontSize:l.fontSize,baseline:l.baseline,measures:[{left:0,right:0}]},0).firstChild;
  t.removeAttribute('x');t.setAttribute('y',l.baseline+i*l.lineHeight);
  const offset=W/2-(run.left+run.right)*l.fontSize/2000;
  run.glyphs.forEach(g=>{const span=document.createElementNS(NS,'tspan');span.setAttribute('x',offset+g.x*l.fontSize/1000);span.textContent=g.char;const color=letterColors[g.sourceIndex];if(color){span.setAttribute($('letterStyle').value==='outline'?'stroke':'fill',color);}t.append(span);});svg.append(t);
 });return svg;
}
// Final SVG geometry check: canvas metrics are an estimate and may differ from
// SVG shaping (fallback fonts, combining marks and unusual installed fonts).
// Measure the actual rendered nodes, then shrink every page by one common factor.
function containText(svgs,W,H,margin=0){
 const host=document.createElement('div');host.style.cssText='position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none';document.body.append(host);
 const groups=svgs.map(svg=>{const g=document.createElementNS(NS,'g');g.classList.add('fittedText');while(svg.firstChild)g.append(svg.firstChild);svg.append(g);host.append(svg);return g;});
 try{
  const boxes=groups.map(g=>g.getBBox()),top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y+b.height));
  const pad=outlineWidth()/2+1,availableW=W-2*(margin+pad),availableH=H-2*(margin+pad);
  const factor=Math.min(1,availableW/Math.max(1,...boxes.map(b=>b.width)),availableH/Math.max(1,bottom-top))*.98;
  groups.forEach((g,i)=>{const b=boxes[i],x=W/2-factor*(b.x+b.width/2),y=H/2-factor*(top+bottom)/2;g.setAttribute('transform',`translate(${x} ${y}) scale(${factor})`);});
  return factor;
 }finally{svgs.forEach(svg=>svg.remove());host.remove();}
}
function posterTextPercent(){return Math.max(10,Math.min(200,Number($('posterTextScale').value)||100));}
function applyPosterTextScale(svg,W,H){
 const scale=posterTextPercent()/100;
 const group=document.createElementNS(NS,'g');group.setAttribute('transform',`translate(${W/2} ${H/2}) scale(${scale}) translate(${-W/2} ${-H/2})`);
 while(svg.firstChild)group.append(svg.firstChild);svg.append(group);return scale;
}
function renderPoster(w,h,margin){
 const lines=$('words').value.replace(/\r/g,'').split('\n'),isFile=$('posterSource').value==='file',valid=isFile?!!media:lines.some(s=>s.trim());
 const rows=Number($('rows').value),cols=Number($('cols').value),cw=w-2*margin,ch=h-2*margin,W=cw*cols,H=ch*rows;
 $('count').textContent=(valid?rows*cols:0)+'枚';$('empty').hidden=valid;$('print').disabled=busy||!valid||(isFile&&mediaBusy);$('assembled').replaceChildren();
 if(!valid){$('empty').textContent=isFile?'画像・PDFを選んでください。':'印刷したい文字を入力してください。';$('summary').textContent=isFile?'PDFは読み込んだ後に使うページを選びます。':'文字を入力してください。改行で行を分けられます。';return;}
 const l=isFile?null:posterLayout(lines,W,H);
 const full=isFile?mediaSVG(W,H):posterSVG(lines,W,H,l);if(!isFile){l.fontSize*=containText([full],W,H);l.fontSize*=applyPosterTextScale(full,W,H);}full.setAttribute('overflow','hidden');const overview=full.cloneNode(true);overview.classList.add('overview');
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
 const box=document.createElementNS(NS,'rect');for(const [k,v] of Object.entries({x:c*cw,y:r*ch,width:cw,height:ch,fill:'none',stroke:'#6a9da6','stroke-width':.5,'stroke-dasharray':'3 2'}))box.setAttribute(k,v);overview.append(box);
 const num=document.createElementNS(NS,'text');num.setAttribute('x',c*cw+3);num.setAttribute('y',r*ch+8);num.setAttribute('font-size',6);num.setAttribute('fill','#246573');num.textContent=r*cols+c+1;overview.append(num);
 const tile=document.createElementNS(NS,'svg');tile.setAttribute('viewBox',`0 0 ${w} ${h}`);tile.setAttribute('width',w+'mm');tile.setAttribute('height',h+'mm');const crop=full.cloneNode(true);crop.setAttribute('x',margin);crop.setAttribute('y',margin);crop.setAttribute('width',cw);crop.setAttribute('height',ch);crop.setAttribute('viewBox',`${c*cw} ${r*ch} ${cw} ${ch}`);crop.setAttribute('overflow','hidden');tile.append(crop);
 // Cut only the incoming left/top edge; keep the neighbour's right/bottom margin as a glue tab.
 // Short guide ticks stay in blank margins, never draw across the artwork or add outer-edge cuts.
 if(($('cutMarks')?.checked??true)&&margin>0){
  const marks=document.createElementNS(NS,'g');marks.setAttribute('data-cut-marks','true');marks.setAttribute('stroke','#999');marks.setAttribute('stroke-width','.15');marks.setAttribute('fill','none');
  function tick(x1,y1,x2,y2,edge){const line=document.createElementNS(NS,'line');for(const [k,v] of Object.entries({x1,y1,x2,y2,'data-cut-edge':edge}))line.setAttribute(k,v);marks.append(line);}
  const a=margin*.3,b=margin*.75;
  if(c>0){tick(margin,a,margin,b,'left');tick(margin,h-b,margin,h-a,'left');}
  if(r>0){tick(a,margin,b,margin,'top');tick(w-b,margin,w-a,margin,'top');}
  if(marks.children.length)tile.append(marks);
 }

 const wrap=document.createElement('div'),sheet=document.createElement('div');sheet.className='sheet';sheet.style.setProperty('--paperRatio',w+'/'+h);sheet.style.setProperty('--mx',100*margin/w+'%');sheet.style.setProperty('--my',100*margin/h+'%');sheet.append(tile);const cap=document.createElement('div');cap.className='caption';cap.textContent=`${r*cols+c+1} / ${rows*cols}（上から${r+1}段・左から${c+1}枚）`;wrap.append(sheet,cap);$('pages').append(wrap);const p=document.createElement('div');p.className='printPage';p.append(tile.cloneNode(true));$('printArea').append(p);
 }
 const heading=document.createElement('h3');heading.textContent='つないだ用紙全体の完成イメージ';$('assembled').append(heading,overview);
 $('summary').textContent=`${$('paper').value}・${$('orientation').selectedOptions[0].text} ／ たて${rows}枚 × よこ${cols}枚。つないだ用紙全体：たて${(H/10).toFixed(1)} × よこ${(W/10).toFixed(1)}cm。${isFile?imageSizeText(W,H)+(media.crop?' 選んだ範囲の縦横比を保持。':' 画像全体の縦横比を保持。'):`全体の文字は共通 ${Math.round(l.fontSize*72/25.4)}pt。文字サイズ ${posterTextPercent()}%。100%が用紙全体に収まる基準です。${posterTextPercent()>100?'注意：拡大により用紙全体からはみ出す文字は切れて印刷されます。':'文字は用紙全体の中央に配置します。'}`}印刷順は左上から右へ、次の段へ。全体図の点線・番号は印刷されません。切り取り目印はオンの場合、各ページと印刷に表示します。`;
}
// Keep the source choice first, then show only its relevant controls.
function updateSourceControls(poster,isFile){
 const grid=$('gridSettings'),source=$('posterSource').closest('label'),text=$('textSettings'),spacing=$('spacingSettings'),file=$('fileSettings'),planner=$('sizePlanner');
 grid.insertBefore(source,grid.firstChild);
 if(poster){
  grid.insertBefore(text,source.nextSibling);
  grid.insertBefore(spacing,text.nextSibling);
  grid.insertBefore(file,spacing.nextSibling);
  grid.insertBefore(planner,file.nextSibling);
 }else{
  grid.parentNode.insertBefore(text,grid.nextSibling);
 }
 $('paperSettingsTitle').textContent=isFile?'用紙設定':'用紙と文字';
}
function render(){
 enforceCharacterLimit();
 $('weightValue').textContent=fontWeight()<=300?'細め':fontWeight()<=500?'標準':fontWeight()<=700?'太め':'極太';$('outlineValue').textContent=outlineWidth().toFixed(1)+' mm';$('outlineControl').hidden=$('letterStyle').value!=='outline';
 const mediaKey=$('posterSource').value+':' +(media?media.url+JSON.stringify([media.crop,media.rotation,media.scale]):'');if(mediaKey!==plannerMediaKey){plannerMediaKey=mediaKey;if($('sizeResults').children.length)showSizes();}
 for(const b of $('sizeResults').querySelectorAll('button'))b.removeAttribute('aria-pressed');
 syncColors();renderChoices();
 $('trackingValue').textContent=Number($('tracking').value)===0?'標準':`${Number($('tracking').value)>0?'+':''}${$('tracking').value}%`;$('leadingValue').textContent=$('leading').value+'%';
 const entries=letterEntries($('words').value).filter(e=>e.char.trim()),all=entries.map(e=>e.char),chars=all.slice(0,40);const [w,h]=dimensions(),margin=Number($('margin').value);
 $('pages').replaceChildren();$('printArea').replaceChildren();$('empty').hidden=chars.length>0;$('count').textContent=chars.length+'枚';$('print').disabled=busy||!chars.length;
 $('pageStyle').textContent=`@page{size:${w}mm ${h}mm;margin:0}.printPage{width:${w}mm;height:${h}mm}`;
 $('status').textContent=all.length>40?'40文字まで印刷できます。超過分はプレビュー・印刷に含まれません。':'';
 const poster=$('mode').value==='poster',isFile=poster&&$('posterSource').value==='file';updateSourceControls(poster,isFile);$('fileSettings').hidden=!isFile;$('spacingSettings').hidden=isFile;$('textSettings').hidden=isFile;$('fontSettings').hidden=isFile;$('colorSetting').hidden=isFile;$('partialColors').hidden=isFile;$('empty').textContent='印刷したい文字を入力してください。';$('gridSettings').hidden=!poster;$('assembled').hidden=!poster;$('inputHint').textContent=poster?'文字列全体を指定枚数に分割します。空白はそのまま、改行で行を分けられます。':'空白・改行は印刷しません。最大40文字。';$('singleAdjust').hidden=poster;$('singleNavigation').hidden=poster;$('previewSwitch').hidden=poster;document.body.classList.toggle('poster-mode',poster);if(poster){$('status').textContent='';renderPoster(w,h,margin);return;}
 if(!chars.length){$('singleNavigation').hidden=true;$('pageTabs').replaceChildren();$('summary').textContent='１文字につき１枚。同じフォントサイズでそろえます。';return;}
 const l=layout(chars,w,h,margin,activeFont);
 const originals=chars.map((char,i)=>makeSVG(char,w,h,l,i,letterColors[entries[i].index]));// Already fitted to actual ink bounds by layout; do not shrink to the font em box.
 applySingleAdjust(originals,w,h);
 $('summary').textContent=`${$('paper').value}・${$('orientation').selectedOptions[0].text} ／ 余白 ${margin}mm ／ 全${chars.length}枚 共通 ${Math.round(l.fontSize*Number($('scale').value)/100*72/25.4)}pt。文字ごとの形や幅の違いはそのままに、同じ倍率で印刷します。`;
 chars.forEach((char,i)=>{const wrapper=document.createElement('div'),sheet=document.createElement('div');sheet.className='sheet';sheet.style.setProperty('--paperRatio',w+'/'+h);sheet.style.setProperty('--mx',100*margin/w+'%');sheet.style.setProperty('--my',100*margin/h+'%');sheet.append(originals[i]);const cap=document.createElement('div');cap.className='caption';cap.textContent=`${i+1} / ${chars.length}`;wrapper.append(sheet,cap);$('pages').append(wrapper);const p=document.createElement('div');p.className='printPage';p.append(originals[i].cloneNode(true));$('printArea').append(p);});
 updatePreview();
}
async function changeFont(){const seq=++generation;busy=true;render();try{
 const value=$('font').value;
 if(value.startsWith('local:')){const item=localList[Number(value.slice(6))];const data=await(await item.blob()).arrayBuffer();const name='ZurukichiLocal'+seq;const face=new FontFace(name,data);await face.load();if(seq!==generation)return;document.fonts.add(face);activeFont=name;$('fontStatus').textContent=`${item.fullName} を使用中。端末内だけで読み込んでいます。`;
 }else{activeFont=value;await document.fonts.load(`1000px ${activeFont}`);}
 }catch(e){activeFont='sans-serif';$('font').value='sans-serif';$('fontStatus').textContent='このフォントを読み込めませんでした。基本のゴシックに戻しました。';}finally{if(seq===generation){busy=false;render();}}
}
$('localFonts').addEventListener('click',async()=>{
 if(!('queryLocalFonts' in window)){ $('fontStatus').textContent='このブラウザでは一覧を取得できません。パソコン版Chrome・Edgeでお試しください。基本フォントはそのまま使えます。';return;}
 $('localFonts').disabled=true;
 try{localList=(await window.queryLocalFonts()).sort((a,b)=>a.fullName.localeCompare(b.fullName,'ja'));$('font').querySelector('[data-local]')?.remove();const group=document.createElement('optgroup');group.label='このパソコンのフォント';group.dataset.local='true';localList.forEach((f,i)=>{const option=document.createElement('option');option.value='local:'+i;option.textContent=f.fullName;group.append(option);});$('font').append(group);$('fontStatus').textContent=localList.length?`${localList.length}種類を読み込みました。上のフォント欄から選べます。`:'利用できるフォントがありませんでした。';}
 catch(e){$('fontStatus').textContent=e.name==='NotAllowedError'?'フォントへのアクセスが許可されませんでした。基本フォントで続けられます。':'フォント一覧を取得できませんでした。学校の管理設定などで制限されている場合があります。';}
 finally{$('localFonts').disabled=false;}
});
function fittedImageSize(W,H,width,height){const scale=Math.min(W/width,H/height);return {width:width*scale,height:height*scale,padX:Math.max(0,(W-width*scale)/2),padY:Math.max(0,(H-height*scale)/2)};}
function imageGeometry(W,H){
 const r=media.crop||{x:0,y:0,width:media.width,height:media.height},angle=media.rotation||0,turn=angle%180!==0;
 const rw=turn?r.height:r.width,rh=turn?r.width:r.height,percent=media.scale||100,scale=Math.min(W/rw,H/rh)*percent/100,width=rw*scale,height=rh*scale;
 return {r,angle,percent,scale,width,height,x:(W-width)/2,y:(H-height)/2,clipped:width>W+1e-7||height>H+1e-7};
}
function imageSizeText(W,H){const d=imageGeometry(W,H);return `画像サイズ ${d.percent}%・右回転${d.angle}°。画像の印刷サイズ：たて${(d.height/10).toFixed(1)} × よこ${(d.width/10).toFixed(1)}cm（${media.crop?'選択範囲内':'元画像内'}の余白も含む）。`+(d.clipped?`注意：用紙からはみ出す部分は印刷されません。用紙内に残る範囲：たて${(Math.min(H,d.height)/10).toFixed(1)} × よこ${(Math.min(W,d.width)/10).toFixed(1)}cm。`:`追加の白余白：左右各${(Math.max(0,d.x)/10).toFixed(1)}cm・上下各${(Math.max(0,d.y)/10).toFixed(1)}cm。`);}

function sizeCandidates(targetW,targetH,margin){
 const list=[];
 for(const [paper,dims] of Object.entries(sizes))for(const orientation of ['portrait','landscape']){const [w,h]=orientation==='portrait'?dims:[dims[1],dims[0]];for(let rows=1;rows<=6;rows++)for(let cols=1;cols<=6;cols++){const width=(w-2*margin)*cols,height=(h-2*margin)*rows;list.push({paper,orientation,rows,cols,width,height,count:rows*cols,error:Math.abs(width-targetW)/targetW+Math.abs(height-targetH)/targetH,covers:width>=targetW&&height>=targetH});}}
 return list;
}
function showSizes(){
 const W=Number($('targetW').value)*10,H=Number($('targetH').value)*10,margin=Number($('margin').value),box=$('sizeResults');box.replaceChildren();
 if(!Number.isFinite(W)||!Number.isFinite(H)||W<100||H<100||W>2000||H>2000){box.textContent='たて・よこを10〜200cmで入力してください。';return;}
 const all=sizeCandidates(W,H,margin),near=[...all].sort((a,b)=>a.error-b.error||a.count-b.count),cover=all.filter(a=>a.covers).sort((a,b)=>a.count-b.count||a.error-b.error),choices=[];
 const add=(label,c)=>{if(c&&!choices.some(x=>x.c===c))choices.push({label,c});};add('目標にいちばん近い',near[0]);add('用紙全体が目標以上で枚数最少',cover[0]);for(const paper of ['A4','A3','B5','B4'])add(paper+'で近い',near.find(c=>c.paper===paper));
 const note=document.createElement('p');note.className='hint';note.textContent=`用紙全体の目標：たて${H/10} × よこ${W/10}cm ／ 余白${margin}mm。近さ＝たて・よこの差の割合の合計。`+(near[0].error===0?'ぴったりの候補があります。':'ぴったりの候補はありません。候補の完成サイズを確認してください。')+(!cover.length?' この範囲では目標以上のサイズを作れません。':'');box.append(note);
 for(const {label,c} of choices){const b=document.createElement('button');b.type='button';b.className='sizeCandidate';const diff=v=>(v>0?'+':'')+(v/10).toFixed(1);b.textContent=`${label}：${c.paper}・${c.orientation==='portrait'?'たて':'よこ'}置き\nたて${c.rows} × よこ${c.cols}枚（計${c.count}枚）\nつないだ用紙全体：たて${(c.height/10).toFixed(1)} × よこ${(c.width/10).toFixed(1)}cm\n用紙全体と目標との差：たて${diff(c.height-H)}／よこ${diff(c.width-W)}cm${$('posterSource').value==='file'?(media?'\n'+imageSizeText(c.width,c.height):'\n画像の印刷サイズ：画像・PDFページを選ぶと表示'):''}`;
 b.addEventListener('click',()=>{$('paper').value=c.paper;$('orientation').value=c.orientation;$('rows').value=c.rows;$('cols').value=c.cols;render();for(const button of box.querySelectorAll('button'))button.removeAttribute('aria-pressed');b.setAttribute('aria-pressed','true');});box.append(b);}
}
$('findSizes').addEventListener('click',showSizes);
for(const id of ['targetW','targetH','margin'])$(id).addEventListener('input',()=>{if($('sizeResults').children.length)showSizes();});
function enforceCharacterLimit(){
 if($('mode').value!=='single')return;
 const entries=letterEntries($('words').value).filter(e=>e.char.trim());
 if(entries.length>40){const end=entries[39];$('words').value=$('words').value.slice(0,end.index+end.char.length);}
}
function letterEntries(value){if(segmenter)return [...segmenter.segment(value)].map(e=>({char:e.segment,index:e.index}));let index=0;return Array.from(value).map(char=>{const e={char,index};index+=char.length;return e;});}
function syncColors(){const value=$('words').value;if(value===previousWords)return;const old=previousWords;let prefix=0;while(prefix<old.length&&prefix<value.length&&old[prefix]===value[prefix])prefix++;let suffix=0;while(suffix<old.length-prefix&&suffix<value.length-prefix&&old[old.length-1-suffix]===value[value.length-1-suffix])suffix++;const next={};for(const [raw,color] of Object.entries(letterColors)){const i=Number(raw);if(i<prefix)next[i]=color;else if(i>=old.length-suffix)next[i+value.length-old.length]=color;}letterColors=next;selectedLetters.clear();previousWords=value;}
function renderChoices(){
 const box=$('letterChoices');box.replaceChildren();
 const single=$('mode').value==='single';
 const entries=letterEntries($('words').value).filter(e=>e.char.trim()).slice(0,single?40:200);
 box.classList.add('individualColors');
 entries.forEach((e,n)=>{
  const label=document.createElement('label');label.className='characterColor';
  const name=document.createElement('span');name.textContent=`${n+1}. ${e.char}`;
  const picker=document.createElement('input');picker.type='color';picker.value=letterColors[e.index]||$('color').value;picker.setAttribute('aria-label',`${n+1}文字目「${e.char}」の色`);
  picker.addEventListener('change',()=>{letterColors[e.index]=picker.value;render();const next=$('letterChoices').querySelectorAll('input')[n];next?.focus();});label.append(name,picker);box.append(label);
 });
 $('partialColor').closest('.row').hidden=true;$('selectionInfo').hidden=true;$('clearSelection').hidden=true;
 $('partialColorHelp').textContent='１文字ずつ色を指定できます。同じ文字があっても別々に設定できます。白抜きでは輪郭の色になります。';
}
$('applyColor').addEventListener('click',()=>{for(const i of selectedLetters)letterColors[i]=$('partialColor').value;render();});
$('clearSelection').addEventListener('click',()=>{selectedLetters.clear();renderChoices();});
$('resetColors').addEventListener('click',()=>{letterColors={};selectedLetters.clear();render();});
function mediaSVG(W,H){
 const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('width',W+'mm');svg.setAttribute('height',H+'mm');svg.setAttribute('overflow','hidden');
 const d=imageGeometry(W,H),r=d.r;
 const group=document.createElementNS(NS,'g');group.setAttribute('transform',`translate(${W/2} ${H/2}) scale(${d.scale}) rotate(${d.angle}) translate(${-r.width/2} ${-r.height/2})`);
 const view=document.createElementNS(NS,'svg');view.setAttribute('x',0);view.setAttribute('y',0);view.setAttribute('width',r.width);view.setAttribute('height',r.height);view.setAttribute('viewBox',`${r.x} ${r.y} ${r.width} ${r.height}`);view.setAttribute('overflow','hidden');
 const img=document.createElementNS(NS,'image');img.setAttribute('href',media.url);img.setAttribute('width',media.width);img.setAttribute('height',media.height);view.append(img);group.append(view);svg.append(group);return svg;
}
function updateCropUI(){
 for(const id of ['rotateImage','imageScale','imageScaleRange','imageScaleDown','imageScaleUp','imageScaleReset','resetImageTransform'])$(id).disabled=!media||mediaBusy;$('imageScaleRange').value=media?.scale||100;$('imageScale').value=media?.scale||100;$('imageRotation').textContent=(media?.rotation||0)+'°';$('openCrop').disabled=!media||mediaBusy;$('resetCrop').hidden=!media?.crop;
 $('cropInfo').textContent=media?.crop?`選択範囲：${media.crop.width} × ${media.crop.height}px。元の画像は変更しません。`:'指定しなければ画像全体を使います。PDFはページを変えると範囲をリセットします。';
}
function clearMedia(){if(media)URL.revokeObjectURL(media.url);media=null;updateCropUI();if($('cropDialog').open)$('cropDialog').close();}
let cropDraft=null,cropStart=null,cropPointer=null;
function cropPoint(e){const b=$('cropImage').getBoundingClientRect();return {x:Math.max(0,Math.min(media.width,(e.clientX-b.left)/b.width*media.width)),y:Math.max(0,Math.min(media.height,(e.clientY-b.top)/b.height*media.height))};}
function drawCropDraft(){const r=cropDraft,b=$('cropBox');b.hidden=!r;if(!r){$('applyCrop').disabled=true;return;}Object.assign(b.style,{left:r.x/media.width*100+'%',top:r.y/media.height*100+'%',width:r.width/media.width*100+'%',height:r.height/media.height*100+'%'});$('applyCrop').disabled=r.width<2||r.height<2;$('cropDraftInfo').textContent=`選択範囲：${r.width} × ${r.height}px。ドラッグし直すと選び直せます。`;}
$('openCrop').onclick=()=>{if(!media||mediaBusy)return;cropDraft=media.crop?{...media.crop}:null;cropStart=null;cropPointer=null;$('cropImage').src=media.url;$('cropDialog').showModal();$('cropDraftInfo').textContent='画像をドラッグして四角で囲んでください。';drawCropDraft();};
$('cropStage').onpointerdown=e=>{if(!media||cropPointer!==null||e.button!==0)return;e.preventDefault();cropPointer=e.pointerId;cropStart=cropPoint(e);$('cropStage').setPointerCapture(e.pointerId);cropDraft=null;drawCropDraft();};
$('cropStage').onpointermove=e=>{if(!cropStart||e.pointerId!==cropPointer)return;const p=cropPoint(e);const x=Math.floor(Math.min(cropStart.x,p.x)),y=Math.floor(Math.min(cropStart.y,p.y));cropDraft={x,y,width:Math.ceil(Math.max(cropStart.x,p.x))-x,height:Math.ceil(Math.max(cropStart.y,p.y))-y};drawCropDraft();};
function endCropDrag(e){if(e.pointerId!==cropPointer)return;cropStart=null;cropPointer=null;}
$('cropStage').onpointerup=endCropDrag;$('cropStage').onpointercancel=endCropDrag;
$('applyCrop').onclick=()=>{if(!media||!cropDraft||cropDraft.width<2||cropDraft.height<2)return;media.crop={...cropDraft};$('cropDialog').close();updateCropUI();render();};
$('cancelCrop').onclick=()=>$('cropDialog').close();
$('resetCrop').onclick=()=>{if(media)delete media.crop;updateCropUI();render();};
async function useCanvas(c,token,message){const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));if(token!==mediaToken)return;if(!blob)throw Error('画像化できませんでした。');const url=URL.createObjectURL(blob);const check=new Image();check.src=url;await check.decode();if(token!==mediaToken){URL.revokeObjectURL(url);return;}clearMedia();media={url,width:c.width,height:c.height};mediaBusy=false;updateCropUI();$('fileInfo').textContent=message+`（${c.width}×${c.height}px）`;render();}
async function pdfPageLoad(){const token=++mediaToken;clearMedia();const n=Number($('pdfPage').value);if(!n){mediaBusy=false;render();return;}mediaBusy=true;$('fileInfo').textContent='PDFのページを画像化しています…';render();try{const p=await pdfDoc.getPage(n),base=p.getViewport({scale:1}),scale=Math.min(3,4096/Math.max(base.width,base.height)),vp=p.getViewport({scale});const c=document.createElement('canvas');c.width=Math.ceil(vp.width);c.height=Math.ceil(vp.height);await p.render({canvasContext:c.getContext('2d'),viewport:vp,background:'#fff'}).promise;p.cleanup();await useCanvas(c,token,`PDF 全${pdfDoc.numPages}ページ中 ${n}ページを使用。`);}catch(e){if(token!==mediaToken)return;mediaBusy=false;$('fileInfo').textContent='このページを読み込めませんでした。別のページか画像をお試しください。';render();}}
$('pdfPage').addEventListener('change',pdfPageLoad);
$('sourceFile').addEventListener('change',async e=>{
 const f=e.target.files[0];if(!f)return;const token=++mediaToken;clearMedia();mediaBusy=true;$('pdfPicker').hidden=true;$('fileInfo').textContent='ファイルを読み込んでいます…';render();
 if(pdfTask){pdfTask.destroy();pdfTask=null;pdfDoc=null;}
 try{if(f.size>25*1024*1024)throw Error('25MB以下のファイルを選んでください。');
 if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){
  const lib=globalThis.pdfjsLib;if(token!==mediaToken)return;lib.GlobalWorkerOptions.workerSrc='./previous-prototype/vendor/pdfjs/pdf.worker.mjs';const root='./previous-prototype/vendor/pdfjs/';
  const task=lib.getDocument({data:new Uint8Array(await f.arrayBuffer()),cMapUrl:root+'cmaps/',cMapPacked:true,BinaryDataFactory:globalThis.PittariBinaryDataFactory,useWorkerFetch:false,standardFontDataUrl:root+'standard_fonts/',wasmUrl:root+'wasm/',isEvalSupported:false,enableXfa:false});pdfTask=task;
  let rejectPassword;const passwordError=new Promise((_,reject)=>rejectPassword=reject);task.onPassword=()=>{rejectPassword(Error('パスワード付きPDFは未対応です。画像に書き出してお試しください。'));task.destroy();};
  const doc=await Promise.race([task.promise,passwordError]);if(token!==mediaToken){task.destroy();return;}if(doc.numPages>200){task.destroy();throw Error('200ページ以下のPDFを選んでください。');}pdfDoc=doc;
  $('pdfPage').replaceChildren();const first=document.createElement('option');first.value='';first.textContent='使うページを選んでください';$('pdfPage').append(first);for(let i=1;i<=doc.numPages;i++){const o=document.createElement('option');o.value=i;o.textContent=i+'ページ';$('pdfPage').append(o);}$('pdfPicker').hidden=false;mediaBusy=false;$('fileInfo').textContent=`${f.name}：全${doc.numPages}ページ。使うページを選んでください。`;render();
 }else{if(!/\.(jpe?g|png|webp)$/i.test(f.name)&&!/^image\/(jpeg|png|webp)$/.test(f.type))throw Error('JPEG・PNG・WebP・PDFを選んでください。');const url=URL.createObjectURL(f);try{const im=new Image();im.src=url;await im.decode();if(token!==mediaToken)return;if(im.width*im.height>40000000)throw Error('4000万画素以下の画像を選んでください。');const ratio=Math.min(1,4096/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*ratio);c.height=Math.round(im.height*ratio);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);await useCanvas(c,token,f.name+(ratio<1?'：長辺4096pxに縮小。':'：'));}finally{URL.revokeObjectURL(url);}}
 }catch(e){if(token!==mediaToken)return;mediaBusy=false;clearMedia();$('fileInfo').textContent=/以下|未対応|選んで|画像化/.test(e.message)?e.message:'読み込めませんでした。破損していない画像またはPDFをお試しください。';render();}
});
$('resetSpacing').addEventListener('click',()=>{$('tracking').value='0';$('leading').value='18';render();});
$('font').addEventListener('change',changeFont);
for(const id of ['words','paper','orientation','margin','color','letterStyle','mode','rows','cols','tracking','leading','posterSource','fontWeight','outlineThickness','cutMarks']) $(id).addEventListener('input',render);
$('print').addEventListener('click',async()=>{if(busy)return;await document.fonts.ready;render();if(!$('print').disabled)window.print();});
window.addEventListener('beforeprint',render);
if(!('queryLocalFonts' in window))$('fontStatus').textContent='PC内のフォント一覧はパソコン版Chrome・Edgeで利用できます。この端末では基本フォントを使えます。';
document.fonts.ready.then(render);render();

function applySingleAdjust(svgs,w,h){
 const scale=Math.max(10,Math.min(150,Number($('scale').value)||100))/100;
 const x=Math.max(-200,Math.min(200,Number($('shiftX').value)||0)),y=Math.max(-200,Math.min(200,Number($('shiftY').value)||0));
 svgs.forEach(svg=>{const group=document.createElementNS(NS,'g');group.setAttribute('transform',`translate(${w/2+x} ${h/2+y}) scale(${scale}) translate(${-w/2} ${-h/2})`);while(svg.firstChild)group.append(svg.firstChild);svg.append(group);});
 if(scale>1||x||y)$('status').textContent+=' サイズや位置を変更しています。点線からはみ出す部分は印刷時に欠ける場合があります。';
}
function updatePreview(){
 const pages=[...$('pages').children];currentPreview=Math.max(0,Math.min(currentPreview,pages.length-1));
 $('pages').classList.toggle('allSheets',previewMode==='all');$('singleNavigation').hidden=previewMode==='all';$('singleView').setAttribute('aria-pressed',previewMode==='single');$('allView').setAttribute('aria-pressed',previewMode==='all');$('pageTabs').replaceChildren();pages.forEach((page,i)=>{page.hidden=previewMode==='single'&&i!==currentPreview;const b=document.createElement('button');b.textContent=page.querySelector('svg').getAttribute('aria-label');b.title=`${i+1}枚目`;b.setAttribute('aria-pressed',i===currentPreview);b.onclick=()=>{currentPreview=i;updatePreview();};$('pageTabs').append(b);});
 $('prevPage').disabled=currentPreview===0;$('nextPage').disabled=currentPreview>=pages.length-1;
 requestAnimationFrame(fitSinglePreview);
}
function openMode(mode){modeMargins[$('mode').value]=$('margin').value;$('mode').value=mode;$('margin').value=modeMargins[mode];$('margin').options[0].textContent=mode==='poster'?'5mm':'5mm（標準）';$('margin').options[2].textContent=mode==='poster'?'10mm（1cm・標準）':'10mm（広め）';if($('sizeResults').children.length)showSizes();document.body.classList.remove('choosing');$('modeTitle').textContent=mode==='single'?'一文字プリント':'ポスタープリント';render();}
$('chooseSingle').onclick=()=>openMode('single');$('choosePoster').onclick=()=>openMode('poster');$('backModes').onclick=()=>document.body.classList.add('choosing');
$('prevPage').onclick=()=>{currentPreview--;updatePreview();};$('nextPage').onclick=()=>{currentPreview++;updatePreview();};
$('scaleRange').oninput=()=>{$('scale').value=$('scaleRange').value;render();};$('scale').oninput=()=>{$('scaleRange').value=$('scale').value;render();};
for(const id of ['shiftX','shiftY'])$(id).addEventListener('input',render);
$('resetAdjust').onclick=()=>{$('scale').value=$('scaleRange').value=100;$('shiftX').value=$('shiftY').value=0;render();};
// Reorganize existing controls without duplicating their state or print logic.
const side=document.querySelector('aside'),left=document.createElement('div'),right=document.createElement('div');left.className='controlsPrimary';right.className='controlsSecondary';
while(side.firstChild)left.append(side.firstChild);side.append(left,right);
let boundary=left.querySelector('h2');while(boundary){const next=boundary.nextSibling;right.append(boundary);boundary=next;}
left.insertBefore($('singleAdjust'),$('partialColors'));
const print=$('print'),status=$('status'),printHint=status.nextElementSibling;const actions=document.createElement('div');actions.className='printActions';actions.append(print,status,printHint);side.append(actions);
const marginDetails=$('margin').closest('details');marginDetails.open=true;marginDetails.classList.add('finishSettings');
// Partial colour is a compact popover, not a second page of controls.
$('partialColors').querySelector('summary').textContent='一文字ずつ色を変える';
render();

// Fit both axes together. max-width alone used to squash landscape paper.
function fitSinglePreview(){
 if(document.body.classList.contains('choosing')||$('mode').value!=='single')return;
 const [w,h]=dimensions(),area=$('pages');
 if(previewMode==='all'){for(const sheet of area.querySelectorAll('.sheet')){sheet.style.width='100%';sheet.style.height='auto';sheet.style.aspectRatio=w+'/'+h;}return;}
 const availableW=Math.max(1,area.clientWidth-4),availableH=Math.max(1,area.clientHeight-26);
 const scale=Math.min(availableW/w,availableH/h);
 for(const sheet of area.querySelectorAll('.sheet')){sheet.style.width=(w*scale)+'px';sheet.style.height=(h*scale)+'px';sheet.style.aspectRatio='auto';}
}
new ResizeObserver(fitSinglePreview).observe($('pages'));
window.addEventListener('resize',fitSinglePreview);

$('singleView').onclick=()=>{previewMode='single';updatePreview();};
$('allView').onclick=()=>{previewMode='all';updatePreview();};

$('rotateImage').onclick=()=>{if(!media)return;media.rotation=((media.rotation||0)+90)%360;updateCropUI();render();};
$('resetImageTransform').onclick=()=>{if(!media)return;media.rotation=0;media.scale=100;updateCropUI();render();};

// Shared 1%-step controls; invalid in-progress numeric input never reaches the print scene.
function bindPosterScale(id,isImage){
 const number=$(id),range=$(id+'Range');
 function apply(value,normalize){
  if(isImage&&!media)return;
  let n=Number(value);if(!Number.isFinite(n)||n<10||n>200){if(!normalize)return;n=Math.max(10,Math.min(200,n||100));}
  n=Math.round(n);number.value=range.value=n;if(isImage)media.scale=n;render();
 }
 number.oninput=()=>apply(number.value,false);number.onchange=()=>apply(number.value,true);
 range.oninput=()=>apply(range.value,true);
 $(id+'Down').onclick=()=>apply((Number(number.value)||100)-1,true);
 $(id+'Up').onclick=()=>apply((Number(number.value)||100)+1,true);
 $(id+'Reset').onclick=()=>apply(100,true);
}
bindPosterScale('posterTextScale',false);bindPosterScale('imageScale',true);updateCropUI();
