'use strict';
const $=id=>document.getElementById(id), esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const catalog=[];const add=(id,name,cat,kind,data={})=>catalog.push({id,name,cat,kind,...data});
[[8,25,6,8],[10,21,7,10],[12,18,8,12],[15,15,10,15],[18,12,12,18]].forEach(([n,cell,cols,rows])=>add('j'+n,'国語 '+n+'マス','国語','grid',{cell,cols,rows}));
[[6,22,10,6],[7,18,12,7],[14,15,10,14],[17,12,12,17]].forEach(([n,cell,cols,rows])=>add('m'+n,'算数 '+n+'マス','算数','grid',{cell,cols,rows}));
[[50,22,5,10],[120,14,8,15],[200,11,10,20]].forEach(([n,cell,cols,rows])=>add('k'+n,'漢字 '+n+'字','漢字','kanji',{cell,cols,rows,ruby:4}));
add('g1','1mm方眼（グラフ用）','方眼・罫線','graph',{cell:1});
add('brushMath','筆算ノート','算数','columnMath',{cell:14});
add('graph5','グラフ用 5mm方眼（題名・軸の記入欄つき）','方眼・罫線','graphWorksheet',{cell:5});
[5,10,15,20].forEach(cell=>add('g'+cell,cell+'mm方眼','方眼・罫線','grid',{cell}));
[5,10].forEach(step=>add('dot'+step,'点方眼 '+step+'mm','方眼・罫線','dots',{step}));
add('h7','横罫 7mm','方眼・罫線','lines',{step:7});add('h10','横罫 10mm','方眼・罫線','lines',{step:10});add('v12','縦罫 12mm','国語','vertical',{step:12});add('v7','縦罫 7mm','方眼・罫線','vertical',{step:7});add('v10','縦罫 10mm','方眼・罫線','vertical',{step:10,also:'国語'});
add('contact-v10','連絡帳 縦書き10行','連絡帳','contactVertical',{step:13.5,cols:10});add('contact-v14','連絡帳 縦書き14行','連絡帳','contactVertical',{step:10,cols:14});add('contact-h10','連絡帳 横書き・10日分','連絡帳','contactHorizontal',{days:10,linesPerDay:2,step:10});
add('gen200','原稿用紙 200字','作文・日記','manuscript',{cols:10,rows:20,cell:10});add('gen400','原稿用紙 400字','作文・日記','manuscript',{cols:20,rows:20,cell:8});
add('diary','絵日記（横罫）','作文・日記','diary');add('diarygrid','絵日記（15mmマス）','作文・日記','diarygrid');
add('observe','生活科の観察','観察・記録','observe');add('compare','くらべる観察','観察・記録','compare');add('experiment','実験の記録','観察・記録','boxes',{labels:['予想','調べ方・方法','結果','考えたこと']});add('book','読書メモ','観察・記録','boxes',{labels:['本の題名・作者','心に残った場面','その理由・考えたこと']});add('interview','インタビューメモ','観察・記録','interview');
add('letter','お礼のお手紙（清書）','手紙','letter');add('draft','お礼のお手紙（下書き）','手紙','boxes',{labels:['何のお礼を伝えたい？','心に残っていること','これからのこと・結び']});
add('venn','ベン図（共通点・違い）','思考ツール','venn');add('y','Yチャート（３つの視点）','思考ツール','y');add('t','Tチャート（２つを比較）','思考ツール','t');add('flow','順序を整理（３つ）','思考ツール','flow');add('mind','考えを広げる','思考ツール','mind');add('reflection','学習のふりかえり','思考ツール','boxes',{labels:['わかったこと','まだ知りたいこと','次にやってみること']});
const notebookCatalog=catalog.filter(t=>['国語','算数','漢字','方眼・罫線','連絡帳'].includes(t.cat)||t.kind==='manuscript').map(t=>t.kind==='manuscript'?{...t,cat:'原稿用紙'}:t);
const kanaTemplates=new Set(['j8','k50','m6','m7','contact-v10']);
let active='j10', category='すべて';let previousNotebookPaper='B5', manuscriptPaper='B4';
const template=id=>notebookCatalog.find(t=>t.id===id);
function selectTemplate(id){
  const paper=$('paper');
  if(paper.value==='B4-mix'){$('mixLeft').value=id;renderList();render();return;}
  if(active!=='gen400'&&id==='gen400'){previousNotebookPaper=paper.value;paper.value=manuscriptPaper;}
  else if(active==='gen400'&&id!=='gen400'){manuscriptPaper=paper.value;paper.value=previousNotebookPaper;}
  active=id;renderList();render();
}
function renderList(){const q=$('search').value.trim();$('templates').innerHTML=notebookCatalog.filter(t=>(category==='すべて'||t.cat===category||t.also===category)&&(!q||(t.name+t.cat).includes(q))).map(t=>`<button data-id="${t.id}" class="${t.id===($('paper').value==='B4-mix'?$('mixLeft').value:active)?'active':''}">${t.name}<small>${t.cell?t.cell+'mm・寸法固定':t.cat}</small></button>`).join('')||'<p>見つかりませんでした</p>';document.querySelectorAll('[data-id]').forEach(b=>b.onclick=()=>selectTemplate(b.dataset.id))}
function makeSheet(t,mode){const paper=mode.startsWith('B4')?'B4':mode.startsWith('B5')?'B5':'A4',manuscript400=t.id==='gen400',kana=kanaTemplates.has(t.id),twoUp=paper==='B4'&&!manuscript400,duplex=mode.endsWith('-duplex'), wide=mode==='A4-wide', landscape=manuscript400||['m6','m7'].includes(t.id),pw=paper==='A4'?210:paper==='B4'&&!twoUp?257:182,ph=paper==='A4'?297:paper==='B4'&&!twoUp?364:257,W=landscape?ph:pw,H=landscape?pw:ph,cw=wide?W-16:landscape?246:174,ch=wide?H-16:landscape?174:246,ox=(W-cw)/2,oy=(H-ch)/2,gray=$('tone').value;let s=[],note='',count='',last={};
const regions=[],fields=[];
const region=(x,y,cols,rows,cell,pitch=cell)=>regions.push({x,y,cols,rows,cell,pitch,vertical:['国語','漢字','原稿用紙'].includes(t.cat),manuscript:t.kind==='manuscript'});
const line=(x1,y1,x2,y2,dash=false)=>s.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${dash?'stroke-dasharray="1.1 1.1"':''}/>`),rect=(x,y,w,h)=>s.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`),txt=(x,y,str,size=3.1)=>s.push(`<text x="${x}" y="${y}" font-size="${size}" fill="#666" stroke="none">${esc(str)}</text>`);
const x=ox+5,top=manuscript400?10:17,y=oy+top,w=cw-10,h=ch-top-4;
function grid(gx,gy,cols,rows,cell,guides=false,gutter=0,record=true){if(record&&!gutter)region(gx,gy,cols,rows,cell);for(let c=0;c<=cols;c++){let px=gx+c*cell+(c>cols/2?gutter:0);line(px,gy,px,gy+rows*cell)}if(gutter){line(gx+cols/2*cell+gutter,gy,gx+cols/2*cell+gutter,gy+rows*cell)}for(let r=0;r<=rows;r++){if(gutter){line(gx,gy+r*cell,gx+cols/2*cell,gy+r*cell);line(gx+cols/2*cell+gutter,gy+r*cell,gx+cols*cell+gutter,gy+r*cell)}else line(gx,gy+r*cell,gx+cols*cell,gy+r*cell);}if(guides){for(let c=0;c<cols;c++)line(gx+(c+.5)*cell,gy,gx+(c+.5)*cell,gy+rows*cell,true);for(let r=0;r<rows;r++)line(gx,gy+(r+.5)*cell,gx+cols*cell,gy+(r+.5)*cell,true)}}
function ruled(rx,ry,rw,rh,step=9){for(let py=ry+step;py<=ry+rh+.01;py+=step)line(rx,py,rx+rw,py)}
function panel(px,py,pw,ph,label){rect(px,py,pw,ph);if(label)txt(px+3,py+5,label)}
if($('title').value&&t.kind!=='graphWorksheet')txt(x,oy+(manuscript400?7:9),$('title').value,3.8);txt(ox+cw-64,oy+(manuscript400?7:13),(kana?'なまえ':'名前')+' '+($('name').value||'________________'));
if(t.kind==='grid'){let cols=(wide||!t.cols)?Math.floor(w/t.cell):t.cols,rows=t.rows||Math.floor(h/t.cell);grid(x+(w-cols*t.cell)/2,wide?y+(h-rows*t.cell)/2:y,cols,rows,t.cell,$('guide').checked&&t.cell>=10);count=`１マス ${t.cell}mm ／ 横${cols} × 縦${rows}（${cols*rows}マス）`;if(cols*t.cell>w||rows*t.cell>h)note='この規格は収まりません。寸法・マス数は変更していません。';last={cell:t.cell,cols,rows,gridWidth:cols*t.cell,gridHeight:rows*t.cell}}
else if(t.kind==='kanji'){const {cell,cols,rows,ruby}=t,gw=cols*(cell+ruby),gh=rows*cell,gx=x+(w-gw)/2,gy=wide?y+(h-gh)/2:y;region(gx,gy,cols,rows,cell,cell+ruby);fields.push({kind:"ruby",x:gx,y:gy,cols,rows,cell,ruby});for(let c=0;c<cols;c++){const cx=gx+c*(cell+ruby);grid(cx,gy,1,rows,cell,$('guide').checked,0,false);rect(cx+cell,gy,ruby,gh);for(let r=1;r<rows;r++)line(cx+cell,gy+r*cell,cx+cell+ruby,gy+r*cell);}count=`${cols*rows}字 ／ 漢字 ${cell}mm角 ／ 横${cols} × 縦${rows} ／ 右に読み仮名欄`;last={cell,cols,rows,ruby,gridWidth:gw,gridHeight:gh};if(gw>w||gh>h)note='この規格は収まりません。寸法・マス数は変更していません。';}
else if(manuscript400){
  const {cell,cols,rows}=t,ruby=3,gutter=10,halfCols=cols/2,pitch=cell+ruby,panelW=halfCols*pitch,gw=panelW*2+gutter,gh=rows*cell,gx=x+(w-gw)/2,gy=wide?y+(h-gh)/2:y;
  txt(gx,gy-3,'No.',2.8);line(gx+5,gy-2.8,gx+24,gy-2.8);
  s.push(`<rect data-manuscript-frame="" x="${gx-.6}" y="${gy-.6}" width="${gw+1.2}" height="${gh+1.2}" fill="none" stroke-width=".36"/>`);
  for(const [index,start] of [gx,gx+panelW+gutter].entries()){
    region(start,gy,halfCols,rows,cell,pitch);
    s.push(`<g data-manuscript-half="${index===0?'left':'right'}">`);
    for(let col=0;col<halfCols;col++){
      const cx=start+col*pitch;
      line(cx,gy,cx,gy+gh);line(cx+cell,gy,cx+cell,gy+gh);
      for(let row=1;row<rows;row++)line(cx,gy+row*cell,cx+cell,gy+row*cell);
    }
    line(start+panelW,gy,start+panelW,gy+gh);
    line(start,gy,start+panelW,gy);line(start,gy+gh,start+panelW,gy+gh);
    s.push('</g>');
  }
  const mid=gx+gw/2;
  for(const [cy,dir] of [[gy+gh*.22,1],[gy+gh*.78,-1]]){
    s.push(`<path data-fold-marker="" d="M ${mid-2.6} ${cy-dir*1.1} H ${mid+2.6} L ${mid} ${cy+dir*1.4} Z" fill="${gray}" stroke="none"/>`);
  }
  count=`400字 ／ １マス ${cell}mm ／ 左右200字ずつ ／ 読み仮名欄つき`;
  last={cell,cols,rows,ruby,gutter,halfCols,gridWidth:gw,gridHeight:gh};
  if(gw+1.2>w||gh+1.2>h+1.2)note='この規格は収まりません。寸法・マス数は変更していません。';
}
else if(t.kind==='manuscript'){const {cell,cols,rows}=t;grid(x+(w-cols*cell)/2,wide?y+(h-rows*cell)/2:y,cols,rows,cell);count=`${cols*rows}字 ／ １マス ${cell}mm ／ 横${cols}×縦${rows}`;last={cell,cols,rows,gridWidth:cols*cell,gridHeight:rows*cell};if(cols*cell>w||rows*cell>h)note='この規格は収まりません。寸法・マス数は変更していません。';}
else if(t.kind==='columnMath'){
  const cell=t.cell,blockW=cell*4,blockH=cell*3,gapX=(w-blockW*2)/3,gapY=9,n=8;
  for(let i=0;i<n;i++){
    const gx=x+gapX+(i%2)*(blockW+gapX),gy=y+10+Math.floor(i/2)*(blockH+gapY);
    s.push(`<g data-math-problem="${i+1}">`);txt(gx,gy-2,`${i+1}.`,3);
    grid(gx,gy,4,3,cell);
    s.push(`<line x1="${gx}" y1="${gy+2*cell}" x2="${gx+blockW}" y2="${gy+2*cell}" stroke-width=".42" stroke="#686868"/>`);
    s.push('</g>');
  }
  count='筆算 8問分 ／ 14mmマス';
  last={cell,problemCount:n};
}
else if(t.kind==='graphWorksheet'){
  const {cell}=t,left=28,bottom=32,head=29;
  const cols=Math.floor((w-left-5)/cell),rows=Math.floor((h-head-bottom)/cell),gw=cols*cell,gh=rows*cell;
  const gx=x+left+(w-left-5-gw)/2,gy=y+head,bx=gx+gw,by=gy+gh;
  const path=(d,width,color)=>`<path d="${d}" fill="none" stroke-width="${width}"${color?' stroke="'+color+'"':''}/>`;
  const title=$('title').value;
  s.push('<g data-graph-title="">');
  txt(x,y+7,'題名',3.5);line(x+13,y+8,x+w,y+8);
  if(title)txt(x+15,y+6.5,title,4.1);
  s.push('</g>');
  // Leave the number and category bands clear so pupils can label their own scale.
  s.push('<g data-graph-left-labels="">');
  txt(x,gy-7,'単位',2.8);line(x+9,gy-6,gx-3,gy-6);
  s.push('</g>');
  s.push('<g data-graph-plot="">');
  grid(gx,gy,cols,rows,cell);
  for(let i=0;i<=cols;i+=2)line(gx+i*cell,by,gx+i*cell,by+1.75);
  for(let i=0;i<=rows;i+=2)line(gx-1.75,by-i*cell,gx,by-i*cell);
  s.push(path(`M${gx} ${gy}V${by}H${bx}`,.42,'#606060'),'</g>');
  s.push('<g data-graph-bottom-labels="">');
  txt(gx,by+27,'項目・単位',3);line(gx+18,by+28,bx,by+28);s.push('</g>');
  count=`１マス ${cell}mm ／ 横${cols} × 縦${rows} ／ 題名・左の目盛り・下の項目を書き込み`;
  last={cell,cols,rows,gridWidth:gw,gridHeight:gh,plotX:gx,plotY:gy,labelsLeft:left,labelsBottom:bottom};
}
else if(t.kind==='graph'){
  const {cell}=t,cols=Math.floor((w-(wide?0:1))/10)*10,rows=Math.floor((h-(wide?0:1))/10)*10;
  const gw=cols*cell,gh=rows*cell,gx=x+(w-gw)/2,gy=y+(h-gh)/2,paths={1:[],5:[],10:[]};
  const band=i=>i%10===0?10:i%5===0?5:1;
  for(let c=0;c<=cols;c++)paths[band(c)].push(`M${gx+c*cell} ${gy}v${gh}`);
  for(let r=0;r<=rows;r++)paths[band(r)].push(`M${gx} ${gy+r*cell}h${gw}`);
  for(const [interval,width,opacity] of [[1,.105,.76],[5,.21,.91],[10,.32,1]]){
    s.push(`<path data-graph-line="${interval}" d="${paths[interval].join(' ')}" fill="none" stroke-width="${width}" stroke-opacity="${opacity}"/>`);
  }
  count=`1mm方眼 ／ 5mm・10mmごとに目印 ／ 横${gw}×縦${gh}mm`;
  last={cell,cols,rows,gridWidth:gw,gridHeight:gh};
}
else if(t.kind==='dots'){
  const {step}=t,cols=Math.floor((w-2)/step)+1,rows=Math.floor((h-2)/step)+1,gw=(cols-1)*step,gh=(rows-1)*step;
  const gx=x+(w-gw)/2,gy=y+(h-gh)/2,path=[];
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++)path.push(`M${gx+c*step} ${gy+r*step}h.001`);
  s.push(`<path data-dot-grid="" d="${path.join(' ')}" fill="none" stroke-width="0.55" stroke-linecap="round"/>`);
  count=`点方眼 ${step}mm間隔`;last={step,cols,rows,gridWidth:gw,gridHeight:gh};
}
else if(t.kind==='lines'){ruled(x,y,w,h,t.step);count=`横罫 ${t.step}mm間隔`;last={step:t.step};}
else if(t.kind==='vertical'){for(let px=x;px<=x+w;px+=t.step)line(px,y,px,y+h);count=`縦罫 ${t.step}mm間隔`;last={step:t.step};}
else if(t.kind==='contactVertical'){
  const labelWidth=14,writeWidth=t.cols*t.step,gw=writeWidth+labelWidth,gh=wide?h:220,gx=x+(w-gw)/2;
  const dateRow=11,dateHeight=dateRow*3,checkRow=13,checkStart=y+gh-checkRow*2,labelX=gx+writeWidth+labelWidth/2;
  fields.push({kind:'contactV',x:gx,y,cols:t.cols,step:t.step,dateRow,dateHeight,bodyHeight:checkStart-y-dateHeight});
  const centered=(cy,label,size=3)=>s.push(`<text x="${labelX}" y="${cy}" text-anchor="middle" font-size="${size}" fill="#555" stroke="none">${esc(label)}</text>`);
  rect(gx,y,gw,gh);
  for(let c=1;c<=t.cols;c++)line(gx+c*t.step,y,gx+c*t.step,y+gh);
  for(let r=1;r<=3;r++)line(gx,y+r*dateRow,gx+gw,y+r*dateRow);
  line(gx,checkStart,gx+gw,checkStart);
  line(gx,checkStart+checkRow,gx+gw,checkStart+checkRow);
  (kana?['がつ','にち','ようび']:['月','日','曜日']).forEach((label,i)=>centered(y+dateRow*(i+.5)+1,label));
  const bodyCenter=(y+dateHeight+checkStart)/2;
  s.push(`<text text-anchor="middle" font-size="4" fill="#555" stroke="none" aria-label="れんらく">${[...'れんらく'].map((ch,i)=>`<tspan x="${labelX}" y="${bodyCenter+(i-1.5)*6+1.5}">${ch}</tspan>`).join('')}</text>`);
  centered(checkStart+checkRow/2+1,kana?'せんせい':'先生');
  if(kana){centered(checkStart+checkRow+5,'おうちの',2.7);centered(checkStart+checkRow+9,'ひと',2.7);}
  else centered(checkStart+checkRow*1.5+1,'保護者');
  count=`縦書き${t.cols}行 ／ 行幅${t.step}mm ／ 日付・曜日・確認欄つき（右から記入）`;
  last={cols:t.cols,step:t.step,gridWidth:gw,gridHeight:gh,dateHeight,labelWidth,writeWidth};
}
else if(t.kind==='contactHorizontal'){const dateWidth=24,gw=w,gh=t.days*t.linesPerDay*t.step,dayHeight=t.linesPerDay*t.step;fields.push({kind:'contactH',x,y,days:t.days,dateWidth,dayHeight});rect(x,y,gw,gh);line(x+dateWidth,y,x+dateWidth,y+gh);for(let d=0;d<t.days;d++){const dy=y+d*dayHeight;if(d)line(x,dy,x+gw,dy);for(let r=1;r<t.linesPerDay;r++)line(x+dateWidth,dy+r*t.step,x+gw,dy+r*t.step);txt(x+8,dy+7,'月',3);txt(x+20,dy+7,'日',3);txt(x+5,dy+15,'（　　）',3);}count=`横書き${t.days}日分 ／ 1日${t.linesPerDay}行・${t.step}mm間隔 ／ 左に日付・曜日欄`;last={days:t.days,linesPerDay:t.linesPerDay,step:t.step,dateWidth,gridWidth:gw,gridHeight:gh};}
else if(t.kind==='diary'||t.kind==='diarygrid'){txt(x,y+3,'月　日（　）　天気');rect(x,y+8,w,85);if(t.kind==='diarygrid'){let cols=Math.floor(w/15),rows=Math.floor((h-100)/15);grid(x,y+100,cols,rows,15,$('guide').checked);count=`絵の欄＋15mmマス（横${cols}×縦${rows}）`}else{ruled(x,y+98,w,h-98,10);count='絵の欄＋10mm横罫'}}
else if(t.kind==='observe'){txt(x,y+3,'月　日（　）　天気');txt(x,y+12,'見つけたもの');rect(x,y+18,w,100);txt(x,y+127,'見つけたこと・気づいたこと');ruled(x,y+130,w,h-130,10)}
else if(t.kind==='compare'){panel(x,y,w/2-3,95,'まえ');panel(x+w/2+3,y,w/2-3,95,'いま');txt(x,y+106,'変わったこと・同じところ');ruled(x,y+110,w,h-110,10)}
else if(t.kind==='boxes'){let ph=(h-8*(t.labels.length-1))/t.labels.length;t.labels.forEach((l,i)=>panel(x,y+i*(ph+8),w,ph,l))}
else if(t.kind==='letter'){txt(x,y+4,'________________ 様');ruled(x,y+12,w,h-48,11);txt(x+w-65,y+h-22,'年　月　日');txt(x+w-65,y+h-8,'名前 __________________');count='本文は11mm横罫。あて名・日付・差出人の欄'}
else if(t.kind==='interview'){panel(x,y,w/2-2,h,'しつもん');panel(x+w/2+2,y,w/2-2,h,'聞いたこと');for(let i=1;i<5;i++){line(x,y+h*i/5,x+w/2-2,y+h*i/5);line(x+w/2+2,y+h*i/5,x+w,y+h*i/5)}}
else if(t.kind==='venn'){const r=w*.31,cy=y+h*.48;s.push(`<circle cx="${x+w*.34}" cy="${cy}" r="${r}" fill="none"/><circle cx="${x+w*.66}" cy="${cy}" r="${r}" fill="none"/>`);txt(x,y+8,'比べるもの：');txt(x+w*.43,cy-r-6,'共通点')}
else if(t.kind==='y'){rect(x,y,w,h);line(x+w/2,y+h*.42,x,y);line(x+w/2,y+h*.42,x+w,y);line(x+w/2,y+h*.42,x+w/2,y+h)}
else if(t.kind==='t'){rect(x,y,w,h);line(x+w/2,y,x+w/2,y+h);line(x,y+17,x+w,y+17)}
else if(t.kind==='flow'){let ph=(h-24)/3;for(let i=0;i<3;i++){panel(x,y+i*(ph+12),w,ph,String(i+1));if(i<2){let yy=y+(i+1)*ph+i*12;line(x+w/2,yy+2,x+w/2,yy+10);line(x+w/2-2,yy+8,x+w/2,yy+10);line(x+w/2+2,yy+8,x+w/2,yy+10)}}}
else if(t.kind==='mind'){let cx=x+w/2,cy=y+h/2;[[x+23,y+25],[x+w-23,y+25],[x+23,y+h-25],[x+w-23,y+h-25]].forEach(([px,py])=>{line(cx,cy,px,py);s.push(`<ellipse cx="${px}" cy="${py}" rx="23" ry="19" fill="white"/>`)});s.push(`<ellipse cx="${cx}" cy="${cy}" rx="28" ry="20" fill="white"/>`)}
if($('marks').checked){[[ox,oy,1,1],[ox+cw,oy,-1,1],[ox,oy+ch,1,-1],[ox+cw,oy+ch,-1,-1]].forEach(([cx,cy,dx,dy])=>{line(cx-2*dx,cy,cx+3*dx,cy);line(cx,cy-2*dy,cx,cy+3*dy)})}line(ox+7,oy+ch-2,ox+57,oy+ch-2);line(ox+7,oy+ch-3,ox+7,oy+ch-3);line(ox+57,oy+ch-3,ox+57,oy+ch-3);txt(ox+60,oy+ch-1,'50mm',2.3);
const art=`<g stroke="${gray}" stroke-width="0.18" font-family="sans-serif">${s.join('')}</g>`;
return {t,art,regions,fields,last,paper,manuscript400,kana,twoUp,duplex,wide,landscape,W,H,cw,ch,note,count};}
function render(){
const mode=$('paper').value,mixed=mode==='B4-mix';
const panes=mixed?[makeSheet(template($('mixLeft').value)||template('brushMath'),'B5'),makeSheet(template($('mixRight').value)||template('graph5'),'B5')]:[];
const {t,art,regions,fields,last,paper,manuscript400,kana,twoUp,duplex,wide,landscape,W,H,cw,ch,note,count}=mixed?panes[0]:makeSheet(template(active),mode);
$('mixControls').hidden=!mixed;
$('rotatedInfo').hidden=!mixed||!panes.some(p=>p.landscape);
const pageW=mixed?364:twoUp?(landscape?257:364):W,pageH=mixed?257:twoUp?(landscape?364:257):H;
const positions=mixed?[[0,0],[182,0]]:twoUp?(landscape?[[0,0],[0,182]]:[[0,0],[182,0]]):[[0,0]];
const content=mixed?panes.map((p,i)=>{
  const tx=182*i+(p.landscape?182:0);
  return `<g data-mix-panel="${i?'right':'left'}" data-template="${p.t.id}" transform="translate(${tx} 0)${p.landscape?' rotate(90)':''}">${p.art}</g>`;
}).join('')+($('marks').checked?'<path data-split-mark="" d="M 182 9 V 248" fill="none" stroke="#aaa" stroke-width=".18" stroke-dasharray="1.4 2.2"/>':''):positions.map(([dx,dy])=>`<g transform="translate(${dx} ${dy})">${art}</g>`).join('');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${pageW}mm" height="${pageH}mm" viewBox="0 0 ${pageW} ${pageH}"><rect width="${pageW}" height="${pageH}" fill="white"/>${content}</svg>`;
const pageCount=duplex?2:1,orientation=pageW>pageH?'横':'縦',binding=pageW>pageH?'短辺とじ':'長辺とじ';
$('sheet').innerHTML=svg;$('sheet').firstElementChild.style.width=(Number($('zoom').value)*100)+'%';
$('printRoot').innerHTML=Array.from({length:pageCount},()=>`<div class="print-page">${svg}</div>`).join('');
$('printStyle').textContent=`@page{size:${pageW}mm ${pageH}mm;margin:0}.print-page{width:${pageW}mm;height:${pageH}mm;break-after:page;page-break-after:always}.print-page:last-child{break-after:auto;page-break-after:auto}`;
$('nameLabel').textContent=!mixed&&kana?'なまえ（任意）':'名前（任意）';
$('paperB4').textContent=manuscript400?'B4・横1面（400字）':'B4・2面（片面にB5を2つ）';
$('paperB4Duplex').textContent=manuscript400?'B4・両面（横1面ずつ）':'B4・両面2面（表裏2面ずつ）';
$('current').textContent=mixed?'B4・左右ちがうノート':t.name;$('meta').textContent=mixed?`B4・横 ／ 左：${panes[0].t.name} ／ 右：${panes[1].t.name}`:`${paper}・${orientation} ／ ${twoUp?'B5等倍2面':'1面'}${duplex?'・両面':''} ／ ${wide?'余白ひかえめ':'1面の切り取り'}${cw}×${ch}mm${count?' ／ '+count:''}`;
const issue=mixed?(panes.find(p=>p.note)?.note||''):note;
$('adjust').textContent=issue||(mixed?'B5を左右に等倍で配置。横向きの用紙は90°回転します。':(wide?'マスの大きさはそのまま、広く書けるように配置します。漢字・原稿用紙の字数と連絡帳の行数・日数は変えません。':'罫線の寸法を保ったまま印刷します。表示画面の縮尺と印刷実寸は異なります。'));$('print').disabled=issue.includes('収まりません');
$('pageGuide').textContent=mixed?'B4横1枚にB5が2面。印刷画面の「1枚あたりのページ数」は1にしてください。':`プレビューは${duplex?'表面（裏面も同じ内容）':'印刷する1ページ'}。出力${pageCount}ページ → ${duplex?'両面印刷で':'片面印刷で'}用紙1枚、${positions.length*pageCount}面分。${twoUp?'アプリで2面配置済みです。印刷画面の「1枚あたりのページ数」は必ず1にしてください。':''}`;
$('printNotice').textContent=`印刷画面：JIS ${mixed?'B4':paper}・${orientation}向き・倍率100%（実際のサイズ）・1枚あたり1ページ・余白なし・ヘッダーとフッターなし。${duplex?`「両面印刷・${binding}」を設定してください（左右にめくる想定）。アプリではプリンターの両面設定を自動変更できません。`:'「片面印刷」を選んでください。'}実機印刷は未確認です。まず1枚試し刷りし、表裏の向きと50mm目盛りを確認してください。`;
const backgroundRegions=mixed
  ?panes.flatMap((p,i)=>p.regions.map(r=>({...r,tx:182*i+(p.landscape?182:0),ty:0,rotate:p.landscape?90:0})))
  :positions.flatMap(([tx,ty])=>regions.map(r=>({...r,tx,ty,rotate:0})));
const backgroundFields=mixed
  ?panes.flatMap((p,i)=>p.fields.map(r=>({...r,tx:182*i+(p.landscape?182:0),ty:0,rotate:p.landscape?90:0})))
  :positions.flatMap(([tx,ty])=>fields.map(r=>({...r,tx,ty,rotate:0})));
window.lastSheet={...last,backgroundRegions,backgroundFields,id:t.id,W,H,cw,ch,svg,note:issue,pageW,pageH,pageCount,positions,binding,duplex,wide,mixed};}

const cats=['すべて',...new Set(notebookCatalog.map(t=>t.cat))];$('categories').innerHTML=cats.map(c=>`<button data-cat="${c}" class="${c===category?'active':''}">${c}</button>`).join('');document.querySelectorAll('[data-cat]').forEach(b=>b.onclick=()=>{category=b.dataset.cat;document.querySelectorAll('[data-cat]').forEach(x=>x.classList.toggle('active',x===b));renderList()});$('search').oninput=renderList;const choices=notebookCatalog.map(t=>`<option value="${t.id}">${esc(t.name)}</option>`).join('');
for(const [id,selected] of [['mixLeft','brushMath'],['mixRight','graph5']]){$(id).innerHTML=choices;$(id).value=selected;$(id).addEventListener('input',()=>{renderList();render();});}
$('mixSwap').onclick=()=>{const left=$('mixLeft').value,right=$('mixRight').value;$('mixLeft').value=right;$('mixRight').value=left;renderList();render();};
$('paper').addEventListener('input',()=>{renderList();render();});
['tone','guide','marks','title','name'].forEach(id=>$(id).addEventListener('input',render));$('zoom').addEventListener('input',render);$('print').onclick=()=>window.print();
$('openSample').onclick=()=>{
  const {svg,pageW,pageH,pageCount,backgroundRegions,backgroundFields}=window.lastSheet;
  const payload={svg,w:pageW,h:pageH,pageCount,regions:backgroundRegions,fields:backgroundFields,title:$('current').textContent};
  const key='satto-sample-launch-v1';
  try {
    sessionStorage.setItem(key,JSON.stringify(payload));
    const tab=window.open('sample.html?v=23','_blank');
    sessionStorage.removeItem(key);
    $('sampleStatus').textContent=tab?'別のタブで見本を編集できます。':'別タブがブロックされました。このサイトのポップアップを許可して、もう一度押してください。';
  }catch {
    $('sampleStatus').textContent='別タブに用紙を渡せませんでした。ブラウザーの保存設定をご確認ください。';
  }
};
renderList();render();
