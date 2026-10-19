// FirstHyundai Kakao Local live proxy.
// No Kakao POI results are persisted or cached; each request queries Kakao live.
// Bundled verified public complex addresses. No network fetch to GitHub during lookups.
// Refresh this snapshot when data/complexes.json changes. Undocumented or aggregate-only entries are excluded.
const COMPLEX_ADDRESSES = Object.freeze({
  "f13":"인천광역시 연수구 컨벤시아대로252번길 70", "f14":"인천광역시 연수구 컨벤시아대로252번길 50",
  "f15":"인천광역시 연수구 컨벤시아대로252번길 30", "m21":"인천광역시 연수구 컨벤시아대로274번길 55",
  "m22":"인천광역시 연수구 컨벤시아대로274번길 35", "m23":"인천광역시 연수구 컨벤시아대로274번길 15",
  "avenue":"인천광역시 연수구 컨벤시아대로252번길 10", "centennial":"인천광역시 연수구 컨벤시아대로274번길 62",
  "prime20":"인천광역시 연수구 인천타워대로231번길 97", "prime25":"인천광역시 연수구 인천타워대로231번길 117",
  "skcentral":"인천광역시 연수구 하모니로188번길 17", "artwin":"인천광역시 연수구 인천타워대로 253-25",
  "central3":"인천광역시 연수구 인천타워대로180번길 11", "kapt-a10020270":"인천광역시 연수구 컨벤시아대로 50",
  "kapt-a10020272":"인천광역시 연수구 컨벤시아대로 126", "kapt-a10020527":"인천광역시 연수구 아카데미로312번길 31",
  "kapt-a10020539":"인천광역시 연수구 송도과학로27번길 27", "kapt-a10020712":"인천광역시 연수구 워터프런트로 150",
  "kapt-a10020744":"인천광역시 연수구 랜드마크로 350", "kapt-a10021000":"인천광역시 연수구 아카데미로343번길 63",
  "kapt-a10022353":"인천광역시 연수구 컨벤시아대로42번길 21", "kapt-a10022395":"인천광역시 연수구 컨벤시아대로 55",
  "kapt-a10022494":"인천광역시 연수구 인천타워대로 365", "kapt-a10022498":"인천광역시 연수구 랜드마크로360번길 40",
  "kapt-a10022954":"인천광역시 연수구 아카데미로 442", "kapt-a10022964":"인천광역시 연수구 인천타워대로 393",
  "kapt-a10023361":"인천광역시 연수구 랜드마크로 20", "kapt-a10024710":"인천광역시 연수구 랜드마크로 68",
  "kapt-a10024779":"인천광역시 연수구 랜드마크로 160", "kapt-a10025031":"인천광역시 연수구 랜드마크로 110",
  "kapt-a10025071":"인천광역시 연수구 아카데미로 446", "kapt-a10025399":"인천광역시 연수구 랜드마크로 19",
  "kapt-a10025443":"인천광역시 연수구 아카데미로312번길 177", "kapt-a10025745":"인천광역시 연수구 송도과학로27번길 15",
  "kapt-a10025886":"인천광역시 연수구 랜드마크로 113", "kapt-a10026038":"인천광역시 연수구 송도국제대로 261",
  "kapt-a10026547":"인천광역시 연수구 송도문화로28번길 27", "kapt-a10027171":"인천광역시 연수구 송도문화로84번길 84",
  "kapt-a10027367":"인천광역시 연수구 송도문화로84번길 24", "kapt-a10027653":"인천광역시 연수구 송도과학로27번길 55",
  "kapt-a10027884":"인천광역시 연수구 아트센터대로97번길 20", "kapt-a10027887":"인천광역시 연수구 센트럴로 160",
  "kapt-a10027888":"인천광역시 연수구 컨벤시아대로130번길 100", "kapt-a40673002":"인천광역시 연수구 신송로82번길 6",
  "kapt-a40673101":"인천광역시 연수구 해돋이로84번길 10", "kapt-a40673412":"인천광역시 연수구 신송로118번길 6",
  "kapt-a40673510":"인천광역시 연수구 해돋이로120번길 16", "kapt-a40673603":"인천광역시 연수구 해돋이로84번길 29",
  "kapt-a40673902":"인천광역시 연수구 해송로30번길 20", "kapt-a40673903":"인천광역시 연수구 해송로30번길 19",
  "kapt-a40673904":"인천광역시 연수구 센트럴로 232", "kapt-a40673906":"인천광역시 연수구 컨벤시아대로130번길 80",
  "kapt-a40673907":"인천광역시 연수구 컨벤시아대로130번길 32", "kapt-a40673908":"인천광역시 연수구 컨벤시아대로130번길 58",
  "kapt-a40673910":"인천광역시 연수구 센트럴로 194", "kapt-a40673911":"인천광역시 연수구 아트센터대로97번길 76",
  "kapt-a40673912":"인천광역시 연수구 아트센터대로97번길 75", "kapt-a40673913":"인천광역시 연수구 아트센터대로97번길 56",
  "kapt-a40673914":"인천광역시 연수구 컨벤시아대로42번길 61", "kapt-a40673915":"인천광역시 연수구 컨벤시아대로42번길 35",
  "kapt-a40673916":"인천광역시 연수구 송도과학로27번길 30", "kapt-a40673917":"인천광역시 연수구 송도과학로27번길 70",
  "kapt-a40673918":"인천광역시 연수구 컨벤시아대로42번길 20", "kapt-a40673920":"인천광역시 연수구 송도과학로51번길 136",
  "kapt-a40673921":"인천광역시 연수구 송도문화로28번길 28", "kapt-a40673922":"인천광역시 연수구 송도문화로28번길 81",
  "kapt-a40673923":"인천광역시 연수구 아트센터대로97번길 30", "kapt-a40673924":"인천광역시 연수구 아트센터대로97번길 15",
  "kapt-a40684004":"인천광역시 연수구 해돋이로84번길 30", "kapt-a40684005":"인천광역시 연수구 해돋이로6번길 7",
  "kapt-a40684007":"인천광역시 연수구 신송로6번길 7", "kapt-a40684008":"인천광역시 연수구 해돋이로6번길 33",
  "kapt-a40684009":"인천광역시 연수구 해송로 70", "kapt-a40684011":"인천광역시 연수구 해송로 143",
  "kapt-a40684013":"인천광역시 연수구 해돋이로 107", "verified-extra-01":"인천광역시 연수구 컨벤시아대로42번길 96",
  "verified-extra-02":"인천광역시 연수구 컨벤시아대로42번길 77", "verified-extra-03":"인천광역시 연수구 컨벤시아대로42번길 95",
  "verified-extra-04":"인천광역시 연수구 해돋이로171번길 11", "verified-extra-05":"인천광역시 연수구 해돋이로 160-7",
  "verified-extra-06":"인천광역시 연수구 해돋이로171번길 9-4", "verified-extra-07":"인천광역시 연수구 신송로 165-17",
  "verified-extra-08":"인천광역시 연수구 신송로118번길 9", "verified-extra-09":"인천광역시 연수구 컨벤시아대로42번길 8",
  "verified-extra-10":"인천광역시 연수구 컨벤시아대로42번길 12", "verified-extra-11":"인천광역시 연수구 컨벤시아대로 60",
  "verified-extra-12":"인천광역시 연수구 컨벤시아대로 116", "verified-extra-13":"인천광역시 연수구 컨벤시아대로 70",
  "verified-extra-14":"인천광역시 연수구 컨벤시아대로 80", "verified-extra-15":"인천광역시 연수구 컨벤시아대로 90",
  "verified-extra-16":"인천광역시 연수구 컨벤시아대로 100", "verified-extra-17":"인천광역시 연수구 해돋이로 160-15",
});
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
    let stage="address_lookup";
    try {
      const address=COMPLEX_ADDRESSES[id]||"";
      if(!address)return answer({error:"address_unavailable"},404);
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
