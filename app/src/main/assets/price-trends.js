/* FirstHyundai v2.0.58 · local, offline and source-backed apartment price trends.
   Aggregation uses contract month, exact complex, exact displayed exclusive area
   (0.01 m²), and one deal type. NEVER average different areas together.
   No extrapolation into missing months, no estimates masquerading as deals. */
(function(){
'use strict';
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const num=n=>Number(n||0).toLocaleString('ko-KR',{maximumFractionDigits:1});
const areaKey=n=>{const a=Number(n);return Number.isFinite(a)&&a>0&&a<1000?(Math.round(a*100)/100).toFixed(2):'';};
const validDate=s=>/^20\d{2}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/.test(String(s||''));
const monthOf=s=>validDate(s)?String(s).slice(0,7):'';
const median=a=>{if(!a.length)return null;const v=a.slice().sort((x,y)=>x-y),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;};
function money(n){if(!Number.isFinite(n))return '—';const val=Math.round(n*10)/10;return val>=10000?num(val/10000)+'억원':num(val)+'만원';}
function monthKeys(end,count){
 if(!/^20\d{2}-(?:0[1-9]|1[0-2])$/.test(end))return [];
 const y=Number(end.slice(0,4)),m=Number(end.slice(5,7));
 return Array.from({length:count},(_,i)=>{
  const d=new Date(Date.UTC(y,m-1-(count-1-i),1));
  return d.getUTCFullYear()+'-'+String(d.getUTCMonth()+1).padStart(2,'0');
 });
}
const isCancelled=r=>/해제|취소/.test(String(r?.status||''));
const isRenewal=r=>/갱신/.test(String(r?.contract_type_raw||''));
function validRow(row,type,area,includeRenewals){
 if(!row||row.type!==type||areaKey(row.area_m2)!==area||isCancelled(row))return false;
 if(type!=='매매'&&!includeRenewals&&isRenewal(row))return false;
 if(!monthOf(row.contract_date))return false;
 const price=type==='매매'?Number(row.amount_10k):Number(row.deposit_10k);
 return Number.isFinite(price)&&price>0&&(type!=='월세'||Number.isFinite(Number(row.monthly_10k))&&Number(row.monthly_10k)>0);
}
function missingMonth(snapshot,month,type){
 const target=month.replace('-','');
 const category=type==='매매'?'매매':'임대';
 const all=[...(Array.isArray(snapshot?.missing_buckets)?snapshot.missing_buckets:[]),
 ...(Array.isArray(snapshot?.errors)?snapshot.errors:[])];
 return all.some(x=>{
  const s=String(x||'').replace(/^\s+/,'');
  return s.startsWith(target+':')&&(/[:](?:임대|전월세)/.test(s)?category==='임대':/[:](?:매매)/.test(s)?category==='매매':true);
 });
}
function prepare({rows=[],type='매매',area='',months=12,snapshot={},includeRenewals=false}={}){
 if(!['매매','전세','월세'].includes(type))type='매매';
 months=months===6?6:12;
 const end=String(snapshot.checked_at||'').slice(0,7);
 const keys=monthKeys(end,months);
 const choices=new Map();
 for(const r of rows){
  const a=areaKey(r?.area_m2);
  if(!a||r?.type!==type||!keys.includes(monthOf(r.contract_date))||isCancelled(r)||(!includeRenewals&&type!=='매매'&&isRenewal(r)))continue;
  const v=type==='매매'?Number(r.amount_10k):Number(r.deposit_10k);
  if(!Number.isFinite(v)||v<=0||(type==='월세'&&!(Number(r.monthly_10k)>0)))continue;
  choices.set(a,(choices.get(a)||0)+1);
 }
 const sorted=[...choices].sort((a,b)=>Number(a[0])-Number(b[0]));
 const picked=sorted.some(x=>x[0]===area)?area:sorted.slice().sort((a,b)=>b[1]-a[1]||Number(a[0])-Number(b[0]))[0]?.[0]||'';
 const selection=rows.filter(r=>picked&&validRow(r,type,picked,includeRenewals)&&keys.includes(monthOf(r.contract_date)));
 const series=keys.map(month=>{
  const filtered=selection.filter(r=>monthOf(r.contract_date)===month);
  const prices=filtered.map(r=>type==='매매'?Number(r.amount_10k):Number(r.deposit_10k));
  const rents=type==='월세'?filtered.map(r=>Number(r.monthly_10k)):[];
  return {month,missing:missingMonth(snapshot,month,type),count:filtered.length,
   price:median(prices),rent:median(rents)};
 });
 const readable=series.filter(x=>x.count>0&&!x.missing);
 const latest=selection.filter(r=>!missingMonth(snapshot,monthOf(r.contract_date),type))
  .sort((a,b)=>String(b.contract_date).localeCompare(String(a.contract_date)))[0]||null;
 const first=readable[0],last=readable[readable.length-1];
 const validChange=readable.length>=3&&selection.length>=6&&first.count>=2&&last.count>=2&&
  Number.isFinite(first.price)&&first.price>0&&Number.isFinite(last.price);
 const pct=validChange?(last.price-first.price)/first.price:null;
 return {type,months,keys,area:picked,areas:sorted,series,latest,count:selection.length,
  observedMonths:readable.length,change:pct,changeFrom:first?.month||'',changeTo:last?.month||'',
  state:String(snapshot?.state||''),checkedAt:String(snapshot?.checked_at||''),
  includesRenewals:!!includeRenewals,partial:!!series.some(x=>x.missing)||snapshot.state==='partial'};
}
function chart(series,key,label,unit){
 const width=360,height=198,left=51,right=11,top=20,bottom=38;
 const w=width-left-right,plotHeight=height-top-bottom,values=series.map(x=>!x.missing?x[key]:null);
 const known=values.filter(Number.isFinite);
 if(!known.length)return '<div class="priceTrendEmpty">해당 기간에 그래프로 표시할 거래가 없습니다.</div>';
 let low=Math.min(...known),high=Math.max(...known);
 const pad=Math.max((high-low)*0.14,high*0.035,1);
 low=Math.max(0,low-pad);high+=pad;
 const x=i=>left+(series.length===1?w/2:w*i/(series.length-1));
 const y=v=>top+plotHeight-(v-low)/(high-low)*plotHeight;
 const grid=[0,0.5,1].map(k=>{
  const val=low+(high-low)*(1-k),yy=top+plotHeight*k;
  return '<line x1="'+left+'" y1="'+yy.toFixed(2)+'" x2="'+(width-right)+'" y2="'+yy.toFixed(2)+'" stroke="#E2E9E7" stroke-width="1"/>'+
  '<text x="'+(left-7)+'" y="'+(yy+4)+'" text-anchor="end" font-size="10" fill="#677D80">'+esc(val>=10000?num(val/10000)+'억':num(val)+'만')+'</text>';
 }).join('');
 // Build separate paths per consecutive observed months; do not join missing months or zero-volume gaps.
 const groups=[];let group=[];
 for(let i=0;i<series.length;i++){
  if(Number.isFinite(values[i])&&!series[i].missing)group.push(i);
  else{if(group.length)groups.push(group);group=[];}
 }
 if(group.length)groups.push(group);
 const lines=groups.filter(g=>g.length>1).map(g=>'<polyline fill="none" stroke="#10776E" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" points="'+g.map(i=>x(i).toFixed(2)+','+y(values[i]).toFixed(2)).join(' ')+'"/>').join('');
 const circles=series.map((r,i)=>{
  const v=values[i];if(!Number.isFinite(v)||r.missing)return '';
  return '<circle cx="'+x(i).toFixed(2)+'" cy="'+y(v).toFixed(2)+'" r="4.1" fill="#0C746A" stroke="#FFFFFF" stroke-width="1.3"><title>'+esc(r.month)+' · '+esc(label)+' '+esc(money(v))+' · '+r.count+'건</title></circle>';
 }).join('');
 const labels=series.map((r,i)=>(i%2===0||i===series.length-1)?
  '<text x="'+x(i).toFixed(2)+'" y="'+(height-11)+'" font-size="10" text-anchor="middle" fill="#5D7177">'+esc(r.month.slice(5))+'월</text>':'').join('');
 const missing=series.map((r,i)=>r.missing?'<text x="'+x(i).toFixed(2)+'" y="'+(top+plotHeight/2).toFixed(2)+'" font-size="10" text-anchor="middle" fill="#B56F3C">!</text>':'').join('');
 return '<svg class="priceTrendSvg" viewBox="0 0 360 198" role="img" aria-label="'+esc(label)+' 월별 계약 중위가격 그래프, 단위 '+esc(unit)+'">'+
  '<title>'+esc(label)+' 월별 가격 추이 · 계약일 기준</title>'+grid+lines+circles+missing+labels+'</svg>';
}
function volume(series){
 const max=Math.max(1,...series.map(x=>x.missing?0:x.count));
 return '<div class="priceTrendVolume" role="img" aria-label="월별 거래건수 막대그래프">'+
  series.map(x=>'<div class="priceTrendVolumeCol" title="'+esc(x.month)+' · '+(x.missing?'수집 누락':x.count+'건')+'">'+
   '<span style="height:'+(x.missing?0:Math.max(x.count?5:0,x.count/max*100)).toFixed(1)+'%"'+(x.count&&!x.missing?' class="hasVolume"':'')+'></span></div>').join('')+
  '</div><p class="priceTrendVolumeCaption">월별 거래건수 · 막대는 해당 면적·유형의 계약 건수</p>';
}
function render(options={}){
 const s=prepare(options),ready=s.state==='ok'||s.state==='partial';
 const typeButtons=['매매','전세','월세'].map(t=>'<button type="button" class="'+(t===s.type?'active':'')+
  '" aria-pressed="'+(t===s.type)+'" onclick="setComplexTrendType(\''+t+'\')">'+t+'</button>').join('');
 const areaOptions=s.areas.map(([area,count])=>'<option value="'+esc(area)+'"'+(area===s.area?' selected':'')+'>'+
  esc(options.formatArea?options.formatArea(Number(area)):'전용 '+Number(area)+'㎡')+' · '+count+'건</option>').join('');
 const periods=[6,12].map(m=>'<button type="button" aria-pressed="'+(s.months===m)+'" class="'+(s.months===m?'active':'')+
  '" onclick="setComplexTrendMonths('+m+')">'+m+'개월</button>').join('');
 const selected=s.area?'전용 '+Number(s.area)+'㎡':'면적 확인 전';
 const intro='<div class="priceTrendIntro"><h3>가격동향</h3><p>같은 아파트·전용면적의 실거래만 비교합니다. 계약일 기준 월별 중위가격입니다.</p></div>';
 if(!ready)return '<section class="priceTrendPanel" aria-label="아파트 가격동향">'+intro+
  '<div class="priceTrendEmpty">실거래 자료가 아직 준비되지 않았습니다. 갱신 후 확인해 주세요.</div></section>';
 const controls='<div class="priceTrendFilters" role="group" aria-label="가격동향 거래유형 선택">'+typeButtons+'</div>'+
  (s.areas.length?'<label class="priceTrendAreaLabel" for="complexTrendAreaSelect">전용면적별 추이</label>'+
   '<select id="complexTrendAreaSelect" onchange="setComplexTrendArea(this.value)" aria-label="가격동향 전용면적 선택">'+areaOptions+'</select>':
   '<div class="priceTrendEmpty">선택한 거래유형에 사용할 수 있는 거래가 없습니다.</div>')+
  '<div class="priceTrendOptions"><div class="priceTrendPeriods" role="group" aria-label="가격동향 조회기간">'+periods+'</div>'+
  (s.type!=='매매'?'<label class="priceTrendRenewal"><input type="checkbox" '+(s.includesRenewals?'checked ':'')+
   'onchange="setComplexTrendRenewals(this.checked)"> 갱신계약 포함</label>':'')+'</div>';
 if(!s.area)return '<section class="priceTrendPanel">'+intro+controls+'</section>';
 const latest=s.latest?(s.type==='월세'?
  money(Number(s.latest.deposit_10k))+' / '+money(Number(s.latest.monthly_10k)):
  money(s.type==='매매'?Number(s.latest.amount_10k):Number(s.latest.deposit_10k))):'거래 없음';
 const change=s.change===null?'산출 보류':(s.change>0?'+':'')+(s.change*100).toFixed(1)+'%';
 const changeTitle=s.change===null?'월별 거래량 부족':s.changeFrom.replace('-','.')+' → '+s.changeTo.replace('-','.');
 const headline='<div class="priceTrendHeadline"><strong>'+esc(selected)+'</strong><span>'+s.months+'개월 · 총 '+s.count+'건</span></div>'+
  '<div class="priceTrendKpis"><div><small>최근 계약가</small><strong>'+esc(latest)+'</strong><span>'+esc(s.latest?.contract_date?.replace(/-/g,'.')||'계약 없음')+'</span></div>'+
  '<div><small>월 중위가격 변화</small><strong class="'+(s.change===null?'quiet':s.change>0?'up':s.change<0?'down':'quiet')+'">'+esc(change)+'</strong><span>'+esc(changeTitle)+'</span></div></div>';
 const charts=s.type==='월세'?
  [['price','보증금'],['rent','월세']].map(([key,label])=>
   '<div class="priceTrendChart"><h4>'+label+' 중위값</h4>'+chart(s.series,key,label,'만원')+'</div>').join(''):
  '<div class="priceTrendChart"><h4>'+s.type+' 중위가격</h4>'+chart(s.series,'price',s.type,'만원')+'</div>';
 const table='<details class="priceTrendTable"><summary>월별 가격·거래건수 상세 보기</summary><div class="priceTrendScroll">'+
  '<table><thead><tr><th scope="col">계약월</th><th scope="col">'+(s.type==='월세'?'보증금 / 월세':'중위가격')+'</th><th scope="col">건수</th></tr></thead><tbody>'+
  s.series.map(r=>'<tr><th scope="row">'+esc(r.month.replace('-','.'))+'</th><td>'+
    (r.missing?'자료 미수집':r.count?(s.type==='월세'?money(r.price)+' / '+money(r.rent):money(r.price)):'거래 없음')+'</td><td>'+(r.missing?'—':r.count+'건')+'</td></tr>').join('')+
  '</tbody></table></div></details>';
 const caution='<p class="priceTrendCaution">'+
  (s.partial?'일부 자료 수집에 오류가 있습니다. 미수집 기간은 추이에서 제외했습니다. ':'')+
  (s.type!=='매매'&&!s.includesRenewals?'갱신계약으로 명시된 거래는 제외하고 계약구분 미기재 거래는 포함했습니다. ':'')+
  '해제 거래 제외 · 실거래 신고 지연 및 정정 가능 · 직거래·층별 특성 등 가격 차이 고려 · 중위값은 시세 감정이 아닙니다.'+
  '</p>';
 return '<section class="priceTrendPanel" aria-label="아파트 가격동향">'+intro+controls+headline+charts+
  volume(s.series)+table+caution+'</section>';
}
window.FirstHyundaiPriceTrends={render,_test:{prepare,chart,median,areaKey,missingMonth,monthKeys,validRow}};
})();