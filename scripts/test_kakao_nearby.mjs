// Offline integration regression for a private, no-cache Kakao Local proxy.
import assert from "node:assert/strict";
import handler from "../workers/kakao-nearby/src/index.mjs";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../app/src/main/assets/index.html",import.meta.url),"utf8");
assert.match(src,/\['nearby','주변시설'\]/);
assert.match(src,/refreshNearbyConfig\(\)/);
const config=JSON.parse(readFileSync(new URL("../data/nearby_config.json",import.meta.url),"utf8"));
const wrangler=readFileSync(new URL("../workers/kakao-nearby/wrangler.toml",import.meta.url),"utf8");
const workerName=wrangler.match(/^name\s*=\s*"([^"]+)"/m)?.[1];
assert(workerName,"Worker name must be explicit in wrangler.toml");
assert.equal(config.backend_url,"https://"+workerName+".jwj2477.workers.dev",
 "App backend address must match the actual Cloudflare Wrangler deployment");
assert(src.includes("return url==='"+config.backend_url+"'")||src.includes('return url==='+JSON.stringify(config.backend_url)),
 "Android WebView URL safety allowlist and cloud backend URL must match exactly");
const native=readFileSync(new URL("../app/src/main/java/kr/co/firsthyundai/app/MainActivity.java",import.meta.url),"utf8");
// A prior build validated the WebView URL but left a stale hard-coded native
// allowlist. Both sides MUST point to the deployed Worker.
const allowlist=native.match(/@JavascriptInterface public void fetchNearby\([\s\S]*?if\(workerUrl==null \|\| !"(https:\/\/[^\"]+)"\.equals\(workerUrl\)/)?.[1];
assert.equal(allowlist,config.backend_url,
 "Native Android URL allowlist MUST equal the verified backend URL in nearby_config.json");
assert(!native.includes("https://firsthyundai-kakao.jwj2477.workers.dev"),
 "No defunct Cloudflare Worker hostname may remain in Android binary");
assert(native.includes('"주변시설 서비스 주소 또는 요청 형식이 잘못되었습니다."'),
 "Fail closed for unrecognized URLs or request parameters");
assert(!src.includes("https://firsthyundai-kakao.jwj2477.workers.dev"),
 "Remove defunct Worker host from built Android app");
assert.match(src,/window\.FirstHyundaiNative\.fetchNearby/);
assert.match(src,/카카오맵에서/);
assert.doesNotMatch(src,/localStorage\.setItem\(['"]kakao/i);
let calls=[];
const oldFetch=globalThis.fetch;
globalThis.fetch=async (request,options={})=>{
  const url=String(request);calls.push({url,auth:options.headers?.Authorization||""});
  const data=url.includes("complexes.json")?
    {schema_version:1,records:[{id:"f13",label:"퍼스트파크 F13",address:"인천광역시 연수구 컨벤시아대로252번길 70"},{id:"hidden",aggregate_only:true,address:"인천광역시 연수구 송도동"}]}:
    url.includes("/search/address.json")?{documents:[{x:"126.647",y:"37.389"}]}:
    url.includes("/search/category.json")?{documents:[{place_name:"테스트병원",distance:"330",road_address_name:"인천 연수구 테스트로",place_url:"http://place.map.kakao.com/16618597"}]}:{};
  return new Response(JSON.stringify(data),{status:200,headers:{"Content-Type":"application/json"}});
};
const env={KAKAO_REST_API_KEY:"fake-secret-do-not-publish",NEARBY_RATE_LIMITER:{limit:async()=>({success:true})}};
const hit=(path)=>handler.fetch(new Request("https://firsthyundai-nearby.demo.workers.dev"+path),env);
try{
  assert.equal((await hit("/nearby?complex=f13&category=bad")).status,400);
  assert.equal((await hit("/nearby/f13/bad")).status,400);
  assert.equal((await hit("/nearby?complex=hidden&category=HP8")).status,404);
  assert.equal((await hit("/nearby/hidden/HP8")).status,404);
  assert.equal((await hit("/nearby/f13/HP8")).status,200);
  const r=await hit("/nearby?complex=f13&category=HP8");
  assert.equal(r.status,200);
  const obj=await r.json();
  assert.equal(obj.places[0].name,"테스트병원");
  assert.equal(obj.places[0].distance_m,330);
  assert.match(obj.places[0].url,/^https:\/\/place\.map\.kakao\.com\//);
  assert.equal(r.headers.get("Cache-Control"),"no-store, max-age=0");
  assert(!JSON.stringify(obj).includes(env.KAKAO_REST_API_KEY));
  assert(calls.some(x=>x.auth==="KakaoAK "+env.KAKAO_REST_API_KEY));
  assert(!calls.some(x=>x.url.includes("complexes.json")), "Worker must not depend on live GitHub catalog fetch");
  assert.equal((await handler.fetch(new Request("https://firsthyundai-nearby.demo.workers.dev/nearby?complex=f13&category=HP8"),
    {...env,NEARBY_RATE_LIMITER:{limit:async()=>({success:false})}})).status,429);
  assert.equal((await handler.fetch(new Request("https://firsthyundai-nearby.demo.workers.dev/nearby?complex=f13&category=HP8"),
    {...env,KAKAO_REST_API_KEY:""})).status,503);
  globalThis.fetch=async()=>{throw new Error("network unavailable");};
  const failed=await hit("/nearby/f13/HP8");
  assert.equal(failed.status,502);
  const diagnostic=await failed.json();
  assert.equal(diagnostic.stage,"kakao_address");
  assert.equal(diagnostic.reason,"network_error");
  assert(!JSON.stringify(diagnostic).includes(env.KAKAO_REST_API_KEY));
  globalThis.fetch=async()=>new Response("",{status:403});
  const forbidden=await (await hit("/nearby/f13/HP8")).json();
  assert.equal(forbidden.stage,"kakao_address");
  assert.equal(forbidden.reason,"http_403");
  globalThis.fetch=async()=>new Response("",{status:302,headers:{Location:"https://example.com/"}});
  const redirected=await (await hit("/nearby/f13/HP8")).json();
  assert.equal(redirected.reason,"redirect_302");
  console.log("Kakao live nearby: embedded public addresses, no-cache, secret isolation, mobile route and failure diagnostics passed.");
}finally{globalThis.fetch=oldFetch;}
