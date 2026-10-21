/* Contract image cards: local-only Canvas rendering of the exact approved preview. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const WIDTH=1080, LEFT=82, RIGHT=998, TOP=278, LIMIT=1890, MAX_PAGES=12;
const styles={
 title:{font:'700 47px sans-serif',color:'#5e3f28',line:66,before:22,after:23},
 section:{font:'700 36px sans-serif',color:'#66452b',line:55,before:27,after:12},
 row:{font:'600 32px sans-serif',color:'#352e29',line:52,before:9,after:10},
 term:{font:'400 32px sans-serif',color:'#3e3833',line:52,before:9,after:14},
 body:{font:'400 31px sans-serif',color:'#494038',line:51,before:5,after:12},
 notice:{font:'600 32px sans-serif',color:'#714f33',line:53,before:24,after:12}
};
let canvases=[];
function kindFor(line){
 if(/^\s*●/.test(line))return 'title';
 if(/^\s*※/.test(line))return 'notice';
 if(/^\s*▶\s*[^:：]+[:：]/.test(line))return 'row';
 if(/^\s*▶/.test(line))return 'section';
 if(/^\s*→/.test(line))return 'term';
 return 'body';
}
function wrapText(ctx,text,width){
 if(!text)return [''];
 const lines=[];let cur='';
 for(const char of Array.from(text)){
  if(cur&&ctx.measureText(cur+char).width>width){
   lines.push(cur.trimEnd());
   cur=char===' '? '':char;
  }else cur+=char;
 }
 if(cur)lines.push(cur);
 return lines.length?lines:[''];
}
function plan(raw){
 const text=String(raw||'').replace(/\r/g,'');
 if(!text.trim())throw Error('계약 안내 내용을 먼저 작성해 주세요.');
 if(text.length>12000)throw Error('이미지 내용이 너무 깁니다. 문구를 확인해 주세요.');
 const measure=document.createElement('canvas').getContext('2d');
 if(!measure)throw Error('휴대폰에서 이미지 생성 기능을 사용할 수 없습니다.');
 const pages=[{items:[],bottom:TOP}],newPage=()=>{
  if(pages.length>=MAX_PAGES)throw Error('안내 내용이 너무 깁니다. 12장을 초과하지 않도록 정리해 주세요.');
  const p={items:[],bottom:TOP};pages.push(p);return p;
 };
 let page=pages[0];
 const sourceLines=text.split('\n');
 for(let index=0;index<sourceLines.length;index++){
  const rawLine=sourceLines[index];
  if(!rawLine.trim()){
   if(page.items.length)page.bottom+=Math.min(22,LIMIT-page.bottom);
   continue;
  }
  const kind=kindFor(rawLine),spec=styles[kind];
  measure.font=spec.font;
  // Retain every source line including user-edited special terms and negotiated clauses.
  const pieces=wrapText(measure,rawLine.trim(),RIGHT-LEFT-4);
  const needed=spec.before+pieces.length*spec.line+spec.after;
  if(page.items.length&&page.bottom+needed>LIMIT && needed<(LIMIT-TOP)){
   page=newPage();
  }
  page.bottom+=spec.before;
  for(const part of pieces){
   if(page.bottom+spec.line+32>LIMIT && page.items.length)page=newPage();
   page.items.push({kind,text:part,y:page.bottom});
   page.bottom+=spec.line;
  }
  page.bottom+=spec.after;
 }
 if(!pages.some(p=>p.items.length))throw Error('이미지에 넣을 내용이 없습니다.');
 return pages.filter(p=>p.items.length);
}
function roundedRect(c,x,y,w,h,r){
 c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
 c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
 c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}
function draw(page,index,total){
 const canvas=document.createElement('canvas');
 canvas.width=WIDTH;
 canvas.height=Math.max(890,Math.min(2100,Math.ceil(page.bottom+148)));
 const c=canvas.getContext('2d');
 if(!c)throw Error('이미지를 그릴 수 없습니다.');
 c.fillStyle='#f7f3ed';c.fillRect(0,0,WIDTH,canvas.height);
 c.fillStyle='#ffffff';roundedRect(c,35,35,WIDTH-70,canvas.height-70,30);c.fill();
 c.strokeStyle='#e9e0d7';c.lineWidth=2;c.stroke();
 c.fillStyle='#6c4b31';roundedRect(c,LEFT,83,91,54,10);c.fill();
 c.font='700 30px sans-serif';c.fillStyle='#ffffff';c.fillText('FHD',LEFT+14,121);
 c.font='700 23px sans-serif';c.fillStyle='#6e503a';c.fillText('FIRST HYUNDAI',LEFT+108,112);
 c.font='700 42px sans-serif';c.fillStyle='#352e29';c.fillText('계약 안내',LEFT,203);
 c.font='400 23px sans-serif';c.fillStyle='#968173';c.fillText('퍼스트현대부동산',RIGHT-196,196);
 c.strokeStyle='#e7ded4';c.lineWidth=2;c.beginPath();c.moveTo(LEFT,235);c.lineTo(RIGHT,235);c.stroke();
 for(const item of page.items){
  const s=styles[item.kind];c.font=s.font;c.fillStyle=s.color;
  c.fillText(item.text,LEFT,item.y+s.line-12);
 }
 const footerY=canvas.height-99;
 c.strokeStyle='#e7ded4';c.beginPath();c.moveTo(LEFT,footerY-25);c.lineTo(RIGHT,footerY-25);c.stroke();
 c.fillStyle='#8e8074';c.font='400 22px sans-serif';
 c.fillText('안내된 계약조건과 계좌정보를 당사자께서 확인해 주세요.',LEFT,footerY+12);
 c.textAlign='right';c.font='600 24px sans-serif';c.fillText(String(index+1).padStart(2,'0')+' / '+String(total).padStart(2,'0'),RIGHT,footerY+12);
 c.textAlign='left';
 return canvas;
}
function ready(){
 return !!window.FirstHyundaiContracts?.canShare?.();
}
function close(){
 const d=$('ct_imageDialog');
 if(d?.open&&typeof d.close==='function')d.close();
}
function open(){
 if(!ready())return;
 try{
  const pages=plan($('ct_preview').value);
  canvases=pages.map((p,i)=>draw(p,i,pages.length));
  const target=$('ct_imagePages');target.replaceChildren();
  canvases.forEach((canvas,i)=>{
   const outer=document.createElement('div');outer.className='contractImageSheet';
   const tag=document.createElement('div');tag.className='contractImagePageTag';
   tag.textContent='이미지 '+(i+1)+' / '+canvases.length;
   canvas.setAttribute('role','img');
   canvas.setAttribute('aria-label','계약 안내 이미지 '+(i+1));
   outer.append(tag,canvas);target.appendChild(outer);
  });
  const status=$('ct_imageStatus');
  status.textContent=canvases.length+'장의 PNG 이미지가 준비되었습니다. 전체 내용을 확인한 뒤 공유해 주세요.';
  const dialog=$('ct_imageDialog');
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
 }catch(e){canvases=[];alert(e.message||'이미지 생성에 실패했습니다.');}
}
async function share(){
 if(!ready())return;
 if(!canvases.length){alert('이미지 미리보기를 먼저 확인해 주세요.');return;}
 const status=$('ct_imageStatus');
 status.textContent='PNG 이미지 공유를 준비하고 있습니다.';
 try{
  if(window.FirstHyundaiNative?.shareContractImages){
   const pages=canvases.map(canvas=>canvas.toDataURL('image/png'));
   const payload=JSON.stringify({pages});
   if(payload.length>22000000)throw Error('이미지가 너무 큽니다. 안내 문구를 나누어 보내 주세요.');
   window.FirstHyundaiNative.shareContractImages(payload);
   status.textContent='공유할 앱을 선택해 고객에게 이미지를 보내세요.';
   return;
  }
  const files=[];
  for(let i=0;i<canvases.length;i++){
   const blob=await new Promise(resolve=>canvases[i].toBlob(resolve,'image/png'));
   if(!blob)throw Error('PNG 생성에 실패했습니다.');
   files.push(new File([blob],'퍼스트현대_계약안내_'+String(i+1).padStart(2,'0')+'.png',{type:'image/png'}));
  }
  if(navigator.share&&navigator.canShare?.({files})){
   await navigator.share({files,title:'퍼스트현대 계약 안내'});
   status.textContent='이미지 공유가 완료되었습니다.';
  }else{
   // Browser-only fallback. The installed Android app always uses the native share sheet.
   files.forEach((file,i)=>{
    const url=URL.createObjectURL(file);
    const a=document.createElement('a');a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),2000);
   });
   status.textContent='이미지 저장을 요청했습니다. 휴대폰에서는 설치형 앱의 공유 기능을 이용해 주세요.';
  }
 }catch(e){
  if(e?.name==='AbortError'){status.textContent='공유를 취소했습니다.';return;}
  status.textContent='공유 실패: '+(e.message||'다시 시도해 주세요.');
 }
}
window.FirstHyundaiContractImage={open,close,share,_test:{plan,kindFor}};
})();