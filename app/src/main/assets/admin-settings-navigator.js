/* v2.1.02 - Admin console search, category filters and accessible section jumps.
   Presentation only: never edits permissions, source data or customer records. */
(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const root=byId('adminCenter');
 if(!root)return;
 const groupQuery='.adminSettingsGroup';
 const rowQuery='.adminPrefRow,.adminAlertPref';
 const toolsPanel=byId('adminToolsPanel');
 const settingsPanel=byId('adminExperiencePanel');
 const extraKeywords={
  adminDefaultPage:'시작 홈 메인 첫화면 초기 기본화면',
  adminReadingSize:'폰트 글자 확대 부모님 글씨',
  adminTapSize:'터치 눌림 버튼 크기 부모님 접근성',
  adminListDensity:'정보 카드 여백 간격 줄임',
  adminMotionStyle:'애니메이션 효과 색흐름 부드럽게',
  adminContrastMode:'시인성 색 대비 또렷하게',
  adminQuickOrder:'탭 버튼 순서 자리 이동',
  adminAccentStyle:'강조 배색 빨강 그린 브론즈',
  adminTheme:'테마 봄 여름 가을 겨울 기본',
  adminThemeMode:'테마 자동 절기 입춘 입하 입추 입동 수동',
  adminWeatherEffect:'날씨 효과 송도 비 눈 수동 자동',
  adminThemeIntensity:'테마 강도 선명 또렷 진하게 은은',
  adminThemeDecor:'테마 장식 꽃잎 낙엽 비 눈 양 효과',
  adminThemeCaption:'시작 첫화면 연도 년 계절 문구 표시 숨기기',adminThemeLogo:'로고 마크 테마 장식',adminThemeHeader:'상단 메인 로고 테마',adminThemeIntro:'시작 첫화면 인트로 테마',
  adminTradeAmountStyle:'실거래 금액 가격 매매 전세 월세',
  adminCancelledStyle:'해제 취소 거래 계약',
  adminMemoOrder:'포스트잇 메모 최신',
  adminMemoCompleted:'포스트잇 완료된',
  adminMemoRefresh:'메모 동기화 주기 갱신',
  adminMemoLayout:'메모 카드 모양 여백 줄임',
  adminMemoClock:'메모 시간 날짜 시각',
  adminMemoPhones:'전화 바로걸기 번호 메모',
  adminTradePopupEnabled:'알림 실거래 팝업 관심',
 };
 let query='',category='view';
 function permitted(){return typeof role!=='undefined'&&role==='admin';}
 function normalize(value){return String(value||'').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g,' ');}
 function matches(text,terms){
  const body=normalize(text);
  return terms.every(word=>body.includes(word));
 }
 function sections(){
  return Array.from(root.querySelectorAll(groupQuery));
 }
 function draw(){
  if(!permitted())return false;
  const terms=normalize(query).split(' ').filter(Boolean);
   root?.classList?.toggle?.('adminFocusMode',category!=='all');
  let visible=0,toolsShown=0;
  for(const group of sections()){
   const categoryMatch=category==='all'||group.dataset.adminCategory===category;
   const rows=Array.from(group.querySelectorAll(rowQuery));
   let count=0;
   for(const row of rows){
    const searchText=row.textContent+' '+(extraKeywords[row.querySelector('select,input')?.id]||'');
    const hit=categoryMatch&&matches(searchText,terms);
    row.hidden=!hit;
    if(hit)count++;
   }
   group.hidden=!categoryMatch||count===0;
   if(count&&terms.length)group.open=true;
   visible+=count;
  }
  const toolAllowed=category==='all'||category==='tools';
  if(toolsPanel){
   const buttons=Array.from(toolsPanel.querySelectorAll('.adminToolGrid>button'));
   for(const button of buttons){
    const hit=toolAllowed&&matches(button.textContent,terms);
    button.hidden=!hit;if(hit)toolsShown++;
   }
   toolsPanel.hidden=!toolsShown;
  }
  const sync=byId('adminSharedSettingsPanel');
  const syncMatch=terms.length&&
   matches('공통 설정 서버 동기화 부모님 휴대폰 게시 재시도 원격 설정 공유',terms)&&
   (category==='all'||category==='view');
  if(sync)sync.hidden=terms.length>0&&!syncMatch || category==='tools';
  if(settingsPanel)settingsPanel.hidden=(visible===0&&!syncMatch);
  const buttons=root.querySelectorAll('.adminCategoryFilters button');
  for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.adminFilter===category));
  const status=byId('adminSearchResult');
  if(status)status.textContent=terms.length||category!=='all'?
   '검색 결과: 설정 '+visible+'개 · 도구 '+toolsShown+'개'+(syncMatch?' · 동기화 상태':'')+
    ((visible+toolsShown+(syncMatch?1:0))===0?' · 결과가 없습니다. 전체를 선택하거나 검색어를 지워주세요.':''):
   '관리 기능을 선택하거나 검색해서 바로 이동할 수 있습니다.';
  const clear=byId('adminSearchClear');
  if(clear)clear.disabled=!(terms.length||category!=='all');
  return true;
 }
 function search(text){
  if(!permitted())return false;
  query=String(text||'').slice(0,80);draw();return true;
 }
 function filter(name){
  if(!permitted()||!['all','view','trade','memo','tools'].includes(name))return false;
  category=name;draw();return true;
 }
 function clear(){
  if(!permitted())return false;
  query='';category='all';
  const input=byId('adminControlSearch');if(input)input.value='';
  draw();return true;
 }
 function jump(where){
  if(!permitted())return false;
  if(where==='sync'||where==='feeds'){
   clear();
   const target=byId(where==='sync'?'adminSharedSettingsPanel':'adminFeedsPanel');
   target?.scrollIntoView?.({behavior:'smooth',block:'start'});
   if(where==='feeds')byId('adminFreshnessLevel')?.focus?.({preventScroll:true});
   return !!target;
  }
  if(!['view','trade','memo','tools'].includes(where))return false;
  clear();filter(where);
  const target=where==='tools'?toolsPanel:sections().find(x=>x.dataset.adminCategory===where&&!x.hidden);
  if(target?.tagName==='DETAILS')target.open=true;
  target?.scrollIntoView?.({behavior:'smooth',block:'start'});
  return !!target;
 }
 window.FirstHyundaiAdminNavigator={search,filter,clear,jump,render:draw,
  _test:{matches,normalize}};
 draw();
})();


