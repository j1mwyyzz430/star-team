'use strict';
let portableSession='',portableLoginPromise=null,portableBackendURL='';
const backendURLPattern=/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/;
function configuredBackendURL(){return (window.STAR_BACKEND_URL||'').trim()}
function backendURL(){
 if(configuredBackendURL())return configuredBackendURL();
 if(portableBackendURL)return portableBackendURL;
 try{return (localStorage.getItem('star-backend-url')||'').trim()}catch{return ''}
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
 d.innerHTML='<h2>星星小隊 · 老師登入</h2><p id="backend-hint"></p><form><label class="field">Google Apps Script 網址<input id="backend-url" type="url" autocomplete="url" placeholder="https://script.google.com/macros/s/…/exec"></label><label class="field">老師密碼<input id="teacher-password" type="password" autocomplete="current-password" required></label><p role="status" id="login-status"></p><button type="submit" class="primary">登入並載入分數</button></form><p class="small"><a id="google-fallback" target="_blank" rel="noopener noreferrer" hidden>開啟同一後台的 Google 備用入口</a></p><p class="small">各裝置須連接同一個後台。密碼只用於登入，不會儲存在此瀏覽器或 GitHub。</p>';
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
   const r=await cloudCall({method:'login',password:d.querySelector('#teacher-password').value},url);
   if(r?.error)throw Error(r.error);
   if(!r||typeof r.token!=='string'||!r.token)throw Error('Google 後台未回傳有效登入資料，請檢查原部署。');
   // Pin this session to the authenticated backend, even if browser storage is blocked.
   portableSession=r.token;
   if(!nativeRPC){portableBackendURL=url;try{localStorage.setItem('star-backend-url',url)}catch{}}
   d.querySelector('#teacher-password').value='';d.close();d.remove();portableLoginPromise=null;resolve();
  }catch(err){status.textContent=err.message}finally{btn.disabled=false}
 };
})}
async function portableRPC(method,arg){if(!portableSession)await portableLogin();let r=await cloudCall({method,arg,token:portableSession});if(r.error==='AUTH'){portableSession='';await portableLogin();r=await cloudCall({method,arg,token:portableSession})}if(r.error)throw Error(r.error);return r}
