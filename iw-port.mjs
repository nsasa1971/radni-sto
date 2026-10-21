// ГЕНЕРИСАНО из апликације (iw.js). Не уређивати ручно.
export function makeIW(S, days) {
  var cancel = false;
var VAL={zeleno:0,zuto:1,crveno:2};
var LAB={zeleno:'Зелено',zuto:'Жуто',crveno:'Црвено',nema:'Нема података'};
var NEXT={zeleno:'zuto',zuto:'crveno',crveno:'nema',nema:'zeleno'};


function latest(ind){return ind.istorija&&ind.istorija.length?ind.istorija[ind.istorija.length-1]:null;}
function dataEntries(ind){return (ind.istorija||[]).filter(function(e){return e.status!=='nema';});}

/* ---------- логика у коду ---------- */
function temperature(sc){
  var inds=sc.indikatori||[],sw=0,sv=0,n=0,heavy=false;
  inds.forEach(function(i){
    var l=latest(i);
    if(!l||l.status==='nema')return;
    n++;sw+=i.tezina;sv+=i.tezina*VAL[l.status];
    if(i.tezina>=3&&l.status==='crveno')heavy=true;
  });
  var total=inds.length;
  var avg=sw?S.r2(sv/sw):0;
  var label=!n?'nema':((heavy||avg>=1.2)?'crveno':(avg>=0.4?'zuto':'zeleno'));
  return {avg:avg,label:label,labelCyr:LAB[label],coverage:total?n/total:0,n:n,total:total,heavy:heavy};
}
function trend(ind){
  var d=dataEntries(ind);
  if(d.length<2)return '–';
  var a=VAL[d[d.length-2].status],b=VAL[d[d.length-1].status];
  return b>a?'↑':(b<a?'↓':'→');
}
function normStatus(s){
  s=String(s||'').toLowerCase();
  if(/нема|nema|no_data/.test(s))return 'nema';
  if(/црв|crv|red/.test(s))return 'crveno';
  if(/жут|zut|žut|yellow/.test(s))return 'zuto';
  if(/зелен|zelen|green/.test(s))return 'zeleno';
  return 'nema';
}
function parseScan(t){
  t=String(t);
  var m=t.match(/(?:СТАТУС|STATUS)\s*:\s*([^\n]+)/i);
  if(!m)return null;
  var d=t.match(/(?:ДОКАЗ|DOKAZ)\s*:\s*([\s\S]*?)(?:\n\s*(?:ДАТУМ|DATUM)\s*:|\n\s*(?:ПОУЗДАНОСТ|POUZDANOST)\s*:|$)/i);
  var dt=t.match(/(?:ДАТУМ|DATUM)\s*:\s*([^\n]+)/i);
  var pz=t.match(/(?:ПОУЗДАНОСТ|POUZDANOST)\s*:\s*([^\n]+)/i);
  var status=normStatus(m[1]);
  var dokaz=d?d[1].trim().slice(0,400):'';
  var pouz=pz?String(pz[1]).toLowerCase().trim():'';
  pouz=(pouz.indexOf('вис')===0||pouz.indexOf('vis')===0)?'висока':((pouz.indexOf('нис')===0||pouz.indexOf('nis')===0)?'ниска':(pouz?'средња':''));
  if(status!=='nema'&&!dokaz){status='nema';dokaz='Модел није навео доказ, па стање није уписано.';}
  return {status:status,dokaz:dokaz,vest:dt?dt[1].trim().slice(0,30):'',pouz:pouz};
}

/* ---------- Gemini позиви ---------- */
var SYS='Ти си аналитичар раног упозорења. Пишеш на српском језику, ћирилицом, екавицом. Не измишљај чињенице.';
async function proposeIndicators(naziv,opis,ctx){
  var u='СЦЕНАРИО: '+naziv+(opis?'\nОПИС: '+opis:'')+(ctx?'\n\nКОНТЕКСТ (резултат ранијег анализирања):\n'+ctx.slice(0,9000):'')+
   '\n\nПредложи 6 до 8 индикатора раног упозорења који би показали да се овај сценарио остварује. Сваки индикатор мора бити појава која се може пратити у отвореним изворима (вести, саопштења, подаци) и мора имати јасне, мерљиве прагове: „зелено“ (нема знакова), „жуто“ (први знаци), „црвено“ (сценарио је на помолу). Индикатори треба да се међусобно допуњују, а не понављају. Тежина је цео број од 1 до 3 (3 = најпоузданији знак).\n'+
   'Врати искључиво JSON облика: {"indikatori":[{"naziv":"кратко","zeleno":"праг","zuto":"праг","crveno":"праг","tezina":2}]}';
  for(var a=0;a<3;a++){
    var r=await S.callGemini(SYS,u,{json:true,temp:0.4});
    try{
      var j=S.parseJson(r.text),arr=j.indikatori||j;
      if(Array.isArray(arr)){
        var out=arr.filter(function(x){return x&&x.naziv&&x.zeleno&&x.zuto&&x.crveno;}).slice(0,10).map(function(x,i){
          return {id:'I'+(i+1)+'_'+S.uid().slice(-3),naziv:String(x.naziv).slice(0,140),zeleno:String(x.zeleno).slice(0,240),zuto:String(x.zuto).slice(0,240),crveno:String(x.crveno).slice(0,240),tezina:Math.max(1,Math.min(3,Math.round(Number(x.tezina)||2))),istorija:[]};
        });
        if(out.length>=3)return out;
      }
    }catch(e){}
  }
  throw new Error('Модел није вратио употребљиве индикаторе.');
}
async function scanInd(sc,ind){
  var u='СЦЕНАРИО: '+sc.naziv+(sc.opis?' — '+sc.opis:'')+'\nИНДИКАТОР: '+ind.naziv+'\nПРАГОВИ:\nЗелено: '+ind.zeleno+'\nЖуто: '+ind.zuto+'\nЦрвено: '+ind.crveno+'\nПЕРИОД: последњих '+days+' дана (данас је '+S.today()+').\n\n'+
   'Претражи најновије доступне информације о овом индикатору и одреди у ком се стању налази према задатим праговима. Ослони се на конкретне, проверљиве чињенице из поузданих извора. Ако за наведени период не постоји поуздана информација, статус је „нема_података“; никада не претпостављај да је стање зелено само зато што ништа ниси пронашао.\n\n'+
   'Одговори тачно у ова четири реда, ништа више:\nСТАТУС: зелено|жуто|црвено|нема_података\nДОКАЗ: једна до две реченице са конкретним чињеницама\nДАТУМ: датум најновије релевантне вести (ДД.ММ.ГГГГ) или непознат\nПОУЗДАНОСТ: висока|средња|ниска';
  for(var a=0;a<2;a++){
    var r=await S.callGemini(SYS,u,{search:true,temp:0.1,cancel:function(){return cancel;}});
    var p=parseScan(r.text);
    if(p){p.izvori=S.uniqGrounding(r.grounding).slice(0,4).map(function(g){return {title:g.title};});return p;}
  }
  return {status:'nema',dokaz:'Одговор модела није у очекиваном облику.',vest:'',pouz:'',izvori:[]};
}
async function summarizeScan(sc,T,promene,hadPrev){
  var lines=sc.indikatori.map(function(i){var l=latest(i);return '- '+i.naziv+' (тежина '+i.tezina+'): '+(l?LAB[l.status]+(l.dokaz?' — '+l.dokaz:''):'нема провере');}).join('\n');
  var pr=hadPrev?(promene.length?promene.map(function(p){return p.ind+': '+LAB[p.od]+' → '+LAB[p.nova];}).join('; '):'нема промена статуса'):'прво скенирање, нема претходног стања';
  var u='СЦЕНАРИО: '+sc.naziv+'\nТЕМПЕРАТУРА: '+T.labelCyr+' (пондерисани просек '+T.avg+' од 2, покривеност '+Math.round(T.coverage*100)+'%)\nПРОМЕНЕ ОД ПРЕТХОДНЕ ПРОВЕРЕ: '+pr+'\nИНДИКАТОРИ:\n'+lines+
   '\n\nНапиши два до три повезане реченице о томе шта се променило и шта то значи за сценарио. Не наводи изворе, не износи нове сценарије ни препоруке. Ако је покривеност мала, то изричито напомени. За поузданост користи само „висока поузданост“, „средња поузданост“ или „ниска поузданост“.';
  var r=await S.callGemini(SYS,u,{temp:0.3});
  return r.text.trim().slice(0,900);
}


  return { VAL: VAL, LAB: LAB, latest: latest, dataEntries: dataEntries, temperature: temperature, trend: trend, parseScan: parseScan, scanInd: scanInd, summarizeScan: summarizeScan, proposeIndicators: proposeIndicators };
}
