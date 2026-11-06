/* Public only. Tracks saved feed provenance and LAST LOCAL DOWNLOAD time.
 * Never records family memos, contracts, phone numbers or credentials. */
(function(root){
'use strict';
const $=id=>document.getElementById(id);
const cached=new Map(),failed=new Set(),stored=new Set();
const LABELS={trades:'실거래',new_trades:'새 거래',complexes:'아파트 정보',
 news:'뉴스',public_services:'청약·공공정보',school_districts:'학교·학군',
 maintenance_estimates:'관리비 평균',maintenance_partial:'관리비 세부',
 nearby_config:'주변시설 설정'};
function stamp(ms){
 const value=Number(ms);
 if(!Number.isFinite(value)||value<=0)return '저장 시각 확인 불가';
 return new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',
  month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'});
}
function render(){
 const panel=$('publicOfflineBanner');if(!panel)return;
 const stale=[...cached],missing=[...failed];
 const show=stale.length>0||missing.length>0;
 panel.classList.toggle('hidden',!show);
 if(!show)return;
 $('publicOfflineTitle').textContent=stale.length?
  '오프라인 보관 자료 · 최신 정보 아님':'서버 자료 연결 실패 · 보관본 없음';
 const label=k=>LABELS[k]||k;
 const parts=[];
 if(stale.length)parts.push('마지막 저장본: '+stale.map(([k,v])=>label(k)+' ('+stamp(v)+')').join(' · '));
 if(missing.length)parts.push('확인 불가: '+missing.map(label).join(' · ')+' · 실제 자료가 0건이라는 뜻이 아닙니다');
 $('publicOfflineDetail').textContent=parts.join(' / ');
}
function track(key,result){
 if(!Object.prototype.hasOwnProperty.call(LABELS,key))return;
 if(result?.ok&&result.offlineCopy){
  cached.set(key,Number(result.offlineSavedAt)||0);failed.delete(key);
 }else if(result?.ok){
  cached.delete(key);failed.delete(key);
  if(result.deviceSnapshotSaved)stored.add(key);
 }else{
  // When a feed has already been displayed from the local cache, retain its
  // origin label even if another live retry fails unexpectedly.
  if(!cached.has(key))failed.add(key);
 }
 render();
}
root.FirstHyundaiPublicOffline={track,isCached:key=>cached.has(key),
 lastStored:key=>cached.get(key)||null,
 isMissing:key=>failed.has(key),
 stored:key=>stored.has(key),
 _test:{stamp,labels:LABELS}};
})(window);
