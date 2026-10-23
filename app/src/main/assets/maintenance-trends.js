/* Source-verified K-apt monthly management-fee trends.
   Does not infer a missing month or claim household invoice averages. */
(function(root){
 'use strict';
 function validMonth(x){return typeof x==='string'&&/^20\d{2}(0[1-9]|1[0-2])$/.test(x);}
 function integer(x,min,max){return Number.isSafeInteger(x)&&x>=min&&x<=max;}
 function shift(month,offset){
  if(!validMonth(month))return '';
  const dt=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(4))-1+offset,1));
  return String(dt.getUTCFullYear())+String(dt.getUTCMonth()+1).padStart(2,'0');
 }
 function currency(won){
  return (Math.round(won/100)*100).toLocaleString('ko-KR')+'원';
 }
 function validRow(r,complexId,code){
  return r&&r.complex_id===complexId&&r.kapt_code===code&&
   validMonth(r.month)&&integer(r.won_per_exclusive_m2,300,20000)&&
   typeof r.source_url==='string'&&/^https:\/\//.test(r.source_url)&&
   (!('monthly_total_won' in r)||integer(r.monthly_total_won,100000,200000000000));
 }
 function summarize(snapshot,complexId,code,exclusive,clock){
  if(snapshot?.schema_version!==1||snapshot?.state!=='verified_partial'||
   !Array.isArray(snapshot.records)||!Number.isFinite(exclusive)||exclusive<=0||exclusive>1000)return null;
  const r=snapshot.records.find(x=>x&&x.complex_id===complexId&&x.kapt_code===code);
  if(!r)return null;
  // Existing v1 records remain supported; historical rows inherit only the
  // verified identity, never an amount, date, source or category.
  const rows=Array.isArray(r.monthly_history)?r.monthly_history:[];
  const byMonth=new Map();
  for(const x of rows){
   const candidate={...x,complex_id:complexId,kapt_code:code};
   if(validRow(candidate,complexId,code))byMonth.set(candidate.month,candidate);
  }
  if(validRow(r,complexId,code))byMonth.set(r.month,r);
  const when=clock instanceof Date?clock:new Date();
  const currentMonth=String(when.getFullYear())+String(when.getMonth()+1).padStart(2,'0');
  const entries=[...byMonth.values()].filter(x=>x.month<=currentMonth).sort((a,b)=>b.month.localeCompare(a.month));
  if(!entries.length)return null;
  const latest=entries[0];
  const minMonth=shift(latest.month,-11);
  const last12=entries.filter(x=>x.month>=minMonth);
  const amount=x=>Math.round(x.won_per_exclusive_m2*exclusive/100)*100;
  const values=last12.map(amount);
  const match=entries.find(x=>x.month===shift(latest.month,-1));
  const yoy=entries.find(x=>x.month===shift(latest.month,-12));
  const avg=values.reduce((a,b)=>a+b,0)/values.length;
  const n=Number(currentMonth.slice(0,4))*12+Number(currentMonth.slice(4))-
    (Number(latest.month.slice(0,4))*12+Number(latest.month.slice(4)));
  const delta=(baseline)=>baseline?Math.round((amount(latest)-amount(baseline))/amount(baseline)*1000)/10:null;
  return {
   latestMonth:latest.month,
   latestWon:amount(latest),
   latestUnitRate:latest.won_per_exclusive_m2,
   latestSource:latest.source_url,
   latestComponents:latest.components_won&&typeof latest.components_won==='object'?latest.components_won:null,
   count:last12.length,
   windowLabel:minMonth+'–'+latest.month,
   avgWon:last12.length>=3?Math.round(avg/100)*100:null,
   minWon:last12.length>=3?Math.min(...values):null,
   maxWon:last12.length>=3?Math.max(...values):null,
   monthOverMonth:delta(match),
   yearOverYear:delta(yoy),
   stale:n>3,
   staleMonths:n,
   trend:last12.map(x=>({month:x.month,won:amount(x),rate:x.won_per_exclusive_m2})),
   maxTrend:Math.max(...values)
  };
 }
 function renderTrend(t, exclusive){
  if(!t)return '';
  const month=m=>m.slice(0,4)+'년 '+Number(m.slice(4))+'월';
  const delta=v=>v===null?'':('<span class="feeTrendChange">'+(v>0?'+':'')+v+'%</span>');
  const stats=t.avgWon===null?
   '<p class="feeTrendShort">월별 자료가 3개월 이상 쌓이면 평균·최저·최고를 비교할 수 있습니다.</p>':
   '<div class="feeTrendStats"><div><small>확인된 '+t.count+'개월 평균</small><b>'+currency(t.avgWon)+'</b></div>'+
   '<div><small>최저</small><b>'+currency(t.minWon)+'</b></div>'+
   '<div><small>최고</small><b>'+currency(t.maxWon)+'</b></div></div>';
  const bars=t.trend.length<2?'':'<details class="feeHistory"><summary>월별 변동 보기 · '+
   t.count+'/12개월 확인</summary><div class="feeHistoryRows">'+t.trend.map(x=>
   '<div class="feeHistoryRow"><span>'+x.month.slice(2,4)+'.'+x.month.slice(4)+'</span>'+
   '<div class="feeHistoryTrack"><i style="width:'+Math.max(3,Math.round(x.won/t.maxTrend*100))+'%"></i></div>'+
   '<strong>'+currency(x.won)+'</strong></div>').join('')+
   '</div><p class="tiny">자료가 없는 달은 평균과 증감률에 포함하지 않습니다.</p></details>';
  return '<div class="feeTrendSummary">'+
   '<div class="feeTrendPeriod">'+(t.stale?'과거 공개자료':'최근 확인 공개월')+
   ' · '+month(t.latestMonth)+(t.stale?' · 이후 월 자료 확인 필요':'')+'</div>'+
   '<div class="feeTrendCurrent">'+currency(t.latestWon)+'</div>'+
   '<p class="tiny">전용 '+Number(exclusive)+'㎡ 월 참고액'+
    (t.monthOverMonth===null?'':' · 전월 대비 '+delta(t.monthOverMonth))+
    (t.yearOverYear===null?'':' · 전년 같은 달 대비 '+delta(t.yearOverYear))+'</p>'+
   stats+'<p class="tiny">최근 공개월 기준 12개월 중 <b>'+t.count+'개월</b> 확인 · '+
    month(t.windowLabel.slice(0,6))+' ~ '+month(t.latestMonth)+'</p>'+bars+
   '<p class="tiny">K-apt 공개 월별 ㎡당 단가 '+currency(t.latestUnitRate)+
   ' × 전용면적 · 실제 세대 청구액 아님</p></div>';
 }
 const api={summarize,currency,shift,renderTrend};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.FirstHyundaiMaintenance=api;
})(typeof window!=='undefined'?window:globalThis);
