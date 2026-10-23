'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const {summarize,renderTrend,currency}=require('../app/src/main/assets/maintenance-trends.js');
const row=(month,rate)=>({
 month,won_per_exclusive_m2:rate,monthly_total_won:rate*70000,
 source_url:'https://www.k-apt.go.kr/'});
const snapshot=(r)=>({schema_version:1,state:'verified_partial',records:[{
 complex_id:'f15',kapt_code:'A10026679',...r
}]});
const now=new Date(2026,9,24,10,0,0);
const one=summarize(snapshot(row('202607',3831)),'f15','A10026679',84.7,now);
assert(one&&one.count===1);
assert.equal(one.avgWon,null,'a single monthly figure is not a 12-month average');
assert.equal(one.latestMonth,'202607');
assert.equal(currency(one.latestWon),'약 32만원');
assert(renderTrend(one,84.7).includes('약 32만원'));
assert(!renderTrend(one,84.7).includes('324,500원'),'fee estimates are rounded');
assert(renderTrend(one,84.7).includes('3개월 이상'));
assert(!renderTrend(one,84.7).includes('전월 대비'),'no missing-month change claims');
const yearHistory=[
 row('202607',3831),row('202608',4100),row('202609',4400),
 row('202510',4100),row('202509',4200),row('202508',4300)];
const full=snapshot({...row('202609',4400),monthly_history:yearHistory});
const t=summarize(full,'f15','A10026679',84.7,now);
assert(t&&t.count===3);
assert.equal(t.latestMonth,'202609');
assert(t.avgWon!==null&&t.minWon!==null&&t.maxWon!==null);
assert(t.monthOverMonth>0);
assert.equal(t.yearOverYear,0,'same month 2025-09 exact comparison');
const html=renderTrend(t,84.7);
assert(html.includes('확인된 3개월 평균'));
assert(html.includes('전년 같은 달 대비'));
assert(html.includes('월별 변동 보기'));
assert(!html.includes('2025년 10월')&&t.count===3,'do not mix older months into rolling 12');
const prior=snapshot(row('202607',3831));
assert.equal(summarize(prior,'f15','WRONG',84.7,now),null);
assert.equal(summarize(prior,'f15','A10026679',NaN,now),null);
const app=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
assert(app.includes('maintenance-trends.js'),'load verified fee trend helper');
assert(app.includes('FirstHyundaiMaintenance.renderTrend'),'family fee view uses monthly trend');
assert(app.includes("'약 '+Math.round(rate*picked.exclusive_m2/10000)+'만원'"),
 'single-month legacy estimate must also round to 10,000 KRW');
console.log('Monthly fee trends: 10k KRW rounding, genuine months only, stale guard, no false yearly average.');
