/* Publish public Songdo weather only. Keys stay in Actions Secrets. */
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {normalizeKmaKey} from '../workers/shared-settings/src/kma-key.mjs';
import {fromKma} from '../workers/shared-settings/src/theme-weather.mjs';
import {forecastBase,parseForecast} from '../workers/shared-settings/src/weather-forecast.mjs';
import {validWeatherSnapshot} from '../workers/shared-settings/src/weather-snapshot.mjs';
const secret=normalizeKmaKey(process.env.DATA_GO_KR_SERVICE_KEY);
if(!secret)throw Error('Official weather service key is not configured');
const now=Date.now(),file='data/songdo_weather.json';
let previous={};try{previous=JSON.parse(fs.readFileSync(file,'utf8'))}catch(e){}
// urllib is the same successful provider connection used by the live permission
// check. The private URL is passed on stdin, never argv, logs or public files.
const python=`import sys,json,urllib.request,urllib.error
request=json.load(sys.stdin)
try:
    with urllib.request.urlopen(urllib.request.Request(request['url'],headers={'Accept':'application/json'}),timeout=15) as stream:
        value=json.load(stream)
    print(json.dumps({'ok':True,'data':value}))
except urllib.error.HTTPError as error:
    print(json.dumps({'ok':False,'code':error.code}))
except Exception:
    print(json.dumps({'ok':False,'code':'unavailable'}))
`;
function request(endpoint,base){
 const url=new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/'+endpoint);
 url.search=new URLSearchParams({serviceKey:secret,pageNo:'1',numOfRows:'1000',dataType:'JSON',base_date:base.date,base_time:base.time,nx:'55',ny:'123'});
 const result=spawnSync('python3',['-c',python],{input:JSON.stringify({url:url.href}),encoding:'utf8',timeout:20000,maxBuffer:2*1024*1024});
 if(result.status!==0)throw Error('weather_request_failed');
 const answer=JSON.parse(result.stdout);if(!answer.ok)throw Error('weather_request_failed');
 return answer.data;
}
let observed=null,forecast=null;
try{
 const local=new Date(now+9*3600000-40*60000);
 const base={date:local.toISOString().slice(0,10).replace(/-/g,''),time:String(local.getUTCHours()).padStart(2,'0')+'00'};
 observed=fromKma(request('getUltraSrtNcst',base),now);
 console.log('OFFICIAL_SONGDO_OBSERVED_VERIFIED',observed.observed_at,observed.effect);
}catch(e){console.log('OFFICIAL_SONGDO_OBSERVED_PENDING');if(/^[a-z_]+$/.test(e.message))console.log('OFFICIAL_WEATHER_REASON',e.message);if(validWeatherSnapshot(previous.observed,'observed',now))observed=previous.observed}
try{
 const base=forecastBase(now);forecast=parseForecast(request('getVilageFcst',base),base,now);
 console.log('OFFICIAL_SONGDO_FORECAST_VERIFIED',forecast.issued_at,forecast.hours.length);
}catch(e){console.log('OFFICIAL_SONGDO_FORECAST_PENDING');if(/^[a-z_]+$/.test(e.message))console.log('OFFICIAL_WEATHER_REASON',e.message);if(validWeatherSnapshot(previous.forecast,'forecast',now))forecast=previous.forecast}
if(!observed&&!forecast)throw Error('No verified weather data; previous file left unchanged');
fs.mkdirSync('data',{recursive:true});
fs.writeFileSync(file,JSON.stringify({schema:1,status:observed&&forecast?'ok':'partial',checked_at:new Date(now).toISOString(),observed,forecast},null,2)+'\n');
