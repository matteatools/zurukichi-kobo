'use strict';

// Each stage has a finite bank. Building the bank lets short worksheets
// sample without replacement, even for very narrow practice targets.
const stages = [];
const range = (first, last) => Array.from({length: last - first + 1}, (_, i) => first + i);
const digits = range(1, 9);
function stage(grade, topic, label, xs, ys, make) {
  const bank = new Map();
  for (const x of xs) for (const y of ys) {
    const item = make(x, y);
    if (item) bank.set(item[0], {expression: item[0], answer: String(item[1])});
  }
  if (!bank.size) throw new Error(label);
  stages.push({grade, topic, label, bank: [...bank.values()]});
}
function gcd(a, b) { return b ? gcd(b, a % b) : a; }
function fraction(a, b) {
  const k = gcd(a, b);
  return a % b === 0 ? String(a / b) : (a / k) + '/' + (b / k);
}
const decimal = x => Number(x.toFixed(4));
const add = (a,b) => [a+' ＋ '+b, decimal(a+b)];
const sub = (a,b) => [a+' − '+b, decimal(a-b)];
const mul = (a,b) => [a+' × '+b, decimal(a*b)];
const div = (a,b) => [a+' ÷ '+b, decimal(a/b)];
const plus='たしざん', minus='ひきざん', times='かけざん', divide='わりざん';
const fractions='ぶんすう', decimals='しょうすう', order='しきの じゅんじょ';
for (const [topic, fn] of [[plus,add],[minus,sub]]) {
  const adding = topic === plus;
  for (const [label, min, max] of [['5まで',2,5],['6から 9まで',6,9],['10の まとまり',10,10]]) {
    stage(1,topic,label,digits,digits,(a,b) => a+b>=min && a+b<=max && (adding?add(a,b):sub(a+b,b)));
  }
  stage(1,topic,'0を つかう',range(0,10),[0,1],(a,b)=>adding && b ? add(0,a) : fn(a,0));
  stage(1,topic,adding?'10と いくつ':'10に もどす',digits,[0],a=>adding?add(10,a):sub(10+a,a));
  stage(1,topic,adding?'10と いくつに たす':'10より おおきい かずから ひく',digits,digits,(a,b)=>a+b<=9 && (adding?add(10+a,b):sub(10+a+b,b)));
  stage(1,topic,adding?'くりあがり（9に たす）':'くりさがり（9を ひく）',range(2,9),[0],a=>adding?add(9,a):sub(9+a,9));
  stage(1,topic,adding?'くりあがり（8・7に たす）':'くりさがり（8・7を ひく）',[7,8],digits,(a,b)=>a+b>10 && (adding?add(a,b):sub(a+b,a)));
  stage(1,topic,adding?'くりあがり（そのほか）':'くりさがり（そのほか）',range(2,6),digits,(a,b)=>a+b>10 && (adding?add(a,b):sub(a+b,a)));
  stage(1,topic,'なんじゅう どうし',digits,digits,(a,b)=>a+b<=10 && (adding?add(10*a,10*b):sub(10*(a+b),10*b)));
}
for (const [sign1,sign2] of [['＋','＋'],['−','−'],['＋','−'],['−','＋']]) {
  // Keep each intermediate result within 0–10, just like the final answer.
  const pairs = digits.flatMap(a => digits.map(b => [a,b]));
  stage(1,'3つの かず',sign1+' と '+sign2,pairs,digits,([a,b],c)=>{
    const mid = sign1==='＋' ? a+b : a-b;
    const result = sign2==='＋' ? mid+c : mid-c;
    if (Math.min(mid,result)<0 || Math.max(mid,result)>10) return;
    return [a+' '+sign1+' '+b+' '+sign2+' '+c,result];
  });
}
for (const [topic,adding] of [[plus,true],[minus,false]]) {
  stage(2,topic,'2けたと 1けた（くり'+(adding?'あがり':'さがり')+' なし）',range(21,79),digits,(a,b)=> (adding?a%10+b<10:a%10>=b) && (adding?add(a,b):sub(a,b)));
  stage(2,topic,'2けたと 1けた（くり'+(adding?'あがり':'さがり')+' あり）',range(21,79),digits,(a,b)=> (adding?a%10+b>=10:a%10<b) && (adding?add(a,b):sub(a,b)));
  stage(2,topic,'2けたと なんじゅう',range(21,49),range(1,4),(a,b)=>adding?add(a,b*10):sub(a+b*10,b*10));
  stage(2,topic,'なんびゃく どうし',digits,digits,(a,b)=>a+b<=10 && (adding?add(100*a,100*b):sub(100*(a+b),100*b)));
}
for (const a of [2,5,3,4,6,7,8,9,1]) stage(2,'くく',a+'の だん',[a],digits,mul);
stage(2,'くく','すべての だん',digits,digits,mul);
stage(3,times,'0を かける・0に かける',digits,[0,1],(a,b)=>b?mul(0,a):mul(a,0));
for (const k of [10,100]) stage(3,times,k+'の まとまり',digits,digits,(a,b)=>mul(k*a,b));
stage(3,times,'2けたを わけて かける',range(11,15),range(2,4),mul);
stage(3,divide,'くくで わる',digits,range(2,9),(a,b)=>div(a*b,b));
stage(3,divide,'1で わる',range(1,20),[0],a=>div(a,1));
stage(3,divide,'0を わる',digits,[0],a=>div(0,a));
stage(3,divide,'おなじ かずで わる',digits,[0],a=>div(a,a));
stage(3,divide,'あまりが ある',range(3,59),range(2,9),(a,b)=>a>b && a<10*b && a%b && [a+' ÷ '+b,Math.floor(a/b)+' あまり '+a%b]);
stage(3,divide,'なんじゅうを わる',digits,range(2,9),(a,b)=>a*b<10 && div(10*a*b,b));
for (const [topic,fn] of [[plus,add],[minus,sub]]) {
  stage(3,topic,'きりの よい かずに する',range(31,69),[9,19],fn);
  stage(3,topic,'なんぜん どうし',digits,digits,(a,b)=>a>b && fn(a*1000,b*1000));
}
for (const [topic,fn] of [['たす',add],['ひく',sub]]) {
  for (const crossing of [false,true]) stage(3,decimals,'0.1ずつ '+topic+'（くり'+(topic==='たす'?'あがり':'さがり')+(crossing?' あり':' なし')+'）',range(10,29),digits,(a,b)=>{
    const crosses = topic==='たす'?a%10+b>=10:a%10<b;
    return crossing===crosses && fn(a/10,b/10);
  });
}
for (const adding of [true,false]) {
  stage(3,fractions,'ぶんぼが おなじ（'+(adding?'たす':'ひく')+'）',range(3,10),digits,(d,a)=>{
    if(a>=d) return;
    const b=adding?Math.min(a,d-a):1;
    const n=adding?a+b:a-b;
    return [a+'/'+d+(adding?' ＋ ':' − ')+b+'/'+d,n===0||n===d?String(n/d):n+'/'+d];
  });
}
stage(4,divide,'なんじゅうで わる',digits,digits,(a,b)=>div(a*b*10,b*10));
stage(4,divide,'なんびゃくで わる',digits,digits,(a,b)=>div(a*b*100,b*100));
for (const k of [100,1000]) {
  for(const [label,fn] of [['たす',add],['ひく',sub]]) stage(4,decimals,(k===100?'0.01':'0.001')+'ずつ '+label,range(11,39),digits,(a,b)=>fn(a/k,b/k));
}
for(const [label,fn] of [['かける',mul],['わる',div]]) stage(4,decimals,'せいすうで '+label,digits,range(2,6),(a,b)=>fn((label==='わる'?a*b:a)/10,b));
for(const adding of [true,false]) {
  stage(4,fractions,adding?'1を こえる たしざん':'1から ひく',range(3,10),digits,(d,a)=>a<d && (adding?[a+'/'+d+' ＋ '+(d-a+1)+'/'+d,(d+1)+'/'+d]:['1 − '+a+'/'+d,(d-a)+'/'+d]));
  stage(4,fractions,adding?'たいぶんすうを たす':'たいぶんすうから ひく',range(3,9),digits,(d,a)=>a<d && ['1と'+a+'/'+d+(adding?' ＋ ':' − ')+(d-1)+'/'+d,fraction(d+a+(adding?d-1:1-d),d)]);
}
stage(4,order,'かけざんが さき',digits,digits,(a,b)=>[a+' ＋ '+b+' × 2',a+b*2]);
stage(4,order,'わりざんが さき',digits,digits,(a,b)=>[a+' ＋ '+2*b+' ÷ 2',a+b]);
stage(4,order,'かっこが さき',digits,digits,(a,b)=>['('+a+' ＋ '+b+') × 2',(a+b)*2]);
stage(4,order,'ひだりから じゅんに',digits,range(2,5),(a,b)=>[a*b+' ÷ '+b+' × 3',a*3]);
stage(4,order,'まとめて かける',range(2,6),digits,(a,b)=>[a+' × '+b+' ＋ '+a+' × '+(10-b),a*10]);
for(const k of [10,100,1000]) {
  stage(5,decimals,k+'ばい',range(1,99),[0],a=>mul(a/100,k));
  stage(5,decimals,k+'ぶんの 1',range(1,99),[0],a=>div(a,k));
}
stage(5,decimals,'1より ちいさい しょうすうを かける',digits,digits,(a,b)=>mul(a,b/10));
stage(5,decimals,'しょうすう どうしを かける',digits,digits,(a,b)=>mul(a/10,b/10));
stage(5,decimals,'1より おおきい しょうすうを かける',range(11,19),range(2,5),(a,b)=>mul(b,a/10));
stage(5,decimals,'しょうすうで わる（こたえは せいすう）',digits,digits,(a,b)=>div(a*b/10,b/10));
stage(5,decimals,'しょうすうで わる（こたえは しょうすう）',digits,digits,(a,b)=>div(a*b/100,b/10));
stage(5,fractions,'やくぶん',digits,range(2,5),(a,b)=>[a*b+'/'+((a+1)*b),fraction(a,a+1)]);
stage(5,fractions,'つうぶん（□に はいる かず）',range(2,9),range(2,5),(d,k)=>['1/'+d+' ＝ □/'+(d*k),k]);
for(const adding of [true,false]) {
  for(const multiple of [true,false]) stage(5,fractions,'ぶんぼが '+(multiple?'ばいすう':'たがいに そ')+'（'+(adding?'たす':'ひく')+'）',range(2,6),range(2,5),(a,b)=>{
    const d=multiple?a*b:a+b;
    if(!multiple && gcd(a,d)!==1) return;
    return ['1/'+a+(adding?' ＋ ':' − ')+'1/'+d,fraction(d+(adding?a:-a),a*d)];
  });
}
stage(5,fractions,'わりざんを ぶんすうに',digits,range(2,9),(a,b)=>a<b && [a+' ÷ '+b,fraction(a,b)]);
stage(5,'わりあい','もとにする かず × わりあい',range(1,9),digits,(a,b)=>mul(a*10,b/10));
stage(5,'わりあい','ひゃくぶんりつ（％）',range(1,19),[0],a=>[a/20+' ＝ □％',a*5]);
for(const op of ['×','÷']) {
  stage(6,fractions,'ぶんすう '+op+' せいすう',range(2,9),range(2,6),(d,b)=>['1/'+d+' '+op+' '+b,op==='×'?fraction(b,d):fraction(1,d*b)]);
  stage(6,fractions,'せいすう '+op+' ぶんすう',range(2,9),range(2,6),(d,b)=>[b+' '+op+' 1/'+d,op==='×'?fraction(b,d):b*d]);
  for(const cancel of [false,true]) stage(6,fractions,'ぶんすう '+op+' ぶんすう（とちゅうの やくぶん '+(cancel?'あり':'なし')+'）',range(3,10),range(2,9),(a,b)=>{
    if(a%2===0) return;
    const cross=gcd(2,b);
    const reduces=op==='×'?cross>1:gcd(a,b)>1;
    if(reduces!==cancel) return;
    return ['2/'+a+' '+op+' 1/'+b,op==='×'?fraction(2,a*b):fraction(2*b,a)];
  });
}
stage(6,fractions,'ぎゃくすう',range(2,9),digits,(d,a)=>a<d && gcd(a,d)===1 && [a+'/'+d+' × □ ＝ 1',fraction(d,a)]);
stage(6,fractions,'しょうすうと ぶんすう',range(1,9),[2,4,5],(a,d)=>[a/10+' ＋ 1/'+d,fraction(a*d+10,10*d)]);
stage(6,'ひ','ひの あたい',digits,range(2,9),(a,b)=>[a+'：'+b+' の あたい',fraction(a,b)]);
stage(6,'ひ','ひとしい ひ',digits,range(2,5),(a,b)=>[a+'：1 ＝ □：'+b,a*b]);
stage(6,'もじと しき','xに あてはめる',digits,range(2,5),(a,b)=>['x ＝ '+a+'　x × '+b,a*b]);

for(const adding of [true,false]) {
  stage(1,'□の かず',adding?'□に たす':'□から ひく',digits,digits,(a,b)=>a+b<=10 && (adding?['□ ＋ '+b+' ＝ '+(a+b),a]:['□ − '+b+' ＝ '+a,a+b]));
  stage(2,adding?plus:minus,'2けた どうし（かんたんな あんざん）',range(11,28),range(11,19),(a,b)=>a%10+b%10<10 && (adding?add(a,b):sub(a+b,b)));
}
stage(2,'くく','□に はいる かず',digits,digits,(a,b)=>[a+' × □ ＝ '+(a*b),b]);
stage(3,divide,'2けたを わけて わる',range(11,19),range(2,4),(a,b)=>div(a*b,b));
stage(5,'せいすう','さいだいこうやくすう',range(2,8),range(2,5),(a,b)=>[a*b+' と '+a*(b+1),a]);
stage(5,'せいすう','さいしょうこうばいすう',range(2,8),range(2,5),(a,b)=>[a+' と '+b,a*b/gcd(a,b)]);
stage(5,'へいきん','3つの かずの へいきん',range(3,9),range(1,3),(a,b)=>['('+ (a-b)+' ＋ '+a+' ＋ '+(a+b)+') ÷ 3',a]);
stage(6,'ひ','かんたんな ひに する',digits,range(2,5),(a,b)=>[a*b+'：'+(a+1)*b,a+'：'+(a+1)]);

