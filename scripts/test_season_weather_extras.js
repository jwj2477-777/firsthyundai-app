'use strict';
/* v2.1.98 — season/weather extras (decoration only; business controls untouched).
   · Peak scenes: cherry blossoms (Apr 1–14) and autumn leaves (Oct 20–Nov 10), KST.
   · Particle budget: battery saver → none, low battery → half, very modest phone → fewer.
   · One-tap admin preset "계절·날씨 자동".
   · Header forecast hint: only with "송도 날씨 자동", only within 6 hours, never while it
     is already raining/snowing, and forecast never turns into a rain/snow effect.
   · 진눈깨비(sleet) is deliberately NOT a separate effect (user decision 2026-11-20). */
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..'),asset=p=>fs.readFileSync(path.join(root,'app/src/main/assets',p),'utf8');
function node(){return {attrs:{},children:[],textContent:'',value:'',hidden:false,style:{setProperty(){}},
 setAttribute(k,v){this.attrs[k]=v},appendChild(c){this.children.push(c)},replaceChildren(){this.children=[]}}}
const HOUR=3600000;

// --- themes + preset ---------------------------------------------------------
const elements=new Map(),storage=new Map(),body=node();
let saver=false;
const context={role:'admin',document:{body,hidden:false,createElement:node,
 getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id)},
 addEventListener(){},dispatchEvent(){}},
 window:{addEventListener(){},setInterval(){},FirstHyundaiNative:{isPowerSaveMode:()=>saver}},
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 setTimeout,clearTimeout,AbortController,Date,confirm:()=>true,Event:class{constructor(t){this.type=t}}};
vm.createContext(context);
vm.runInContext(asset('admin-preferences.js'),context);
vm.runInContext(asset('season-themes.js'),context);
const prefs=context.window.FirstHyundaiUIOptions,api=context.window.FirstHyundaiThemes;
const kst=s=>Date.parse(s+'T12:00:00+09:00');
assert.equal(api._test.seasonPeak('spring',kst('2027-04-05')),'blossom');
assert.equal(api._test.seasonPeak('spring',kst('2027-04-20')),'');
assert.equal(api._test.seasonPeak('autumn',kst('2026-10-25')),'foliage');
assert.equal(api._test.seasonPeak('autumn',kst('2026-11-10')),'foliage');
assert.equal(api._test.seasonPeak('autumn',kst('2026-09-20')),'');
assert.equal(api._test.seasonPeak('winter',kst('2026-04-05')),'','Peak follows the shown theme, not just the date');
const b=env=>api._test.particleBudget(env);
assert.equal(b({saver:true}).factor,0,'Battery saver: no moving decoration');
assert.equal(b({saver:false,battery:{charging:false,level:.12},navigator:{}}).factor,.5);
assert.equal(b({saver:false,battery:{charging:true,level:.05},navigator:{}}).factor,1,'Charging is fine');
assert.equal(b({saver:false,battery:null,navigator:{deviceMemory:2}}).factor,.6);
assert.equal(b({saver:false,battery:null,navigator:{deviceMemory:8,hardwareConcurrency:8}}).factor,1);
// Real paint path: the saver empties the decoration layer, then restores it.
assert(prefs.set('theme','winter'));assert(prefs.set('themeDecor','full'));
const layer=()=>body.children[0];
assert(layer().children.length>0,'Winter decoration visible normally');
saver=true;api.configure(prefs.get());
assert.equal(layer().children.length,0,'Battery saver removes particles');
assert.equal(body.attrs['data-theme-budget'],'saver');
saver=false;api.configure(prefs.get());
assert(layer().children.length>0,'Decoration returns after saver is off');
// One-tap preset
assert(prefs.preset('natureAuto'));
assert.equal(prefs.get().themeMode,'season');assert.equal(prefs.get().weatherEffect,'auto');
assert.equal(api.weatherMode(),'auto');
assert(!/진눈깨비|sleet/.test(asset('season-themes.js')),'No separate sleet effect');
assert(asset('index.html').includes("FirstHyundaiUIOptions.preset('natureAuto')"),'Admin one-tap button present');

// --- header forecast hint ----------------------------------------------------
const nodes=new Map(),get=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id)};
let mode='auto',observed=null;
const wctx={Date,AbortController,setTimeout,clearTimeout,
 window:{setInterval(){},FirstHyundaiThemes:{weatherMode:()=>mode,currentWeather:()=>observed,refreshObserved(){}}},
 document:{hidden:true,getElementById:get,addEventListener(){}}};
vm.createContext(wctx);vm.runInContext(asset('weather-briefing.js'),wctx);
const w=wctx.window.FirstHyundaiWeatherBriefing._test;
const now=Date.parse('2026-11-20T12:20:00+09:00');
const hour=h=>new Date(Date.parse('2026-11-20T00:00:00+09:00')+h*HOUR).toISOString().replace('.000Z','Z');
const doc=types=>({schema:1,status:'ok',area:'송도',date:'2026-11-20',issued_at:'2026-11-20T11:00:00+09:00',
 hours:Object.entries(types).map(([h,type])=>({at:hour(Number(h)),type,pop:type==='none'?10:70,temp:5,sky:3}))});
assert.equal(w.upcomingHint(doc({12:'none',13:'none',15:'rain'}),now),'오늘 오후 3시경 비 예보');
assert.equal(w.upcomingHint(doc({12:'rain'}),now),'곧 비 예보','Already in the forecast hour');
assert.equal(w.upcomingHint(doc({13:'none',20:'snow'}),now),'','Beyond 6 hours: no header hint');
assert.equal(w.upcomingHint(doc({15:'mixed'}),now),'오늘 오후 3시경 비·눈 예보');
assert.equal(w.upcomingHint(doc({15:'rain'}),now,{effect:'rain'}),'','Already raining: the effect shows it');
assert.equal(w.upcomingHint(null,now),'','No forecast: nothing');
const html=asset('index.html');
assert(/<button id="headerForecastHint"[^>]*hidden[^>]*onclick="switchPage\('overview'\)"/.test(html),'Hint starts hidden and opens 오늘 요약');
const brief=asset('weather-briefing.js');
assert(brief.includes("weatherMode?.()==='auto'"),'Hint only when 송도 날씨 자동 is on');
assert(!/data-weather-effect/.test(brief),'Forecast never sets the rain/snow effect');
console.log('Season/weather extras passed: peak scenes, particle budget, one-tap auto preset, header forecast hint.');
