'use strict';
// Grade membership lives in rosters; student additions use the existing atomic save.
let gradeCreating=false,batchEntries=[],batchPhotos=[],batchLoading=false,batchToken=0,batchPreparedText='';
function updateRosterControls(){
 $('#add-grade').disabled=!loaded||conflict||gradeCreating||activeGradeKeys().length===Object.keys(grades).length;
 $('#batch-add').disabled=!loaded||conflict||students.length>=40;
}
function selectGradeState(next){
 if(!Object.hasOwn(rosters,next))return;
 grade=next;students=rosters[grade];history=[];drawn=[];winner=null;groupIds=[];wheelGeneration++;
 try{localStorage.setItem('star-grade',grade)}catch{}
 giftStudentKey=students.length?grade+':'+students[0].id:giftStudentKey;
 $('#winner').textContent='準備好了嗎？';$('#winner-skin').innerHTML='';render();drawWheel();
}
async function createGrade(next){
 if(!usable()||saving||gradeCreating)return false;
 if(!Object.hasOwn(grades,next)||Object.hasOwn(rosters,next)){toast('這個年級已存在，請在上方選擇。');return false}
 gradeCreating=true;$('#grade-save').disabled=true;$('#grade-message').textContent='正在建立及儲存…';
 try{
  if(!commit(()=>{rosters[next]=[]}))return false;
  history=[];clearTimeout(saveTimer);await flush();
  if(dirty||syncError||conflict){$('#grade-message').textContent='年級已留在本頁，尚未確認雲端儲存。請先關閉此視窗，再按上方重試儲存。';return false}
  $('#grade-dialog').close();selectGradeState(next);toast(grades[next]+'已建立，按「批量加入」新增學生。');return true;
 }finally{gradeCreating=false;$('#grade-save').disabled=false;updateRosterControls()}
}
$('#add-grade').onclick=()=>{
 if(!usable()||saving)return;
 const available=Object.keys(grades).filter(g=>!Object.hasOwn(rosters,g));
 if(!available.length){toast('小一至小六都已建立。');return}
 $('#new-grade').innerHTML=available.map(g=>'<option value="'+g+'">'+grades[g]+'</option>').join('');
 $('#new-grade').value=available.includes('p2')?'p2':available[0];$('#grade-message').textContent='已有年級不會重複建立。';$('#grade-dialog').showModal();
};
$('#grade-form').onsubmit=async e=>{e.preventDefault();await createGrade($('#new-grade').value)};
function batchNameKey(name){return String(name).normalize('NFKC').trim().toLocaleLowerCase()}
function fileStudentName(file){return file.name.replace(/\.[^.]+$/,'').trim()}
function parseBatchNames(text){return String(text).split(/\r?\n/).map(x=>x.trim()).filter(Boolean)}
function batchIssue(entries=batchEntries){
 if(batchLoading)return '正在處理照片，請稍候。';
 if(!entries.length)return '先輸入姓名或上載照片，再按「更新姓名及照片預覽」。';
 if(entries.length+students.length>40)return '這班還可加入 '+Math.max(0,40-students.length)+' 人；請移除多出的學生。';
 const seen=new Set(students.map(s=>batchNameKey(s.name)));
 for(const entry of entries){
  const name=entry.name.trim(),key=batchNameKey(name);
  if(!name||name.length>20)return '每位學生的姓名須為 1–20 字。';
  if(seen.has(key))return '姓名「'+name+'」重複。請使用不同暱稱，避免重複加入。';
  seen.add(key);
 }
 return '';
}
function updateBatchStatus(message=''){
 const issue=batchIssue(),without=batchEntries.filter(e=>!e.photo).length;
 $('#batch-status').textContent=message||issue||(without?'已準備好；'+without+' 位未選照片，可使用姓名頭像加入。':'姓名及照片已配對，請核對後加入。');
 $('#batch-status').classList.toggle('batch-error',!!issue&&batchEntries.length>0&&!batchLoading);
 $('#batch-save').disabled=!!issue||!loaded||conflict||saving;
 $('#batch-save').textContent='確認加入 '+batchEntries.length+' 位學生';
 $('#batch-preview').disabled=batchLoading;$('#batch-photos').disabled=batchLoading;
 $('#batch-count').textContent='現有 '+students.length+' 人 · 新增 '+batchEntries.length+' 人';
}
function renderBatchPreview(message=''){
 $('#batch-list').innerHTML=batchEntries.length?batchEntries.map((entry,i)=>{
  const pooled=batchPhotos.findIndex(p=>p.photo===entry.photo),custom=entry.photo&&pooled<0;
  return '<div class="batch-person"><span data-batch-avatar="'+i+'">'+avatar({name:entry.name,photo:entry.photo})+'</span><label>姓名<input data-batch-name="'+i+'" maxlength="20" value="'+esc(entry.name)+'" '+(batchLoading?'disabled':'')+'></label><label class="batch-photo-field">照片<select data-batch-photo="'+i+'" '+(batchLoading?'disabled':'')+'><option value="">使用姓名頭像</option>'+(custom?'<option value="custom" selected>本列已選照片</option>':'')+batchPhotos.map((p,j)=>'<option value="'+j+'" '+(j===pooled?'selected':'')+'>'+esc(p.filename)+'</option>').join('')+'</select><input class="batch-single" data-batch-file="'+i+'" type="file" accept="image/jpeg,image/png,image/webp" aria-label="為'+esc(entry.name)+'選照片" '+(batchLoading?'disabled':'')+'></label><button type="button" class="batch-remove danger" data-batch-remove="'+i+'" '+(batchLoading?'disabled':'')+'>移除</button></div>';
 }).join(''):'<div class="batch-empty">姓名與頭像預覽會顯示在這裡</div>';
 updateBatchStatus(message);
}
function prepareBatchPreview(){
 if(batchLoading)return;
 const names=parseBatchNames($('#batch-names').value),previous=new Map(batchEntries.map(e=>[batchNameKey(e.name),e.photo]));
 batchEntries=names.map(name=>{
  const matches=batchPhotos.filter(p=>batchNameKey(p.name)===batchNameKey(name));
  return {name,photo:previous.get(batchNameKey(name))||(matches.length===1?matches[0].photo:'')};
 });
 batchPreparedText=$('#batch-names').value;renderBatchPreview();
}
function openBatchStudents(){
 if(!usable()||saving)return;
 batchToken++;batchEntries=[];batchPhotos=[];batchLoading=false;batchPreparedText='';
 $('#batch-names').value='';$('#batch-photos').value='';$('#batch-class').textContent=grades[grade]+' · 現有 '+students.length+' 人，每班最多 40 人';
 renderBatchPreview();$('#batch-dialog').showModal();
}
$('#batch-add').onclick=openBatchStudents;$('#batch-preview').onclick=prepareBatchPreview;
$('#batch-names').oninput=()=>{if($('#batch-names').value!==batchPreparedText){$('#batch-save').disabled=true;$('#batch-status').textContent='姓名已改動，請按「更新姓名及照片預覽」。'}};
async function readStudentPhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('請選擇 20 MB 以下的 JPG、PNG 或 WebP 照片。');
 const url=URL.createObjectURL(file);
 try{
  const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('照片無法讀取：'+file.name));img.src=url});
  const c=document.createElement('canvas');c.width=c.height=144;const ctx=c.getContext('2d'),side=Math.min(img.width,img.height);
  ctx.fillStyle='#fff';ctx.fillRect(0,0,144,144);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,144,144);
  let photo=c.toDataURL('image/jpeg',.75);if(photo.length>45000)photo=c.toDataURL('image/jpeg',.4);
  if(photo.length>45000)throw Error('照片太大：'+file.name);return photo;
 }finally{URL.revokeObjectURL(url)}
}
async function loadBatchPhotos(files){
 if(batchLoading)return;
 if(files.length>40){updateBatchStatus('每次最多上載 40 張照片。');return}
 const token=++batchToken;batchLoading=true;renderBatchPreview('正在處理照片…');const photos=[];
 try{
  for(let i=0;i<files.length;i++){
   const file=files[i],photo=await readStudentPhoto(file);if(token!==batchToken)return;
   photos.push({filename:file.name,name:fileStudentName(file),photo});$('#batch-status').textContent='正在處理照片 '+(i+1)+' / '+files.length;
  }
  if(token!==batchToken)return;batchPhotos=photos;
  if(!parseBatchNames($('#batch-names').value).length)$('#batch-names').value=photos.map(p=>p.name).join('\n');
  batchLoading=false;prepareBatchPreview();
 }catch(e){if(token===batchToken){batchLoading=false;renderBatchPreview('照片未加入：'+e.message)}}finally{if(token===batchToken){batchLoading=false;$('#batch-photos').value='';$('#batch-photos').disabled=false;$('#batch-preview').disabled=false}}
}
$('#batch-photos').onchange=e=>loadBatchPhotos(Array.from(e.target.files||[]));
$('#batch-list').oninput=e=>{
 const input=e.target.closest('[data-batch-name]');if(!input||batchLoading)return;
 const i=Number(input.dataset.batchName);if(!batchEntries[i])return;
 batchEntries[i].name=input.value;
 const preview=$('[data-batch-avatar="'+i+'"]');if(preview)preview.innerHTML=avatar({name:input.value,photo:batchEntries[i].photo});updateBatchStatus();
};
$('#batch-list').onchange=async e=>{
 if(batchLoading)return;const select=e.target.closest('[data-batch-photo]'),input=e.target.closest('[data-batch-file]');
 if(select){const entry=batchEntries[Number(select.dataset.batchPhoto)];if(!entry)return;if(select.value!=='custom')entry.photo=select.value===''?'':batchPhotos[Number(select.value)]?.photo||'';renderBatchPreview();return}
 if(!input?.files?.[0])return;const i=Number(input.dataset.batchFile),token=++batchToken;batchLoading=true;renderBatchPreview('正在處理照片…');
 try{const photo=await readStudentPhoto(input.files[0]);if(token===batchToken&&batchEntries[i])batchEntries[i].photo=photo}catch(err){if(token===batchToken)toast(err.message)}finally{if(token===batchToken){batchLoading=false;renderBatchPreview()}}
};
$('#batch-list').onclick=e=>{const b=e.target.closest('[data-batch-remove]');if(!b||batchLoading)return;batchEntries.splice(Number(b.dataset.batchRemove),1);renderBatchPreview()};
async function saveBatchStudents(){
 if(!usable()||batchLoading||saving)return false;
 if($('#batch-names').value!==batchPreparedText){updateBatchStatus('請先更新姓名及照片預覽。');return false}
 const issue=batchIssue();if(issue){updateBatchStatus(issue);return false}
 const base=students.length,entries=batchEntries.map((e,i)=>({id:'s'+(base+i+1),name:e.name.trim(),photo:e.photo,score:0,xp:0,theme:'default',present:true}));
 try{validate([...students,...entries])}catch(e){updateBatchStatus(e.message);return false}
 if(!commit(()=>students.push(...entries)))return false;
 drawn=[];winner=null;groupIds=[];$('#winner-skin').innerHTML='';$('#batch-dialog').close();drawWheel();clearTimeout(saveTimer);await flush();
 toast(dirty||syncError||conflict?'學生已留在本頁，尚未儲存，請按上方重試。':'已加入 '+entries.length+' 位學生並儲存。');return true;
}
$('#batch-save').onclick=saveBatchStudents;
$('#batch-dialog').onclose=()=>{batchToken++;batchLoading=false};
updateRosterControls();
