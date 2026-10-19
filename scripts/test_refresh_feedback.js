// v1.10.1: buttons visibly confirm a real no-cache published-data recheck.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
new vm.Script(js);
assert(html.includes('class="officeMarkSvg"')&&html.includes('fill="#FF0000"')&&html.includes('fill="#FFFFFF"'));
assert(html.includes('<h1>퍼스트현대</h1>')&&html.includes('class="brandHeader"'));
assert(!html.includes('자료 이용 안내 · 눌러서 보기'));
assert(!html.includes('프라임뷰 20블럭과 25블럭은 별개 단지로 표시합니다.'));
assert(!html.includes('상세 화면</b>이 부드럽게 열립니다.'));
assert(html.includes('id="refreshFeedback"')&&html.includes('aria-live="polite"'));
for(const category of ['trades','new_trades','news','complexes'])
 assert(html.includes('data-refresh="'+category+'"'),'Refresh action missing for '+category);
const elements=new Map(),buttonSets={};
function el(id){
 if(!elements.has(id)){
  const classes=new Set();
  elements.set(id,{
   innerHTML:'',textContent:'',className:'',value:'',options:[{}],scrollTop:0,open:false,
   classList:{add(n){classes.add(n)},remove(n){classes.delete(n)},toggle(n,on){if(on)classes.add(n);else classes.delete(n)},contains(n){return classes.has(n)}},
   setAttribute(){},focus(){},scrollIntoView(){},reset(){},showModal(){this.open=true},close(){this.open=false},
   querySelectorAll(){return []}
  });
 }
 return elements.get(id);
}
const data={
 'trades.json':{schema_version:1,area:'송도동',state:'ok',checked_at:'2026-10-19T09:00:00+09:00',records:[]},
 'new_trades.json':{schema_version:1,state:'ok',checked_at:'2026-10-19T09:00:00+09:00',records:[]},
 'news.json':{schema_version:1,state:'ok',checked_at:'2026-10-19T09:00:00+09:00',briefs:[]},
 'complexes.json':JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8'))
};
let failNext='',counter=0,requests=[];
const ctx=vm.createContext({
 window:{},document:{getElementById:el,body:{classList:el('body').classList},activeElement:el('complexSearch'),
  querySelectorAll(q){const x=q.match(/data-refresh="([^"]+)"/);return x?(buttonSets[x[1]]||[]):[]}},
 localStorage:{getItem:()=>null,setItem(){}},
 fetch:async(url,options)=>{
  requests.push({url,options});const file=url.split('/').pop().split('?')[0];
  if(failNext===file){failNext='';throw new Error('인터넷 연결 불가');}
  return {ok:true,json:async()=>JSON.parse(JSON.stringify(data[file]))};
 },alert(){},confirm:()=>true,console,URL,Blob
});
vm.runInContext(js,ctx);
(async()=>{
 const run=q=>vm.runInContext(q,ctx);
 for(let i=0;i<30;i++)await Promise.resolve();
 buttonSets.trades=[{disabled:false},{disabled:false}];
 requests=[];
 let p=run("refreshOne('trades',true)");
 assert(el('refreshFeedback').textContent.includes('확인하고 있습니다'));
 assert(buttonSets.trades.every(x=>x.disabled===true));
 let result=await p;
 assert.equal(result.ok,true);
 assert.equal(result.changed,false,'Same published source should be labeled unchanged');
 assert(el('refreshFeedback').textContent.includes('동일'));
 assert(el('refreshFeedback').textContent.includes('자료 수집:'));
 assert(buttonSets.trades.every(x=>x.disabled===false));
 assert(requests[0].url.includes('trades.json?t='),'Cache buster must be on browser request');
 assert.equal(requests[0].options.cache,'no-store');
 data['trades.json'].checked_at='2026-10-19T11:30:00+09:00';
 data['trades.json'].records.push({building:'송도테스트',contract_date:'2026-10-19',type:'매매',amount_10k:110000,area_m2:84,status:'신고'});
 result=await run("refreshOne('trades',true)");
 assert.equal(result.ok,true);assert.equal(result.changed,true);
 assert(el('refreshFeedback').textContent.includes('새로 게시된 자료'));
 assert(el('tradesContent').innerHTML.includes('송도테스트'));
 assert.equal(run('remote.trades.records.length'),1);
 const prior=run('remote.trades.checked_at');
 failNext='trades.json';
 result=await run("refreshOne('trades',true)");
 assert.equal(result.ok,false);
 assert(el('refreshFeedback').textContent.includes('연결 불가'));
 assert.equal(run('remote.trades.checked_at'),prior,'Connection failure must retain last good data');
 assert(buttonSets.trades.every(x=>x.disabled===false));
 requests=[];
 await run('refreshAll(true)');
 assert.equal(requests.length,4,'Overview refresh should recheck all four snapshots');
 assert(el('refreshFeedback').textContent.includes('모든 게시자료'));
 const java=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
 assert(java.includes('conn.setUseCaches(false)'));
 assert(java.includes('"Cache-Control", "no-cache, no-store, max-age=0"'));
 assert(java.includes('"?refresh="+System.currentTimeMillis()'));
 console.log('Refresh UX regression passed: cache busting, pending, unchanged, updated, failure fallback, all feeds, header brand, clutter removed');
})().catch(e=>{console.error(e);process.exitCode=1});
