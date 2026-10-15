const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../cloud.js'),'utf8');
const shared='https://script.google.com/macros/s/fixture-shared/exec';
const stale='https://script.google.com/macros/s/fixture-stale/exec';

function environment({configured='',stored='',blocked=false,fetch}={}){
 const pending=new Map(),calls=[],storage=new Map([['star-backend-url',stored]]);
 const context={window:{STAR_BACKEND_URL:configured},AbortController,JSON,
  localStorage:{
   getItem(key){if(blocked)throw Error('storage denied');return storage.get(key)||null},
   setItem(key,value){if(blocked)throw Error('storage denied');storage.set(key,value)},
   removeItem(key){if(blocked)throw Error('storage denied');storage.delete(key)}
  },
  setTimeout(fn){const key={};pending.set(key,fn);return key},
  clearTimeout(key){pending.delete(key)},
  fetch:async(url,options)=>{calls.push({url,options});return fetch?fetch(url,options):{ok:true,json:async()=>({version:7})}}
 };
 vm.createContext(context);vm.runInContext(source,context);
 return {context,calls,pending,storage};
}

test('shared config overrides a different backend saved by another browser',()=>{
 const {context}=environment({configured:' '+shared+' ',stored:stale});
 assert.equal(context.backendURL(),shared);
 assert.equal(environment({stored:stale}).context.backendURL(),stale);
});

test('blocked browser storage does not break shared config or URL lookup',()=>{
 assert.equal(environment({blocked:true}).context.backendURL(),'');
 assert.equal(environment({blocked:true,configured:shared}).context.backendURL(),shared);
});

test('authenticated backend remains pinned when local storage cannot persist it',async()=>{
 const {context,calls}=environment({blocked:true});
 vm.runInContext(`portableBackendURL=${JSON.stringify(shared)}`,context);
 assert.equal(context.backendURL(),shared);
 await context.cloudCall({method:'getState'});
 assert.equal(calls[0].url,shared);
});

test('POST uses JSON without cookies and works without AbortSignal.timeout',async()=>{
 const {context,calls,pending}=environment({configured:shared});
 context.AbortSignal={};
 await context.cloudCall({method:'getState',token:'fixture-token'});
 const {url,options}=calls[0];
 assert.equal(url,shared);assert.equal(options.method,'POST');
 assert.equal(options.credentials,'omit');assert.equal(options.redirect,'follow');
 assert.equal(options.headers['Content-Type'],'text/plain;charset=utf-8');
 assert.equal(JSON.parse(options.body).method,'getState');
 assert(options.signal instanceof AbortSignal);assert.equal(pending.size,0);
});

test('rejects non-deployment URLs before sending a request',async()=>{
 for(const url of ['','https://example.com/exec',shared+'/extra',shared.replace('/exec','/dev')]){
  const {context,calls,pending}=environment({configured:url});
  await assert.rejects(context.cloudCall({method:'getState'}),/正確的 Google Apps Script/);
  assert.equal(calls.length,0);assert.equal(pending.size,0);
 }
});

test('network failures direct the user to the existing Google fallback',async()=>{
 const {context,pending}=environment({configured:shared,fetch:async()=>{throw TypeError('network')}});
 await assert.rejects(context.cloudCall({method:'getState'}),/Google 備用入口/);
 assert.equal(pending.size,0);
});

test('HTTP and non-JSON responses are diagnosed and timers are cleared',async()=>{
 for(const [response,message] of [
  [{ok:false},/暫時未能連線/],
  [{ok:true,json:async()=>{throw SyntaxError('HTML')}},/登入頁或無效資料/]
 ]){
  const {context,pending}=environment({configured:shared,fetch:async()=>response});
  await assert.rejects(context.cloudCall({method:'getState'}),message);
  assert.equal(pending.size,0);
 }
});

test('timeout aborts the request and reports a retryable error',async()=>{
 const {context,pending}=environment({configured:shared,fetch:async(url,{signal})=>new Promise((resolve,reject)=>{
  signal.addEventListener('abort',()=>reject(Object.assign(Error('timeout'),{name:'AbortError'})));
 })});
 const result=context.cloudCall({method:'getState'});
 for(const callback of pending.values())callback();
 await assert.rejects(result,/連線逾時/);assert.equal(pending.size,0);
});

test('Google-hosted fallback keeps native RPC and requires no URL or fetch',async()=>{
 const {context,calls}=environment({blocked:true});
 context.google=context.window.google={script:{run:{
  withSuccessHandler(fn){this.success=fn;return this},
  withFailureHandler(fn){this.failure=fn;return this},
  starApi(payload){this.success({method:payload.method,version:9})}
 }}};
 const r=await context.cloudCall({method:'getState'});
 assert.equal(r.version,9);assert.equal(calls.length,0);
});

test('expired sessions reauthenticate and retry only against the same backend',async()=>{
 let expired=true,logins=0;
 const {context,calls}=environment({configured:shared,fetch:async()=>({ok:true,json:async()=>{
  if(expired){expired=false;return {error:'AUTH'}}
  return {version:10};
 }})});
 vm.runInContext("portableSession='expired';",context);
 context.portableLogin=async()=>{logins++;vm.runInContext("portableSession='renewed';",context)};
 assert.equal((await context.portableRPC('getState')).version,10);
 assert.equal(logins,1);assert.equal(calls.length,2);
 assert(calls.every(c=>c.url===shared));
 assert.equal(JSON.parse(calls[1].options.body).token,'renewed');
});

test('remembered credentials restore on a new page and are scoped to the backend',async()=>{
 const {context,storage,calls}=environment({configured:shared});
 const token=(Date.now()+86400000)+'.fixture-signature';
 vm.runInContext(`portableSession=${JSON.stringify(token)}`,context);
 assert(context.rememberPortableSession());
 const key=context.portableSessionKey();
 vm.runInContext("portableSession='';",context);
 assert(context.restorePortableSession());
 await context.portableRPC('getState');
 assert.equal(JSON.parse(calls[0].options.body).token,token);
 context.window.STAR_BACKEND_URL=stale;
 vm.runInContext("portableSession='';portableBackendURL='';",context);
 assert.equal(context.restorePortableSession(),false);
 assert.equal(storage.get(key),token,'other backend credential must remain untouched');
});

test('expired or malformed stored credentials are discarded before requesting login',()=>{
 for(const token of [(Date.now()-1000)+'.signature','not-a-token','Infinity.signature']){
  const {context,storage}=environment({configured:shared});
  storage.set(context.portableSessionKey(),token);
  assert.equal(context.restorePortableSession(),false);
  assert(!storage.has(context.portableSessionKey()));
 }
});

test('forgetting login clears this device credential without clearing other local data',()=>{
 const {context,storage}=environment({configured:shared});
 storage.set('star-motion-v2','off');
 vm.runInContext(`portableSession='${Date.now()+86400000}.signature'`,context);
 assert(context.rememberPortableSession());context.forgetPortableSession();
 assert.equal(context.restorePortableSession(),false);
 assert.equal(storage.get('star-motion-v2'),'off');
});

test('remembering login degrades gracefully when local storage is unavailable',()=>{
 const {context}=environment({configured:shared,blocked:true});
 assert.equal(context.restorePortableSession(),false);
 assert.equal(context.rememberPortableSession(),false);
 assert.doesNotThrow(()=>context.forgetPortableSession());
});

test('temporary network failure keeps a remembered credential for the next visit',async()=>{
 const {context,storage}=environment({configured:shared,fetch:async()=>{throw Error('offline')}});
 const key=context.portableSessionKey(),token=(Date.now()+86400000)+'.signature';
 storage.set(key,token);
 await assert.rejects(context.portableRPC('getState'),/連線失敗/);
 assert.equal(storage.get(key),token);
});

test('backend AUTH rejection removes an invalid remembered credential before reauthentication',async()=>{
 let first=true;
 const {context,storage}=environment({configured:shared,fetch:async()=>({ok:true,json:async()=>{
  if(first){first=false;return {error:'AUTH'}}return {version:11};
 }})});
 const key=context.portableSessionKey();storage.set(key,(Date.now()+86400000)+'.rejected');
 context.portableLogin=async()=>{
  assert(!storage.has(key));vm.runInContext("portableSession='replacement';",context);
 };
 assert.equal((await context.portableRPC('getState')).version,11);
});
