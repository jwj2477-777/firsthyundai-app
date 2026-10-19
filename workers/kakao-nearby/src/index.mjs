// FirstHyundai Kakao Local live proxy.
// No Kakao POI results are persisted or cached; each request queries Kakao live.
const CATALOG = "https://raw.githubusercontent.com/jwj2477-777/firsthyundai-app/main/data/complexes.json";
const ALLOWED = new Set(["SC4","PS3","HP8","PM9","MT1","CS2","SW8","BK9","CE7","AC5"]);
const KAKAO = "https://dapi.kakao.com/v2/local/";
const HEADERS = {
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store, max-age=0",
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Methods":"GET, OPTIONS",
  "Access-Control-Allow-Headers":"Content-Type",
  "X-Content-Type-Options":"nosniff",
};
function answer(body,status=200) {
  return new Response(JSON.stringify(body),{status,headers:HEADERS});
}
async function readJson(url,init) {
  const response=await fetch(url,{...init,redirect:"error",cache:"no-store",
    signal:AbortSignal.timeout(9000)});
  if(!response.ok)throw Error("upstream_http_"+response.status);
  const body=await response.text();
  if(body.length>400000)throw Error("upstream_size_limit");
  return JSON.parse(body);
}
function validCoordinate(x,y) {
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=126.45&&x<=126.80&&y>=37.28&&y<=37.52;
}
function placeLink(url) {
  try {
    const u=new URL(url);
    return u.hostname==="place.map.kakao.com"&&["http:","https:"].includes(u.protocol)
      ? "https://place.map.kakao.com"+u.pathname : "";
  } catch {return "";}
}
export default {
  async fetch(request,env) {
    if(request.method==="OPTIONS")return new Response(null,{status:204,headers:HEADERS});
    if(request.method!=="GET")return answer({error:"method_not_allowed"},405);
    const url=new URL(request.url);
    if(url.pathname==="/health")return answer({ok:true,service:"firsthyundai-nearby",ready:!!env.KAKAO_REST_API_KEY});
    // Accept path parameters as well: /nearby/f13/MT1 is reliable in mobile chat browsers.
    const pathParts=url.pathname.split("/").filter(Boolean);
    const pathLookup=pathParts.length===3&&pathParts[0]==="nearby";
    if(url.pathname!=="/nearby"&&!pathLookup)return answer({error:"not_found"},404);
    const id=pathLookup?pathParts[1]:(url.searchParams.get("complex")||"");
    const cat=pathLookup?pathParts[2]:(url.searchParams.get("category")||"");
    if(!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||!ALLOWED.has(cat)||
       [...url.searchParams.keys()].some(k=>!["complex","category"].includes(k)))
      return answer({error:"invalid_parameters"},400);
    if(!env.KAKAO_REST_API_KEY||!env.NEARBY_RATE_LIMITER)
      return answer({error:"not_configured"},503);
    // Conservative per-Cloudflare-location limiter; keep paid usage disabled and monitor quota.
    const quota=await env.NEARBY_RATE_LIMITER.limit({key:"firsthyundai-live-lookup"});
    if(!quota.success)return answer({error:"rate_limited",message:"조회가 많아 잠시 후 다시 시도해 주세요."},429);
    let stage="catalog";
    try {
      const catalog=await readJson(CATALOG);
      if(catalog.schema_version!==1||!Array.isArray(catalog.records))throw Error("catalog_invalid");
      const complex=catalog.records.find(p=>p.id===id&&!p.aggregate_only);
      const address=String(complex?.address||"");
      if(!complex||address.length<10||address.length>160||!address.includes("연수구"))
        return answer({error:"address_unavailable"},404);
      const headers={"Authorization":"KakaoAK "+env.KAKAO_REST_API_KEY,"Accept":"application/json"};
      const addrUrl=new URL(KAKAO+"search/address.json");
      addrUrl.search=new URLSearchParams({query:address,size:"1"}).toString();
      stage="kakao_address";
      const geo=await readJson(addrUrl.toString(),{headers});
      const point=geo.documents?.[0];
      const x=Number(point?.x),y=Number(point?.y);
      if(!validCoordinate(x,y))return answer({error:"address_unverified"},422);
      const poiUrl=new URL(KAKAO+"search/category.json");
      poiUrl.search=new URLSearchParams({
        category_group_code:cat,x:String(x),y:String(y),
        radius:"1500",size:"10",sort:"distance",page:"1"
      }).toString();
      stage="kakao_category";
      const pois=await readJson(poiUrl.toString(),{headers});
      if(!Array.isArray(pois.documents))throw Error("invalid_places");
      const places=pois.documents.slice(0,10).map(p=>({
        name:String(p.place_name||"").slice(0,90),
        address:String(p.road_address_name||p.address_name||"").slice(0,160),
        distance_m:Number.isFinite(Number(p.distance))?Math.max(0,Math.round(Number(p.distance))):null,
        phone:String(p.phone||"").slice(0,40),
        url:placeLink(p.place_url)
      })).filter(p=>p.name&&p.url);
      return answer({schema_version:1,source:"Kakao Local",complex_id:id,category:cat,
        radius_m:1500,checked_at:new Date().toISOString(),places});
    } catch(error) {
      // Report only the failed stage and a safe upstream status; never reveal secrets,
      // full URLs, upstream bodies, or request headers to the client or logs.
      const m=/^upstream_http_([45][0-9]{2})$/.exec(String(error?.message||""));
      const reason=m?"http_"+m[1]:"request_failed";
      return answer({error:"provider_unavailable",stage,reason,
        message:"실시간 조회에 실패했습니다. 오류 단계와 코드를 확인해 주세요."},502);
    }
  }
};
