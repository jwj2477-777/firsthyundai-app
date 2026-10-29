/* Administrator-only member records. All permissions enforced by native bridge + server. */
(function(){
'use strict';
const $=id=>document.getElementById(id),native=window.FirstHyundaiNative;
let seq=0,members=[],pending=new Map(),busy=false,editing='';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allowed(){return native?.getMode?.()==='admin'}
function lastSeenText(value){
 const date=typeof value==='string'?new Date(value):null;
 if(!date||!Number.isFinite(date.getTime()))return '접속 기록 없음';
 return '마지막 접속 · '+new Intl.DateTimeFormat('ko-KR',{
  timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hour12:false
 }).format(date);
}
function choose(){
 if(!allowed()||typeof native?.requestOfficeMemberPicker!=='function'){
  status('관리자모드에서 계정을 선택할 수 있습니다.');return;
 }
 native.requestOfficeMemberPicker();
}
function status(v){if($('officeMemberFeedback'))$('officeMemberFeedback').textContent=v}
function action(kind,payload){
 if(!allowed()||!native?.officeMembersAction)return Promise.reject(Error('관리자모드로 로그인해 주세요.'));
 const id='members'+(++seq);
 return new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('응답 시간 초과'))},16000);
  pending.set(id,{resolve:d=>{clearTimeout(timer);resolve(d)},reject:e=>{clearTimeout(timer);reject(e)}});
  native.officeMembersAction(kind,JSON.stringify(payload||{}),id);
 });
}
window.onFirstHyundaiOfficeMembersResult=e=>{
 const p=pending.get(e?.requestId);if(!p)return;
 pending.delete(e.requestId);
 if(e.ok)p.resolve(e.data);else p.reject(Error(e.error||'구성원 계정 처리 실패'));
};
function render(){
 const footerLabel=$('officeFooterMember');
 if(footerLabel){
  const account=native?.getOfficeMemberName?.()||'';
  footerLabel.textContent=account?'· '+account:'';
 }
 const currentLabel=$('officeCurrentMember');
 if(currentLabel)currentLabel.textContent=native?.getOfficeMemberName?.()||'연결되지 않음';
 const list=$('officeMemberList');if(!list)return;
 if(!allowed()){list.textContent='관리자 전용 기능입니다.';return}
 if(!members.length){list.innerHTML='<p class="tiny">등록된 구성원이 없습니다.</p>';return}
 const current=native?.getOfficeMemberName?.()||'';
 list.innerHTML=members.map(m=>{
  const self=m.name===current,isEditing=editing===m.id;
  return '<div class="officeMemberRow" data-member-row="'+esc(m.id)+'">'+
   '<span class="officeMemberAvatar" aria-hidden="true">'+esc(m.name.slice(0,1))+'</span>'+
   (isEditing?'<input class="officeMemberRenameInput" data-rename-input="'+esc(m.id)+
    '" aria-label="수정할 계정 이름" maxlength="24" value="'+esc(m.name)+'">':
    '<span class="officeMemberIdentity"><strong>'+esc(m.name)+'</strong>'+
    '<small class="officeMemberLastSeen">'+esc(lastSeenText(m.last_seen_at))+'</small></span>')+
   (self&&!isEditing?'<span class="officeMemberSelf">현재</span>':'')+
   (isEditing?'<button type="button" class="officeMemberRenameSave" data-rename-save="'+esc(m.id)+'">저장</button>'+
    '<button type="button" class="officeMemberRenameCancel" data-rename-cancel="'+esc(m.id)+'">취소</button>':
    '<button type="button" class="officeMemberRename" data-rename="'+esc(m.id)+'" aria-label="'+esc(m.name)+' 계정 이름 수정">이름 수정</button>'+
    (self?'':'<button type="button" class="officeMemberDelete" data-member="'+esc(m.id)+
    '" data-name="'+esc(m.name)+'">삭제</button>'))+
   '</div>';
 }).join('');
}
async function refresh(){
 if(!allowed())return;try{
  const result=await action('list',{});members=Array.isArray(result.accounts)?result.accounts:[];render();status('');
 }catch(e){status(e.message)}
}
async function add(){
 if(!allowed()||busy)return;
 const input=$('officeMemberName'),name=String(input?.value||'').trim();
 if(!name||name.length>24){status('구성원 이름을 1~24자로 입력해 주세요.');return}
 busy=true;
 try{await action('add',{name});input.value='';await refresh();status('구성원을 추가했습니다.')}
 catch(e){status(e.message)}finally{busy=false}
}
function startRename(id){
 if(!allowed()||busy||!members.some(m=>m.id===id))return;
 editing=id;render();
 $('officeMemberList')?.querySelector?.('input[data-rename-input]')?.focus?.();
}
function cancelRename(){editing='';render()}
async function saveRename(id){
 if(!allowed()||busy||editing!==id)return;
 const input=$('officeMemberList')?.querySelector?.('input[data-rename-input]');
 const name=String(input?.value||'').trim().replace(/\s+/g,' ');
 if(!name||name.length>24){status('계정 이름은 1~24자로 입력해 주세요.');return}
 busy=true;
 try{
  await action('rename',{id,name});
  editing='';await refresh();
  status('계정 이름을 변경했습니다. 다른 휴대폰에도 다음 연결부터 반영됩니다.');
 }catch(e){status(e.message)}finally{busy=false}
}
async function remove(id,name){
 if(!allowed()||busy||!/^[0-9a-f-]{36}$/.test(id))return;
 if(typeof confirm==='function'&&!confirm(name+' 계정을 삭제할까요?\n이 계정의 모든 연결 기기는 즉시 접근이 차단됩니다.'))return;
 busy=true;try{await action('remove',{id});await refresh();status('계정과 연결 기기 권한을 해제했습니다.')}
 catch(e){status(e.message)}finally{busy=false}
}
$('officeMemberList')?.addEventListener?.('click',event=>{
 const b=event.target?.closest?.('button');if(!b)return;
 if(b.dataset.rename)startRename(b.dataset.rename);
 else if(b.dataset.renameSave)saveRename(b.dataset.renameSave);
 else if(b.dataset.renameCancel)cancelRename();
 else if(b.dataset.member)remove(b.dataset.member,b.dataset.name||'구성원');
});
$('officeMemberList')?.addEventListener?.('keydown',event=>{
 if(event.target?.matches?.('input[data-rename-input]')){
  if(event.key==='Enter'){event.preventDefault();saveRename(event.target.dataset.renameInput)}
  else if(event.key==='Escape'){event.preventDefault();cancelRename()}
 }
});
render();
window.FirstHyundaiOfficeMembers={refresh,add,remove,rename:saveRename,choose,_test:{render}};
})();