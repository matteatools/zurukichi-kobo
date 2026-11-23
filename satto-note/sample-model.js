'use strict';
(function(root){
  const world=(r,x,y)=>r.rotate===90?{x:r.tx-y,y:r.ty+x}:{x:r.tx+x,y:r.ty+y};
  const local=(r,x,y)=>r.rotate===90?{x:y-r.ty,y:r.tx-x}:{x:x-r.tx,y:y-r.ty};
  function hit(regions,x,y){
    for(let i=0;i<regions.length;i++){
      const r=regions[i],p=local(r,x,y),dx=p.x-r.x,dy=p.y-r.y;
      if(r.cell<4||dx<0||dy<0)continue;
      const c=Math.floor(dx/r.pitch),row=Math.floor(dy/r.cell);
      if(c<r.cols&&row<r.rows&&dx-c*r.pitch<r.cell)return {i,c,row};
    }
    return null;
  }
  const segmenter=typeof Intl!=='undefined'&&Intl.Segmenter?new Intl.Segmenter('ja',{granularity:'grapheme'}):null;
  const chars=s=>segmenter?Array.from(segmenter.segment(s),v=>v.segment):Array.from(s);
  const smallKana=/^[ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶㇰ-ㇿ\u{1B132}\u{1B150}-\u{1B152}\u{1B155}\u{1B164}-\u{1B167}]/u;
  const punctuation='、。，．';
  const opening='「『（〔［｛〈《【〖〘〚';
  const closing='」』）〕］｝〉》】〗〙〛';
  function markPlacement(ch,vertical,mode=''){
    const edge=(x,y,turn,maxW,maxH)=>({x,y,turn,maxW,maxH});
    if(smallKana.test(ch))return vertical?edge(.23,-.23,0,.45,.45):edge(-.23,.23,0,.45,.45);
    if(punctuation.includes(ch)&&ch.length===1){
      if(mode==='hanging')return vertical?edge(.24,.65,90,.24,.24):edge(.65,.26,0,.24,.24);
      return vertical?edge(.32,-.33,90,.24,.24):edge(-.33,.32,0,.24,.24);
    }
    if(ch.length===1&&(opening.includes(ch)||closing.includes(ch))){
      const open=opening.includes(ch);
      if(mode==='hanging')return vertical?edge(-.08,.67,90,.55,.25):edge(.67,.06,0,.25,.55);
      if(mode==='hanging-pair')return vertical?edge(-.10,.86,90,.55,.24):edge(.86,.04,0,.24,.55);
      if(mode==='paired')return vertical?edge(-.11,.18,90,.59,.33):edge(.19,.06,0,.34,.63);
      // Tall round/angle brackets stay centred on the cross axis; corner
      // brackets follow the handwriting position in their own cell.
      const corner='「『」』'.includes(ch),side=open?-1:1;
      return vertical?edge(corner?-side*.12:0,side*.25,90,.64,.40):
        edge(side*.25,corner?side*.12:0,0,.40,.64);
    }
    if(ch==='ー')return edge(0,0,vertical?90:0,.76,.76);
    return null;
  }
  function gapContains(g,x,y){return x>=g.x&&x<=g.x2&&y>=g.y&&y<=g.y2;}
  function cellCenter(r,c,row){return world(r,r.x+c*r.pitch+r.cell/2,r.y+row*r.cell+r.cell/2);}
  function cellBox(r,c,row){
    const p=cellCenter(r,c,row),s=r.cell/2;
    return {x:p.x-s,y:p.y-s,x2:p.x+s,y2:p.y+s};
  }
  function gapBounds(regions,a,b){
    const box=p=>{
      const at=hit(regions,p.x,p.y);
      return at?cellBox(regions[at.i],at.c,at.row):{x:p.x,y:p.y,x2:p.x,y2:p.y};
    };
    const u=box(a),v=box(b);
    return {x:Math.min(u.x,v.x),y:Math.min(u.y,v.y),x2:Math.max(u.x2,v.x2),y2:Math.max(u.y2,v.y2)};
  }
  function gapPath(regions,g){
    const paths=[];
    for(const r of regions){
      if(r.cell<4)continue;
      for(let c=0;c<r.cols;c++)for(let row=0;row<r.rows;row++){
        const p=cellCenter(r,c,row);
        if(gapContains(g,p.x,p.y)){
          const s=r.cell;
          paths.push(`M${p.x-s/2} ${p.y-s/2}h${s}v${s}h-${s}z`);
        }
      }
    }
    return paths.join(' ');
  }
  function glyphs(r,c,row,text,dir,gaps=[]){
    const vertical=dir==='vertical'||(dir==='auto'&&r.vertical),startC=c,startR=row,points=[];
    const letters=chars(text.replace(/\r\n?/g,'\n'));
    const point=(char,c,row,markMode='')=>({char,...world(r,r.x+c*r.pitch+r.cell/2,r.y+row*r.cell+r.cell/2),rotate:r.rotate,vertical,...(markMode?{markMode}:{})});
    const blocked=(c,row)=>{
      if(!gaps.length)return false;
      const p=cellCenter(r,c,row);
      return gaps.some(g=>gapContains(g,p.x,p.y));
    };
    const wrap=()=>{
      if(vertical&&row>=r.rows){row=0;c--;}
      if(!vertical&&c>=r.cols){c=0;row++;}
    };
    const inGrid=()=>c>=0&&row>=0&&c<r.cols&&row<r.rows;
    const advance=()=>{if(vertical)row++;else c++;};
    let clipped=false;
    for(let n=0;n<letters.length;n++){
      const char=letters[n],next=letters[n+1];
      if(char==='\n'){
        if(vertical){c--;row=startR;}else{c=startC;row++;}
        continue;
      }
      const lineEnd=vertical?row>=r.rows:c>=r.cols;
      const lineExists=vertical?c>=0&&c<r.cols:row>=0&&row<r.rows;
      const pair=r.manuscript&&char==='。'&&next&&closing.includes(next);
      if(r.manuscript&&lineEnd&&lineExists&&!blocked(vertical?c:r.cols-1,vertical?r.rows-1:row)&&(punctuation.includes(char)||closing.includes(char))){
        const lastC=vertical?c:r.cols-1,lastRow=vertical?r.rows-1:row;
        points.push(point(char,lastC,lastRow,'hanging'));
        if(pair){points.push(point(next,lastC,lastRow,'hanging-pair'));n++;}
        continue;
      }
      wrap();
      while(inGrid()&&blocked(c,row)){advance();wrap();}
      if(!inGrid()){clipped=true;break;}
      points.push(point(char,c,row));
      if(pair){points.push(point(next,c,row,'paired'));n++;}
      if(vertical)row++;else c++;
    }
    return {points,clipped};
  }
  const textTarget=(regions,item)=>item.snap?hit(regions,item.x,item.y):null;
  function angle(value){
    const n=Number(value);
    return Number.isFinite(n)?Math.min(180,Math.max(-180,Math.round(n))):0;
  }
  function rotation(box,value){
    const a=angle(value);
    return box&&a?`rotate(${a} ${box.x+box.w/2} ${box.y+box.h/2})`:'';
  }
  function freeTextPosition(item,x,y,w,h){
    return {...item,x:Math.max(0,Math.min(w-1,x)),y:Math.max(0,Math.min(h-1,y)),snap:false};
  }
  function fieldAt(fields,x,y,mode){
    for(let i=0;i<fields.length;i++){
      const r=fields[i],p=local(r,x,y),dx=p.x-r.x,dy=p.y-r.y;
      if(dx<0||dy<0)continue;
      if(mode==='ruby'&&r.kind==='ruby'){
        const pitch=r.cell+r.ruby,c=Math.floor(dx/pitch),row=Math.floor(dy/r.cell);
        if(c<r.cols&&row<r.rows)return {i,c,row};
      }else if(r.kind==='contactV'){
        const c=Math.floor(dx/r.step);
        if(c>=r.cols)continue;
        if((mode==='date'&&dy<r.dateHeight)||(mode==='body'&&dy>=r.dateHeight&&dy<r.dateHeight+r.bodyHeight))return {i,c,row:0};
      }else if(mode==='date'&&r.kind==='contactH'&&dx<r.dateWidth){
        const row=Math.floor(dy/r.dayHeight);
        if(row<r.days)return {i,c:0,row};
      }
    }
    return null;
  }
  function dateParts(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
    const d=new Date(value+'T00:00:00Z');
    if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==value)return null;
    return [String(d.getUTCMonth()+1),String(d.getUTCDate()),'日月火水木金土'[d.getUTCDay()]];
  }
  function fieldLayout(r,target,mode,value){
    if(!r||!target)return null;
    const {c,row}=target;
    if(!Number.isInteger(c)||!Number.isInteger(row)||c<0||row<0)return null;
    let x,y,w,h,size,points=[];
    const add=(text,px,py,vertical=false)=>points.push({text,...world(r,px,py),vertical,rotate:r.rotate||0});
    if(mode==='ruby'&&r.kind==='ruby'&&c<r.cols&&row<r.rows){
      x=r.x+c*(r.cell+r.ruby)+r.cell;y=r.y+row*r.cell;w=r.ruby;h=r.cell;
      const letters=chars(value.replace(/\s/g,''));
      if(!letters.length)return null;
      size=Math.min(w*.74,(h-1.6)/(letters.length*1.08));
      if(size<2.2)return {overflow:true};
      letters.forEach((ch,n)=>add(ch,x+w/2,y+h/2+(n-(letters.length-1)/2)*size*1.08,true));
    }else if(mode==='body'&&r.kind==='contactV'&&c<r.cols&&row===0){
      x=r.x+c*r.step;y=r.y+r.dateHeight;w=r.step;h=r.bodyHeight;
      const letters=chars(value.replace(/\r?\n/g,'　'));
      if(!letters.length)return null;
      size=Math.min(5,w*.56,(h-5)/(letters.length*1.18));
      if(size<3.2)return {overflow:true};
      letters.forEach((ch,n)=>add(ch,x+w/2,y+2.5+size/2+n*size*1.18,true));
    }else if(mode==='date'){
      const date=dateParts(value);
      if(!date)return null;
      size=3.3;
      if(r.kind==='contactV'&&c<r.cols&&row===0){
        x=r.x+c*r.step;y=r.y;w=r.step;h=r.dateHeight;
        date.forEach((v,n)=>add(v,x+w/2,y+r.dateRow*(n+.5)));
      }else if(r.kind==='contactH'&&c===0&&row<r.days){
        x=r.x;y=r.y+row*r.dayHeight;w=r.dateWidth;h=r.dayHeight;
        add(date[0],x+4.5,y+6);add(date[1],x+16.5,y+6);add(date[2],x+11,y+14);
      }else return null;
    }else return null;
    const a=world(r,x,y),b=world(r,x+w,y+h);
    const box={x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};
    return {points,size,box};
  }
  const sameTarget=(a,b)=>!!a&&!!b&&a.i===b.i&&a.c===b.c&&a.row===b.row;
  function moveField(fields,items,item,x,y){
    const target=fieldAt(fields,x,y,item.mode);
    if(!target)return {error:'target'};
    if(sameTarget(item.target,target))return {item};
    const layout=fieldLayout(fields[target.i],target,item.mode,item.value);
    if(!layout||layout.overflow)return {error:'fit'};
    if(items.some(i=>i.id!==item.id&&i.type==='field'&&i.mode===item.mode&&sameTarget(i.target,target)))return {error:'occupied'};
    return {item:{...item,target}};
  }
  const turn=(x,y,a)=>({x:x*Math.cos(a)-y*Math.sin(a),y:x*Math.sin(a)+y*Math.cos(a)});
  function resizeText(item,box,dx,dy,{snapped=false,w=400,h=400}={}){
    const a=snapped?0:angle(item.angle)*Math.PI/180;
    const diag=turn(box.w,box.h,a),len=Math.hypot(diag.x,diag.y)||1;
    const base=snapped?(item.cellScale||1):item.size;
    const factor=snapped?1+((dx+dy)/2)/Math.max(.5,box.glyphRadius):1+(dx*diag.x+dy*diag.y)/(len*len);
    const lo=snapped?.38:1,hi=snapped?1.32:25;
    const n=Math.min(hi,Math.max(lo,Math.round(base*factor*100)/100));
    if(n===base)return item;
    if(snapped)return {...item,cellScale:n};
    const half=turn(box.w/2,box.h/2,a),scale=n/base;
    return {...freeTextPosition(item,item.x+(scale-1)*(half.x+item.x-box.x-box.w/2),item.y+(scale-1)*(half.y+item.y-box.y-box.h/2),w,h),size:n};
  }
  function inkPath(points,straight=false){
    if(!points.length)return '';
    const xy=p=>p.x+' '+p.y,mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
    if(points.length===1)return 'M '+xy(points[0])+' l .01 0';
    let d='M '+xy(points[0]);
    if(straight)return d+' L '+points.slice(1).map(xy).join(' L ');
    for(let i=1;i<points.length-1;i++)d+=' Q '+xy(points[i])+' '+xy(mid(points[i],points[i+1]));
    return d+' L '+xy(points[points.length-1]);
  }
  function inkBounds(points){
    if(!points.length)return null;
    let x=Infinity,y=Infinity,x2=-Infinity,y2=-Infinity;
    for(const p of points){x=Math.min(x,p.x);y=Math.min(y,p.y);x2=Math.max(x2,p.x);y2=Math.max(y2,p.y);}
    return {x,y,w:x2-x,h:y2-y};
  }
  function moveInk(item,dx,dy,w,h){
    const b=inkBounds(item.points);
    const x=Math.max(-b.x,Math.min(w-b.x-b.w,dx)),y=Math.max(-b.y,Math.min(h-b.y-b.h,dy));
    return {...item,points:item.points.map(p=>({x:p.x+x,y:p.y+y}))};
  }
  const mid=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const lerp=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  function flatInk(points){
    if(points.length<3)return points;
    const flat=[points[0]];
    for(let i=1;i<points.length-1;i++){
      const a=flat.at(-1),b=points[i],c=mid(b,points[i+1]);
      const count=Math.min(24,Math.max(2,Math.ceil(Math.hypot(c.x-a.x,c.y-a.y)/2)));
      for(let j=1;j<=count;j++){const t=j/count;flat.push(lerp(lerp(a,b,t),lerp(b,c,t),t));}
    }
    flat.push(points.at(-1));return flat;
  }
  function eraseInk(item,a,b,radius){
    const pts=item.points,bounds=inkBounds(pts),r=radius+item.width/2;
    if(!bounds||Math.max(a.x,b.x)+r<bounds.x||Math.min(a.x,b.x)-r>bounds.x+bounds.w||
      Math.max(a.y,b.y)+r<bounds.y||Math.min(a.y,b.y)-r>bounds.y+bounds.h)return null;
    const vx=b.x-a.x,vy=b.y-a.y,len=Math.hypot(vx,vy),ux=len?vx/len:1,uy=len?vy/len:0;
    const local=p=>({x:(p.x-a.x)*ux+(p.y-a.y)*uy,y:(p.y-a.y)*ux-(p.x-a.x)*uy});
    const inside=p=>Math.hypot(p.x-Math.min(len,Math.max(0,p.x)),p.y)<=r;
    if(pts.length===1)return inside(local(pts[0]))?[]:null;
    const centerline=item.straight?pts:flatInk(pts),pieces=[];let piece=[],changed=false;
    const flush=()=>{if(piece.length>=2)pieces.push(piece);piece=[];};
    for(let i=1;i<centerline.length;i++){
      const p=centerline[i-1],q=centerline[i],u=local(p),v=local(q),x=v.x-u.x,y=v.y-u.y,dd=x*x+y*y;
      if(dd<1e-12)continue;
      const ts=[0,1],push=t=>{if(t>0&&t<1)ts.push(t);};
      for(const cx of len?[0,len]:[0]){
        const z=u.x-cx,k=z*x+u.y*y,disc=k*k-dd*(z*z+u.y*u.y-r*r);
        if(disc>0){const s=Math.sqrt(disc);push((-k-s)/dd);push((-k+s)/dd);}
      }
      if(y){push((r-u.y)/y);push((-r-u.y)/y);}
      ts.sort((a,b)=>a-b);
      for(let j=1;j<ts.length;j++){
        const s=ts[j-1],t=ts[j];if(t-s<1e-8)continue;
        if(inside(lerp(u,v,(s+t)/2))){changed=true;flush();}
        else{
          const A=lerp(p,q,s),B=lerp(p,q,t);
          if(!piece.length)piece.push(A);
          else if(Math.hypot(piece.at(-1).x-A.x,piece.at(-1).y-A.y)>1e-6){flush();piece.push(A);}
          piece.push(B);
        }
      }
    }
    flush();
    if(changed&&pieces.length>1&&pts[0].x===pts.at(-1).x&&pts[0].y===pts.at(-1).y){
      const first=pieces[0],last=pieces.at(-1),p=pts[0];
      if(first[0].x===p.x&&first[0].y===p.y&&Math.hypot(last.at(-1).x-p.x,last.at(-1).y-p.y)<1e-6){
        pieces.pop();pieces[0]=last.concat(first.slice(1));
      }
    }
    return changed?pieces:null;
  }
  const space=(n,fallback,min,max)=>Number.isFinite(Number(n))&&n!==''&&n!=null?Math.min(max,Math.max(min,Math.round(Number(n)))):fallback;
  const letterSpace=n=>space(n,0,-15,100);
  const lineSpace=n=>space(n,125,70,300);
  const erasableObject=i=>!!i&&['text','field'].includes(i.type);
  const strokeCache=new WeakMap();
  function erasableStroke(item){
    const {x,y,x2,y2}=item;
    if(item.type==='ink')return item;
    if(strokeCache.has(item))return strokeCache.get(item);
    let points;
    if(item.type==='line')points=[{x,y},{x:x2,y:y2}];
    else if(item.type==='rect')points=[{x,y},{x:x2,y},{x:x2,y:y2},{x,y:y2},{x,y}];
    else if(item.type==='ellipse'){
      const cx=(x+x2)/2,cy=(y+y2)/2,rx=Math.abs(x2-x)/2,ry=Math.abs(y2-y)/2;
      const steps=Math.max(32,Math.min(720,Math.ceil(2*Math.PI*Math.max(rx,ry))));
      points=Array.from({length:steps},(_,i)=>{
        const a=2*Math.PI*i/steps;
        return {x:cx+rx*Math.cos(a),y:cy+ry*Math.sin(a)};
      });
      points.push(points[0]);
    }else return null;
    const stroke={...item,type:'ink',straight:true,points};
    strokeCache.set(item,stroke);return stroke;
  }
  function eraseObject(items,id){
    return items.some(i=>i.id===id&&erasableObject(i))?items.filter(i=>i.id!==id):items;
  }
  const fontOptions={
    standard:'"Noto Sans JP","Yu Gothic",sans-serif',
    klee:'"Sattoto Klee One","Yu Gothic",sans-serif',
    school:'"UD Digi Kyokasho N-R","UD デジタル 教科書体 N-R","UD Digi Kyokasho NP-R","UD デジタル 教科書体 NP-R","Kyokasho ICA","教科書体","Sattoto Klee One",sans-serif',
    mincho:'"Yu Mincho","Hiragino Mincho ProN","Noto Serif CJK JP",serif'
  };
  function fontName(value){return typeof value==='string'?value.trim().replace(/[\x00-\x1f\x7f]/g,'').slice(0,120):'';}
  function fontKey(value){return Object.prototype.hasOwnProperty.call(fontOptions,value)?value:'standard';}
  function fontFamily(preset,value){
    const f=fontKey(preset),name=fontName(value);
    return name?JSON.stringify(name)+','+fontOptions.standard:fontOptions[f];
  }
  const model={fontKey,fontName,fontFamily,erasableStroke,erasableObject,eraseObject,eraseInk,letterSpace,lineSpace,resizeText,inkPath,inkBounds,moveInk,sameTarget,moveField,world,local,hit,gapContains,gapBounds,gapPath,glyphs,markPlacement,textTarget,angle,rotation,freeTextPosition,fieldAt,fieldLayout,dateParts};
  if(typeof module!=='undefined'&&module.exports)module.exports=model;
  else root.SattoSample=model;
})(typeof window==='undefined'?null:window);
