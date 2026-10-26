'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),
 child=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../app/src/main/assets');
const chrome=process.env.FHD_CHROME||
 ['google-chrome','google-chrome-stable','chromium','chromium-browser']
 .find(x=>child.spawnSync('which',[x]).status===0);
assert(chrome,'Chromium required for weather screen geometry test');
async function verify(){
 try{
  await document.fonts.ready;
  const check=(value,message)=>{if(!value)throw Error(message)};
  fetchRemote=async()=>null;
  switchPage('overview');
  const day=new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  const start=Math.ceil(Date.now()/3600000)*3600000;
  const hours=Array.from({length:12},(_,i)=>({at:new Date(start+i*3600000).toISOString(),
    type:i===4?'rain':'none',temp:11+i%4,pop:i===4?72:10,sky:i%2?3:1}));
  const mock={schema:1,status:'ok',date:day,issued_at:new Date(Date.now()-3600000).toISOString(),hours};
  window.FirstHyundaiWeatherBriefing.forecast=()=>mock;
  window.FirstHyundaiWeatherBriefing.forecastStatus=()=>({mapAlert:'지도함 비 예보 안내'});
  window.FirstHyundaiOfficeBoard.weatherAppointments=()=>[{at:hours[4].at}];
  const trigger=document.getElementById('weatherDetailEntry');
  const dialog=document.getElementById('fhdWeatherDialog');
  check(trigger&&dialog&&dialog.hidden,'Detail dialog starts completely hidden');
  trigger.click();
  check(!dialog.hidden&&dialog.getAttribute('aria-hidden')==='false','Weather detail opens on tap');
  const rect=dialog.getBoundingClientRect();
  check(rect.width<=innerWidth+1&&rect.left>=-1,'Detail fits phone width');
  check(Math.abs(rect.height-innerHeight)<=2,'Detail fills device viewport');
  check(getComputedStyle(dialog).position==='fixed','Detail covers dashboard without moving navigation');
  check(document.getElementById('fhdWeatherChart').querySelectorAll('.fhdWeatherHour').length===12,
    'Twelve forecast slots render on supported KMA data');
  check(document.getElementById('fhdWeatherChart').querySelectorAll('.fhdWeatherPlot path').length>0,
    'Temperature points connect correctly');
  check(document.getElementById('fhdWeatherOfficeAlert').textContent.includes('지도함'),
    'Existing map-box warning appears in detail');
  check(document.getElementById('fhdWeatherSchedule').textContent.includes('72%'),
    'Shared appointment matches exact forecast time');
  check(document.documentElement.scrollWidth<=innerWidth+1,'No accidental horizontal overflow');
  check(window.firstHyundaiGoBack()===true&&dialog.hidden,'Android Back dismisses weather first');
  check(currentPage==='overview','Back does not leave the dashboard');
  document.body.innerHTML='<pre id="weather-detail-test">PASS detail overlay, 12h chart, private appointment weather, back and mobile geometry</pre>';
 }catch(e){document.body.innerHTML='<pre id="weather-detail-test">FAIL '+e.message+'</pre>'}
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-weather-detail-'));
try{
 fs.cpSync(root,temp,{recursive:true});
 let html=fs.readFileSync(path.join(temp,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(temp,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,393,430]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',
    '--hide-scrollbars','--window-size='+width+',1100','--virtual-time-budget=30000',
    '--dump-dom','file://'+file],{encoding:'utf8',timeout:40000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-900));
  const m=r.stdout.match(/<pre id="weather-detail-test">([\s\S]*?)<\/pre>/);
  assert(m,'Weather detail browser never finished: '+r.stdout.slice(-800));
  assert(m[1].startsWith('PASS'),width+'px '+m[1]);
  console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true})}
