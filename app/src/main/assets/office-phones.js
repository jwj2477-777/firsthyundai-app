/* Local private-office phone normalization. Never sends data outside the memo service. */
(function(root){
'use strict';
const dash='[-ㅡ－−–—―‐‑]';
const full=new RegExp('(?<!\\d)(?:0(?:1[016789]|2|[3-6]\\d|70|50\\d)'+dash+'?\\d{3,4}'+dash+'?\\d{4}|(?:[1-9]\\d{2,3})'+dash+'\\d{4})(?!\\d)','g');
function format(value){
 const digits=String(value||'').replace(/\D/g,'');
 if(/^(?:15|16|18)\d{6}$/.test(digits))return digits.slice(0,4)+'-'+digits.slice(4);
 if(/^[1-9]\d{6,7}$/.test(digits))return '032-'+digits.slice(0,-4)+'-'+digits.slice(-4);
 if(/^01[016789]\d{7,8}$/.test(digits))return digits.slice(0,3)+'-'+digits.slice(3,-4)+'-'+digits.slice(-4);
 if(/^02\d{7,8}$/.test(digits))return digits.slice(0,2)+'-'+digits.slice(2,-4)+'-'+digits.slice(-4);
 if(/^0(?:[3-6]\d|70)\d{7,8}$/.test(digits))return digits.slice(0,3)+'-'+digits.slice(3,-4)+'-'+digits.slice(-4);
 if(/^050\d\d{7,8}$/.test(digits))return digits.slice(0,4)+'-'+digits.slice(4,-4)+'-'+digits.slice(-4);
 return '';
}
function normalize(value){
 const text=String(value||'').replace(full,m=>format(m)||m);
 // Plain seven/eight-digit numbers are ambiguous unless explicitly labelled as a contact.
 return text.replace(/(전화번호|전화|연락처|연락|☎|📞)(\s*[:：]?\s*)([1-9]\d{6,7})(?!\d)/g,
  (whole,label,space,digits)=>label+space+(format(digits)||digits));
}
function linkify(value,escape){
 const text=String(value||'');
 let html='',offset=0,match;
 full.lastIndex=0;
 while((match=full.exec(text))!==null){
  const shown=format(match[0]);
  if(!shown)continue;
  html+=escape(text.slice(offset,match.index));
  html+='<a class="officeBoardPhone" href="tel:'+shown.replace(/\D/g,'')+'">'+escape(shown)+'</a>';
  offset=match.index+match[0].length;
 }
 return html+escape(text.slice(offset));
}
root.FirstHyundaiPhones={format,normalize,linkify};
})(window);
