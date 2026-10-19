// FirstHyundai v1.4 - Admin-only draft editor for PUBLIC apartment reference data.
'use strict';
const CATALOG_DRAFT_KEY='firsthyundai-catalog-drafts-v14';
let catalogDrafts={};
try {
 const saved=JSON.parse(localStorage.getItem(CATALOG_DRAFT_KEY)||'{}');
 if(saved && typeof saved==='object' && !Array.isArray(saved))catalogDrafts=saved;
} catch(e){catalogDrafts={};}
const knownCatalogIds=new Set(['f13','f14','f15','m21','m22','m23','avenue','centennial','prime20','prime25','skcentral','artwin','central3']);
window.firstHyundaiDraftCount=()=>Object.keys(catalogDrafts).filter(x=>knownCatalogIds.has(x)).length;
window.firstHyundaiDraftOverlay=(published,mode)=>mode==='admin'?
 published.map(p=>{
  const changed=knownCatalogIds.has(p.id)&&catalogDrafts[p.id];
  // Never change a real trade alias or the chosen building identifier via drafts.
  return changed?{...p,...changed,id:p.id,label:p.label,aliases:p.aliases}:p;
 }):published;
function catalogPublishedRows(){
 const real=remote.complexes?.records||[];
 const current=catalogRows();
 // This view is used ONLY as a fallback for missing remote records.
 return current.map(x=>{
  const found=real.find(v=>v&&v.id===x.id);
  if(found)return {...x,...found,id:x.id,label:x.label,aliases:x.aliases};
  const {id,label,aliases}=x;
  return {id,label,aliases,households:null,heating:null,area_types_m2:[],supply_type_labels:[],floorplans:[],source_url:null,last_verified:null};
 });
}
function parseAreaTypes(input){
 const parts=input.trim()?input.trim().split(/[,\s]+/).filter(Boolean):[];
 if(parts.length>50)throw Error('전용면적은 최대 50개까지만 입력할 수 있습니다.');
 if(parts.some(v=>!/^[1-9][0-9]{0,2}(?:\.[0-9]{1,2})?$/.test(v)||Number(v)>=1000))throw Error('전용면적은 1~999.99 숫자를 쉼표로 구분해 주세요.');
 return [...new Set(parts.map(Number))].sort((a,b)=>a-b);
}
function parseSupplyTypes(input){
 const values=input.trim()?input.split(/[,\n]+/).map(v=>v.trim()).filter(Boolean):[];
 if(values.length>45)throw Error('공급면적 타입은 최대 45개까지 입력할 수 있습니다.');
 if(values.some(v=>!/^[0-9]{2,3}(?:\.[0-9]{1,2})?[A-Za-z-]{0,4}$/.test(v)))throw Error('공급면적은 117A, 131B 같은 타입명으로 입력하세요.');
 return [...new Set(values)];
}
function parseFloorplanUrls(input){
 const lines=input.trim()?input.split(/\n+/).map(x=>x.trim()).filter(Boolean):[];
 if(lines.length>30)throw Error('평면도 링크는 최대 30개까지 입력할 수 있습니다.');
 return lines.map(line=>{
  const split=line.indexOf('|');
  if(split<1)throw Error('평면도는 타입 | HTTPS주소 형식으로 입력하세요.');
  const label=line.slice(0,split).trim(),url=line.slice(split+1).trim();
  if(!label||label.length>60||!safeLink(url)||url.length>700)throw Error('평면도 타입 또는 HTTPS 주소를 확인해 주세요.');
  return {label,url};
 });
}
function openComplexEditor(){
 if(role!=='admin')return;
 const p=catalogRows().find(x=>x.id===complexSelected);
 if(!p)return alert('수정할 단지를 먼저 선택하세요.');
 $('complexEditTitle').textContent=p.label+' · 단지정보 편집';
 $('complexHouseholds').value=Number.isInteger(p.households)&&p.households>0?String(p.households):'';
 $('complexHeating').value=p.heating||'';
 $('complexSupplyTypes').value=(Array.isArray(p.supply_type_labels)?p.supply_type_labels:[]).join(', ');
 $('complexAreaTypes').value=(Array.isArray(p.area_types_m2)?p.area_types_m2:[]).join(', ');
 $('complexFloorplans').value=(Array.isArray(p.floorplans)?p.floorplans:[]).map(v=>String(v.label||'')+' | '+String(v.url||'')).join('\n');
 $('complexSource').value=p.source_url||'';
 $('complexVerified').value=p.last_verified||'';
 $('complexEditor').showModal();
}
function saveComplexDraft(){
 if(role!=='admin')return false;
 if(!knownCatalogIds.has(complexSelected))throw Error('등록되지 않은 단지입니다.');
 const h=$('complexHouseholds').value.trim(), households=h?Number(h):null;
 if(h&&(!/^[1-9][0-9]*$/.test(h)||!Number.isInteger(households)||households>99999))throw Error('세대수는 1~99,999의 정수만 입력해 주세요.');
 const heating=$('complexHeating').value.trim()||null;
 if(heating&&heating.length>60)throw Error('난방방식은 60자 이하로 입력해 주세요.');
 const supply_type_labels=parseSupplyTypes($('complexSupplyTypes').value);
 const area_types_m2=parseAreaTypes($('complexAreaTypes').value);
 const floorplans=parseFloorplanUrls($('complexFloorplans').value);
 const source_url=$('complexSource').value.trim()||null;
 const last_verified=$('complexVerified').value.trim()||null;
 if(source_url&&(!safeLink(source_url)||source_url.length>500))throw Error('출처 URL은 HTTPS 주소만 가능합니다.');
 if(last_verified&&!/^\d{4}-\d{2}-\d{2}$/.test(last_verified))throw Error('검증일은 YYYY-MM-DD 형식으로 입력해 주세요.');
 if((households||heating||supply_type_labels.length||area_types_m2.length||floorplans.length)&&(!source_url||!last_verified))throw Error('세대수·난방·면적·평면도 정보를 입력하려면 출처 URL과 검증일을 함께 입력해 주세요.');
 catalogDrafts[complexSelected]={households,heating,area_types_m2,supply_type_labels,floorplans,source_url,last_verified};
 localStorage.setItem(CATALOG_DRAFT_KEY,JSON.stringify(catalogDrafts));
 $('complexEditor').close();
 renderComplexes();
 return true;
}
$('complexForm').onsubmit=function(event){
 event.preventDefault();
 try{
  if(saveComplexDraft())alert('이 휴대폰에 임시 저장했습니다. 가족에게 공개하려면 JSON을 내보내 GitHub에 적용해 주세요.');
 }catch(e){alert('입력 오류: '+e.message);}
};
function resetComplexDraft(){
 if(role!=='admin'||!catalogDrafts[complexSelected])return;
 if(!confirm('이 단지의 미게시 수정을 삭제하고 공개 자료로 되돌릴까요?'))return;
 delete catalogDrafts[complexSelected];
 localStorage.setItem(CATALOG_DRAFT_KEY,JSON.stringify(catalogDrafts));
 $('complexEditor').close();
 renderComplexes();
}
function createCatalogExport(){
 if(role!=='admin')return null;
 const records=catalogRows().filter(p=>knownCatalogIds.has(p.id));
 return {
  schema_version:1,state:'verified_partial',updated_at:kstDateOffset(0),
  note:'관리자가 직접 확인한 공개용 단지정보입니다. 개인정보·계약서·비밀번호 저장 금지. 출처와 검증일 필수.',
  records:records.map(p=>({
   id:p.id,label:p.label,aliases:p.aliases,households:p.households??null,heating:p.heating??null,
   supply_type_labels:Array.isArray(p.supply_type_labels)?p.supply_type_labels:[],
   area_types_m2:Array.isArray(p.area_types_m2)?p.area_types_m2:[],
   floorplans:Array.isArray(p.floorplans)?p.floorplans:[],
   source_url:p.source_url??null,last_verified:p.last_verified??null
  }))
 };
}
function exportComplexCatalog(){
 if(role!=='admin')return;
 const json=JSON.stringify(createCatalogExport(),null,2)+'\n';
 if(window.FirstHyundaiNative?.saveCatalog){window.FirstHyundaiNative.saveCatalog(json);return;}
 const blob=new Blob([json],{type:'application/json'});
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='complexes.json';a.click();
 setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
window.onCatalogSaved=r=>alert(r.ok?'단지정보 JSON을 저장했습니다. GitHub에 올려야 가족에게 반영됩니다.':'단지정보 파일 저장 실패');
