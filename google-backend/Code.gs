/* 星星小隊 Google backend. Keep this project and spreadsheet private. */
function props_(){return PropertiesService.getScriptProperties()}
function onOpen(){SpreadsheetApp.getUi().createMenu('星星小隊').addItem('首次設定／更改密碼','setup_').addItem('更新學生／禮物報表','refreshReports_').addItem('套用學生報表修改','applyReport_').addToUi()}
function setup_(){
 const ui=SpreadsheetApp.getUi(),r=ui.prompt('老師密碼','設定至少 16 個字元的密碼，請保存好。只在這裡輸入，不要放在 GitHub。',ui.ButtonSet.OK_CANCEL);if(r.getSelectedButton()!==ui.Button.OK)return;const password=r.getResponseText();if(password.length<16)throw Error('密碼至少 16 個字元');
 const p=props_(),salt=Utilities.getUuid();p.setProperties({SHEET_ID:SpreadsheetApp.getActiveSpreadsheet().getId(),SALT:salt,PASSWORD_HASH:hash_(salt+password),SECRET:Utilities.getUuid()+Utilities.getUuid()});
 if(!p.getProperty('ACTIVE'))writeState_({version:0,lastOpId:'',rosters:{p4:[],p5:[],p6:[]},extras:{gifts:[],receipts:[],drawCost:1,currencyVersion:2}});
 ui.alert('設定完成。請部署為網頁應用程式，執行身分「我」，存取權「所有人」。老師密碼由本程式另行驗證。');
}
function hash_(s){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s))}
function sign_(s){return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s,props_().getProperty('SECRET')))}
function authorised_(token){if(typeof token!=='string')return false;const [body,signature]=token.split('.');return Number(body)>Date.now()&&signature===sign_(body)}
function login_(password,remember=false){
 const p=props_();if(!p.getProperty('SECRET'))throw Error('請先在試算表執行 setup_ 設定');const c=CacheService.getScriptCache(),n=Number(c.get('failures')||0);if(n>=20)throw Error('登入失敗次數過多，請 10 分鐘後再試');
 if(typeof password!=='string'||hash_(p.getProperty('SALT')+password)!==p.getProperty('PASSWORD_HASH')){c.put('failures',String(n+1),600);throw Error('密碼不正確')}c.remove('failures');const expiry=String(Date.now()+(remember?90*24*3600000:12*3600000));return {token:expiry+'.'+sign_(expiry)};
}
function book_(){return SpreadsheetApp.openById(props_().getProperty('SHEET_ID'))}
function readState_(){const p=props_(),bank=p.getProperty('ACTIVE');if(!bank)throw Error('請先完成設定');const s=book_().getSheetByName(bank);return JSON.parse(s.getRange(1,1,s.getLastRow(),1).getValues().map(r=>String(r[0]).slice(1)).join(''))}
function writeState_(state){
 // Write inactive bank completely before committing pointer; old bank remains rollback copy.
 const p=props_(),name=p.getProperty('ACTIVE')==='_state_A'?'_state_B':'_state_A',b=book_(),s=b.getSheetByName(name)||b.insertSheet(name),text=JSON.stringify(state),chunks=[];for(let i=0;i<text.length;i+=40000)chunks.push([':'+text.slice(i,i+40000)]);
 s.clearContents();if(s.getMaxRows()<chunks.length)s.insertRowsAfter(s.getMaxRows(),chunks.length-s.getMaxRows());s.getRange(1,1,chunks.length,1).setNumberFormat('@').setValues(chunks);SpreadsheetApp.flush();p.setProperty('ACTIVE',name);
}
function starApi(req){try{
 if(!req||typeof req!=='object')throw Error('請求格式錯誤');if(req.method==='login')return login_(req.password,req.remember===true);if(!authorised_(req.token))return {error:'AUTH'};
 const lock=LockService.getScriptLock();lock.waitLock(25000);try{
 const state=readState_();if(req.method==='getState')return clientState_(state);if(req.method!=='saveState')throw Error('未知操作');const a=req.arg;
 if(!a||typeof a.opId!=='string'||!/^[\w-]{1,80}$/.test(a.opId))throw Error('操作編號錯誤');if(state.lastOpId===a.opId)return clientState_(state);if(state.schemaVersion===2&&a.clientVersion!==2)throw Error('UPDATE_REQUIRED：請重新整理網站，使用最新班別管理版本');if(a.baseVersion!==state.version)throw Error('CONFLICT：另一裝置已更新，請匯出本頁備份再同步');
 validateState_(a);const next={schemaVersion:a.clientVersion===2?2:(state.schemaVersion||1),rosters:a.rosters,extras:a.extras,version:state.version+1,lastOpId:a.opId};writeState_(next);return clientState_(next);
 }finally{lock.releaseLock()}
 }catch(e){return {error:String(e.message||e)}}}
function doPost(e){let result;try{if(!e.postData||e.postData.contents.length>16000000)throw Error('資料太大');result=starApi(JSON.parse(e.postData.contents))}catch(err){result={error:String(err.message)}}return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)}
function doGet(){return HtmlService.createHtmlOutputFromFile('Index').setTitle('星星小隊 · 課堂計分').addMetaTag('viewport','width=device-width, initial-scale=1')}
function validateState_(a){
 const w=a.extras?.drawWeights;if(w!==undefined&&(!w||typeof w!=='object'||Array.isArray(w)||Object.keys(w).length!==3||![2,3,4].every(t=>Number.isSafeInteger(w[t])&&w[t]>=0&&w[t]<=10000)||![2,3,4].some(t=>w[t]>0)))throw Error('抽獎權重不正確');
 const integer=(v,max)=>Number.isSafeInteger(v)&&v>=0&&v<=max,photo=(v,max)=>typeof v==='string'&&v.length<=max&&(!v||/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(v));
 if(!a.rosters||typeof a.rosters!=='object'||Array.isArray(a.rosters)||Object.keys(a.rosters).length>30)throw Error('班別資料不正確');validateClassNames(a.extras?.classNames,a.rosters);
 for(const [g,students] of Object.entries(a.rosters)){if(!validClassId(g)||!Array.isArray(students)||students.length>100||new Set(students.map(s=>s.id)).size!==students.length)throw Error('年級或人數不正確');students.forEach((s,i)=>{if(!validStudentId(s.id)||typeof s.name!=='string'||!s.name.trim()||s.name.length>20||!integer(s.score,999999)||!integer(s.xp??s.score,99999999)||typeof s.present!=='boolean'||!photo(s.photo,45000)||s.theme!==undefined&&!ALLOWED_THEMES.includes(s.theme))throw Error('學生資料不正確，頭像必須包含在備份中')})}
 const x=a.extras,id=v=>typeof v==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(v);if(!x||x.currencyVersion!==2||!integer(x.drawCost,999999)||!Array.isArray(x.gifts)||x.gifts.length>60||!Array.isArray(x.receipts)||x.receipts.length>300)throw Error('禮物資料錯誤');
 if(new Set(x.gifts.map(g=>g.id)).size!==x.gifts.length||new Set(x.receipts.map(r=>r.id)).size!==x.receipts.length)throw Error('編號重複');
 for(const g of x.gifts)if(!id(g.id)||typeof g.name!=='string'||!g.name.trim()||g.name.length>60||!integer(g.cost,999999)||!(g.stock===-1||integer(g.stock,999999))||typeof g.draw!=='boolean'||g.rarity!==undefined&&![2,3,4].includes(g.rarity)||g.image!==undefined&&!photo(g.image,70000))throw Error('禮物格式不正確，請重新上載缺失圖片');
 for(const r of x.receipts)if(!id(r.id)||!validStudentId(r.studentId)||!id(r.giftId)||typeof r.giftName!=='string'||r.giftName.length>60||!integer(r.cost,999999)||typeof r.time!=='string'||!Number.isFinite(Date.parse(r.time))||!['pending','delivered','refunded'].includes(r.status)||!['redeem','draw'].includes(r.kind)||r.grade!==undefined&&!validClassId(r.grade))throw Error('兌換紀錄不正確');
 for(const r of x.receipts){if(r.studentName!==undefined&&(typeof r.studentName!=='string'||r.studentName.length>20)||r.className!==undefined&&(typeof r.className!=='string'||r.className.length>30))throw Error('紀錄名稱不正確');if(r.status==='pending'&&!a.rosters[r.grade||'p6']?.some(s=>s.id===r.studentId))throw Error('待派發禮物的學生不能刪除，請先派發或退款');}
 if(JSON.stringify(a).length>14000000)throw Error('資料超過 14 MB，請減少圖片大小');
}
function refreshReports_(){const lock=LockService.getScriptLock();lock.waitLock(25000);try{const s=readState_(),b=book_(),safe=v=>typeof v==='string'&&/^[=+@-]/.test(v)?"'"+v:v;
 const table=(name,rows)=>{const sheet=b.getSheetByName(name)||b.insertSheet(name);sheet.clearContents();sheet.getRange(1,1,rows.length,rows[0].length).setValues(rows.map(r=>r.map(safe)));sheet.setFrozenRows(1);sheet.autoResizeColumns(1,rows[0].length)};
 props_().setProperty('REPORT_VERSION',String(s.version));
 table('學生報表',[['班別ID','學生ID','姓名','可用小星星','經驗值','名片','出席','班別名稱'],...Object.entries(s.rosters).flatMap(([g,list])=>list.map(x=>[g,x.id,x.name,x.score,x.xp??x.score,x.theme??'default',x.present,s.extras.classNames?.[g]||legacyClassNames[g]||g]))]);
 table('禮物報表',[['ID','禮物','彩色星星價格','庫存','稀有度','抽獎'],...s.extras.gifts.map(g=>[g.id,g.name,g.cost,g.stock,g.rarity??2,g.draw])]);
 table('兌換報表',[['時間','班別','學生ID','禮物','價格','狀態'],...s.extras.receipts.map(r=>[r.time,r.className||s.extras.classNames?.[r.grade]||legacyClassNames[r.grade]||r.grade||'',r.studentId,r.giftName,r.cost,r.status])]);
 }finally{lock.releaseLock()}}

const ALLOWED_THEMES=["default", "ocean", "sunset", "forest", "galaxy", "rainbow", "t2-rose", "t2-mint", "t2-azure", "t2-amber", "t2-violet", "t2-coral", "t2-jade", "t2-navy", "t2-peach", "t2-lime", "t2-ruby", "t2-lilac", "t2-aqua", "t2-sand", "t2-silver", "t2-cobalt", "t2-orchid", "t2-teal", "t2-copper", "t2-lemon", "t1-flare", "t1-frost", "t1-prism", "t1-solar", "t1-storm", "t1-nova", "t1-jade", "t1-rose", "t0-inferno", "t0-glacier", "t0-rainbow", "t0-sovereign", "t0-verdant", "t0-tempest", "t0-ocean", "t0-lunar", "t0-aurora", "t0-comet", "t0-chrono", "t0-eclipse", "t0-crystal", "t0-abyss", "t0-cosmos", "t0-seraph", "t0-omni", "t0-genesis", "m1-rail", "m1-sonic", "m1-emperor"];

function applyReport_(){
 const ui=SpreadsheetApp.getUi();if(ui.alert('套用學生報表','只套用姓名、分數、經驗、出席。請先關閉網站編輯或暫停加分。確定？',ui.ButtonSet.YES_NO)!==ui.Button.YES)return;
 const lock=LockService.getScriptLock();lock.waitLock(25000);try{
 const state=readState_();if(String(state.version)!==props_().getProperty('REPORT_VERSION'))throw Error('網站已有新資料，請先更新報表再編輯；本次沒有覆蓋資料。');
 const sheet=book_().getSheetByName('學生報表'),n=sheet.getLastRow()-1,rows=n?sheet.getRange(2,1,n,7).getValues():[];
 if(rows.length!==Object.values(state.rosters).reduce((n,a)=>n+a.length,0))throw Error('不要在報表新增或刪除學生；請到網站處理。');
 const seen=new Set();for(const [g,id,name,score,xp,theme,present] of rows){const key=g+':'+id,s=state.rosters[g]?.find(x=>x.id===id);if(!s||seen.has(key))throw Error('學生 ID 被修改或重複');seen.add(key);if(typeof present!=='boolean')throw Error('出席欄請填 TRUE 或 FALSE');s.name=String(name).replace(/^'(?=[=+@-])/,'');s.score=score;s.xp=xp;s.present=present;}
 validateState_(state);state.version++;state.lastOpId='sheet-'+Utilities.getUuid();writeState_(state);props_().setProperty('REPORT_VERSION',String(state.version));ui.alert('已套用。網站按「同步最新分數」即可讀取。');
 }finally{lock.releaseLock()}
}

// ID and class-name rules shared with roster-model.js. Keep these in sync.
const legacyClassNames={p1:'一年級',p2:'二年級',p3:'三年級',p4:'四年級',p5:'五年級',p6:'六年級'};
const validClassId=id=>typeof id==='string'&&/^(?:p[1-6]|c-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(id);
const validStudentId=id=>typeof id==='string'&&/^(?:s[1-9][0-9]{0,5}|s-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(id);
function validateClassNames(names,lists){
 if(names!==undefined){if(!names||typeof names!=='object'||Array.isArray(names)||Object.keys(names).length>30)throw Error('班別名稱資料不正確');for(const [id,name] of Object.entries(names))if(!validClassId(id)||typeof name!=='string'||!name.trim()||name.length>30)throw Error('班別名稱須為 1–30 字');}
 if(lists)for(const id of Object.keys(lists))if(!legacyClassNames[id]&&!names?.[id])throw Error('班別名稱缺失');
}

function clientState_(state){return {...state,capabilities:{classManagement:true}}}
