'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const script=html.split('<script>')[1].split('</script>')[0];
new vm.Script(script);
assert(!html.includes('생성형 AI 아님'),'Outdated news label conflicts with enabled Gemini/Groq pipeline');
assert(html.includes('본문 요약 대기')&&html.includes('Gemini 본문 요약')&&html.includes('Groq 본문 요약'));
const begin=script.indexOf('function renderNews(){'),end=script.indexOf('function persistNotes(){',begin);
assert(begin>=0&&end>begin,'News renderer exists');
const divs={newsMeta:{textContent:''},newsContent:{innerHTML:''},newsCategory:{value:''}};
const ctx=vm.createContext({
 remote:{news:null},$:id=>divs[id],
 safeLink:s=>String(s||'').startsWith('https://')?s:'',
 escapeHtml:v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 prettyTime:s=>s||'수집 전',
});
vm.runInContext(script.slice(begin,end),ctx);
function render(input){ctx.remote.news=input;vm.runInContext('renderNews()',ctx);return divs.newsContent.innerHTML;}
const data=[
 {id:'1',title:'송도 기사 첫째',category:'송도 종합',summary_method:'gemini_article',summary:'첫 문장입니다.\n두 번째 문장입니다.\n세 번째 문장입니다.',last_published_at:'2026-10-21',article_count:1,sources:[]},
 {id:'2',title:'분양 기사 둘째',category:'분양·입주',summary_method:'groq_article',summary:'임대료 관련 정책을 발표했습니다.\n세부 기준을 설명했습니다.\n시행 일정은 아직 확인 중입니다.',last_published_at:'2026-10-21',article_count:1,sources:[]},
 {id:'3',title:'본문 확인 안 된 기사',category:'정책·규제',summary_method:'headline_only',summary:'',last_published_at:'2026-10-21',article_count:1,sources:[]}
];
let out=render({state:'ok',checked_at:'2026-10-21T10:00:00+09:00',briefs:data});
assert(divs.newsMeta.textContent.includes('AI 본문요약 2/3건'));
assert(divs.newsMeta.textContent.includes('1건 원문 확인 대기'));
assert(out.includes('Gemini 본문 요약')&&out.includes('Groq 본문 요약'));
assert(out.includes('기사 본문 확보 또는 요약 검증이 완료되지 않았습니다'));
assert(!out.includes('<p></p>'),'Never show empty AI summary paragraph');
assert(out.includes('첫 문장입니다.<br>두 번째 문장입니다.'));
divs.newsCategory.value='정책·규제';
out=render({state:'ok',checked_at:'2026-10-21T10:00:00+09:00',briefs:data});
assert(out.includes('뉴스 묶음 1개 · AI 요약 0개'));
assert(!out.includes('송도 기사 첫째'));
divs.newsCategory.value='';
out=render({state:'partial',checked_at:'',briefs:[{...data[0],title:'<script>bad</script>',summary:'무언가를 조사했습니다.\n<script>evil</script>\n확인되었습니다.'}]});
assert(!out.includes('<script>bad</script>'));
assert(out.includes('&lt;script&gt;bad&lt;/script&gt;'));
out=render({state:'ok',briefs:[]});
assert(divs.newsMeta.textContent.includes('0/0건'));
const news=JSON.parse(fs.readFileSync(path.join(root,'data/news.json'),'utf8'));
const ai=news.briefs.filter(b=>['gemini_article','groq_article','openai_article'].includes(b.summary_method)&&typeof b.summary==='string'&&b.summary.trim().length>=20);
assert(ai.length>0,'Published news should retain AI summaries, not accidentally erase them');
console.log('News UI regression passed. Published AI summaries: '+ai.length+'/'+news.briefs.length);
