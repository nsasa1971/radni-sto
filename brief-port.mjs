// ГЕНЕРИСАНО из апликације (брифинг). Не уређивати ручно.
export function makeBrief() {
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function fmtDate(iso){if(!iso)return '';var p=iso.split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]+'.':iso;}

var DEFAULT_TPL={
  dnevni:{naziv:'Дневни преглед',duzina:'kratko',implik:false,
    sections:'Кључни закључак | Једна до две реченице: шта је најважније у посматраном периоду.\nПреглед догађаја | Најважнији догађаји повезани у једну целину, не као листа.\nОцена и поузданост | Шта је потврђено, шта није и колика је поузданост информација.\nПрепоруке | Конкретни наредни кораци.'},
  nedeljni:{naziv:'Недељни преглед',duzina:'standardno',implik:false,
    sections:'Кључни закључак недеље | Најважнији закључак у два до три реченице.\nПреглед по темама | Теме груписати по важности, са конкретним подацима.\nТенденције | Шта се променило у односу на претходни период.\nОцена и поузданост | Потврђено наспрам непотврђеног.\nПрепоруке | Конкретни наредни кораци.'},
  mesecni:{naziv:'Месечни преглед',duzina:'opsirno',implik:true,
    sections:'Резиме месеца | Кратак синтетички пасус.\nКључни трендови | Најважнији трендови са подацима.\nАнализа | Аргументована анализа узрока и последица.\nИмпликације за Србију | Шта то значи за Србију.\nОцена поузданости | Поузданост закључака.\nПрепоруке | Конкретни наредни кораци.'},
  zahtev:{naziv:'Информативна белешка (на захтев)',duzina:'standardno',implik:false,
    sections:'Предмет | Шта је питање или тема белешке.\nКључни закључак | Одговор у једној до две реченице.\nОбразложење | Аргументована анализа са конкретним подацима.\nОцена поузданости | Колико су закључци поуздани.\nПрепоруке | Конкретни наредни кораци.'}
};
var TIP_ORDER=['dnevni','nedeljni','mesecni','zahtev'];

function parseSections(str){
  return String(str||'').split('\n').map(function(l){return l.trim();}).filter(Boolean).map(function(l){
    var p=l.split('|');return {name:p[0].trim(),hint:(p.slice(1).join('|')||'').trim()};
  });
}


var LEN_TXT={kratko:'око 300 речи',standardno:'око 650 речи',opsirno:'око 1100 речи'};
var SYSTEM=
'Ти си искусан аналитичар безбедносно-геополитичких питања и пишеш службене брифинге. '+
'Пишеш на српском језику, ћирилицом, екавицом. '+
'Стандард писања: непрекидан аргументативан ток, без механичког набрајања; конкретни подаци пре апстрактне теорије; сваки одељак мора бити повезан целина; последњи одељак (или његов завршни пасус) мора садржати синтезу. '+
'Строго не наводи изворе у тексту: без назива медија у заградама, без линкова, без бројева референци, без фраза типа „према извору“. '+
'Једине ознаке које смеш да користиш за поузданост су „висока поузданост“, „средња поузданост“ и „ниска поузданост“. '+
'Не измишљај чињенице, бројеве ни цитате. Ако нешто није у достављеном материјалу, то изостави или јасно означи као непотврђено. Ако се извори противрече, то изричито наведи. '+
'Формат излаза: сваки одељак почиње у посебном реду као „## Назив одељка“, затим следе пасуси обичног текста. Набрајање са цртицом „- “ користи само у препорукама. '+
'Не додај увод, наслов документа, потпис ни напомене изван тражених одељака. Не користи облике форматирања осим ретког истицања са **.';

function buildUser(ctx){
  var secs=ctx.sections;
  var u='ВРСТА ДОКУМЕНТА: '+ctx.tipNaziv+'\n';
  if(ctx.naslov)u+='ТЕМА: '+ctx.naslov+'\n';
  if(ctx.od||ctx.do)u+='ПЕРИОД: '+(fmtDate(ctx.od)||'—')+' до '+(fmtDate(ctx.do)||'—')+'\n';
  if(ctx.fokus)u+='ПОСЕБАН ФОКУС: '+ctx.fokus+'\n';
  u+='ЖЕЉЕНА ДУЖИНА: '+LEN_TXT[ctx.duzina]+'\n\n';
  u+='ОДЕЉЦИ (тачно овим редом, са овим насловима):\n';
  secs.forEach(function(s,i){u+=(i+1)+'. '+s.name+(s.hint?' — '+s.hint:'')+'\n';});
  if(ctx.implik&&!secs.some(function(s){return /импликациј|сценариј/i.test(s.name);})){
    u+='Додај одељак „Импликације за Србију“ са кратким сценаријима, само ако их материјал подржава.\n';
  }
  if(!ctx.implik){
    u+='ВАЖНО: Ово је чисто информативна белешка. Не пиши сценарије и не пиши импликације за Србију.\n';
  }
  u+='\n=== МАТЕРИЈАЛ ===\n';
  if(ctx.rucno)u+='\n[РУЧНИ УНОС]\n'+ctx.rucno+'\n';
  ctx.prethodni.forEach(function(p,i){u+='\n[ПРЕТХОДНИ ПРЕГЛЕД '+(i+1)+' — '+p.tipNaziv+(p.naslov?', '+p.naslov:'')+']\n'+p.text+'\n';});
  (ctx.alati||[]).forEach(function(a,i){u+='\n[МАТЕРИЈАЛ ИЗ АЛАТА '+(i+1)+' — '+a.label+']\n'+a.text.slice(0,12000)+'\n';});
  ctx.sources.forEach(function(s,i){
    u+='\n[ИЗВОР '+(i+1)+(s.name?': '+s.name:'')+(s.rel?' — поузданост извора: '+s.rel:'')+']\n'+s.text.slice(0,15000)+'\n';
  });
  u+='\n=== КРАЈ МАТЕРИЈАЛА ===\nСачини документ на основу овог материјала.';
  return u;
}


function inline(s){return esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');}
function renderMd(text){
  var lines=String(text).replace(/\r/g,'').split('\n'),html='',para=[],list=[];
  function fp(){if(para.length){html+='<p>'+inline(para.join(' '))+'</p>';para=[];}}
  function fl(){if(list.length){html+='<ul>'+list.map(function(x){return '<li>'+inline(x)+'</li>';}).join('')+'</ul>';list=[];}}
  lines.forEach(function(raw){
    var l=raw.trim();
    if(!l){fp();fl();return;}
    var m=l.match(/^#{1,3}\s+(.*)$/);
    if(m){fp();fl();html+='<h2>'+inline(m[1])+'</h2>';return;}
    var b=l.match(/^[-*•]\s+(.*)$/);
    if(b){fp();list.push(b[1]);return;}
    fl();para.push(l);
  });
  fp();fl();
  return html;
}
function buildDocHtml(meta,bodyText,srcs,withSrc){
  var h='<div class="dh">';
  if(meta.kls)h+='<span class="cls">'+esc(meta.kls)+'</span>';
  if(meta.org)h+='<div class="org">'+esc(meta.org)+'</div>';
  h+='<h1>'+esc(meta.tipNaziv)+(meta.naslov?': '+esc(meta.naslov):'')+'</h1>';
  var m=[];
  if(meta.broj)m.push('Број: '+esc(meta.broj));
  m.push('Датум: '+esc(fmtDate(meta.datum)));
  if(meta.od||meta.do)m.push('Период: '+esc(fmtDate(meta.od)||'—')+' – '+esc(fmtDate(meta.do)||'—'));
  if(meta.autor)m.push('Аутор: '+esc(meta.autor));
  h+='<div class="meta">'+m.join(' &nbsp;|&nbsp; ')+'</div></div>';
  h+=renderMd(bodyText);
  if(withSrc&&srcs.length){
    h+='<div class="srcs"><strong>Извори:</strong> '+srcs.map(function(s,i){
      var n=s.name||('извор '+(i+1));
      return esc(n)+(s.url?' ('+esc(s.url)+')':'');
    }).join('; ')+'</div>';
  }
  return h;
}

  return { DEFAULT_TPL: DEFAULT_TPL, TIP_ORDER: TIP_ORDER, parseSections: parseSections, SYSTEM: SYSTEM, buildUser: buildUser, buildDocHtml: buildDocHtml, renderMd: renderMd };
}
