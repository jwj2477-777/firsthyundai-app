'use strict';
/* All four trade-type buttons drive native typed CSS fill, not JS RAF. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('app/src/main/assets/index.html');
const css=read('app/src/main/assets/ui-v2.css');
const js=read('app/src/main/assets/selection-flow.js');
for(const [id,func,input,renderer] of [
 ['tradeTypeBar','setTradeType','typeFilter','renderTrades()'],
 ['officeTypeBar','setOfficeType','officeTypeSearch','renderOfficeRentals()'],
 ['nearbyTypeBar','setNearbyType','nearbyType','renderNearbyDetails(true)']
]){
 assert(html.includes('id="'+id+'"'),id+' must preserve actual markup');
 const match=html.match(new RegExp('function '+func+'\\(type\\)\\{([\\s\\S]*?)\\n\\}'));
 assert(match&&match[1].includes("$('"+input+"').value=type")&&match[1].includes(renderer),
  func+' must update actual filter before native animation begins');
 assert(html.includes('onclick="'+func+'(\'매매\')"'));
 assert(html.includes('onclick="'+func+'(\'전세\')"'));
 assert(html.includes('onclick="'+func+'(\'월세\')"'));
 assert(css.includes('#'+id+'>button'),id+' must be included in CSS selector');
}
assert(html.includes("button.className=(active?'active ':'')+tradeClass(t)"));
assert(html.includes("button.setAttribute('aria-pressed',active?'true':'false')"));
assert(css.includes('>button.active{\n --fhd-native-fill:100%;'));
for(const color of ['#285970','#255CA5','#146A50','#875007'])
 assert(css.includes('--fhd-native-ink:'+color));
assert(js.includes('if(isNativeRow(row))return null'));
assert(js.includes("['tradeTypeBar','officeTypeBar','nearbyTypeBar'].includes(row.id)"));
console.log('Trade-type native CSS fill: 4 choices across apartment, office and favorites follow real .active state.');
