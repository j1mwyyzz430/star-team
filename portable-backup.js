'use strict';
const blobData=b=>new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(b)});
$('#export').onclick=async()=>{if(!loaded)return toast('請先載入資料');try{await soundReady;const sounds=await Promise.all([...studentSounds.values()].map(async r=>({key:r.key,data:await blobData(r.blob)})));const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify({format:'star-team-v5',exportedAt:new Date().toISOString(),rosters,extras,sounds})],{type:'application/json'}));a.download='星星小隊完整備份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),10000)}catch(e){toast('備份失敗：'+e.message)}};
const legacyImport=$('#import-file').onchange;
$('#import-file').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>150000000)throw Error('檔案太大');const data=JSON.parse(await f.text());if(!['star-team-v4','star-team-v5'].includes(data.format))return legacyImport(e);validateRosterData(data.rosters);validateExtras(data.extras);
 const missing=[...Object.values(data.rosters).flat().filter(s=>s.photo.startsWith('/api/')).map(s=>s.name),...data.extras.gifts.filter(g=>g.image?.startsWith('/api/')).map(g=>g.name)];if(missing.length)throw Error('備份仍有舊站圖片連結：'+missing.join('、')+'。請用套件的「完整搬家備份」重新匯出。');
 const sounds=data.sounds||[];if(!Array.isArray(sounds)||sounds.length>240)throw Error('音訊備份格式錯誤');for(const r of sounds)if(!/^p[1-6]:s(?:[1-9]|[1-3][0-9]|40)$/.test(r.key)||typeof r.data!=='string'||r.data.length>500000||!/^data:audio\/(wav|x-wav);base64,[A-Za-z0-9+/=]+$/.test(r.data))throw Error('音訊格式錯誤');
 if(!confirm('匯入備份中的年級、分數、禮物，以及 '+sounds.length+' 個本機音效？建議先匯出目前備份。'))return;
 if(!commit(()=>{rosters={...rosters,...copy(data.rosters)};students=rosters[grade];extras=copy(data.extras)}))return;
 drawn=[];winner=null;groupIds=[];render();drawWheel();await flush();
 try{await soundReady;for(const r of sounds){const blob=await(await fetch(r.data)).blob(),row={key:r.key,blob};await soundStore('readwrite',s=>s.put(row));studentSounds.set(row.key,row)}}catch{toast('分數已匯入，但部分本機音效失敗；請重新上傳音效。');return}
 toast(dirty?'資料已載入本頁，請重試雲端儲存，勿關閉分頁。':'已匯入並儲存；音效保存在這部裝置。');
 }catch(err){toast('匯入失敗：'+err.message)}finally{e.target.value=''}};
