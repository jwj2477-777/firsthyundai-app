'use strict';
/* Real Chromium checks the SIX menu rectangles and three previously inconsistent
   section headings. No screenshots or static CSS-only assertions. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const binary=process.env.FHD_CHROME||
 ['google-chrome','google-chrome-stable','chromium','chromium-browser']
  .find(x=>child.spawnSync('which',[x]).status===0);
assert(binary,'Chrome/Chromium required to verify actual geometry');
async function verify(){
 try{
  await document.fonts.ready;
  const check=(condition,msg)=>{if(!condition)throw Error(msg)};
  fetchRemote=async()=>null;
  const round=n=>Math.round(n*10)/10;
  const selectors='#nav .primaryNav>button,#nav .utilityNav>button:not(.adminCenterNav)';
  const rect=e=>{const b=e.getBoundingClientRect();
   return {x:round(b.left),y:round(b.top),w:round(b.width),h:round(b.height)}};
  const shape=e=>{const s=getComputedStyle(e);
   return {r:s.borderTopLeftRadius,b:s.borderTopWidth,box:s.boxSizing};};
  const headings={trades:'#trades>.sectionTitle',complexes:'#complexes>.sectionTitle',
    news:'#news>.sectionTitle',overview:'#overview>.sectionTitle',
    officeBoard:'#officeBoard>.sectionTitle',contracts:'#contracts>.contractHero'};
  let reference=null,positions=null;
  for(const page of Object.keys(headings)){
   switchPage(page);
   await new Promise(resolve=>setTimeout(resolve,120));
   const buttons=[...document.querySelectorAll(selectors)];
   check(buttons.length===6,page+' should show exactly six common navigation actions');
   const bounds=buttons.map(rect),shapes=buttons.map(shape);
   for(const [index,b] of bounds.entries()){
    check(Math.abs(b.h-bounds[0].h)<.2,'Mixed button heights on '+page+': '+index);
    check(Math.abs(b.w-bounds[0].w)<.2,'Mixed button widths on '+page+': '+index);
    check(shapes[index].r===shapes[0].r,'Mixed corner radius on '+page+': '+index);
    check(shapes[index].b===shapes[0].b,'Border jumps on '+page+': '+index);
    check(shapes[index].box==='border-box','Sizing mode differs');
    check(buttons[index].scrollWidth<=buttons[index].clientWidth+2,
      'Button label overflow on '+page+': '+index);
   }
   check(bounds[0].y===bounds[1].y&&bounds[1].y===bounds[2].y,'First row misaligned');
   check(bounds[3].y===bounds[4].y&&bounds[4].y===bounds[5].y,'Second row misaligned');
   check(bounds[3].y>bounds[0].y,'Row order reversed');
   const geometry=JSON.stringify(bounds);
   if(positions!==null)check(positions===geometry,'Changing pages moves a menu button: '+page);
   positions=geometry;
   const header=document.querySelector(headings[page]);
   check(!!header,'Missing heading '+page);
   const h=header.querySelector('h2');
   const styles=getComputedStyle(h),headRect=rect(header);
   const referenceHeading={font:styles.fontSize,weight:styles.fontWeight,
    height:headRect.h,top:headRect.y,left:headRect.x};
   if(!reference)reference=referenceHeading;
   else{
    check(reference.font===referenceHeading.font,'Heading font-size mismatch '+page);
    check(reference.weight===referenceHeading.weight,'Heading weight mismatch '+page);
    check(Math.abs(reference.height-referenceHeading.height)<.2,
      'Heading height mismatch '+page+': '+JSON.stringify([reference,referenceHeading]));
    check(Math.abs(reference.top-referenceHeading.top)<.2,'Heading starts at different Y: '+page);
    check(Math.abs(reference.left-referenceHeading.left)<.2,'Heading starts at different X: '+page);
   }
   check(document.documentElement.scrollWidth<=innerWidth+1,'Horizontal overflow '+page);
  }
  check(!document.querySelector('#contracts .contractFirstGuide'),
   'Redundant contract how-to disclosure removed while 3-stage workflow remains');
  check(!!document.querySelector('#contracts #ct_flowSteps'),
   'Three-stage contract flow must remain');
  document.body.innerHTML='<pre id="six-nav-geometry">PASS six equal buttons, stable coordinates, six matching titles and live contract help</pre>';
 }catch(e){
  document.body.innerHTML='<pre id="six-nav-geometry">FAIL '+e.message+'</pre>';
 }
}
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-six-nav-geometry-'));
try{
 fs.cpSync(assets,dir,{recursive:true});
 let html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
 html=html.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 html=html.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(dir,'index.html');fs.writeFileSync(file,html);
 for(const width of [320,360,393,430,600]){
  const result=child.spawnSync(binary,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=20000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:35000,maxBuffer:8*1024*1024});
  assert.equal(result.status,0,result.stderr.slice(-800));
  const found=result.stdout.match(/<pre id="six-nav-geometry">([\s\S]*?)<\/pre>/);
  assert(found,'Geometry test did not finish: '+result.stdout.slice(-700));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(dir,{recursive:true,force:true})}
