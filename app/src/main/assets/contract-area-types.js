/* v2.1.98 — 평형을 말하거나 적으면 그 단지의 "검증된" 타입 하나로만 연결한다.
 *
 * "34평", "35평 A타입", "117A타입"처럼 적거나 말해도, 단지의 검증된
 * 공급/전용 쌍(area_type_pairs + supply_type_labels) 중 정확히 하나일 때만
 * 전용면적·공급타입을 채운다. 같은 평형에 A/B 타입이 둘 이상이면 고르지 않고
 * 선택지를 보여준다. 전용면적이나 공급면적을 추정해서 만들지 않는다.
 * 계약 안내문에는 전용면적 옆에 "(약 N평형)"을 함께 쓴다(앱 다른 화면과 같은 표기).
 */
(function(root){
 'use strict';
 // "117A타입", "117 A 타입" → explicit verified type label.
 const TYPE=/(?:^|[^\d.])(\d{2,3}(?:\.\d{1,2})?)\s*([A-Za-z]{1,2})?\s*타입/i;
 // "34평", "34평형", "35평 A", "35평 A타입". Not 평당/평대/평수, not "35평 B동".
 const PYEONG=/(?:^|[^\d.])([1-9]\d)\s*평(?:형)?(?!\s*(?:당|대|수))(?:\s*([A-Za-z])(?![A-Za-z])(?!\s*동)\s*(?:타입)?)?/i;
 const SUPPLY=/^(\d{2,3}(?:\.\d{1,2})?[A-Za-z0-9-]{0,8})타입\s*·\s*공급\s*(\d{2,3}(?:\.\d{1,3})?)㎡/;
 // index.html declares these helpers as page globals (window in the app).
 const helper=name=>typeof globalThis[name]==='function'?globalThis[name]:typeof root[name]==='function'?root[name]:null;

 function record(label){
  const name=String(label||'').trim();
  const rows=helper('catalogRows');
  if(!name||!rows)return null;
  return rows().find(r=>r&&r.label===name)||null;
 }
 function types(rec){
  const canonical=helper('canonicalAreaTypes'),pyeong=helper('supplyPyeong');
  if(!rec||!canonical||!pyeong)return [];
  return canonical(rec).map(t=>({label:t.supply_label,exclusive:t.exclusive_m2,
   supply:t.supply_m2,pyeong:pyeong(t.supply_m2,t.market_pyeong)})).filter(t=>t.pyeong);
 }
 function parse(text){
  const s=String(text||'').normalize('NFKC');
  const t=s.match(TYPE);
  if(t)return {label:(t[1]+(t[2]||'')).toUpperCase()};
  const p=s.match(PYEONG);
  if(p)return {pyeong:Number(p[1]),letter:(p[2]||'').toUpperCase()};
  return null;
 }
 const suffix=label=>(String(label).toUpperCase().match(/[A-Z]+$/)||[''])[0];
 function resolve(rec,query){
  const list=types(rec);
  let hits=[];
  if(query?.label){
   hits=list.filter(t=>t.label.toUpperCase()===query.label);
   if(!hits.length&&/^\d+(?:\.\d+)?$/.test(query.label))
    hits=list.filter(t=>parseFloat(t.label)===Number(query.label));
  }else if(query?.pyeong){
   hits=list.filter(t=>t.pyeong===query.pyeong);
   if(query.letter)hits=hits.filter(t=>suffix(t.label)===query.letter);
  }
  return hits.length===1?{status:'one',type:hits[0]}:hits.length?{status:'many',types:hits}:{status:'none'};
 }
 // Same format fromSelectedComplex() already writes and the memo parser reads back.
 function supplyInfo(t){return t.label+'타입 · 공급 '+String(t.supply)+'㎡';}
 function describe(q){return q?.label?q.label+'타입':q?.pyeong?q.pyeong+'평형'+(q.letter?' '+q.letter+'타입':''):'평형';}
 function choicesText(list){return list.map(t=>t.label+'(전용 '+t.exclusive+'㎡)').join(', ');}
 function pyeongForContract(property,exclusive,supply){
  const m=String(supply||'').match(SUPPLY);
  if(!m)return null;
  const t=types(record(property)).find(x=>x.label===m[1]&&Math.abs(x.exclusive-Number(exclusive))<=0.011);
  if(t)return t.pyeong;
  const pyeong=helper('supplyPyeong');
  return pyeong?pyeong(Number(m[2])):null;
 }
 /** Shared by the memo parser and Live. Writes only verified values. */
 function applyTo(property,query,setArea){
  const rec=record(property);
  if(!query)return {status:'none',message:''};
  if(!rec)return {status:'no_complex',message:describe(query)+'은(는) 단지가 확인되면 타입을 연결합니다. 단지명을 확인해 주세요.'};
  const r=resolve(rec,query);
  if(r.status==='one'){
   setArea(String(r.type.exclusive),supplyInfo(r.type));
   return {status:'one',type:r.type,message:describe(query)+' → '+r.type.label+'타입 · 전용 '+r.type.exclusive+'㎡ (약 '+r.type.pyeong+'평형)'};
  }
  if(r.status==='many')return {status:'many',types:r.types,
   message:rec.label+'에 '+describe(query)+' 타입이 '+r.types.length+'개 있습니다: '+choicesText(r.types)+'. "A타입"처럼 함께 적거나 아파트정보 > 평형·타입에서 골라 주세요.'};
  return {status:'none',message:rec.label+'에서 '+describe(query)+'에 해당하는 검증된 타입을 찾지 못했습니다. 전용면적을 직접 확인해 주세요.'};
 }
 root.FirstHyundaiAreaTypes=Object.freeze({record,types,parse,resolve,supplyInfo,describe,choicesText,pyeongForContract,applyTo});
})(window);
