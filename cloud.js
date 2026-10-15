'use strict';
let portableSession='',portableLoginPromise=null;
function backendURL(){return window.STAR_BACKEND_URL||localStorage.getItem('star-backend-url')||''}
async function cloudCall(payload){
 if(window.google?.script?.run)return new Promise((resolve,reject)=>google.script.run.withSuccessHandler(resolve).withFailureHandler(reject).starApi(payload));
 const url=backendURL();if(!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url))throw Error('請先設定正確的 Google Apps Script /exec 網址');
 let response;try{response=await fetch(url,{method:'POST',redirect:'follow',credentials:'omit',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload),signal:AbortSignal.timeout(60000)})}catch(e){throw Error('Google 連線失敗。請檢查部署權限，或直接開啟 Google /exec 網址使用備用入口。')}
 if(!response.ok)throw Error('Google 服務暫時未能連線');try{return await response.json()}catch{throw Error('Google 回傳登入頁；請確認部署為「所有人」，並使用 /exec 網址。')}
}
function portableLogin(){return portableLoginPromise??=new Promise(resolve=>{
 const d=document.createElement('dialog');d.style.cssText='max-width:520px;width:92vw';d.innerHTML='<h2>星星小隊 · 老師登入</h2><p>連接你自己的 Google 試算表。</p><form><label class="field">Google Apps Script 網址<input id="backend-url" type="url" placeholder="https://script.google.com/macros/s/…/exec"></label><label class="field">老師密碼<input id="teacher-password" type="password" autocomplete="current-password" required></label><p role="status" id="login-status"></p><button type="submit" class="primary">登入並載入分數</button></form><p class="small">首次使用請按照壓縮檔中的設定教學部署。密碼不會寫入 GitHub。</p>';document.body.append(d);
 const u=d.querySelector('#backend-url');u.value=backendURL();u.parentElement.hidden=!!window.google?.script?.run;d.addEventListener('cancel',e=>e.preventDefault());d.showModal();
 d.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=d.querySelector('button'),status=d.querySelector('#login-status');btn.disabled=true;status.textContent='正在連接…';try{if(!window.google?.script?.run){window.STAR_BACKEND_URL=u.value.trim();localStorage.setItem('star-backend-url',window.STAR_BACKEND_URL)}const r=await cloudCall({method:'login',password:d.querySelector('#teacher-password').value});if(r.error)throw Error(r.error);portableSession=r.token;d.close();d.remove();portableLoginPromise=null;resolve()}catch(err){status.textContent=err.message}finally{btn.disabled=false}};
})}
async function portableRPC(method,arg){if(!portableSession)await portableLogin();let r=await cloudCall({method,arg,token:portableSession});if(r.error==='AUTH'){portableSession='';await portableLogin();r=await cloudCall({method,arg,token:portableSession})}if(r.error)throw Error(r.error);return r}
