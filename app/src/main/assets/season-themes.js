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
  const base=options.themeMode==='season'?season():options.theme,wet=effect();
  document.body.setAttribute('data-season-theme',base);
  document.body.setAttribute('data-weather-effect',wet);
  document.body.setAttribute('data-theme-paused',document.hidden?'true':'false');
  document.body.setAttribute('data-theme-intensity',options.themeIntensity);
  document.body.setAttribute('data-theme-decor',options.themeDecor);
  document.body.setAttribute('data-theme-header',options.themeHeader);
  document.body.setAttribute('data-theme-intro',options.themeIntro);
  document.body.setAttribute('data-theme-logo',options.themeLogo);
  const header=document.querySelector?.('header');
  document.body.style?.setProperty('--theme-header-bottom',Math.max(0,header?.getBoundingClientRect?.().bottom||0)+'px');
  const colors=headerPalette(base,options.themeIntensity);
  document.body.style?.setProperty('--season-header',`linear-gradient(121deg,${colors[0]} 0%,${colors[1]} 57%,${colors[2]} 100%)`);
  const nativeValue=JSON.stringify({...options,resolvedTheme:base,weatherObserved:weather?.observed_at||'',resolvedWeather:wet});
  if(nativeValue!==nativeSnapshot){
   try{window.FirstHyundaiNative?.cacheThemeAppearance?.(nativeValue);nativeSnapshot=nativeValue}catch(e){}
  }
  const scene=base+'/'+wet+'/'+options.themeDecor;
  if(scene!==lastScene){
   if(!layer){
    layer=document.createElement('div');layer.id='seasonAtmosphere';
    layer.setAttribute('aria-hidden','true');layer.setAttribute('inert','');
    document.body.appendChild(layer);
   }
   layer.replaceChildren();
   const kind=wet!=='none'?wet:base;
   const amount={default:0,spring:20,summer:14,autumn:22,winter:18,rain:48,snow:36}[kind];
   const count=options.themeDecor==='off'?0:options.themeDecor==='subtle'?Math.ceil(amount/2):amount;
   for(let i=0;i<count;i++){
    const part=document.createElement('i');part.className='seasonParticle '+kind;
    part.style.setProperty('--x',(i%2?(84+(i*13%150)/10):(i*17%150)/10)+'vw');
    part.style.setProperty('--delay',-(i*2.7)+'s');
    part.style.setProperty('--duration',(kind==='rain'?1.2+(i%4)*.17:15+(i*7%18))+'s');
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
 }
 window.FirstHyundaiThemes={configure,refresh,refreshObserved:()=>refresh(true),currentWeather:()=>fresh(weather)?weather:null,_test:{terms,season,fresh,longitude,headerPalette}};
 document.addEventListener('visibilitychange',()=>{paint();if(!document.hidden)refresh()});
 window.addEventListener('focus',()=>{paint();refresh()});
 window.addEventListener('resize',paint);
 window.addEventListener('scroll',()=>{if(options.themeHeader==='off')paint()},{passive:true});
 window.setInterval(()=>{paint();refresh()},60000);
 configure(window.FirstHyundaiUIOptions?.get?.());
})();

