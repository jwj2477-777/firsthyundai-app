'use strict';
/* Real Blink test: validates interpolated registered CSS fill in headless Chrome. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const css=['theme.css','ui-v2.css'].map(s=>fs.readFileSync(path.join(root,'app/src/main/assets',s),'utf8')).join('\n').replace(/<\/style/gi,'<\\/style');
const binary=['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(x=>child.spawnSync('which',[x],{encoding:'utf8'}).status===0);
assert(binary,'Chrome or Chromium required for real native-flow browser test');
function group(id,n,classes,news){
 const names=n===2?['뉴스 브리핑','인천 청약·분양']:['전체','매매','전세','월세'];
 return '<div id="'+id+'" class="'+classes+'"'+(news?' data-tone="purple"':'')+'>'+
  names.map((v,i)=>'<button id="'+id+i+'" class="'+(i===0?'active':'')+
   '" '+(news?'aria-selected="'+(i===0)+'"':'aria-pressed="'+(i===0)+'"')+
   '>'+v+'</button>').join('')+'</div>';
}
function runBrowserTests(){
 const tests=[];
 const el=id=>document.getElementById(id);
 const fill=id=>parseFloat(getComputedStyle(el(id)).getPropertyValue('--fhd-native-fill'));
 const check=(label,condition)=>tests.push([label,!!condition]);
 const cases=[['newsSwitch',1,true],['tradeTypeBar',1,false],
   ['officeTypeBar',2,false],['nearbyTypeBar',3,false]];
 addEventListener('load',()=>{
  for(const [id,target] of cases){
   check(id+' selected starts full',Math.abs(fill(id+'0')-100)<1);
   check(id+' idle starts empty',Math.abs(fill(id+target))<1);
  }
  setTimeout(()=>{
   for(const [id,target,news] of cases){
    const old=el(id+'0'),now=el(id+target);
    if(news){
     old.setAttribute('aria-selected','false');
     now.setAttribute('aria-selected','true');
    }else{
     old.classList.remove('active');
     now.classList.add('active');
     now.classList.add(['','sale','lease','monthly'][target]);
     old.setAttribute('aria-pressed','false');
     now.setAttribute('aria-pressed','true');
    }
    getComputedStyle(now).getPropertyValue('--fhd-native-fill');
    const motion=now.getAnimations().find(a=>a.transitionProperty==='--fhd-native-fill');
    check(id+' actual CSS transition exists',!!motion);
    if(motion){
     try {
      motion.currentTime=330;
      const value=fill(id+target);
      check(id+' halfway is 8–93% ('+value+')',value>8&&value<93);
     }catch(err){check(id+' halfway exception '+err.message,false)}
    }
   }
   const failed=tests.filter(x=>!x[1]);
   const pre=document.createElement('pre');
   pre.id='actual-browser-flow-test';
   pre.textContent=(failed.length?'FAIL ':'PASS ')+JSON.stringify(tests);
   document.body.appendChild(pre);
  },140);
 });
}
const html=[
 '<!doctype html><html><head><meta charset="utf-8"><style>',css,'</style></head><body>',
 '<div id="news" class="page">',group('newsSwitch',2,'controls newsCategoryTabs sectionModeSwitch',true),'</div>',
 '<div id="trades" class="page">',group('tradeTypeBar',4,'tradeTypeBar',false),'</div>',
 '<div id="officetel" class="page">',group('officeTypeBar',4,'tradeTypeBar',false),'</div>',
 '<div id="nearbyDetails">',group('nearbyTypeBar',4,'tradeTypeBar',false),'</div>',
 '<script>(',runBrowserTests.toString(),')();</script></body></html>'
].join('');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-native-css-'));
try{
 const file=path.join(dir,'test.html');fs.writeFileSync(file,html);
 const r=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu',
  '--disable-dev-shm-usage','--disable-background-timer-throttling',
  '--virtual-time-budget=1300','--dump-dom','file://'+file],
  {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
 if(r.error)throw r.error;
 assert.equal(r.status,0,'Chrome failed: '+r.stderr.slice(-1400));
 const m=r.stdout.match(/<pre id="actual-browser-flow-test">([\s\S]*?)<\/pre>/);
 assert(m,'Native browser check did not execute: '+r.stdout.slice(-1200));
 const report=m[1].replaceAll('&quot;','"').replaceAll('&amp;','&');
 assert(report.startsWith('PASS '),report);
 console.log('Actual Chrome CSS transitions verified: '+report.slice(0,1800));
}finally{fs.rmSync(dir,{recursive:true,force:true})}
