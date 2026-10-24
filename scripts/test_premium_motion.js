'use strict';
/* v2.0.60: premium motion is CSS + disposable ripple, never an app workflow change. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('app/src/main/assets/index.html'),css=read('app/src/main/assets/ui-v2.css'),
 source=read('app/src/main/assets/premium-motion.js');
assert(html.includes('<script src="premium-motion.js"></script>'),'Motion script must load inside Android');
assert(css.includes('/* v2.0.59 · FIRST HYUNDAI PREMIUM INTERACTION LAYER'));
assert(css.includes('.page:not(.hidden){animation:fhd-page-reveal') &&
 css.includes('.page:not(.hidden)>.sectionTitle:first-child'),'Navigation shows a short fade');
assert(css.includes('Do NOT translate .page'),'The fixed apartment sheet must not shift');
assert(css.includes('prefers-reduced-motion:reduce')&&css.includes('animation:none!important'),'Accessibility setting removes effects');
assert(css.includes('.fhd-tap-wave')&&css.includes('pointer-events:none'));
assert(html.includes('onclick="closeApartmentSheet()"')&&html.includes('function switchPage(id)'),
 'All existing navigation paths remain intact');
new vm.Script(source);
let handler,disable=false,created=0,added=0,removed=0;
const document={
 addEventListener(name,cb,opts){if(name==='pointerdown'){handler=cb;assert.equal(opts.passive,true)}},
 createElement(){
  created++;const listeners={};
  return {className:'',style:{},setAttribute(){},addEventListener(name,cb){listeners[name]=cb},
   remove(){removed++},fire(name){listeners[name]?.()}};
 }
};
const box={width:180,height:50,left:100,top:200};
const target={
 disabled:false,classes:[],getAttribute(){return null},closest(){return null},
 classList:{contains(){return false},add(){added++}},
 getBoundingClientRect(){return box},querySelectorAll(){return []},
 appendChild(wave){this.wave=wave;}
};
const ctx=vm.createContext({document,window:{matchMedia:()=>({matches:disable})},Number,Math});
vm.runInContext(source,ctx);
assert.equal(typeof handler,'function');
const event={pointerType:'touch',isPrimary:true,target:{closest:()=>target},clientX:135,clientY:220};
handler(event);assert.equal(created,1);assert.equal(added,1);
assert.equal(target.wave.style.left,'35px');assert.equal(target.wave.style.top,'20px');
assert.equal(target.wave.className,'fhd-tap-wave');
target.wave.fire('animationend');assert.equal(removed,1,'Touch wave must clean itself up');
disable=true;handler(event);assert.equal(created,1,'Reduced motion disables visual effects');
disable=false;target.disabled=true;handler(event);assert.equal(created,1,'Disabled buttons cannot animate');
target.disabled=false;handler({...event,pointerType:'mouse',button:2});assert.equal(created,1,'Right click does not trigger waves');
assert(!/setTimeout|setInterval|fetch\(|localStorage|preventDefault\(|stopPropagation\(/.test(source),
 'Motion must neither schedule work nor intercept app events or change data');
console.log('Premium motion verified: delegated passive touch, short transitions, cleanup, disabled/reduced motion, no workflow changes.');
