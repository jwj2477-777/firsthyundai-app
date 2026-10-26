'use strict';
/* Conditional same/previous-day published news, source links and action-only
   map-box warning; button semantics and grouped contract inputs. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/notification-inbox.css'),'utf8');
const js=fs.readFileSync(path.join(root,'app/src/main/assets/weather-briefing.js'),'utf8');
assert(!html.includes('id="overviewMapCaution"'),'No missing-forecast explanation row');
assert(html.includes('id="overviewMapAlert"')&&html.includes('id="overviewSongdoNews"'));
assert(html.includes('class="contractEntryGroup"'),'Contract memo is one framed group');
assert(!html.includes('class="contractFirstGuide"'),'Redundant how-to removed');
const block=html.slice(html.indexOf('<div class="contractEntryGroup"'),
 html.indexOf('<div class="contractEasyActions"'));
assert.equal((block.match(/id="ct_rough"/g)||[]).length,1);
assert.equal((block.match(/id="ct_specialMemo"/g)||[]).length,1);
assert(block.includes('특약 메모')&&block.includes('선택'));
assert(css.includes('contractEntryGroup>.contractSpecialMemoArea')&&css.includes('border-top:1px'),
 'Optional reminder is separated by one quiet horizontal rule');
const refresh=[...html.matchAll(/<button\b[^>]*class="[^"]*\brefreshAction\b[^"]*"[^>]*>([\s\S]*?)<\/button>/g)]
 .filter(x=>!x[0].includes('FirstHyundaiAdminCenter.refresh()'));
assert(refresh.length>=8,'No refresh action lost');
for(const button of refresh){
 assert(button[1].includes('refreshGlyph')&&button[1].includes('갱신')&&!button[1].includes('새로고침'),
  'Each refresh button must say ↻ 갱신: '+button[0].slice(0,130));
}
assert(css.includes('height:49px!important'),'Header refresh has a single common height');
assert(css.includes('height:60px!important'),'Secondary toggle has a single common height');
const start=html.indexOf('function todaySongdoNews(');
const end=html.indexOf('function renderOverviewNews(){',start);
assert(start>0&&end>start);
const cx=vm.createContext({safeLink:x=>/^https:\/\//.test(x)?x:'',Date,Set});
vm.runInContext(html.slice(start,end)+'\nthis.select=todaySongdoNews;',cx);
const mk=(title,published,category='개발·교통',withLink=true)=>({
 title,category,last_published_at:published,summary:'지역의 주요 변화에 관한 충분한 본문 요약입니다.',
 summary_method:'gemini_article',sources:withLink?[{link:'https://example.org/item',publisher:'테스트신문'}]:[]
});
const now=Date.parse('2026-10-26T20:00:00+09:00');
const payload={state:'ok',briefs:[
 mk('송도 역세권 개발', '2026-10-26T18:00:00+09:00'),
 mk('GTX-B 청학역 신설', '2026-10-25T19:00:00+09:00'),
 mk('연수구 재건축 추진', '2026-10-26T15:00:00+09:00'),
 mk('송도 한 달 전 뉴스', '2026-09-20T13:00:00+09:00'),
 mk('서울 행사 기사', '2026-10-26T16:00:00+09:00'),
 mk('송도 출처 없는 정보', '2026-10-26T17:00:00+09:00','개발·교통',false)
]};
const chosen=cx.select(payload,now);
assert.equal(chosen.length,3,'Only verified current or previous day Songdo news (max three)');
assert(chosen.every(x=>x.sourceUrl.startsWith('https://')));
assert(chosen.every(x=>x.publishedDay==='2026-10-25'||x.publishedDay==='2026-10-26'));
assert.equal(cx.select(null,now).length,0,'No fabricated news for absent feed');
assert.equal(cx.select({...payload,briefs:[]},now).length,0,'No placeholder for empty feed');
assert.equal(cx.select({...payload,state:'not_started'},now).length,0);
const messages=new Map(),node=id=>{
 if(!messages.has(id))messages.set(id,{textContent:'',hidden:false});
 return messages.get(id);
};
const sandbox={Date,AbortController,clearTimeout,setTimeout,document:{hidden:true,getElementById:node,addEventListener(){}},
 window:{setInterval(){}}};
vm.createContext(sandbox);vm.runInContext(js,sandbox);
const weather=sandbox.window.FirstHyundaiWeatherBriefing._test;
const evening=Date.parse('2026-10-26T19:30:00+09:00');
assert.equal(weather.summarize(null,evening).mapAlert,'');
assert(!('mapCaution' in weather.summarize(null,evening)));
console.log('PASS conditional Songdo news, mapped-source links, action-only box warnings, optional contract and unified refresh buttons.');
