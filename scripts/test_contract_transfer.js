// Privacy-safe memo field permutations and source-backed NEIS tab integration.
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'app/src/main/assets');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
assert(html.includes('<script src="contracts-language.js"></script><script src="contracts-transfer.js"></script><script src="contracts-easy.js"></script>'),'Load order is essential');
assert(html.includes('neisSchoolLevel')&&html.includes('selectNeisSchoolLevel'));
assert(html.includes('NEIS_EDU_KEY')&&!html.includes('KEY=SECRET'));
assert(html.includes('data')||html.includes('publicServices'));
const elems=new Map();function el(id){
 if(!elems.has(id)){const state=new Set();elems.set(id,{
  id,value:'',textContent:'',innerHTML:'',className:'',open:false,
  checked:['ct_autoDeposit','ct_polishTerms'].includes(id),
  classList:{add:x=>state.add(x),remove:x=>state.delete(x),toggle:(x,flag)=>flag?state.add(x):state.delete(x),contains:x=>state.has(x)},
  focus(){},select(){},closest(){return null},scrollIntoView(){}});
 }return elems.get(id);
}
const complex=[{id:'f15',label:'퍼스트파크 15블럭',address:'인천 연수구 테스트로 15',aliases:[]}];
const ctx=vm.createContext({window:{},document:{getElementById:el},catalogRows:()=>complex,alert(){},confirm(){return true},console,Date,Number,String,navigator:{}});
for(const file of ['contracts.js','contracts-smart.js','contracts-language.js','contracts-transfer.js','contracts-easy.js']){
 const js=fs.readFileSync(path.join(dir,file),'utf8');
 new vm.Script(js);
 assert(!/\b(?:fetch|XMLHttpRequest)\b/.test(js),file+' cannot leak bank account data to the network');
 vm.runInContext(js,ctx);
}
const easy=ctx.window.FirstHyundaiEasy,transfer=ctx.window.FirstHyundaiTransfer;
function compose(notes){el('ct_rough').value='퍼팍 15블럭 1501동 1203호 매매 10억 2000 계약금 1억 200만원 '+notes+' 잔금일 2026년 12월 30일';assert.equal(easy.compose(),true);}
function permute(a){if(!a.length)return [[]];return a.flatMap((v,i)=>permute(a.filter((_,j)=>i!==j)).map(x=>[v,...x]));}
const four=['김철수','123-456-789012','500','국민은행'];
const permutations=permute(four);
assert.equal(permutations.length,24);
for(const p of permutations){
 compose(p.join(' '));
 assert.equal(el('ct_bank').value,'국민은행',p.join('|')+' bank');
 assert.equal(el('ct_account').value,'123-456-789012',p.join('|')+' account must not contain 500');
 assert.equal(el('ct_accountHolder').value,'김철수',p.join('|')+' recipient');
 assert.equal(el('ct_advance').value,'500',p.join('|')+' remittance');
 assert(el('ct_preview').value.includes('▶ 이번 송금 예정액 : 500만원'),'Customer text must show the exact transfer amount without assuming contract formation');
 assert(!el('ct_preview').value.includes('▶ 이번 선송금 예정액'));
}
compose('천만원 오늘 입금 이영희 신한은행 110-222-334455');
assert.equal(el('ct_advance').value,'1000','Korean spoken remittance before today works');
assert.equal(el('ct_accountHolder').value,'이영희');
compose('금일 1,000만 원 박민수 국민은행 111-222-333444');
assert.equal(el('ct_advance').value,'1000','Commas and spaced won work');
assert.equal(el('ct_accountHolder').value,'박민수');
compose('송금액 500 매도인 김갑수 매수인 이을희 예금주 박영희 기업은행 110-222-334455');
assert.equal(el('ct_advance').value,'500');
assert.equal(el('ct_accountHolder').value,'박영희','Never use owner/buyer as account holder where payee is specified');
compose('매수인 이영희 계좌 123-456-789012 은행 국민은행 500 김철수');
assert.equal(el('ct_advance').value,'500');
assert(el('ct_languageWarnings').textContent.includes('추정했습니다'),'Unlabeled transfer is explicitly tentative');
// Separate amounts without bank and account cannot be a reliable remittance.
compose('매매대금 10억 2000만원 계약금 1억 200만원 중도금 2억');
assert.equal(el('ct_advance').value,'');
const p=transfer.packet('계좌 111-222-333333 계좌 444-555-666666 국민은행 홍길동 500');
assert.equal(p.account,null,'Ambiguous multiple accounts cannot be auto-confirmed');
assert(p.warning.includes('계좌번호'));
const snap=JSON.parse(fs.readFileSync(path.join(root,'data/public_services.json'),'utf8'));
assert(['awaiting_key','verified'].includes(snap.schools.state));
assert(snap.school_zones.records.length===0);
console.log('Transfer permutation regression passed: 24 field orders, Korean words, labels, account safety, explicit review, no false assigned schools.');
compose('우리은행 1002 999 123456 예금주 가상인 오늘 500만원 송금');
assert.equal(el('ct_account').value,'1002999123456','Spaced account is extracted without the transfer amount');
assert.equal(el('ct_advance').value,'500');
assert.equal(el('ct_accountHolder').value,'가상인');
let spaced=transfer.packet('우리은행 1002 999 123456 예금주 가상인 예금주 가상인 오늘 500만원');
assert.equal(spaced.holder,'가상인','Repeated identical payee is not ambiguous');
assert.equal(transfer.packet('국민은행 연락처 010-1234-5678').account,null,'Phone number cannot become an account');


// The only unlabelled person is normally the receiving account holder; a draft guess is reviewable.
for(const [memo,holder,advance] of [
 ['김철수 전세 4억, 계약금 4천 오늘 500만원 입금','김철수',500],
 ['오늘 500만원 이체 / 신한은행 123-456-789012 김철수','김철수',500],
 ['김철수 국민은행 123-456-789012 보낼 돈 500','김철수',500],
 ['국민은행 123-456-789012 김철수 계약금 중 500 보내기로','김철수',500],
 ['송금액 500 김철수 국민은행 123-456-789012','김철수',500],
 ['박민수 500만원 넣기로 국민은행 123-456-789012','박민수',500],
 ['선입금 500 홍길동 국민은행 123-456-789012','홍길동',500]
]){
 const result=transfer.packet(memo);
 assert.equal(result.holder,holder,'Payee is memo-wide: '+memo);
 assert.equal(result.amount,advance,'This remittance is not the full deposit: '+memo);
}
compose('김가람 오늘 500만원 입금, 국민은행 123-456-789012');
assert.equal(el('ct_accountHolder').value,'김가람');
assert(el('ct_languageWarnings').textContent.includes('추정했습니다'),'Unlabeled name must be reviewed');
assert.equal(transfer.packet('예금주 박민수 임대인 김철수 국민은행 123-456-789012 오늘 500 송금').holder,'박민수');
assert.equal(transfer.packet('김철수 박민수 국민은행 123-456-789012 오늘 500 송금').holder,null,'Two names are ambiguous');
assert.equal(transfer.packet('임차인 김철수 국민은행 123-456-789012 오늘 500 송금').holder,null,'Buyer alone is not payee');
assert.equal(transfer.packet('오늘 500 송금, 계약금 4000, 중도금 2000').amount,500);
assert.equal(transfer.packet('계약금 4000, 중도금 2000').amount,null,'Totals are not remittance');
console.log('Unique payee and spoken remittance checks passed.');


// End-to-end regression: informal memo, middle payment followed by mistyped date,
// lone recipient, unlabelled repair/date clauses. All names and accounts are fictional.
const sampleMemo=[
 '퍼팍 1502동 3004호',
 '매매 15억',
 '중도금 4억 12년20일',
 '잔금일 1월 30일',
 '김가람 국민은행 123-456-789012',
 '1000만원',
 '',
 '매도인이 화장실 수리해주기로',
 '잔금일은 상호합의하에 앞당길수 있다'
].join('\n');
el('ct_rough').value=sampleMemo;
assert.equal(easy.compose(),true);
assert.equal(el('ct_price').value,'150000');
assert.equal(el('ct_interim').value,'40000','Four-eok interim survives malformed date suffix');
assert.equal(el('ct_advance').value,'1000');
assert.equal(el('ct_accountHolder').value,'김가람');
assert.equal(el('ct_unit').value,'1502동 3004호');
assert.equal(el('ct_contractDeposit').value,'15000');
assert.equal(el('ct_interimDate').value,'','Ambiguous 12년20일 must not be silently fixed');
assert(el('ct_languageWarnings').textContent.includes('월/년 표기가 불명확'));
assert(el('ct_preview').value.includes('▶ 중도금 : 40,000만원'));
assert(el('ct_preview').value.includes('▶ 중도금 지급일 : [메모 날짜 확인 필요]'));
assert(el('ct_preview').value.includes('▶ 잔금 : 95,000만원'));
assert(!el('ct_preview').value.includes('계약금 잔여액'));
assert(el('ct_preview').value.includes('화장실 수리해주기로 한다.'));
assert(el('ct_preview').value.includes('잔금일은 상호 합의하에 앞당길 수 있다.'));
assert(el('ct_status').textContent.includes('중도금 지급일 오타 확인'),'Cannot approve unclear date');
el('ct_interimDate').value='2026-12-20'; // deliberate human correction
easy.afterManualEdit();
assert(el('ct_preview').value.includes('▶ 중도금 지급일 : 2026.12.20.'), 'Interim date must match contract and balance date format');
assert(!ctx.window.FirstHyundaiContracts._test.collect().errors.includes('중도금 지급일 오타 확인'));
console.log('User-pattern memo regression passed: interim, corrected balance, implicit clauses and date review.');


// A new real-world office memo shape (entirely invented recipient/account).
// Bare 잔금 is a payment-date heading; no literal "특약:" label is necessary.
const looseDateMemo=[
 '퍼팍 1502동3004호',
 '매매 15억',
 '중도금 5억 12월5일',
 '잔금 27년 1월30일',
 '',
 '김가람 하나은행 123-45678-01 700만',
 '중도금 및 잔금일 앞당길수있다',
 '매도인은 부서진곳을 수리해준다'
].join('\n');
el('ct_rough').value=looseDateMemo;
assert.equal(easy.compose(),true);
assert.equal(el('ct_property').value,'퍼스트파크 15블럭');
assert.equal(el('ct_unit').value,'1502동 3004호');
assert.equal(el('ct_price').value,'150000');
assert.equal(el('ct_contractDeposit').value,'15000');
assert.equal(el('ct_interim').value,'50000');
assert(el('ct_interimDate').value.endsWith('-12-05'),'Interim date 12월5일');
assert.equal(el('ct_balanceDate').value,'2027-01-30','Short year after bare balance keyword');
assert.equal(el('ct_bank').value,'하나은행');
assert.equal(el('ct_accountHolder').value,'김가람');
assert.equal(el('ct_advance').value,'700');
assert.equal(el('ct_terms').value.split('\n').length,2);
assert(el('ct_terms').value.includes('중도금 및 잔금일 앞당길 수 있다.'));
assert(el('ct_terms').value.includes('매도인은 부서진 곳을 수리해준다.'));
assert(el('ct_preview').value.includes('▶ 중도금 : 50,000만원'));
assert(el('ct_preview').value.includes('▶ 잔금일 : 2027.01.30.'));
assert(el('ct_preview').value.includes('▶ 잔금 : 85,000만원'));
for(const term of ['중도금 및 잔금일 앞당길 수 있다.','매도인은 부서진 곳을 수리해준다.'])assert(el('ct_preview').value.includes(term));
assert(!el('ct_preview').value.includes('계약금 잔여액'));
console.log('Unlabeled balance / special terms regression passed with one memo.');


// Brokerage memo with a bare "특약" header followed by bank details.
// All personal details below are synthetic and must never match customer records.
const negotiatedMemo=[
 '퍼팍 1502동3004호',
 '매매 16억',
 '계약금 6천',
 '중도금 4억 12월4일',
 '잔금 1월5일',
 '',
 '계약은 10월중 협의',
 '특약',
 '화장실는 매도인이 수리해주기로',
 '애완동물 금지하기로 한다',
 '',
 '하나은행 김가람 123-45678-01 500'
].join('\n');
el('ct_rough').value=negotiatedMemo;
assert.equal(easy.compose(),true,'One-memo workflow should complete');
for(const [id,expected] of [
 ['property','퍼스트파크 15블럭'],
 ['unit','1502동 3004호'],
 ['price','160000'],['contractDeposit','6000'],
 ['interim','40000'],['bank','하나은행'],
 ['account','123-45678-01'],['accountHolder','김가람'],
 ['advance','500'],['contractDate','10월중 협의']
])assert.equal(el('ct_'+id).value,expected,'Field '+id);
assert(el('ct_interimDate').value.endsWith('-12-04'),'Interim date extracted');
assert(el('ct_balanceDate').value.endsWith('-01-05'),'Balance date extracted');
assert(el('ct_preview').value.includes('▶ 계약일 : 10월중 협의'),'Negotiated signing window visible in SMS and image preview');
assert(el('ct_preview').value.includes('▶ 잔금 : 114,000만원'),'Deal minus contractual deposit minus interim');
assert(el('ct_terms').value.includes('화장실는 매도인이 수리해주기로 한다.'));
assert(el('ct_terms').value.includes('반려동물 금지하기로 한다.'));
assert.equal(el('ct_terms').value.split('\n').length,2,'Only the two negotiated clauses');
for(const secret of ['123-45678-01','김가람','하나은행','500']){
 assert(!el('ct_terms').value.includes(secret),'Transfer row must never leak into special clause: '+secret);
}
assert(!el('ct_preview').value.includes('→ 하나은행'),'No accidental banking special term');
assert(el('ct_preview').value.includes('하나은행 123-45678-01 (예금주 김가람)'));
assert(el('ct_languageWarnings').textContent.includes('협의 일정'),'Flexible signing schedule should prompt human review');
assert.equal(easy._test.extractSpecial('특약:\n도배는 매도인이 해주기로\n국민은행 123-456-789012 김철수 700'),'도배는 매도인이 해주기로');
console.log('Labeled clauses isolated from banking row; flexible contract date and transfer verified.');
