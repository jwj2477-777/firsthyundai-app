'use strict';
/* Real Chromium geometry for an intentionally secondary calculator entry point. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),
 child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const chrome=process.env.FHD_CHROME||['google-chrome','chromium','google-chrome-stable','chromium-browser']
 .find(x=>child.spawnSync('which',[x]).status===0);
assert(chrome,'Chrome/Chromium required to verify calculator layout');
async function verify(){
 try{
  await document.fonts.ready;
  fetchRemote=async()=>null;
  const check=(x,m)=>{if(!x)throw Error(m)};
  const quick=document.getElementById('fhc_quickOpen'),
    size=document.getElementById('deviceDisplayOpen');
  check(quick&&size,'Footer tools must be mounted');
  check(quick.closest('.compactAppFooter .appFooterDisplayRow'),'Calculator belongs in the low-priority footer tool row');
  check(size.parentElement===quick.parentElement,'Calculator and screen-size tools share one row');
  check(!document.querySelector('#nav #fhc_quickOpen'),'Never add seventh main menu action');
  check(quick.getBoundingClientRect().height>=44,'Footer calculator tap target smaller than 44px');
  check(quick.querySelector('svg')&&quick.textContent.trim()==='계산기','Icon and compact label should be clear');
  quick.click();
  check(document.body.dataset.section==='calculators','Footer shortcut must open real calculator page');
  check(quick.getAttribute('aria-current')==='page','Selected state must follow page');
  const rows=[...document.querySelectorAll('#fhc_modes>.fhcMode')];
  check(rows.length===5,'Must display five calculators');
  const first=rows[0].getBoundingClientRect();
  for(const [i,row] of rows.entries()){
   const rect=row.getBoundingClientRect();
   check(rect.height>=62,'Calculator row too small '+i);
   check(Math.abs(rect.height-first.height)<1,'Mixed calculator heights '+i);
   check(Math.abs(rect.width-first.width)<1,'Mixed calculator widths '+i);
   check(Math.abs(rect.left-first.left)<1,'Misaligned calculator row '+i);
   check(row.querySelector('.fhcModeIcon svg')&&row.querySelector('.fhcModeCopy strong'),'Missing icon or label '+i);
  }
  check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow caused by footer or calculator buttons');
  quick.setAttribute('aria-current','false');
  document.body.innerHTML='<pre id="fhc-layout-result">PASS small footer shortcut and five uniform calculator rows</pre>';
 }catch(e){document.body.innerHTML='<pre id="fhc-layout-result">FAIL '+e.message+'</pre>'}
}
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'fhc-layout-'));
try{
 fs.cpSync(assets,temp,{recursive:true});
 let html=fs.readFileSync(path.join(temp,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(temp,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,393,600]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu',
    '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
    '--virtual-time-budget=15000','--dump-dom','file://'+file],
    {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-1000));
  const m=r.stdout.match(/<pre id="fhc-layout-result">([\s\S]*?)<\/pre>/);
  assert(m,'Browser never completed '+width+'px '+r.stdout.slice(-400));
  assert(m[1].startsWith('PASS'),width+'px '+m[1]);
  console.log(width+'px '+m[1]);
 }
}finally{fs.rmSync(temp,{recursive:true,force:true})}
