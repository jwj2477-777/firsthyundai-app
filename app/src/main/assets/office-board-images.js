/* Photo attachments for authenticated shared office notes.
 * No photo data in public GitHub, Web Storage, or unauthenticated HTTP.
 */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),MAX=3,MAX_BYTES=145000;
 let drafts=[],target='',uploading=false,activePhoto=null,existingCount=0;
 const cache=new Map();
 function status(text){const el=$('officeBoardFeedback');if(el)el.textContent=text}
 function renderDrafts(){
  const tray=$('officeBoardImagePreview');if(!tray)return;
  tray.innerHTML='';
  drafts.forEach((data,i)=>{
   const wrap=document.createElement('div');wrap.className='officeBoardImagePreview';
   const image=document.createElement('img');image.src=data;image.alt='선택한 사진 '+(i+1);
   const button=document.createElement('button');button.type='button';button.textContent='×';
   button.setAttribute('aria-label','선택한 사진 '+(i+1)+' 삭제');
   button.addEventListener('click',()=>{drafts.splice(i,1);renderDrafts()});
   wrap.append(image,button);tray.append(wrap);
  });
  const retry=$('officeBoardImageRetry');
  if(retry)retry.hidden=!(target&&drafts.length);
 }
 function compress(file){
  return new Promise((resolve,reject)=>{
   if(!file||!file.type.startsWith('image/')||file.size>15*1024*1024)
    return reject(Error('15MB 이하 사진만 첨부할 수 있습니다.'));
   const reader=new FileReader();
   reader.onerror=()=>reject(Error('사진을 읽지 못했습니다.'));
   reader.onload=()=>{
    const img=new Image();
    img.onerror=()=>reject(Error('지원하지 않는 사진 형식입니다.'));
    img.onload=()=>{
     try{
      let max=1200,quality=.78,url='';
      const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
      if(!ctx)throw Error('사진 변환을 사용할 수 없습니다.');
      for(let i=0;i<12;i++){
       const scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
       canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));
       canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
       ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
       ctx.drawImage(img,0,0,canvas.width,canvas.height);
       url=canvas.toDataURL('image/jpeg',quality);
       if(url.length<=MAX_BYTES)break;
       if(quality>.48)quality-=.1;else{max=Math.max(440,Math.round(max*.78));quality=.65}
      }
      if(url.length>MAX_BYTES||!/^data:image\/jpeg;base64,\/9j\//.test(url))
       throw Error('사진 용량을 줄이지 못했습니다. 다른 사진을 선택해 주세요.');
      resolve(url);
     }catch(e){reject(e)}
    };
    img.src=String(reader.result||'');
   };
   reader.readAsDataURL(file);
  });
 }
 async function selected(ev){
  const files=Array.from(ev.target?.files||[]);
  if(ev.target)ev.target.value='';
  if(!files.length)return;
  const count=MAX-(target?existingCount:0)-drafts.length;
  if(files.length>count){status('메모당 사진은 최대 3장입니다.');return;}
  try{
   status('사진을 최적화하고 있습니다…');
   const converted=[];
   for(const file of files)converted.push(await compress(file));
   if(target){
    drafts=converted;renderDrafts();await uploadPending(target);
   }else{
    drafts.push(...converted);renderDrafts();
    status('사진 '+drafts.length+'장 준비 완료 · 메모 붙이기를 누르면 공유됩니다.');
   }
  }catch(e){status(e.message||'사진을 처리하지 못했습니다.')}
 }
 function selectFor(noteId='',photosAlready=0){
  if(uploading)return;
  if(noteId&& !/^[a-z0-9]{8,14}-[0-9a-f-]{36}$/.test(noteId))return;
  target=noteId||'';
  existingCount=target?Math.max(0,Math.min(MAX,Number(photosAlready)||0)):0;
  if(target)drafts=[];
  if(existingCount>=MAX){status('사진은 메모당 최대 3장입니다.');return;}
  const input=$('officeBoardImageInput');
  if(input)input.click();else status('사진 선택을 사용할 수 없습니다.');
 }
 async function uploadPending(id){
  if(uploading||!drafts.length)return false;
  if(!window.FirstHyundaiOfficeBoard?.imageCall){status('최신 앱으로 업데이트해 주세요.');return false}
  uploading=true;target=id;
  const input=$('officeBoardImageInput'),post=$('officeBoardPost');
  if(input)input.disabled=true;if(post)post.disabled=true;
  try{
   while(drafts.length){
    status('사진 업로드 중 · 남은 사진 '+drafts.length+'장');
    const result=await window.FirstHyundaiOfficeBoard.imageCall('imageAdd',{id,data_url:drafts[0]});
    if(!result?.note)throw Error('사진 저장 응답을 확인할 수 없습니다.');
    drafts.shift();
    existingCount=Array.isArray(result.note.images)?result.note.images.length:existingCount+1;
    window.FirstHyundaiOfficeBoard.imageUpdate(result.note);
    renderDrafts();
   }
   target='';existingCount=0;renderDrafts();
   status('사진을 공유했습니다. 다른 휴대전화에서도 볼 수 있습니다.');
   return true;
  }catch(e){
   renderDrafts();
   status('사진 업로드 실패 · 사진 다시 올리기를 눌러 재시도하세요. '+(e.message||''));
   return false;
  }finally{
   uploading=false;if(input)input.disabled=false;if(post)post.disabled=false;
  }
 }
 function pendingCount(){return drafts.length}
 function pendingTarget(){return target}
 async function view(noteId,imageId){
  if(!/^[a-z0-9]{8,14}-[0-9a-f-]{36}$/.test(noteId)||!/^[0-9a-f-]{36}$/.test(imageId))return;
  const dialog=$('officeBoardImageDialog'),img=$('officeBoardImageFull'),title=$('officeBoardImageLoading');
  if(!dialog||!img)return;
  img.removeAttribute('src');img.hidden=true;
  if(title)title.textContent='사진 불러오는 중…';
  try{if(!dialog.open)dialog.showModal()}catch(e){}
  const key=noteId+':'+imageId;
  activePhoto={noteId,imageId};
  try{
   let data=cache.get(key);
   if(!data){
    const response=await window.FirstHyundaiOfficeBoard.imageCall('imageGet',{id:noteId,image_id:imageId});
    data=response?.data_url;
    if(typeof data!=='string'||data.length>195000||!/^data:image\/jpeg;base64,\/9j\//.test(data))
     throw Error('이미지 형식을 확인할 수 없습니다.');
    cache.set(key,data);
    if(cache.size>15)cache.delete(cache.keys().next().value);
   }
   if(!dialog.open)return;
   img.src=data;img.hidden=false;
   if(title)title.textContent='';
  }catch(e){if(title)title.textContent='사진을 불러오지 못했습니다. 다시 눌러 주세요.'}
 }
 async function removeActive(){
  if(!activePhoto||uploading)return;
  if(typeof confirm==='function'&&!confirm('이 사진을 공유 메모에서 삭제할까요?'))return;
  const {noteId,imageId}=activePhoto;
  try{
   const result=await window.FirstHyundaiOfficeBoard.imageCall('imageRemove',{id:noteId,image_id:imageId});
   if(!result?.note)throw Error('사진 삭제 확인 실패');
   cache.delete(noteId+':'+imageId);
   window.FirstHyundaiOfficeBoard.imageUpdate(result.note);
   $('officeBoardImageDialog')?.close();
   status('첨부 사진을 삭제했습니다.');
  }catch(e){status('사진 삭제 실패 · 다시 시도해 주세요.')}
 }
 $('officeBoardImageRemove')?.addEventListener('click',removeActive);
 $('officeBoardImageInput')?.addEventListener('change',selected);
 $('officeBoardImageRetry')?.addEventListener('click',()=>{if(target)uploadPending(target)});
 $('officeBoardImageClose')?.addEventListener('click',()=>$('officeBoardImageDialog')?.close());
 window.FirstHyundaiBoardImages={selectFor,pendingCount,pendingTarget,uploadPending,view,
  _test:{compress,renderDrafts}};
})();
