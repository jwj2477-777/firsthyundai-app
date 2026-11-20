/* Decorative themes only. Never move, resize, hide or activate a business control. */
(function(){
 'use strict';
 const THEMES=['default','spring','summer','autumn','winter'];
 const WEATHER=['none','rain','snow','auto'];
 const ENDPOINT='https://firsthyundai-shared-settings.jwj2477.workers.dev/theme-weather';
 const labels={default:'기본',spring:'봄',summer:'여름',autumn:'가을',winter:'겨울'};
 const HOUR=3600000, cache=new Map();
 const headerBase=['#102D38','#183E49','#23575D'];
 const headerColors={spring:['#4D354E','#704B65','#765864'],summer:['#073E55','#086B7B','#0F6A66'],
  autumn:['#51352D','#784E32','#79532B'],winter:['#232F50','#35476D','#4B557E']};
 function blend(a,b,k){return '#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-k)+parseInt(b.slice(i,i+2),16)*k).toString(16).padStart(2,'0')).join('')}
 function headerPalette(theme,strength){const k={soft:.4,balanced:.8,vivid:1}[strength]??.8;return headerColors[theme]?.map((c,i)=>blend(headerBase[i],c,k))||headerBase}
 // A subtle layer of natural light; intentionally no change to buttons, icon,
 // business labels or existing seasonal logo art. Local Korean clock, no GPS.
 function timeMood(now=Date.now()){
  const hour=new Date(now+9*HOUR).getUTCHours();
  return hour>=5&&hour<10?'morning':hour>=10&&hour<17?'day':
   hour>=17&&hour<20?'evening':'night';
 }
 const ambientTints={
  morning:['#E7AD83',.095],day:['#A8D7DC',.025],
  evening:['#DC947A',.105],night:['#7885B2',.075]
 };
 function ambientPalette(theme,strength,now=Date.now()){
  const [tint,mix]=ambientTints[timeMood(now)];
  return headerPalette(theme,strength).map(c=>blend(c,tint,mix));
 }
 // v2.1.98: short "peak" scenes inside a season (approximate Incheon climatology,
 // decoration only): cherry blossoms in early April, autumn leaves late Oct–early Nov.
 function seasonPeak(base,now=Date.now()){
  const d=new Date(now+9*HOUR),md=(d.getUTCMonth()+1)*100+d.getUTCDate();
  if(base==='spring'&&md>=401&&md<=414)return 'blossom';
  if(base==='autumn'&&md>=1020&&md<=1110)return 'foliage';
  return '';
 }
 // Fewer moving particles when the phone is saving power, low on battery or modest.
 // Business controls never change; only decoration is reduced.
 let battery=null;
 try{
  if(typeof navigator!=='undefined'&&navigator.getBattery)navigator.getBattery().then(b=>{
   battery=b;b.addEventListener?.('levelchange',paint);b.addEventListener?.('chargingchange',paint);paint();
  }).catch(()=>{});
 }catch(e){}
 function particleBudget(env={}){
  let saver=env.saver;
  if(saver===undefined){try{saver=!!window.FirstHyundaiNative?.isPowerSaveMode?.()}catch(e){saver=false}}
  if(saver)return {factor:0,reason:'saver'};
  const bat=env.battery!==undefined?env.battery:battery;
  if(bat&&!bat.charging&&Number(bat.level)<=.15)return {factor:.5,reason:'battery'};
  const nav=env.navigator!==undefined?env.navigator:(typeof navigator!=='undefined'?navigator:{});
  const memory=Number(nav?.deviceMemory),cores=Number(nav?.hardwareConcurrency);
  if((memory>0&&memory<=2)||(cores>0&&cores<=2))return {factor:.6,reason:'device'};
  return {factor:1,reason:''};
 }
 function rainStrength(wet,measured){
  if(wet!=='rain'||!fresh(measured)||!Number.isFinite(measured.precip_mm))return 'normal';
  return measured.precip_mm<.5?'light':measured.precip_mm>=3?'heavy':'normal';
 }
 let options={theme:'default',themeMode:'manual',weatherEffect:'none',motion:'full'};
 let nativeSnapshot='',weather=null,lastAttempt=0,pending=false,generation=0,layer=null,lastScene='',sequence=0;
 const requests=new Map();
 window.onFirstHyundaiThemeWeatherFetched=result=>{
  const call=requests.get(result?.requestId);if(!call)return;requests.delete(result.requestId);
  result.ok?call.resolve(result.payload):call.reject(Error('weather unavailable'));
 };
 function requestNative(){
  return new Promise((resolve,reject)=>{
   const id='theme'+(++sequence),timer=setTimeout(()=>{requests.delete(id);reject(Error('weather timeout'))},20000);
   requests.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject:e=>{clearTimeout(timer);reject(e)}});
   try{window.FirstHyundaiNative.fetchThemeWeather(id)}catch(e){clearTimeout(timer);requests.delete(id);reject(e)}
  });
 }
 // US Naval Observatory apparent solar longitude approximation (about 1 arcminute).
 // https://aa.usno.navy.mil/faq/sun_approx . Only the Korean calendar DAY is used:
 // switch at 00:00 KST on 입춘/입하/입추/입동, never fixed Gregorian dates.
 function longitude(ms){
  const d=ms/86400000+2440587.5-2451545,g=(357.529+.98560028*d)*Math.PI/180;
  return ((280.459+.98564736*d+1.915*Math.sin(g)+.020*Math.sin(2*g))%360+360)%360;
 }
 function terms(year){
  if(cache.has(year))return cache.get(year);
  const targets=[315,45,135,225], months=[1,4,7,10];
  const result=targets.map((target,i)=>{
   let lo=Date.UTC(year,months[i],1),hi=Date.UTC(year,months[i],12);
   for(let n=0;n<36;n++){
    const mid=(lo+hi)/2,diff=((longitude(mid)-target+540)%360)-180;
    if(diff<0)lo=mid;else hi=mid;
   }
   const kst=new Date(hi+9*HOUR);
   return Date.UTC(kst.getUTCFullYear(),kst.getUTCMonth(),kst.getUTCDate())-9*HOUR;
  });
  cache.set(year,result);return result;
 }
 // v2.2.2: the 24 solar terms (절기) by the same solar longitude, on Korean calendar
 // days: the term of a KST day is the sun's 15° sector at that day's end.
 const TERM_NAMES=['춘분','청명','곡우','입하','소만','망종','하지','소서','대서','입추','처서','백로',
  '추분','한로','상강','입동','소설','대설','동지','소한','대한','입춘','우수','경칩'];
 function solarTerm(now=Date.now()){
  const k=new Date(now+9*HOUR),start=Date.UTC(k.getUTCFullYear(),k.getUTCMonth(),k.getUTCDate())-9*HOUR;
  const at=ms=>Math.floor(longitude(ms)/15)%24;
  const today=at(start+86400000-1),before=at(start-1);
  return {name:TERM_NAMES[today],today:today!==before};
 }
 // v2.2.2: two fixed-date occasions only (no lunar calendar guessing).
 function occasion(now=Date.now()){
  const k=new Date(now+9*HOUR),md=(k.getUTCMonth()+1)*100+k.getUTCDate();
  if(md>=101&&md<=103)return 'newyear';
  if(md>=1224&&md<=1225)return 'christmas';
  return '';
 }
 function season(now=Date.now()){
  const year=new Date(now+9*HOUR).getUTCFullYear(),days=terms(year);
  let name='winter';days.forEach((day,i)=>{if(now>=day)name=THEMES[i+1]});return name;
 }
 function fresh(value,now=Date.now()){
  const time=Date.parse(value?.observed_at);
  return value?.status==='ok'&&['none','rain','snow'].includes(value.effect)&&
   Number.isFinite(time)&&now-time<=2*HOUR&&time-now<=5*60000;
 }
 function effect(){return options.weatherEffect==='auto'?(fresh(weather)?weather.effect:'none'):options.weatherEffect}
 function status(){
  const node=document.getElementById('adminThemeStatus');if(!node)return;
  const base=options.themeMode==='season'?season():options.theme;
  let text=labels[base]+' · '+({none:'날씨 효과 없음',rain:'비',snow:'눈'}[effect()]||'');
  if(options.themeMode==='season')text+=' · 절기 자동';
  if(options.weatherEffect==='auto')text+=fresh(weather)?' · 송도 '+weather.observed_at.slice(11,16)+' 기준':
   ' · 송도 날씨 확인 대기, 계절 테마 유지';
  node.textContent=text;
 }
 function paint(){
  if(!document.body)return;
  const now=Date.now();
  const base=options.themeMode==='season'?season(now):options.theme,wet=effect();
  const mood=timeMood(now),strength=options.weatherEffect==='auto'?rainStrength(wet,weather):'normal';
  document.body.setAttribute('data-theme-time',mood);
  document.body.setAttribute('data-weather-strength',strength);
  document.body.setAttribute('data-season-theme',base);
  document.body.setAttribute('data-weather-effect',wet);
  const peak=wet==='none'?seasonPeak(base,now):'',budget=particleBudget();
  document.body.setAttribute('data-season-peak',peak);
  document.body.setAttribute('data-theme-budget',budget.reason||'full');
  document.body.setAttribute('data-theme-occasion',occasion(now));
  document.body.setAttribute('data-theme-paused',document.hidden?'true':'false');
  document.body.setAttribute('data-theme-intensity',options.themeIntensity);
  document.body.setAttribute('data-theme-decor',options.themeDecor);
  document.body.setAttribute('data-theme-header',options.themeHeader);
  document.body.setAttribute('data-theme-intro',options.themeIntro);
  document.body.setAttribute('data-theme-logo',options.themeLogo);
  const header=document.querySelector?.('header');
  document.body.style?.setProperty('--theme-header-bottom',Math.max(0,header?.getBoundingClientRect?.().bottom||0)+'px');
  const colors=ambientPalette(base,options.themeIntensity,now);
  document.body.style?.setProperty('--season-header',`linear-gradient(121deg,${colors[0]} 0%,${colors[1]} 57%,${colors[2]} 100%)`);
  const nativeValue=JSON.stringify({...options,resolvedTheme:base,weatherObserved:weather?.observed_at||'',resolvedWeather:wet});
  if(nativeValue!==nativeSnapshot){
   try{window.FirstHyundaiNative?.cacheThemeAppearance?.(nativeValue);nativeSnapshot=nativeValue}catch(e){}
  }
  const scene=base+'/'+wet+'/'+strength+'/'+options.themeDecor+'/'+peak+'/'+budget.factor;
  if(scene!==lastScene){
   if(!layer){
    layer=document.createElement('div');layer.id='seasonAtmosphere';
    layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
    document.body.appendChild(layer);
   }
   layer.replaceChildren();
   const kind=wet!=='none'?wet:base;
   const amount=kind==='rain'?({light:18,normal:32,heavy:46}[strength]||32):
    {default:0,spring:peak==='blossom'?30:20,summer:14,autumn:peak==='foliage'?30:22,winter:18,snow:30}[kind];
   const decor=options.themeDecor==='off'?0:options.themeDecor==='subtle'?Math.ceil(amount/2):amount;
   const count=Math.round(decor*budget.factor);
   for(let i=0;i<count;i++){
    const part=document.createElement('i');part.className='seasonParticle '+kind;
    part.style.setProperty('--x',(i%2?(84+(i*13%150)/10):(i*17%150)/10)+'vw');
    part.style.setProperty('--delay',-(i*2.7)+'s');
    part.style.setProperty('--duration',(kind==='rain'?
     (strength==='light'?1.85:strength==='heavy'?.9:1.35)+(i%4)*.16:
     kind==='snow'?13+(i*7%14):15+(i*7%18))+'s');
    part.style.setProperty('--s',(.65+(i%4)*.17).toFixed(2));
    layer.appendChild(part);
   }
   lastScene=scene;
  }
  status();
 }
 async function refresh(includeObserved=false){
  if((options.weatherEffect!=='auto'&&!includeObserved)||document.hidden||pending||Date.now()-lastAttempt<5*60000)return;
  lastAttempt=Date.now();pending=true;const mine=generation;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{
   let value;
   if(window.FirstHyundaiNative?.fetchThemeWeather)value=await requestNative();
   else{
    const response=await fetch(ENDPOINT,{cache:'no-store',signal:controller.signal});
    if(!response.ok)throw Error('weather unavailable');
    value=await response.json();
   }
   if(mine===generation)weather=fresh(value)?value:null;
  }catch(e){if(mine===generation&&!fresh(weather))weather=null}
  finally{clearTimeout(timer);pending=false;paint();document.dispatchEvent?.(new Event('firsthyundai-observed-weather'))}
 }
 function configure(value){
  const previous=options.weatherEffect;
  options={theme:THEMES.includes(value?.theme)?value.theme:'default',
   themeMode:value?.themeMode==='season'?'season':'manual',
   weatherEffect:WEATHER.includes(value?.weatherEffect)?value.weatherEffect:'none',motion:value?.motion||'full',
   themeIntensity:['soft','balanced','vivid'].includes(value?.themeIntensity)?value.themeIntensity:'balanced',
   themeDecor:['off','subtle','full'].includes(value?.themeDecor)?value.themeDecor:'full',
   themeHeader:value?.themeHeader==='off'?'off':'on',themeIntro:value?.themeIntro==='off'?'off':'on',themeLogo:value?.themeLogo==='off'?'off':'on',themeCaption:value?.themeCaption==='off'?'off':'on'};
  if(previous!==options.weatherEffect){generation++;lastAttempt=0}
  paint();refresh();
  try{document.dispatchEvent?.(new Event('firsthyundai-theme-configured'))}catch(e){}
 }
 window.FirstHyundaiThemes={configure,refresh,refreshObserved:()=>refresh(true),currentWeather:()=>fresh(weather)?weather:null,weatherMode:()=>options.weatherEffect,solarTerm,occasion,
  _test:{terms,season,fresh,longitude,headerPalette,timeMood,ambientPalette,rainStrength,seasonPeak,particleBudget,solarTerm,occasion}};
 document.addEventListener('visibilitychange',()=>{paint();if(!document.hidden)refresh()});
 window.addEventListener('focus',()=>{paint();refresh()});
 window.addEventListener('resize',paint);
 window.addEventListener('scroll',()=>{if(options.themeHeader==='off')paint()},{passive:true});
 // Hidden app: nothing to repaint; the visibilitychange handler catches up on return.
 window.setInterval(()=>{if(!document.hidden){paint();refresh()}},60000);
 configure(window.FirstHyundaiUIOptions?.get?.());
})();

