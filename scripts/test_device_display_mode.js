/* Per-phone display modes; no shared administrator data or sign-in required. */
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../app/src/main');
const source=fs.readFileSync(path.join(root,'assets/device-display.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/device-display.css'),'utf8');
const java=fs.readFileSync(path.join(root,'java/kr/co/firsthyundai/app/MainActivity.java'),'utf8');
const nav=fs.readFileSync(path.join(root,'assets/nav-collapse.js'),'utf8');
const html=fs.readFileSync(path.join(root,'assets/index.html'),'utf8');
assert(java.includes('s.setTextZoom(deviceTextZoom(localDeviceDisplayMode()))'));
assert(java.includes('"xlarge".equals(mode)?128:"large".equals(mode)?116:100'));
assert(html.includes('<script src="device-display.js"></script><script src="nav-collapse.js"></script>'));
assert(html.includes('id="deviceDisplayDialog"'));
assert(nav.includes('standard:{height:[90,48]'));
assert(nav.includes('large:{height:[114,76]'));
assert(nav.includes('xlarge:{height:[134,96]'));
assert(css.includes('grid-template-columns:repeat(2,minmax(0,1fr))'));
assert(!source.includes('FirstHyundaiSharedSettings'));
const controls={};
function el(id){
 if(!controls[id])controls[id]={attributes:{},textContent:'',listeners:{},
  setAttribute(k,v){this.attributes[k]=v},getAttribute(k){return this.attributes[k]},
  addEventListener(k,fn){this.listeners[k]=fn},showModal(){this.opened=true},close(){this.opened=false}};
 return controls[id];
}
const choices=['standard','large','xlarge'].map(mode=>{
 const node=el('choice-'+mode);node.setAttribute('data-device-choice',mode);return node;
});
const body={attributes:{},setAttribute(k,v){this.attributes[k]=v}};
let saved='standard',nativeCalls=[],navUpdates=0;
const context={window:{FirstHyundaiNative:{getDeviceDisplayMode:()=>saved,setDeviceDisplayMode:mode=>{nativeCalls.push(mode);saved=mode;return true}},
 FirstHyundaiNavCollapse:{update:()=>navUpdates++}},document:{body,getElementById:el,querySelectorAll:()=>choices}};
vm.runInNewContext(source,context,{filename:'device-display.js'});
const api=context.window.FirstHyundaiDeviceDisplay;
assert.equal(api.get(),'standard');
assert.equal(body.attributes['data-device-display'],'standard');
api.open();assert.equal(el('deviceDisplayDialog').opened,true);
choices[1].listeners.click();assert.equal(api.get(),'large');assert.equal(saved,'large');
assert.equal(choices[1].attributes['aria-pressed'],'true');
choices[2].listeners.click();assert.equal(saved,'xlarge');
choices[0].listeners.click();assert.equal(saved,'standard');
assert.deepEqual(nativeCalls,['large','xlarge','standard']);
assert(navUpdates>=4);
el('deviceDisplayDone').listeners.click();
assert.equal(el('deviceDisplayDialog').opened,false);
console.log('PASS device-local display settings and standard Android text zoom');
