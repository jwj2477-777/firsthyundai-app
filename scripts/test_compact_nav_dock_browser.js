'use strict';
/* A real-browser geometry check: all SIX premium cards stay INSIDE one frame,
   with balanced inset, compact height, and stable selection at phone widths. */
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const child=require('node:child_process'),assert=require('node:assert/strict');
const assets=path.resolve(__dirname,'../app/src/main/assets');
const chrome=process.env.FHD_CHROME||
 ['google-chrome','google-chrome-stable','chromium','chromium-browser']
  .find(name=>child.spawnSync('which',[name]).status===0);
assert(chrome,'A Chrome binary is required for physical navigation checks');
async function verify(){
 try{
  await document.fonts.ready;
  fetchRemote=async()=>null;
  const check=(valid,message)=>{if(!valid)throw Error(message)};
  const round=v=>Math.round(v*10)/10;
  let expectedLayout=null;
  for(const page of ['trades','complexes','news','overview','contracts','officeBoard']){
   switchPage(page);
   await new Promise(done=>setTimeout(done,120));
   const frame=document.getElementById('nav');
   const shell=getComputedStyle(frame),box=frame.getBoundingClientRect();
   const tiles=[...document.querySelectorAll('#nav .primaryNav>button,#nav .utilityNav>button:not(.adminCenterNav)')];
   check(tiles.length===6,'Exactly 6 controls in navigation panel');
   check(parseFloat(shell.borderTopWidth)>=1,'Single frame needs a real outline');
   check(parseFloat(shell.borderTopLeftRadius)>=19,'Single dock should have softened corners');
   check(shell.backgroundImage!=='none','Dock background should gently contain buttons');
   const b=tiles.map(x=>x.getBoundingClientRect());
   const inset=Math.min(...b.map(x=>x.left-box.left));
   check(inset>=7,'Buttons touch or escape outer frame');
   check(b.every(x=>x.right<=box.right-6&&x.bottom<=box.bottom-6),
    'One of the buttons escapes grouped frame');
   check(b.every(x=>Math.abs(x.height-b[0].height)<.3),'Mismatched button heights');
   check(b.every(x=>Math.abs(x.width-b[0].width)<.3),'Mismatched button widths');
   check(b.every(x=>x.height>=80&&x.height<=95),'Dock buttons are not slightly reduced');
   check(Math.abs(b[0].y-b[1].y)<.2&&Math.abs(b[1].y-b[2].y)<.2,
    'First row not aligned');
   check(Math.abs(b[3].y-b[4].y)<.2&&Math.abs(b[4].y-b[5].y)<.2,
    'Second row not aligned');
   const gapX=b[1].left-b[0].right,gapY=b[3].top-b[0].bottom;
   check(gapX>=4&&gapX<=9&&gapY>=4&&gapY<=12,
    'The buttons must stay slightly separated, but visually gathered');
   check(b.every((x,i)=>tiles[i].scrollWidth<=tiles[i].clientWidth+2),
    'Navigation icon/text overflows the tile');
   check(tiles.every(t=>!!t.querySelector('.navIcon svg')&&!!t.querySelector('.navLabel')),
    'Navigation icons must remain above captions');
   check(b.every((x,i)=>getComputedStyle(tiles[i]).borderTopLeftRadius==='13px'||
    getComputedStyle(tiles[i]).borderTopLeftRadius==='14px'),
    'Tiles should have one smaller corner radius');
   check(document.documentElement.scrollWidth<=innerWidth+1,'Unexpected horizontal scrolling');
   const geometry=JSON.stringify(b.map(x=>[round(x.x),round(x.y),round(x.width),round(x.height)]));
   if(expectedLayout)check(geometry===expectedLayout,'Page selection reflows the menu '+page);
   expectedLayout=geometry;
  }
  document.body.innerHTML='<pre id="compact-dock-test">PASS six smaller stable buttons in one subtly framed navigation dock</pre>';
 }catch(e){document.body.innerHTML='<pre id="compact-dock-test">FAIL '+e.message+'</pre>'}
}
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'fhd-compact-dock-'));
try{
 fs.cpSync(assets,tmp,{recursive:true});
 let markup=fs.readFileSync(path.join(tmp,'index.html'),'utf8');
 markup=markup.replace('refreshAll();refreshPublicServices();refreshNearbyConfig();\n','\n');
 markup=markup.replace('</body>','<script>addEventListener("load",()=>('+verify.toString()+')());</script></body>');
 const file=path.join(tmp,'index.html');fs.writeFileSync(file,markup);
 for(const width of [320,360,393,430,600]){
  const r=child.spawnSync(chrome,['--headless=new','--no-sandbox','--disable-gpu',
   '--disable-dev-shm-usage','--hide-scrollbars','--window-size='+width+',1100',
   '--virtual-time-budget=19000','--dump-dom','file://'+file],
   {encoding:'utf8',timeout:36000,maxBuffer:8*1024*1024});
  assert.equal(r.status,0,r.stderr.slice(-800));
  const found=r.stdout.match(/<pre id="compact-dock-test">([\s\S]*?)<\/pre>/);
  assert(found,'Browser did not report layout test '+r.stdout.slice(-650));
  assert(found[1].startsWith('PASS'),width+'px '+found[1]);
  console.log(width+'px '+found[1]);
 }
}finally{fs.rmSync(tmp,{recursive:true,force:true})}
