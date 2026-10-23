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
 const api={summarize,currency,shift};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 root.FirstHyundaiMaintenance=api;
})(typeof window!=='undefined'?window:globalThis);
