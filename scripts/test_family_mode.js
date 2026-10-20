// Offline regression checks for the v1.0 family/admin display modes.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname,'..','app/src/main/assets/index.html'),'utf8');
const js = html.split('<script>')[1]?.split('</script>')[0];
assert.ok(js,'embedded script required');
assert.ok(html.includes('onclick="toggleAdminMode()"'),'user-facing explicit admin switch required');
assert.ok(js.includes("if(role!=='admin')return;let text=$('repo')"),'prevent family changing repository');
assert.ok(js.includes("const DEFAULT_REPOSITORY='jwj2477-777/firsthyundai-app'"),'default fixed source');
const prefix = js.slice(0, js.indexOf('function prettyTime'));
assert.ok(prefix.includes('function switchPage(id)'), 'role-aware nav required');
function makeContext(initialMode){
 const elements = new Map();
 const get = id => {
  if(!elements.has(id)) elements.set(id,{
   id, value:'', textContent:'', innerHTML:'', open:false,
   classList: {add(){},remove(){},toggle(){},contains(){return false}},
   close(){this.open=false;}
  });
  return elements.get(id);
 };
 const storage = new Map([['firsthyundai-public-repo','different/public-repository']]);
 const native = {getMode:()=>initialMode};
 const ctx=vm.createContext({
  document:{getElementById:get},
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},
  window:{FirstHyundaiNative:native},
  alert(){},
 });
 vm.runInContext(prefix+'\nfunction renderNearby(){}\nfunction renderComplexes(){}\nfunction renderNew(){}\nfunction renderTrades(){}\nfunction renderNews(){}\nfunction renderNotes(){}\nfunction refreshAll(){}',ctx);
 return {ctx,get};
}
const family=makeContext('family');
assert.equal(vm.runInContext('role',family.ctx),'family');
assert.equal(vm.runInContext('repository',family.ctx),'jwj2477-777/firsthyundai-app');
assert.equal(vm.runInContext('activePages().length',family.ctx),7);
vm.runInContext("switchPage('complexes')",family.ctx);
assert.equal(vm.runInContext('currentPage',family.ctx),'complexes','family can view public apartment information');
vm.runInContext("switchPage('settings')",family.ctx);
assert.equal(vm.runInContext('currentPage',family.ctx),'nearby','settings should not open in family mode');
vm.runInContext("switchPage('security')",family.ctx);
assert.equal(vm.runInContext('currentPage',family.ctx),'nearby','security settings must be admin only');
vm.runInContext("switchPage('contracts')",family.ctx);
assert.equal(vm.runInContext('currentPage',family.ctx),'contracts','family can draft contract notices privately');
vm.runInContext("switchPage('notes')",family.ctx);
assert.equal(vm.runInContext('currentPage',family.ctx),'nearby','notes should be admin only');
vm.runInContext("window.onRoleChanged('admin')",family.ctx);
assert.equal(vm.runInContext('activePages().length',family.ctx),11);
vm.runInContext("switchPage('settings')",family.ctx);
assert.equal(vm.runInContext('currentPage',family.ctx),'settings','admin may view settings');
vm.runInContext("window.onRoleChanged('family')",family.ctx);
assert.equal(vm.runInContext('repository',family.ctx),'jwj2477-777/firsthyundai-app');
assert.equal(vm.runInContext('activePages().length',family.ctx),7);
assert.equal(vm.runInContext('currentPage',family.ctx),'nearby');
const admin=makeContext('admin');
assert.equal(vm.runInContext('role',admin.ctx),'admin','admin device remembers its mode');
assert.equal(vm.runInContext('activePages().length',admin.ctx),11);
console.log('Role test passed: family default repository, admin confirmation state, restricted menus');
