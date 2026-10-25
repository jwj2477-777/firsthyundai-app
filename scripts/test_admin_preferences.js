'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const dir=path.resolve(__dirname,'../app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const prefs=fs.readFileSync(path.join(dir,'admin-preferences.js'),'utf8');
const css=fs.readFileSync(path.join(dir,'admin-preferences.css'),'utf8');
new vm.Script(prefs);
for(const id of ['adminDefaultPage','adminListDensity','adminReadingSize','adminMotionStyle',
 'adminContrastMode','adminTradePopupEnabled','adminSettingsExport','adminSettingsImport','adminPreferencesStatus'])
 assert(html.includes('id="'+id+'"'),'Settings control missing '+id);
assert(html.indexOf('admin-preferences.js')<html.indexOf('premium-motion.js'),
 'Preferences must load before transition scripts');
assert(css.includes('data-list-density="compact"')&&css.includes('data-app-motion="reduced"'));
assert(css.includes('data-shortcut-order="memoFirst"')&&css.includes('data-reading-size="xlarge"'));
for(const id of ['adminQuickOrder','adminAccentStyle','adminTradeAmountStyle','adminCancelledStyle',
 'adminMemoOrder','adminMemoCompleted','adminMemoRefresh','adminMemoClock','adminMemoPhones'])
 assert(html.includes('id="'+id+'"'),'Missing admin setting '+id);
assert(html.includes('현재 일반모드')&&html.includes('>일반모드</button>'),'User-facing name must be 일반모드');
assert(!html.includes('현재 가족 모드')&&!html.includes('가족 모드로 전환'));
const map=new Map(),nodes=new Map();
const readKey='firsthyundai-ui-preferences-v1';
const body={attrs:{},setAttribute(k,v){this.attrs[k]=v}};
function get(id){if(!nodes.has(id))nodes.set(id,{value:'',checked:false,textContent:'',
 open:false,focus(){},select(){}});return nodes.get(id)}
let calls=[];
const ctx=vm.createContext({
 role:'admin',document:{getElementById:get,body},window:{FirstHyundaiTradeAlerts:{
  enabled:()=>calls[calls.length-1]??true,setEnabled:v=>calls.push(v)}},
 localStorage:{getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)},
 confirm:()=>true});
vm.runInContext(prefs,ctx);
const api=ctx.window.FirstHyundaiUIOptions;
assert.equal(body.attrs['data-list-density'],'standard');
assert.equal(get('adminDefaultPage').value,'nearby');
assert(api.set('start','news'));
assert.equal(JSON.parse(map.get(readKey)).start,'news');
assert(api.set('density','compact'));
assert.equal(body.attrs['data-list-density'],'compact');
assert(api.set('reading','large'));
assert.equal(body.attrs['data-reading-size'],'large');
assert(api.set('contrast','high'));
assert.equal(body.attrs['data-app-contrast'],'high');
assert(api.set('motion','reduced'));
assert.equal(body.attrs['data-app-motion'],'reduced');
for(const [key,value,attr] of [
 ['quickOrder','memoFirst','data-shortcut-order'],['accent','teal','data-ui-accent'],
 ['tradeAmount','bold','data-trade-amount'],['cancelled','subtle','data-cancelled-style']]){
 assert(api.set(key,value),key);assert.equal(body.attrs[attr],value);
}
for(const [key,value] of [['memoOrder','oldest'],['memoCompleted','show'],['memoRefresh','120'],
 ['memoClock','24'],['memoPhones','off'],['density','roomy'],['reading','xlarge'],['start','officeBoard']])
 assert(api.set(key,value),key);
assert.equal(api.set('density','evil'),false,'Reject invalid setting');
api.setTradePopup(false);assert.equal(calls.at(-1),false);
api.exportSettings();
const exported=get('adminSettingsExport').value;
assert.equal(JSON.parse(exported).preferences.start,'officeBoard','Backup preserves newly selected default page');
const backup=JSON.parse(exported);
assert(!('notes' in backup)&&!('password' in backup)&&!('secrets' in backup),'No personal data or credentials in settings backup');
assert.equal(backup.preferences.memoOrder,'oldest');
assert.equal(backup.preferences.memoPhones,'off');
api.reset();assert.equal(body.attrs['data-list-density'],'standard');
get('adminSettingsImport').value=exported;
assert(api.importSettings());assert.equal(body.attrs['data-list-density'],'roomy');
assert.equal(calls.at(-1),false);
const invalid=JSON.stringify({schema:1,type:'firsthyundai-ui-settings',
 preferences:{...api.get(),motion:'malicious'},tradePopup:false});
get('adminSettingsImport').value=invalid;assert.equal(api.importSettings(),false);
assert.equal(api.get().motion,'reduced','Invalid import cannot replace last valid setting');
assert.equal(api.get().memoRefresh,'120','Invalid import must not change memo refresh');
assert(api.set('tapSize','large'));
assert.equal(body.attrs['data-touch-size'],'large');
assert(api.set('memoLayout','roomy'));
assert.equal(body.attrs['data-memo-layout'],'roomy');
assert(api.preset('comfortable'));
assert.equal(api.get().reading,'xlarge');
assert.equal(api.get().contrast,'high');
assert.equal(api.get().tapSize,'large');
assert.equal(api.get().memoRefresh,'120','Visual profile cannot change office board refresh setting');
assert.equal(get('adminUndoLast').disabled,false);
assert(api.undo(),'Undo restores last preset atomically');
assert.equal(get('adminUndoLast').disabled,true);
assert.equal(api.get().memoLayout,'roomy','Undo preserves memo layout');
assert(api.preset('compact'));
assert.equal(api.get().density,'compact');
assert(api.undo());
assert.equal(api.get().density,'roomy');
assert(api.preset('default'));assert.equal(api.get().density,'standard');
assert(api.undo());assert.equal(api.get().density,'roomy');
const data=api.get();
ctx.role='family';assert.equal(api.set('density','standard'),false);
assert.equal(api.reset(),false);assert.equal(api.importSettings(),false);
api.setTradePopup(true);assert.equal(calls.at(-1),false,'Family cannot change alerts through admin API');
assert.equal(api.get().density,data.density,'Family has no admin settings access');
console.log('Admin UI preferences passed: role isolation, local persistence, live styles, startup choice, alerts, validated backup/restore.');
