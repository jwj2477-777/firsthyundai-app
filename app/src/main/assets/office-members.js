/* Administrator-only member records. All permissions enforced by native bridge + server. */
(function(){
'use strict';
const $=id=>document.getElementById(id),native=window.FirstHyundaiNative;
let seq=0,members=[],pending=new Map(),busy=false;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function allowed(){return native?.getMode?.()==='admin'}
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
  const self=m.name===current;
  return '<div class="officeMemberRow"><span class="officeMemberAvatar" aria-hidden="true">'+
   esc(m.name.slice(0,1))+'</span><strong>'+esc(m.name)+'</strong>'+
   (self?'<span class="officeMemberSelf">현재 계정</span>':
   '<button type="button" class="officeMemberDelete" data-member="'+esc(m.id)+'" data-name="'+esc(m.name)+'">삭제</button>')+
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
async function remove(id,name){
 if(!allowed()||busy||!/^[0-9a-f-]{36}$/.test(id))return;
 if(typeof confirm==='function'&&!confirm(name+' 계정을 삭제할까요?\n이 계정의 모든 연결 기기는 즉시 접근이 차단됩니다.'))return;
 busy=true;try{await action('remove',{id});await refresh();status('계정과 연결 기기 권한을 해제했습니다.')}
 catch(e){status(e.message)}finally{busy=false}
}
$('officeMemberList')?.addEventListener?.('click',event=>{
 const button=event.target?.closest?.('button[data-member]');
 if(button)remove(button.dataset.member,button.dataset.name||'구성원');
});
render();
window.FirstHyundaiOfficeMembers={refresh,add,remove,choose,_test:{render}};
})();