'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),root=path.join(__dirname,'..'),asset=p=>fs.readFileSync(path.join(root,'app/src/main/assets',p),'utf8');
const elements=new Map(),storage=new Map(),events={};
function node(){return {attrs:{},children:[],textContent:'',value:'',style:{setProperty(){}},
 setAttribute(k,v){this.attrs[k]=v},appendChild(c){this.children.push(c)},replaceChildren(){this.children=[]}}}
const body=node();
const context={role:'admin',document:{body,hidden:false,createElement:node,
 getElementById(id){if(!elements.has(id))elements.set(id,node());return elements.get(id)},
 addEventListener(k,f){events[k]=f}},window:{addEventListener(){},setInterval(){}},
 localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},
 setTimeout,clearTimeout,AbortController,Date,confirm:()=>true};
vm.createContext(context);vm.runInContext(asset('admin-preferences.js'),context);
vm.runInContext(asset('season-themes.js'),context);
const prefs=context.window.FirstHyundaiUIOptions,api=context.window.FirstHyundaiThemes;
assert.equal(prefs.get().theme,'default');assert.equal(prefs.get().weatherEffect,'none');
assert.equal(body.attrs['data-season-theme'],'default');assert.equal(body.children[0].children.length,0);
const themeList=['default','spring','summer','autumn','winter'];
for(const t of themeList)for(const w of ['none','rain','snow']){
 assert(prefs.set('theme',t));assert(prefs.set('weatherEffect',w));
 assert.equal(body.attrs['data-season-theme'],t);assert.equal(body.attrs['data-weather-effect'],w);
 assert.equal(body.children.length,1,'One inert decoration layer, never duplicate layers');
 assert.equal(body.children[0].attrs['aria-hidden'],'true');
 assert(body.children[0].children.length<=48);
}
for(const key of ['themeHeader','themeIntro','themeLogo','themeCaption']){
 assert(prefs.set(key,'off'));assert.equal(prefs.get()[key],'off');assert(prefs.set(key,'on'));
}
for(const intensity of ['soft','balanced','vivid']){
 assert(prefs.set('themeIntensity',intensity));assert.equal(body.attrs['data-theme-intensity'],intensity);
}
assert(prefs.set('themeDecor','off'));assert.equal(body.children[0].children.length,0);
assert(prefs.set('themeDecor','full'));assert(body.children[0].children.length>0);
assert.notDeepEqual(api._test.headerPalette('spring','soft'),api._test.headerPalette('spring','vivid'));
// Time-of-day tints use the Korean local clock, not UTC or GPS.
const local=s=>Date.parse('2026-10-29T'+s+':00+09:00');
for(const [time,mood] of [['04:59','night'],['05:00','morning'],
 ['09:59','morning'],['10:00','day'],['16:59','day'],
 ['17:00','evening'],['19:59','evening'],['20:00','night']])
 assert.equal(api._test.timeMood(local(time)),mood,time+' Korean seasonal ambient');
const morning=api._test.ambientPalette('autumn','balanced',local('07:00'));
const evening=api._test.ambientPalette('autumn','balanced',local('18:00'));
assert.notDeepEqual(morning,evening,'Warm daylight differs from sunset');
assert.equal(morning.length,3);
assert.equal(body.attrs['data-theme-time'],api._test.timeMood());
const observed=(mm,stamp=Date.now())=>({status:'ok',effect:'rain',
 observed_at:new Date(stamp).toISOString(),precip_mm:mm});
assert.equal(api._test.rainStrength('rain',observed(0.1)),'light');
assert.equal(api._test.rainStrength('rain',observed(1)),'normal');
assert.equal(api._test.rainStrength('rain',observed(3)),'heavy');
assert.equal(api._test.rainStrength('rain',observed(null)),'normal');
assert.equal(api._test.rainStrength('snow',observed(9)),'normal',
 'Do not infer snowfall strength from rain-water equivalent');
assert.equal(api._test.rainStrength('rain',observed(9,Date.now()-7200001)),'normal',
 'Stale measurements must not produce exaggerated rain');
assert(body.attrs['data-weather-strength']==='normal');
assert(!asset('season-themes.js').includes("className='seasonLogo'"),
 'Already implemented logo graphics must not be duplicated');
assert.equal(prefs.set('theme','rain'),false,'Rain is an overlay, not a sixth base theme');
assert.equal(prefs.set('weatherEffect','lightning'),false);
assert(prefs.set('themeMode','season'));assert.equal(body.attrs['data-season-theme'],api._test.season());
assert(prefs.set('theme','winter'));assert.equal(prefs.get().themeMode,'manual');
prefs.set('themeMode','season');prefs.set('theme','winter');assert.equal(prefs.get().themeMode,'manual','Same choice exits auto too');
const kst=s=>Date.parse(s+'T00:00:00+09:00');
assert.equal(api._test.season(kst('2026-02-03')),'winter');
assert.equal(api._test.season(kst('2026-02-04')),'spring');
assert.equal(api._test.season(kst('2026-05-04')),'spring');
assert.equal(api._test.season(kst('2026-05-05')),'summer');
assert.equal(api._test.season(kst('2026-08-06')),'summer');
assert.equal(api._test.season(kst('2026-08-07')),'autumn');
assert.equal(api._test.season(kst('2026-11-07')),'winter');
assert.equal(api._test.season(kst('2027-01-01')),'winter');
// Compare every annual boundary at its day before and the Korean midnight.
for(let year=2026;year<=2040;year++){
 const dates=api._test.terms(year);
 dates.forEach((time,i)=>{
  assert.equal(api._test.season(time-1),i===0?'winter':themeList[i]);
  assert.equal(api._test.season(time),themeList[i+1]);
  assert.equal((time+9*3600000)%86400000,0,'KST calendar-day transition');
 });
}
const now=Date.now(),valid={status:'ok',effect:'rain',observed_at:new Date(now).toISOString()};
assert(api._test.fresh(valid));assert(!api._test.fresh({...valid,observed_at:new Date(now-7200001).toISOString()}));
assert(!api._test.fresh({...valid,observed_at:new Date(now+300001).toISOString()},now));
context.document.hidden=true;events.visibilitychange();assert.equal(body.attrs['data-theme-paused'],'true');
const backup=prefs._test.backupValue();context.role='family';
assert.equal(prefs.set('theme','summer'),false);assert.equal(prefs.set('weatherEffect','rain'),false);
assert(prefs.applyShared({...backup,preferences:{...backup.preferences,theme:'spring',weatherEffect:'snow'}}));
assert.equal(body.attrs['data-season-theme'],'spring');assert.equal(body.attrs['data-weather-effect'],'snow');
const legacy={...backup,preferences:{schema:1,start:'nearby',density:'standard',reading:'standard',motion:'full',contrast:'standard'}};
assert(prefs.applyShared(legacy));assert.equal(prefs.get().theme,'default');
const css=asset('season-themes.css');
for(const kind of ['spring','summer','autumn','winter','rain','snow']){
 assert(asset('season-point-'+kind+'.svg').includes('viewBox="0 0 24 24"'));
 assert(css.includes('season-point-'+kind+'.svg'));
}
assert.equal(prefs.get().themeCaption,'on','Old settings default to showing the seasonal caption');
for(const block of css.matchAll(/body\[data-season-theme[^{}]*\{([^{}]*)\}/g))
 assert(!/(?:^|;)\s*(?:font|width|height|padding|margin|display|position|order|gap|grid|transform)\b/.test(block[1]),'Season rules change appearance only');
assert(css.includes('pointer-events:none!important')&&css.includes('prefers-reduced-motion:reduce'));
const html=asset('index.html');assert.equal((html.match(/id="adminTheme"/g)||[]).length,1);
console.log('Season themes: 5 bases × 3 overlays, permissions, shared settings, legacy backups, KST term boundaries, stale weather and inert decoration passed.');

