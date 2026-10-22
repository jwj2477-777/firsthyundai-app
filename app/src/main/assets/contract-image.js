/* FirstHyundai premium contract image: on-device, document-like cards.
 * The final reviewed preview text is the sole source to preserve user edits.
 * Prefer one complete PNG. Long exceptional notes paginate rather than truncate.
 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const WIDTH=1080, LEFT=90, RIGHT=990, TOP=285, LIMIT=3040, MAX_PAGES=12;
const profiles=[
 {name:'spacious',scale:1,gap:1},
 {name:'compact',scale:0.88,gap:0.70},
 {name:'dense',scale:0.78,gap:0.50}
];
const specs={
 row:{size:30,line:48,before:5,after:5},
 section:{size:34,line:53,before:22,after:8},
 term:{size:29,line:46,before:5,after:5},
 body:{size:28,line:45,before:6,after:8},
 notice:{size:30,line:51,before:22,after:12},
 'notice-body':{size:26,line:42,before:5,after:9}
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
function clean(line,kind){
 const t=String(line||'').trim();
 return kind==='title'?t.replace(/^●\s*|\s*●$/g,'').trim():
  kind==='notice'?t.replace(/^※\s*/,''):
  kind==='row'||kind==='section'?t.replace(/^▶\s*/,''):
  kind==='term'?t.replace(/^→\s*/,''):t;
}
function wrapText(ctx,text,width){
 const lines=[];let cur='';
 for(const char of Array.from(text)){
  if(cur&&ctx.measureText(cur+char).width>width){
   lines.push(cur);
   cur=char===' '? '':char;
  }else cur+=char;
 }
 if(cur)lines.push(cur);
 return lines.length?lines:[''];
}
function round(c,x,y,w,h,r){
 c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
 c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
 c.lineTo(x+r,y+h);c.quadraticCurveTo(x,y+h,x,y+h-r);
 c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}
function parseTransfer(text){
 // Today's actual remittance, bank and payee are extracted only from the
 // reviewed contract message. Never substitute the full contract deposit.
 const line=String(text||'').split('\n').find(x=>
  /(?:금일|오늘|이번)/.test(x)&&/송금/.test(x)&&/계좌\(/.test(x));
 if(!line)return null;
 const amount=line.match(/계약금\s*중\s*일부인\s*([0-9,]+\s*(?:억(?:\s*[0-9,]+\s*만?원?)?|만원|원))\s*을/);
 const begin=line.indexOf('계좌('),end=line.lastIndexOf(')로 송금');
 if(!amount||begin<0||end<=begin)return null;
 const detail=line.slice(begin+3,end).trim();
 const acct=detail.match(/\b(?:\d{2,6}[- ]?){2,5}\d{2,6}\b/);
 if(!acct)return null;
 const bank=detail.match(/(?:[가-힣A-Za-z0-9·]+은행|농협|우체국|신협|새마을금고)/);
 const payee=detail.match(/예금주\s*([^()]+)/);
 return {amount:amount[1].replace(/\s+/g,' ').trim(),bank:bank?bank[0]:'',
  account:acct[0].trim(),payee:payee?payee[1].trim():'',raw:line};
}
function drawOriginalBrandMark(c){
 // Exact paths from the header's original company SVG; recolor only.
 const svg=document.querySelector?.('.officeMarkSvg');
 const paths=svg?.querySelectorAll?.('path');
 if(!paths?.length||typeof Path2D!=='function')return false;
 c.save();c.translate(LEFT,72);c.scale(94/512,94/512);
 for(const el of paths){
  const d=el.getAttribute('d');if(!d)continue;
  const fill=String(el.getAttribute('fill')||'').toUpperCase();
  c.fillStyle=fill==='#FF0000'?'#155a66':fill==='#FFFFFF'?'#ffffff':'#155a66';
  c.fill(new Path2D(d),el.getAttribute('fill-rule')||'nonzero');
 }
 c.restore();return true;
}

function wrapAccountLine(c,text,width,size,transfer){
 // Only the actual bank, account and payee in the approved SMS are highlighted.
 // Keep them in the legal sentence, not in a second payment panel.
 const fields=[
  {text:transfer.account,kind:'account'},
  {text:transfer.amount,kind:'amount'},
  {text:transfer.bank,kind:'bank'},
  {text:transfer.payee,kind:'payee'}
 ].filter(x=>x.text);
 const escaped=s=>Array.from(s).map(ch=>'\\.^$*+?()[]{}|'.includes(ch)?'\\'+ch:ch).join('');
 const pattern=new RegExp(fields.map(x=>escaped(x.text)).join('|'),'g');
 const lines=[],runs=[];let length=0;
 function flush(){
  if(runs.length){lines.push({value:runs.map(x=>x.text).join(''),runs:runs.splice(0)});length=0;}
 }
 function append(text,kind){
  const chunks=kind?[text]:(text.match(/\s+|[^\s]+/g)||[]);
  for(const chunk of chunks){
   if(!chunk)continue;
   c.font=kind==='amount'?'800 '+(size+3)+'px sans-serif':(kind?'700 '+(size+2):'400 '+size)+'px sans-serif';
   const w=c.measureText(chunk).width;
   if(length&&length+w>width)flush();
   if(!length&&/^\s+$/.test(chunk))continue;
   if(w>width){
    for(const char of Array.from(chunk)){
     const cw=c.measureText(char).width;
     if(length&&length+cw>width)flush();
     runs.push({text:char,emphasis:!!kind,kind,underline:kind==='account'});
     length+=cw;
    }
   }else{
    runs.push({text:chunk,emphasis:!!kind,kind,underline:kind==='account'});
    length+=w;
   }
  }
 }
 let at=0,found;
 while((found=pattern.exec(text))!==null){
  append(text.slice(at,found.index),'');
  append(found[0],fields.find(x=>x.text===found[0]).kind);
  at=pattern.lastIndex;
 }
 append(text.slice(at),'');
 flush();
 return lines.length?lines:[{value:text,runs:[]}];
}
function layout(text,profile,allowPages){
 const c=document.createElement('canvas').getContext('2d');
 if(!c)throw Error('휴대폰에서 계약 이미지를 생성할 수 없습니다.');
 const headingMatch=text.match(/^\s*●\s*([^●\n]+)\s*●/m);
 const heading=headingMatch?headingMatch[1].trim().replace(/\s*계약$/,'계약')+' 안내':'계약 안내';
 const pages=[{items:[],bottom:TOP,heading,profile:profile.name}],newPage=()=>{
  if(pages.length===MAX_PAGES)throw Error('안내 내용이 너무 깁니다. 특약을 정리한 뒤 다시 시도해 주세요.');
  const p={items:[],bottom:TOP,heading,profile:profile.name};pages.push(p);return p;
 };
 let page=pages[0],inNotice=false;
 const transfer=parseTransfer(text);
 const blank=Math.round(13*profile.gap);
 for(const rawLine of text.split('\n')){
  if(!rawLine.trim()){
   if(page.items.length)page.bottom+=blank;
   continue;
  }
  const initial=kindFor(rawLine);
  if(initial==='title')continue; // The heading is rendered as the hero title instead.
  if(initial==='notice')inNotice=true;
  const kind=inNotice&&initial==='body'?'notice-body':initial;
  const style=specs[kind],size=Math.max(21,Math.round(style.size*profile.scale));
  const lineHeight=Math.round(style.line*profile.scale);
  const before=Math.round(style.before*profile.gap),after=Math.round(style.after*profile.gap);
  const data=clean(rawLine,initial);
  let label='',value=data;
  if(kind==='row'){
   const m=data.match(/^([^:：]{1,16})\s*[:：]\s*(.*)$/);
   if(m){label=m[1].trim();value=m[2];}
  }
  c.font=(kind==='row'?'600 ':'400 ')+size+'px sans-serif';
  const usable=label?RIGHT-LEFT-300:RIGHT-LEFT-20;
  const inlineAccount=kind==='notice-body'&&transfer&&data===transfer.raw.trim();
  const pieces=inlineAccount?wrapAccountLine(c,value,usable,size,transfer):wrapText(c,value,usable).map(value=>({value,runs:null}));
  const total=before+pieces.length*lineHeight+after;
  if(allowPages&&page.items.length&&page.bottom+total>LIMIT&&total<LIMIT-TOP)page=newPage();
  page.bottom+=before;
  for(let i=0;i<pieces.length;i++){
   if(allowPages&&page.bottom+lineHeight+16>LIMIT&&page.items.length)page=newPage();
   const piece=pieces[i];
   const full=label&&i===0?label+' : '+piece.value:piece.value;
   page.items.push({kind,text:full,label:i===0?label:'',value:piece.value,runs:piece.runs,continuation:i>0,y:page.bottom,line:lineHeight,size});
   page.bottom+=lineHeight;
  }
  page.bottom+=after;
 }
 return pages.filter(x=>x.items.length);
}
function plan(raw){
 const text=String(raw||'').replace(/\r/g,'');
 if(!text.trim())throw Error('계약 안내 내용을 먼저 작성해 주세요.');
 if(text.length>12000)throw Error('계약 안내가 너무 깁니다. 내용을 검토해 주세요.');
 // Try one high-quality sheet; tighten typography only if truly necessary.
 for(const profile of profiles){
  const p=layout(text,profile,false);
  if(p.length===1&&p[0].bottom<=LIMIT)return p;
 }
 // The customer-facing artifact is always ONE PNG. Never silently truncate,
 // split a contract into separate images, or make tiny unreadable legal text.
 throw Error('계약 안내가 한 장에 담기기에는 너무 깁니다. 내용을 검토·정리한 뒤 다시 생성해 주세요.');
}
function draw(page,index,total){
 const canvas=document.createElement('canvas');canvas.width=WIDTH;
 canvas.height=Math.max(1000,Math.min(3330,Math.ceil(page.bottom+85)));
 const c=canvas.getContext('2d');if(!c)throw Error('계약 이미지 화면을 그릴 수 없습니다.');
 c.fillStyle='#e8f3f2';c.fillRect(0,0,WIDTH,canvas.height);
 c.fillStyle='#ffffff';round(c,32,30,WIDTH-64,canvas.height-60,30);c.fill();
 c.strokeStyle='#ccdedf';c.lineWidth=2;c.stroke();
 const hasBrand=drawOriginalBrandMark(c);
 c.fillStyle='#155a66';c.font='700 24px sans-serif';c.fillText('FIRST HYUNDAI',LEFT+(hasBrand?111:0),108);
 c.fillStyle='#5b7480';c.font='400 20px sans-serif';c.fillText('REAL ESTATE',LEFT+(hasBrand?113:2),136);
 c.fillStyle='#213f49';c.font='700 46px sans-serif';c.fillText(page.heading,LEFT,215);
 c.fillStyle='#58727a';c.font='400 23px sans-serif';c.textAlign='right';c.fillText('퍼스트현대부동산',RIGHT,214);c.textAlign='left';
 c.fillStyle='#be9371';round(c,LEFT,244,78,5,2);c.fill();
 c.fillStyle='#c9d9d9';c.fillRect(LEFT+93,246,RIGHT-LEFT-93,2);
 const items=page.items;
 // Background grouping: restrained warm-taupe areas for terms and notices, not SMS glyphs.
 for(let i=0;i<items.length;i++){
  const item=items[i],prev=items[i-1];
  if(item.kind==='notice'&&(i===0||prev?.kind!=='notice')){
   const end=items.slice(i).filter(x=>x.kind==='notice'||x.kind==='notice-body').at(-1);
   if(end){
    c.fillStyle='#edf5f4';round(c,LEFT-17,item.y-9,RIGHT-LEFT+34,end.y+end.line-item.y+17,16);c.fill();
   }
  }
 }
 for(const item of items){
  const y=item.y+item.line-11;
  if(item.kind==='row'){
   const prominent=/^(?:매매대금|전세보증금|임대차보증금|보증금|월세|월 차임|계약금|중도금|잔금|이번 송금액|오늘 송금액)$/.test(item.label);
   if(prominent&&!item.continuation){
    c.fillStyle='#e8f3f2';round(c,LEFT-10,item.y-5,RIGHT-LEFT+20,item.line+8,9);c.fill();
   }
   if(item.label){
    c.font='500 '+Math.max(22,item.size-3)+'px sans-serif';c.fillStyle='#506a71';
    c.fillText(item.label,LEFT+10,y);
   }
   c.font='600 '+item.size+'px sans-serif';c.fillStyle=prominent?'#155a66':'#263b43';
   c.fillText(item.value,item.label?LEFT+300:LEFT+300,y);
  }else if(item.kind==='section'){
   c.fillStyle='#18808a';round(c,LEFT,item.y+6,5,item.line-9,2);c.fill();
   c.fillStyle='#234750';c.font='700 '+item.size+'px sans-serif';c.fillText(item.text,LEFT+17,y);
  }else if(item.kind==='term'){
   c.fillStyle='#16818b';round(c,LEFT+6,item.y+Math.round(item.line/2),7,7,3);c.fill();
   c.fillStyle='#2b4149';c.font='400 '+item.size+'px sans-serif';c.fillText(item.text,LEFT+25,y);
  }else if(item.kind==='notice'){
   c.fillStyle='#1a5460';c.font='700 '+item.size+'px sans-serif';c.fillText(item.text,LEFT+11,y);
  }else if(item.kind==='notice-body'&&item.runs?.length){
   let x=LEFT+10;
   for(const run of item.runs){
    c.font=run.kind==='amount'?'800 '+(item.size+3)+'px sans-serif':(run.emphasis?'700 '+(item.size+2):'400 '+item.size)+'px sans-serif';
    c.fillStyle=run.emphasis?'#0c6269':'#50646b';
    c.fillText(run.text,x,y);
    const measured=c.measureText(run.text).width;
    if(run.underline){c.fillStyle='#0c6269';c.fillRect(x,y+5,measured,2);}
    x+=measured;
   }
  }else{
   c.fillStyle=item.kind==='notice-body'?'#50646b':'#50646b';
   c.font='400 '+item.size+'px sans-serif';c.fillText(item.text,LEFT+(item.kind==='notice-body'?10:0),y);
  }
 }
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
window.FirstHyundaiContractImage={open,close,share,_test:{plan,kindFor,clean,parseTransfer,drawOriginalBrandMark}};
})();