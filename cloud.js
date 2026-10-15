'use strict';
let portableSession='',portableLoginPromise=null,portableBackendURL='';
const backendURLPattern=/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
function configuredBackendURL(){return (window.STAR_BACKEND_URL||'').trim()}
function backendURL(){
 if(configuredBackendURL())return configuredBackendURL();
 if(portableBackendURL)return portableBackendURL;
 try{return (localStorage.getItem('star-backend-url')||'').trim()}catch{return ''}
}
function portableSessionKey(){
 const url=backendURL();
 // Native Google RPC and GitHub Pages must not reuse each other's credentials.
 return 'star-team-session-v1:'+(window.google?.script?.run?'google-rpc:':'')+url;
}
function validPortableSession(token){
 if(typeof token!=='string'||!/^\d+\.[A-Za-z0-9_-]+={0,2}$/.test(token))return false;
 const expiry=Number(token.split('.')[0]);return Number.isSafeInteger(expiry)&&expiry>Date.now();
}
function forgetPortableSession(){
 portableSession='';
 try{localStorage.removeItem(portableSessionKey())}catch{}
}
function rememberPortableSession(){
 try{localStorage.setItem(portableSessionKey(),portableSession);return true}catch{return false}
}
function restorePortableSession(){
 try{
  const token=localStorage.getItem(portableSessionKey());
  if(!validPortableSession(token)){localStorage.removeItem(portableSessionKey());return false}
  portableSession=token;
  if(!window.google?.script?.run)portableBackendURL=backendURL();
  return true;
 }catch{return false}
}
async function cloudCall(payload,url=portableBackendURL||backendURL()){
 if(window.google?.script?.run)return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).starApi(payload));
 if(!backendURLPattern.test(url))throw Error('請先設定正確的 Google Apps Script /exec 網址');
 // AbortSignal.timeout is unavailable in older iPad Safari versions.
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
 try{
  let response;
  try{response=await fetch(url,{method:'POST',redirect:'follow',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:controller.signal})}
  catch(e){throw Error(e.name==='AbortError'?'Google 連線逾時，請重試或開啟下方的 Google 備用入口。':'Google 連線失敗。請檢查網絡及部署權限，或開啟下方的 Google 備用入口。')}
  if(!response.ok)throw Error('Google 服務暫時未能連線');
  try{return await response.json()}catch{throw Error('Google 回傳登入頁或無效資料；請確認原部署可供「所有人」存取，並使用 /exec 網址。')}
 }finally{clearTimeout(timer)}
}
function portableLogin(){return portableLoginPromise??=new Promise(resolve=>{
 const nativeRPC=!!window.google?.script?.run,configured=configuredBackendURL();
 const d=document.createElement('dialog');d.style.cssText='max-width:520px;width:92vw';
 d.innerHTML='<h2>星星小隊 · 老師登入</h2><p id="backend-hint"></p><form><label class="field">Google Apps Script 網址<input id="backend-url" type="url" autocomplete="url" placeholder="https://script.google.com/macros/s/…/exec"></label><label class="field">老師密碼<input id="teacher-password" type="password" autocomplete="current-password" required></label><label class="field"><span><input id="remember-login" type="checkbox" checked> 記住這部裝置，下次自動登入</span></label><p class="small">只記住登入憑證，不儲存老師密碼；憑證到期或清除瀏覽器資料後才需重新登入。共用裝置請取消勾選。</p><p role="status" id="login-status"></p><button type="submit" class="primary">登入並載入分數</button></form><p class="small"><a id="google-fallback" target="_blank" rel="noopener noreferrer" hidden>開啟同一後台的 Google 備用入口</a></p><p class="small">各裝置須連接同一個後台。可在「設定」忘記這部裝置的登入。</p>';
 document.body.append(d);
 const u=d.querySelector('#backend-url'),fallback=d.querySelector('#google-fallback');
 u.value=backendURL();u.readOnly=!!configured;u.required=!nativeRPC;u.parentElement.hidden=nativeRPC;
 d.querySelector('#backend-hint').textContent=nativeRPC?'使用目前 Google 部署的資料。':configured?'已使用網站設定的共用後台，登入後會讀取原有資料。':'請填入原有電腦使用的後台網址；此裝置的空白畫面不代表雲端資料遺失，無需重新匯入。';
 const updateFallback=()=>{const url=configured||u.value.trim();fallback.hidden=nativeRPC||!backendURLPattern.test(url);if(!fallback.hidden)fallback.href=url;else fallback.removeAttribute('href')};
 u.addEventListener('input',updateFallback);updateFallback();
 d.addEventListener('cancel',e=>e.preventDefault());d.showModal();
 d.querySelector('form').onsubmit=async e=>{
  e.preventDefault();const btn=d.querySelector('button'),status=d.querySelector('#login-status'),url=configured||u.value.trim();
  btn.disabled=true;status.textContent='正在連接…';
  try{
   const remember=d.querySelector('#remember-login').checked;
   const r=await cloudCall({method:'login',password:d.querySelector('#teacher-password').value,remember},url);
   if(r?.error)throw Error(r.error);
   if(!r||!validPortableSession(r.token))throw Error('Google 後台未回傳有效登入資料，請檢查原部署。');
   // Pin this session to the authenticated backend, even if browser storage is blocked.
   portableSession=r.token;
   if(!nativeRPC){portableBackendURL=url;try{localStorage.setItem('star-backend-url',url)}catch{}}
   if(remember){
    if(!rememberPortableSession()&&typeof toast==='function')toast('此瀏覽器未能記住登入；目前分頁仍可正常使用。');
   }else{try{localStorage.removeItem(portableSessionKey())}catch{}}
   d.querySelector('#teacher-password').value='';d.close();d.remove();portableLoginPromise=null;resolve();
  }catch(err){status.textContent=err.message}finally{btn.disabled=false}
 };
})}
async function portableRPC(method,arg){if(!portableSession&&!restorePortableSession())await portableLogin();let r=await cloudCall({method,arg,token:portableSession});if(r.error==='AUTH'){forgetPortableSession();await portableLogin();r=await cloudCall({method,arg,token:portableSession})}if(r.error)throw Error(r.error);return r}
