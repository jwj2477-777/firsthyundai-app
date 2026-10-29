'use strict';
/* v2.0.58: accurate by-complex, by-area, by-deal-type official trend charts. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'app/src/main/assets/ui-v2.css'),'utf8');
const src=fs.readFileSync(path.join(root,'app/src/main/assets/price-trends.js'),'utf8');
new vm.Script(src);
const ctx=vm.createContext({window:{},Date,Number,console});
vm.runInContext(src,ctx);
const api=ctx.window.FirstHyundaiPriceTrends,t=api._test;
assert(html.includes('src="price-trends.js"'));
for(const s of ["['trends','가격동향']","setComplexDetailTab(&quot;trends&quot;)","function openFavoritePriceTrend()",
 "id=\"nearbyTrendButton\"","formatArea:area=>displayExclusiveArea(area,p)"])
 assert(html.includes(s),'Trend linked to apartment-detail workflow: '+s);
assert(css.includes('#complexSheet .priceTrendKpis')&&css.includes('.priceTrendSvg'));
const date=month=>month+'-12';
const sale=(area,month,price,id='매매',status='신고')=>({area_m2:area,contract_date:date(month),amount_10k:price,type:id,status});
const lease=(area,month,deposit,kind='',type='전세',monthly=0)=>({area_m2:area,contract_date:date(month),deposit_10k:deposit,type,monthly_10k:monthly,contract_type_raw:kind,status:'신고'});
const records=[
 sale(84.9,'2026-08',100000),sale(84.9,'2026-08',110000),sale(84.9,'2026-08',120000),
 sale(84.9,'2026-09',115000),sale(84.9,'2026-09',120000),sale(84.9,'2026-09',125000),
 sale(84.9,'2026-10',120000),sale(84.9,'2026-10',130000),
 sale(84.94,'2026-10',300000),sale(84.9,'2026-10',900000,'매매','해제'),
 lease(84.9,'2026-10',60000,'신규계약'),lease(84.9,'2026-10',40000,'갱신계약'),
 lease(84.9,'2026-10',5000,'신규계약','월세',140),lease(84.9,'2026-09',4000,'신규계약','월세',160),
 lease(84.9,'2026-08',7000,'갱신계약','월세',40)
];
const snap={state:'ok',checked_at:'2026-10-24T09:10:00+09:00'};
let s=t.prepare({rows:records,type:'매매',area:'84.90',months:6,snapshot:snap});
assert.equal(s.area,'84.90');
assert.equal(s.count,8,'Do not mix 84.90, 84.94, cancellations, lease or monthly');
assert.equal(s.series.find(x=>x.month==='2026-08').price,110000,'Median for three sale prices');
assert.equal(s.series.find(x=>x.month==='2026-09').price,120000);
assert.equal(s.series.find(x=>x.month==='2026-10').price,125000);
assert(Math.abs(s.change-15/110)<.001,'Only multi-month sufficiently sampled values may have a percent change');
assert.equal(s.series.find(x=>x.month==='2026-07').count,0);
assert.equal(s.series.find(x=>x.month==='2026-07').price,null);
const markup=api.render({rows:records,type:'매매',area:'84.90',months:6,snapshot:snap});
assert(markup.includes('priceTrendSvg')&&markup.includes('월별 거래건수')&&markup.includes('전용 84.9㎡'));
assert(!markup.includes('300,000만원'),'Neighboring exclusive areas must never contaminate the trend');
const gaps=t.chart(s.series,'price','매매','만원');
assert.equal((gaps.match(/<polyline/g)||[]).length,1,'A gap must not connect to unrelated months');
s=t.prepare({rows:records,type:'매매',area:'84.94',months:6,snapshot:snap});
assert.equal(s.count,1);assert.equal(s.change,null);
s=t.prepare({rows:records,type:'전세',area:'84.90',months:6,snapshot:snap});
assert.equal(s.count,1,'Exclude explicitly renewed lease by default');assert.equal(s.change,null);
s=t.prepare({rows:records,type:'전세',area:'84.90',months:6,snapshot:snap,includeRenewals:true});
assert.equal(s.count,2);assert.equal(s.series.find(x=>x.month==='2026-10').price,50000);
s=t.prepare({rows:records,type:'월세',area:'84.90',months:6,snapshot:snap});
assert.equal(s.count,2);assert.equal(s.series.find(x=>x.month==='2026-10').price,5000);
assert.equal(s.series.find(x=>x.month==='2026-10').rent,140);
const rentHtml=api.render({rows:records,type:'월세',area:'84.90',months:6,snapshot:snap});
assert(rentHtml.includes('보증금 중위값')&&rentHtml.includes('월세 중위값'),'Separate deposit and monthly rent charts');
assert(!rentHtml.includes('중위가격 변화</small><strong class="up"'),'Sparse rent trend should not fabricate a rate');
s=t.prepare({rows:records,type:'매매',area:'84.90',months:12,snapshot:{...snap,state:'partial',missing_buckets:['202609:매매']}});
assert.equal(s.series.find(x=>x.month==='2026-09').missing,true);
assert.equal(s.change,null,'Missing data must block a trend percentage with too few observed months');
assert(api.render({rows:records,type:'매매',area:'84.90',snapshot:{...snap,state:'partial',missing_buckets:['202609:매매']}}).includes('자료 수집에 오류'));
assert.equal(t.areaKey(84.949),'84.95');assert.equal(t.areaKey(84.94),'84.94');
// Regression: the live <select> onchange handler must accept two-decimal area
// keys instead of silently resetting the selection to the largest area.
const selectorHandler=html.match(/function setComplexTrendArea\(area\)\{[\s\S]*?\n\}/)?.[0];
assert(selectorHandler,'Real index.html missing price-trend area onchange handler');
const selectionCtx=vm.createContext({String,api,records,snap});
vm.runInContext('let complexTrendArea="";let redraws=0;let latestChart="";'+
 'function renderComplexes(){redraws++;latestChart=api.render({rows:records,type:"매매",area:complexTrendArea,months:6,snapshot:snap})};'+
 selectorHandler+';function choose(value){setComplexTrendArea(value);return complexTrendArea}',selectionCtx);
for(const [area,number] of [['84.90',8],['84.94',1]]){
 const chosen=vm.runInContext('choose('+JSON.stringify(area)+')',selectionCtx);
 assert.equal(chosen,area,'Area selection must not reset: '+area);
 assert.equal(t.prepare({rows:records,type:'매매',area:chosen,months:6,snapshot:snap}).count,number);
 assert(vm.runInContext('latestChart',selectionCtx).includes('전용 '+Number(area)+'㎡'),
  'Chart must redraw selected area '+area);
}
assert.equal(vm.runInContext('redraws',selectionCtx),2,'Each selection change must trigger render');
assert.equal(vm.runInContext("choose('invalid')",selectionCtx),'');

assert(!api.render({rows:[],snapshot:{state:'not_started'}}).includes('월별 거래건수'));
console.log('Apartment trend regression passed: monthly medians, exact areas, 3 types, renewals, cancellations, missing months, sparse samples and source data.');
