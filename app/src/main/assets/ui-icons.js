/* v2.1.97 — One line-icon language for the whole app.
 *
 * Buttons, tabs and titles used to mix emoji and Unicode shapes (✎ ▤ ▦ ▧ 🎙 ★ …)
 * that render at different sizes and weights on every phone. The source text is
 * left untouched (tests, copied text and the no-JS fallback keep working); this
 * module only swaps a LEADING UI glyph for an SVG drawn in the same stroke style
 * as the six main menu icons. User-written memo or news text is never changed.
 * Removing this file (and ui-consistency.css) restores the previous look.
 */
(function(){
 'use strict';
 const PATHS={
  pen:'<path d="M4.5 19.5h3.8L19 8.8a2.4 2.4 0 0 0-3.4-3.4L4.9 16.1z"/><path d="M14 7l3.4 3.4"/>',
  memoBox:'<rect x="4" y="3.5" width="16" height="17" rx="2.5"/><path d="M8 8.5h8M8 12.5h8M8 16.5h5"/>',
  calendar:'<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3v4M16 3v4M3.5 10h17M8 14h2M14 14h2M8 17.5h2"/>',
  photo:'<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M20.5 16l-4.8-4.8L8 19"/>',
  mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/>',
  pin:'<path d="M9.5 3.5h5l-.8 5.2 3 3.3H7.3l3-3.3z"/><path d="M12 12v8.5"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4L18 18M6 18l1.6-1.6M16.4 7.6L18 6"/>',
  clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  star:'<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7L12 16.6l-5.1 2.7 1-5.7-4.1-4 5.7-.8z"/>',
  sparkle:'<path d="M11 3.5l1.7 4.8 4.8 1.7-4.8 1.7L11 16.5l-1.7-4.8L4.5 10l4.8-1.7z"/><path d="M18 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  refresh:'<path d="M19.3 12.5a7.4 7.4 0 1 1-2.4-6"/><path d="M19.5 4v4.6h-4.6"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  bell:'<path d="M6.5 16.5v-5.3a5.5 5.5 0 0 1 11 0v5.3l1.5 2h-14z"/><path d="M10 21a2.2 2.2 0 0 0 4 0"/>',
  home:'<path d="M4 11.5L12 4.5l8 7"/><path d="M6.5 10v9.5h11V10"/><path d="M10.5 19.5v-5h3v5"/>',
  chart:'<path d="M4 19.5h16"/><path d="M5.5 15.5l4-4.5 3.5 3 5.5-6.5"/><path d="M15 7.5h3.5V11"/>',
  restore:'<path d="M5 9.5h9.5a5 5 0 0 1 0 10H9"/><path d="M8.5 6L5 9.5 8.5 13"/>'
 };
 const FILLED=new Set(['starFill']);
 const GLYPHS={'✎':'pen','▤':'memoBox','▦':'calendar','▧':'photo','🎙':'mic','📌':'pin','⚙':'gear',
  '◷':'clock','★':'starFill','☆':'star','✦':'sparkle','↻':'refresh','＋':'plus','🔔':'bell','⌂':'home',
  '⌁':'chart','↶':'restore'};
 const LEAD=/^(\s*)(✎|▤|▦|▧|🎙|📌|⚙|◷|★|☆|✦|↻|＋|🔔|⌂|⌁|↶)️?\s*/u;
 // Elements whose whole content is one decorative glyph.
 const ICON_ONLY='.starterIcon,.refreshGlyph,.adminHubIcon,.favoriteCardStar,.inboxKind';
 // Short UI labels that may begin with a glyph.
 const LABELS='button,summary,label,h2,h3,.officeBoardPinned,.officeBoardNoteSchedule,'+
  '.officeBoardReminderHint,.officeBoardAutoSchedule,.newsLiveVoiceHeading strong,#nearbyTotal>span';
 // Never touch what a person wrote or what an outside source published.
 const CONTENT='.overviewMemoEntry,.inboxItem .inboxInfo,.officeBoardText,.officeBoardNoteLabel,'+
  'textarea,option,[contenteditable],#ct_preview,.contractPreview,.newsItem .newsTitle';

 function svg(name,extra){
  const filled=FILLED.has(name),key=filled?name.replace(/Fill$/,''):name;
  return '<svg class="uiIcon'+(extra?' '+extra:'')+'" data-icon="'+name+'" viewBox="0 0 24 24" fill="'+
   (filled?'currentColor':'none')+'" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '+
   'stroke-linejoin="round" aria-hidden="true" focusable="false">'+(PATHS[key]||'')+'</svg>';
 }
 function iconOnly(el){
  if(el.querySelector('svg'))return;
  const name=GLYPHS[(el.textContent||'').trim().replace(/️/g,'')];
  if(name)el.innerHTML=svg(name);
 }
 function firstText(el){
  // The label text is either directly inside the control or in its first child span.
  for(const node of el.childNodes){
   if(node.nodeType===3){if(node.nodeValue.trim())return node;continue}
   if(node.nodeType!==1)continue;
   if(node.matches?.('svg,.uiIcon'))return null;
   if(node.matches?.('span,strong,b')&&!node.matches(ICON_ONLY)){
    for(const inner of node.childNodes){
     if(inner.nodeType===3&&inner.nodeValue.trim())return inner;
     if(inner.nodeType===1)return null;
    }
   }
   return null;
  }
  return null;
 }
 function label(el){
  if(el.closest?.(CONTENT))return;
  if((el.textContent||'').trim().length>60)return;
  const node=firstText(el);if(!node)return;
  const match=node.nodeValue.match(LEAD);if(!match)return;
  const name=GLYPHS[match[2]];if(!name)return;
  const holder=document.createElement('span');holder.innerHTML=svg(name,'uiIconLead');
  node.parentNode.insertBefore(holder.firstChild,node);
  node.nodeValue=match[1]+node.nodeValue.slice(match[0].length);
  el.classList.add('hasUiIcon');
 }
 function upgrade(root){
  if(!root||root.nodeType!==1)return;
  if(root.matches?.(ICON_ONLY))iconOnly(root);
  if(root.matches?.(LABELS))label(root);
  root.querySelectorAll?.(ICON_ONLY).forEach(iconOnly);
  root.querySelectorAll?.(LABELS).forEach(label);
 }
 function start(){
  upgrade(document.body);
  if(typeof MutationObserver!=='function')return;
  const seen=new Set();let queued=false;
  const flush=()=>{queued=false;const list=[...seen];seen.clear();
   for(const el of list){if(el.isConnected){upgrade(el);const up=el.parentElement?.closest?.(LABELS);if(up)label(up)}}};
  new MutationObserver(records=>{
   for(const r of records){
    const target=r.type==='characterData'?r.target.parentElement:r.target;
    if(target&&target.nodeType===1)seen.add(target);
    r.addedNodes?.forEach(n=>{if(n.nodeType===1)seen.add(n)});
   }
   if(!queued&&seen.size){queued=true;(window.queueMicrotask||setTimeout)(flush)}
  }).observe(document.body,{childList:true,subtree:true,characterData:true});
 }
 window.FirstHyundaiIcons=Object.freeze({svg,upgrade,glyphs:Object.freeze({...GLYPHS})});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
 else start();
})();
