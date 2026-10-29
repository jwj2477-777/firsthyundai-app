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
 let query='',category='all';
 const TITLES={view:'화면 · 테마',memo:'메모 · 일정',trade:'거래 · 알림',
  people:'구성원 · 권한',data:'자료 · 동기화',tools:'운영 도구'};
 const dataTerms='자료 수집 게시 API 동기화 서버 갱신 오류 상태 경고 진단 점검 연결';
 const peopleTerms='구성원 계정 권한 이름 수정 마지막 접속 인증 보안 휴대폰';
 const toolTerms='앱 업데이트 백업 단지정보 진단 개발자 화면 점검';
 const detailsPanels=['adminStatusPanel','adminAttentionPanel','adminFeedsPanel','adminPeoplePanel',
  'adminAuditPanel','adminDeveloperPanel'];
 function permitted(){return typeof role!=='undefined'&&role==='admin';}
 function normalize(value){return String(value||'').trim().toLocaleLowerCase('ko-KR').replace(/\s+/g,' ');}
 function matches(text,terms){const body=normalize(text);return terms.every(word=>body.includes(word));}
 function sections(){return Array.from(root.querySelectorAll(groupQuery));}
 function setHidden(id,hidden){const node=byId(id);if(node)node.hidden=!!hidden;}
 function draw(){
  if(!permitted())return false;
  const terms=normalize(query).split(' ').filter(Boolean),searching=terms.length>0;
  const home=category==='all'&&!searching;
  root.classList?.toggle?.('adminFocusMode',!home);
  root.setAttribute?.('data-admin-section',home?'home':searching?'search':category);
  setHidden('adminCategoryGrid',!home);
  setHidden('adminSectionBar',home);
  const title=byId('adminSectionTitle');
  if(title)title.textContent=searching?'검색 결과':TITLES[category]||'전체 설정';
  const chooser=byId('adminCategorySwitch');
  if(chooser)chooser.value=searching?'':category;
  const cards=root.querySelectorAll?.('[data-admin-select]')||[];
  for(const b of cards)b.setAttribute?.('aria-pressed',String(!searching&&b.dataset.adminSelect===category));
  const inCategory=(c)=>searching||category===c;
  let visible=0,toolsShown=0;
  for(const group of sections()){
   const permittedGroup=!home&&inCategory(group.dataset.adminCategory);
   let groupHits=0;
   for(const row of group.querySelectorAll(rowQuery)){
    const input=row.querySelector?.('select,input');
    const content=row.textContent+' '+(extraKeywords[input?.id]||'');
    const hit=permittedGroup&&(!searching||matches(content,terms));
    row.hidden=!hit;
    if(hit)groupHits++;
   }
   group.hidden=!permittedGroup||groupHits===0;
   if(groupHits&&searching)group.open=true;
   visible+=groupHits;
  }
  // Operational tools are in the original panel; no actions or permissions change.
  const toolButtons=Array.from(toolsPanel?.querySelectorAll?.('.adminToolGrid>button')||[]);
  for(const button of toolButtons){
   const group=button.dataset?.adminTool||'tools';
   const eligible=!home&&inCategory(group);
   const hit=eligible&&(!searching||matches(button.textContent+' '+group,terms));
   button.hidden=!hit;
   if(hit)toolsShown++;
  }
  if(toolsPanel)toolsPanel.hidden=!toolsShown;
  // Keep existing settings controls, backup, data freshness and admin-only records.
  const presetShown=!home&&!searching&&category==='view';
  const showBackup=!home&&!searching&&category==='tools';
  for(const selector of ['.adminPresets','.adminUndoBar']){
   const e=settingsPanel?.querySelector?.(selector);if(e)e.hidden=!presetShown;
  }
  for(const selector of ['.adminPrefActions','.adminPrefBackup']){
   const e=settingsPanel?.querySelector?.(selector);if(e)e.hidden=!showBackup;
  }
  const syncMatch=!home&&inCategory('data')&&(!searching||
   matches('공통 설정 서버 동기화 부모님 휴대폰 게시 재시도 원격 설정 공유',terms));
  setHidden('adminSharedSettingsPanel',!syncMatch);
  setHidden('adminPreferencesStatus',!(visible||syncMatch||showBackup));
  if(settingsPanel)settingsPanel.hidden=!(visible||syncMatch||showBackup||presetShown);
  const peopleMatch=!home&&inCategory('people')&&(!searching||matches(peopleTerms,terms));
  setHidden('adminPeoplePanel',!peopleMatch);
  const dataMatch=!home&&inCategory('data')&&(!searching||matches(dataTerms,terms));
  for(const id of ['adminStatusPanel','adminAttentionPanel','adminFeedsPanel','adminAuditPanel'])
   setHidden(id,!dataMatch);
  const developerMatch=!home&&inCategory('tools')&&(!searching||matches(toolTerms,terms));
  setHidden('adminDeveloperPanel',!developerMatch);
  const result=byId('adminSearchResult');
  if(result)result.textContent=home?'관리할 분야를 선택하세요.':
   (searching?('설정 '+visible+'개 · 바로가기 '+toolsShown+'개'+
    ((visible+toolsShown+(peopleMatch?1:0)+(dataMatch?1:0)+(developerMatch?1:0))===0?' · 검색 결과 없음':'')):
    (TITLES[category]||'전체')+' 항목을 표시합니다.');
  const clear=byId('adminSearchClear');if(clear)clear.disabled=home;
  return true;
 }
 function search(text){
  if(!permitted())return false;
  query=String(text||'').slice(0,80);category='all';draw();return true;
 }
 function filter(name){
  if(!permitted()||!Object.hasOwn(TITLES,name))return false;
  category=name;query='';
  const searchBox=byId('adminControlSearch');if(searchBox)searchBox.value='';
  draw();return true;
 }
 function clear(){
  if(!permitted())return false;
  query='';category='all';
  const searchBox=byId('adminControlSearch');if(searchBox)searchBox.value='';
  draw();return true;
 }
 function jump(where){
  if(!permitted())return false;
  if(where==='sync'||where==='feeds'){
   filter('data');
   const target=byId(where==='sync'?'adminSharedSettingsPanel':'adminFeedsPanel');
   target?.scrollIntoView?.({behavior:'smooth',block:'start'});
   if(where==='feeds')byId('adminFreshnessLevel')?.focus?.({preventScroll:true});
   return !!target;
  }
  if(!Object.hasOwn(TITLES,where))return false;
  filter(where);
  const target=where==='people'?byId('adminPeoplePanel'):where==='tools'?toolsPanel:
   sections().find(x=>x.dataset.adminCategory===where&&!x.hidden);
  if(target?.tagName==='DETAILS')target.open=true;
  target?.scrollIntoView?.({behavior:'smooth',block:'start'});
  return !!target;
 }
 window.FirstHyundaiAdminNavigator={search,filter,clear,jump,render:draw,
  _test:{matches,normalize}};
 draw();
})();


