// v1.10: separate full-screen apartment detail screens and reverse navigation.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
new vm.Script(js);
assert(html.includes('240ms cubic-bezier'),'Opening apartment details should animate quickly');
assert(html.includes('@media(prefers-reduced-motion:reduce)'),'Honor device reduced-motion preference');
assert(html.includes('id="complexSheet"')&&html.includes('id="nearbyDetails"'));
assert(!/scrollIntoView\(\{behavior:'smooth',block:'start'\}\)/.test(js.slice(js.indexOf('function chooseNearby(id)'),js.indexOf('function showMoreNearby'))));
const els=new Map();
function element(id){
 if(!els.has(id)){
  const classes=new Set();
  const attributes={};
  els.set(id,{
   value:'',innerHTML:'',textContent:'',open:false,scrollTop:0,options:[{}],attributes,
   classList:{toggle(n,v){if(v)classes.add(n);else classes.delete(n);},remove(n){classes.delete(n);},contains(n){return classes.has(n);},add(n){classes.add(n);}},
   setAttribute(n,v){attributes[n]=v},getAttribute(n){return attributes[n]},
   scrollIntoView(){throw new Error('App must never jump to the bottom of the list')},
   focus(){},reset(){},showModal(){this.open=true},close(){this.open=false}
  });
 }
 return els.get(id);
}
const payload={
 'complexes.json':JSON.parse(fs.readFileSync(path.join(root,'data/complexes.json'),'utf8')),
 'trades.json':{schema_version:1,area:'송도동',state:'ok',checked_at:'2026-10-19T13:00:00Z',records:[
  {building:'더샵송도프라임뷰20BL',contract_date:'2026-10-19',type:'매매',amount_10k:70000,area_m2:84.95,status:'신고'},
  {building:'더샵송도프라임뷰25BL',contract_date:'2026-10-18',type:'전세',deposit_10k:45000,area_m2:101.5,status:'신고'}
 ]},
 'new_trades.json':{schema_version:1,state:'ok',checked_at:'2026-10-19T12:00:00Z',records:[]},
 'news.json':{schema_version:1,state:'ok',checked_at:'2026-10-19T12:00:00Z',briefs:[]}
};
const body={classList:element('body').classList};
const ctx=vm.createContext({
 window:{},document:{getElementById:element,body,activeElement:element('complexSearch')},
 localStorage:{getItem:()=>null,setItem(){}},
 fetch:async url=>({ok:true,json:async()=>payload[url.split('/').pop().split('?')[0]]}),
 alert(){},confirm:()=>true,console,URL,Blob
});
vm.runInContext(js,ctx);
(async()=>{
 for(let i=0;i<30;i++)await Promise.resolve();
 const run=q=>vm.runInContext(q,ctx);
 run("switchPage('complexes')");
 element('complexSearch').value='프라임뷰';
 run('renderComplexes()');
 run("selectComplex('prime20')");
 assert.equal(run('currentPage'),'complexes');
 assert.equal(element('complexSearch').value,'프라임뷰','Search must survive detail opening');
 assert.equal(element('complexSheet').classList.contains('detailOpen'),true);
 assert.equal(element('complexSheet').getAttribute('aria-hidden'),'false');
 assert.equal(element('complexSheetTitle').textContent,'프라임뷰 20블럭');
 assert.equal(body.classList.contains('apartmentSheetActive'),true);
 run("setComplexDetailTab('deals')");
 assert(element('complexDetails').innerHTML.includes('전용 84.95㎡'));
 assert(!element('complexDetails').innerHTML.includes('전용 101.5㎡'));
 assert.equal(run('window.firstHyundaiGoBack()'),true);
 assert.equal(element('complexSheet').classList.contains('detailOpen'),false);
 assert.equal(element('complexSheet').getAttribute('aria-hidden'),'true');
 assert.equal(element('complexSearch').value,'프라임뷰','Previous search restored unchanged');
 assert.equal(body.classList.contains('apartmentSheetActive'),false);
 assert.equal(run('window.firstHyundaiGoBack()'),false,'Back should fall through without detail open');
 run("switchPage('nearby')");
 run("chooseNearby('prime25')");
 assert.equal(element('nearbyDetails').classList.contains('detailOpen'),true);
 assert.equal(element('nearbySheetTitle').textContent,'프라임뷰 25블럭');
 assert(element('nearbyTrades').innerHTML.includes('101.5'));
 assert(!element('nearbyTrades').innerHTML.includes('84.95'));
 run('openFavoriteBasicInfo()');
 assert.equal(element('nearbyDetails').classList.contains('detailOpen'),false);
 assert.equal(element('complexSheet').classList.contains('detailOpen'),true);
 assert.equal(element('complexSheetTitle').textContent,'프라임뷰 25블럭');
 assert.equal(run('currentPage'),'complexes');
 assert(element('complexDetails').innerHTML.includes('164세대'));
 run("switchPage('news')");
 assert.equal(element('complexSheet').classList.contains('detailOpen'),false);
 assert.equal(body.classList.contains('apartmentSheetActive'),false);
 const java=fs.readFileSync(path.join(root,'app/src/main/java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
 assert(java.includes('window.firstHyundaiGoBack'));
 assert(java.includes('MainActivity.super.onBackPressed()'));
 console.log('v1.10 detail screens: animated navigation, safe back, persistent search, correct 20/25 split and favorites-to-basics passed');
})().catch(e=>{console.error(e);process.exitCode=1});
