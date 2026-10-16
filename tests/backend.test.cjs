const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),crypto=require('crypto');
const props=new Map([['SECRET','testsecret'],['SALT','salt'],['SHEET_ID','test']]),cache=new Map(),sheets=new Map();let fail=false,locked=false;
const sheet=()=>({rows:[],getLastRow(){return this.rows.length},getMaxRows(){return 1000},clearContents(){this.rows=[]},getRange(row,col,n){return {getValues:()=>this.rows.slice(row-1,row-1+n),setNumberFormat(){return this},setValues:a=>{if(fail)throw Error('simulated storage failure');this.rows=a}}}});
const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:k=>props.get(k),setProperty:(k,v)=>props.set(k,v)})},CacheService:{getScriptCache:()=>({get:k=>cache.get(k),put:(k,v)=>cache.set(k,v),remove:k=>cache.delete(k)})},SpreadsheetApp:{openById:()=>({getSheetByName:n=>sheets.get(n),insertSheet:n=>{let s=sheet();sheets.set(n,s);return s}}),flush(){}},LockService:{getScriptLock:()=>({waitLock(){assert(!locked);locked=true},releaseLock(){locked=false}})},Utilities:{DigestAlgorithm:{SHA_256:'sha256'},computeDigest:(_,s)=>crypto.createHash('sha256').update(s).digest(),base64EncodeWebSafe:b=>Buffer.from(b).toString('base64url'),computeHmacSha256Signature:(s,k)=>crypto.createHmac('sha256',k).update(s).digest()},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(__dirname+'/../google-backend/Code.gs','utf8'),ctx);props.set('PASSWORD_HASH',ctx.hash_('saltabcdefghijklmnop'));
const initial={rosters:{p4:[],p5:[],p6:[]},extras:{gifts:[],receipts:[],drawCost:1,currencyVersion:2},version:0,lastOpId:''};ctx.writeState_(initial);
assert.equal(ctx.starApi({method:'getState'}).error,'AUTH');assert(ctx.starApi({method:'login',password:'wrong'}).error);const token=ctx.starApi({method:'login',password:'abcdefghijklmnop'}).token;assert(token);assert(!ctx.authorised_('9999999999999.forged'));
let state=ctx.starApi({method:'getState',token});assert.equal(state.version,0);
const student={id:'s1',name:'測試學生',score:29,xp:333,theme:'t0-inferno',photo:'data:image/jpeg;base64,'+'A'.repeat(42000),present:true};state.rosters.p6=[student];state.extras.drawWeights={2:10,3:30,4:60};state.extras.gifts=[{id:'g1',name:'獎品',cost:2,stock:3,rarity:4,draw:true,image:''}];
const a={...state,baseVersion:0,opId:'op-1'};let r=ctx.starApi({method:'saveState',token,arg:a});assert.equal(r.version,1);assert.equal(ctx.starApi({method:'getState',token}).extras.drawWeights[4],60);assert.equal(ctx.starApi({method:'getState',token}).rosters.p6[0].photo,student.photo);assert.equal(ctx.starApi({method:'saveState',token,arg:a}).version,1);assert.match(ctx.starApi({method:'saveState',token,arg:{...a,opId:'stale'}}).error,/CONFLICT/);
const b=JSON.parse(JSON.stringify({...a,baseVersion:1,opId:'op-2'}));b.rosters.p6[0].score=30;b.rosters.p6[0].xp=393;fail=true;assert(ctx.starApi({method:'saveState',token,arg:b}).error);fail=false;assert.equal(ctx.starApi({method:'getState',token}).version,1);assert.equal(ctx.starApi({method:'saveState',token,arg:b}).version,2);
b.baseVersion=2;b.opId='op-3';b.rosters.p6[0].photo='/api/photos/old';assert(ctx.starApi({method:'saveState',token,arg:b}).error);assert(!locked);
console.log('PASS: login, authentication, chunked photo roundtrip, versions, retry deduplication, stale-device conflict, failed-write recovery, private-path rejection.');
for(const path of ['cloud.js','portable-backup.js','student-audio.js','focused-fixes.js','class-tools.js','class-tools-v2.js','portable-backup-v6.js','roster-model.js'])new vm.Script(fs.readFileSync(__dirname+'/../'+path,'utf8'));
const h=fs.readFileSync(__dirname+'/../index.html','utf8');new vm.Script(h.match(/<script>([\s\S]*?)<\/script>/)[1]);assert(!h.includes("fetch('/api/state'"));assert(!h.includes('Jay'));assert(!/src="\//.test(h));console.log('PASS: portable JavaScript parses; no original student seed or Site API dependency.');

const bad=JSON.parse(JSON.stringify(b));bad.rosters.p6[0].photo='';bad.extras.drawWeights={2:0,3:0,4:0};assert(ctx.starApi({method:'saveState',token,arg:bad}).error);console.log('PASS backend persisted weights and rejects all-zero weights');

const beforeLogin=Date.now(),password='abcdefghijklmnop';
const remembered=ctx.starApi({method:'login',password,remember:true}).token;
const temporary=ctx.starApi({method:'login',password,remember:false}).token;
const legacy=ctx.starApi({method:'login',password}).token;
const notBoolean=ctx.starApi({method:'login',password,remember:'true'}).token;
const afterLogin=Date.now();
for(const [value,duration] of [[remembered,90*24*3600000],[temporary,12*3600000],[legacy,12*3600000],[notBoolean,12*3600000]]){
 const expiry=Number(value.split('.')[0]);
 assert(expiry>=beforeLogin+duration&&expiry<=afterLogin+duration);
 assert(ctx.authorised_(value));
}
assert(ctx.starApi({method:'login',password:'wrong',remember:true}).error);
assert.equal(ctx.starApi({method:'getState',remember:true}).error,'AUTH');
assert.equal(ctx.starApi({method:'getState',token:remembered}).version,2);
const storedBefore=JSON.stringify(ctx.readState_());
props.set('SECRET','rotated-fixture-secret');
assert(!ctx.authorised_(remembered));
assert.equal(ctx.starApi({method:'getState',token:remembered}).error,'AUTH');
assert.equal(JSON.stringify(ctx.readState_()),storedBefore);
console.log('PASS: remembered login lasts 90 days; unchecked/legacy login lasts 12 hours; authentication and secret rotation remain enforced without changing student data.');

// New class protocol accepts old identities unchanged and protects them from old clients.
const classToken=ctx.login_(password,true).token;
let modern=JSON.parse(JSON.stringify(ctx.readState_()));
const classId='c-11111111-2222-4333-8444-555555555555',studentId='s-11111111-2222-4333-8444-555555555555';
modern.rosters[classId]=[{...student,id:studentId,name:'代課學生'}];
modern.extras.classNames={[classId]:'星期五 <A>'};
modern.clientVersion=2;modern.baseVersion=modern.version;modern.opId='classes-1';
let created=ctx.starApi({method:'saveState',token:classToken,arg:modern});
assert(!created.error,created.error);assert.equal(created.capabilities.classManagement,true);assert.equal(created.schemaVersion,2);
assert.equal(created.rosters.p6[0].id,'s1');assert.equal(created.rosters[classId][0].id,studentId);
assert.equal(created.extras.classNames[classId],'星期五 <A>');
assert.match(ctx.starApi({method:'saveState',token:classToken,arg:{...created,baseVersion:created.version,opId:'old-client'}}).error,/UPDATE_REQUIRED/);
const candidate=()=>JSON.parse(JSON.stringify({...created,clientVersion:2,baseVersion:created.version,opId:'classes-2'}));
let invalid=candidate();delete invalid.extras.classNames;assert(ctx.starApi({method:'saveState',token:classToken,arg:invalid}).error);
invalid=candidate();invalid.rosters[classId].push({...invalid.rosters[classId][0]});assert(ctx.starApi({method:'saveState',token:classToken,arg:invalid}).error);
invalid=candidate();invalid.extras.classNames[classId]='x'.repeat(31);assert(ctx.starApi({method:'saveState',token:classToken,arg:invalid}).error);
invalid=candidate();invalid.rosters[classId]=Array.from({length:101},(_,i)=>({...student,id:'s'+(i+1)}));assert(ctx.starApi({method:'saveState',token:classToken,arg:invalid}).error);
let pending=candidate();pending.extras.receipts=[{id:'r-class',grade:classId,studentId,giftId:'g1',giftName:'禮物',cost:1,time:'2026-10-16T00:00:00Z',status:'pending',kind:'redeem'}];
ctx.validateState_(pending);delete pending.rosters[classId];assert.throws(()=>ctx.validateState_(pending),/待派發/);
pending.extras.receipts[0].status='delivered';pending.extras.receipts[0].studentName='代課學生';pending.extras.receipts[0].className='星期五 <A>';ctx.validateState_(pending);
// Non-contiguous IDs and 100 students are supported; no reindexing or implicit migration.
const hundred=candidate();hundred.rosters[classId]=Array.from({length:100},(_,i)=>({...student,photo:'',id:'s'+(i+101)}));ctx.validateState_(hundred);
const empty=candidate();empty.rosters={};empty.extras.classNames={};const removed=ctx.starApi({method:'saveState',token:classToken,arg:empty});assert(!removed.error,removed.error);assert.equal(Object.keys(removed.rosters).length,0);
assert.equal(removed.extras.gifts[0].id,'g1');assert.equal(removed.extras.drawWeights[4],60);
console.log('PASS: custom class labels, stable IDs, 100-student limit, missing labels/duplicate rejection, pending-gift guard, empty rosters and old-client write protection.');

const generated=fs.readFileSync(__dirname+'/../google-backend/Index.html','utf8');
assert.equal(generated,h.replace('<head>','<head><base href="https://j1mwyyzz430.github.io/star-team/" target="_top">').replace('<base target="_top">',''));
console.log('PASS: Google native-RPC fallback matches the current frontend and resolves relative assets from GitHub Pages.');
