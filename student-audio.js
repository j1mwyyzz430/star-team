'use strict';
// Student clips use class + student IDs; the shared deduction clip has its own local key.
const studentSounds=new Map();let soundDBPromise,soundTarget=null,soundDraft=null,recording=null,recordStream=null,recordTimer=0,soundGeneration=0,soundBusy=false,suppressRewardTone=false;
const deductionSoundKey='global:deduct';
function soundKey(g,id){return g+':'+id}
function soundDB(){return soundDBPromise??=new Promise((resolve,reject)=>{const r=indexedDB.open('star-team-student-audio-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('sounds',{keyPath:'key'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function soundStore(mode,action){const db=await soundDB();return new Promise((resolve,reject)=>{const tx=db.transaction('sounds',mode),r=action(tx.objectStore('sounds'));tx.oncomplete=()=>resolve(r.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('儲存取消'))})}
const soundReady=soundStore('readonly',s=>s.getAll()).then(rows=>rows.forEach(r=>studentSounds.set(r.key,r))).catch(()=>{});
// One AudioContext clock keeps all award clips aligned, even when decoding takes different times.
const soundBuffers=new WeakMap(),playingSources=new Set();
let soundPlaybackGeneration=0,soundMix=null;
function stopStudentSound(){
 soundPlaybackGeneration++;
 for(const source of playingSources){source.onended=null;try{source.stop()}catch{}source.disconnect()}
 playingSources.clear();soundMix?.disconnect();soundMix=null;
}
function decodeStudentSound(blob,ctx){
 if(!soundBuffers.has(blob))soundBuffers.set(blob,blob.arrayBuffer().then(bytes=>ctx.decodeAudioData(bytes)).catch(e=>{soundBuffers.delete(blob);throw e}));
 return soundBuffers.get(blob);
}
async function playStudentSounds(blobs,{reward=false,level=0}={}){
 stopStudentSound();const token=soundPlaybackGeneration;
 if(document.hidden)return;
 try{
  audioContext??=new(window.AudioContext||window.webkitAudioContext)();const ctx=audioContext;
  // Resume inside the click handler, before waiting for IndexedDB or decoding (iPad autoplay).
  const [,clips]=await Promise.all([ctx.resume(),Promise.resolve(blobs)]);
  if(token!==soundPlaybackGeneration)return;
  const results=await Promise.allSettled(clips.map(blob=>decodeStudentSound(blob,ctx)));
  if(token!==soundPlaybackGeneration)return;
  const buffers=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  if(!buffers.length){if(reward)oldRewardTone(level);if(clips.length)toast('未能讀取音效，請重新上傳。');return}
  const mix=ctx.createGain();mix.gain.value=1/buffers.length;mix.connect(ctx.destination);soundMix=mix;
  // Create every source before choosing the shared start time.
  const sources=buffers.map(buffer=>{const source=ctx.createBufferSource();source.buffer=buffer;source.connect(mix);playingSources.add(source);source.onended=()=>{source.disconnect();playingSources.delete(source);if(soundMix===mix&&!playingSources.size){mix.disconnect();soundMix=null}};return source});
  const startAt=ctx.currentTime+.04;for(const source of sources)source.start(startAt);
  if(buffers.length<clips.length)toast('部分音效無法讀取，其餘已同步播放。');
 }catch(e){if(token===soundPlaybackGeneration){stopStudentSound();if(reward)oldRewardTone(level);toast('未能播放音效，請開啟聲音後再試。')}}
}
function playStudentSound(blob){return playStudentSounds([blob])}
const oldRewardTone=tone;tone=function(...args){if(!suppressRewardTone)return oldRewardTone(...args)};
const soundAward=collectionAward;
collectionAward=function(before,after,ids){
 const changed=after.filter(s=>ids.includes(s.id)&&s.score>(before.find(b=>b.id===s.id)?.score??s.score));
 const custom=audioEnabled&&changed.length>0,awardGrade=grade;
 suppressRewardTone=custom;try{soundAward(before,after,ids)}finally{suppressRewardTone=false}
 if(custom){
  const clips=soundReady.then(()=>changed.map(s=>studentSounds.get(soundKey(awardGrade,s.id))?.blob).filter(Boolean));
  playStudentSounds(clips,{reward:true,level:changed.some(s=>s.score%10===0)?1:0});
 }
};
// Only actual score deductions trigger the shared clip, once per action.
const soundDeduct=deduct;
deduct=function(ids){
 const before=new Map(students.map(s=>[s.id,s.score]));
 const result=soundDeduct(ids);
 if(audioEnabled&&students.some(s=>ids.includes(s.id)&&s.score<before.get(s.id))){
  const clips=soundReady.then(()=>{const blob=studentSounds.get(deductionSoundKey)?.blob;return blob?[blob]:[]});
  playStudentSounds(clips);
 }
 return result;
};
const soundDialog=document.createElement('dialog');soundDialog.id='student-sound-dialog';soundDialog.innerHTML='<div class="dialog-head"><h2 id="student-sound-title">加分音效</h2><button type="button" id="sound-close" aria-label="關閉">×</button></div><p id="sound-description"></p><p class="small">音效保存在這部裝置的瀏覽器，換裝置需重新上傳；可先下載備份。請先開啟頁頂「音效」。</p><p id="sound-behavior" class="small"></p><div class="row"><button id="sound-record" type="button">● 開始錄音</button><button id="sound-stop" type="button" disabled>■ 停止錄音</button></div><label class="field"><span>上傳音訊（最多 10 MB）</span><input id="sound-file" type="file" accept="audio/*,.mp3,.m4a,.wav"></label><p id="sound-status" role="status" aria-live="polite"></p><div class="row"><button id="sound-preview" type="button">▶ 試聽</button><button id="sound-download" type="button">下載備份</button><button id="sound-remove" type="button">移除</button><button id="sound-save" class="primary" type="button">儲存音效</button></div>';
document.body.append(soundDialog);
function soundControls(){const active=!!recording||soundBusy;$('#sound-record').disabled=active;$('#sound-stop').disabled=!recording;$('#sound-file').disabled=active;for(const id of ['sound-preview','sound-download','sound-remove'])$('#'+id).disabled=active||!soundDraft;$('#sound-save').disabled=active}
function soundLabel(target=soundTarget){return target?.kind==='deduct'?'扣分音效':'加分音效'}
function soundEmptyMessage(){return soundTarget?.kind==='deduct'?'未設定，扣分時不播放音效。':'未設定，使用原本提示音。'}
async function openSoundEditor(target){
 const token=++soundGeneration;soundTarget=target;soundDraft=null;soundBusy=true;
 $('#student-sound-title').textContent=target.name+' · '+soundLabel();
 $('#sound-description').textContent=target.kind==='deduct'?'所有班別、所有學生扣分時統一播放這一段。可直接錄音，或上傳 MP3／M4A／WAV；最多保留前 8 秒。':'錄低一句打氣說話，或者上傳 MP3／M4A／WAV。每次為這位學生加分就會播放；最多保留前 8 秒。';
 $('#sound-behavior').textContent=target.kind==='deduct'?'只有實際扣到分才會播放；分數已是 0、缺席或音效關閉時不播放。':'全班或整組加分時，已設定錄音且實際獲加分的學生音效會同步播放，合播音量會自動調整。';
 $('#sound-status').textContent='正在讀取…';$('#sound-file').value='';soundControls();soundDialog.showModal();
 await soundReady;if(token!==soundGeneration)return;
 soundDraft=studentSounds.get(target.key)?.blob||null;soundBusy=false;
 $('#sound-status').textContent=soundDraft?'已設定'+soundLabel()+'。':soundEmptyMessage();soundControls();
}
function openStudentSound(s){return openSoundEditor({key:soundKey(grade,s.id),name:s.name,kind:'award'})}
function stopRecording(discard=false){if(recordTimer)clearTimeout(recordTimer);recordTimer=0;if(discard)soundGeneration++;if(recording&&recording.state!=='inactive')recording.stop();recordStream?.getTracks().forEach(t=>t.stop());recordStream=null}
function closeSound(){stopRecording(true);stopStudentSound();soundBusy=false;soundDialog.close()}
$('#sound-close').onclick=closeSound;soundDialog.addEventListener('cancel',closeSound);soundDialog.addEventListener('close',()=>{stopRecording(true);stopStudentSound()});
function encodeSoundWav(buffer){const n=buffer.length,out=new ArrayBuffer(44+n*2),v=new DataView(out),put=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i))};put(0,'RIFF');v.setUint32(4,36+n*2,true);put(8,'WAVE');put(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,buffer.sampleRate,true);v.setUint32(28,buffer.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);put(36,'data');v.setUint32(40,n*2,true);const data=buffer.getChannelData(0);for(let i=0;i<n;i++){const fade=Math.min(1,i/220,(n-1-i)/440),x=Math.max(-1,Math.min(1,data[i]*fade));v.setInt16(44+i*2,x<0?x*32768:x*32767,true)}return new Blob([out],{type:'audio/wav'})}
async function prepareSound(blob,token){let ctx;try{if(blob.size>10*1024*1024)throw Error('音訊太大，請選擇 10 MB 以下檔案');soundBusy=true;soundControls();$('#sound-status').textContent='正在處理音訊…';ctx=new(window.AudioContext||window.webkitAudioContext)();const decoded=await ctx.decodeAudioData(await blob.arrayBuffer());if(!decoded.length)throw Error('音訊沒有內容');const duration=Math.min(8,decoded.duration),offline=new(window.OfflineAudioContext||window.webkitOfflineAudioContext)(1,Math.ceil(duration*22050),22050),src=offline.createBufferSource();src.buffer=decoded;src.connect(offline.destination);src.start();const rendered=await offline.startRendering();if(token!==soundGeneration)return;soundDraft=encodeSoundWav(rendered);$('#sound-status').textContent='已準備 '+duration.toFixed(1)+' 秒音效，請試聽後按「儲存音效」。'}catch(e){if(token===soundGeneration)$('#sound-status').textContent=e.message||'無法讀取音訊，請改用 MP3。'}finally{ctx?.close();if(token===soundGeneration){soundBusy=false;soundControls()}}}
$('#sound-file').onchange=e=>{const f=e.target.files[0];if(f)prepareSound(f,soundGeneration)};
$('#sound-record').onclick=async()=>{const token=soundGeneration;if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){$('#sound-status').textContent='此瀏覽器未支援錄音，請使用 Safari 或上傳 MP3。';return}soundBusy=true;soundControls();try{const stream=await navigator.mediaDevices.getUserMedia({audio:true});if(token!==soundGeneration){stream.getTracks().forEach(t=>t.stop());return}recordStream=stream;const mime=['audio/mp4','audio/webm;codecs=opus','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));const rec=new MediaRecorder(stream,mime?{mimeType:mime}:{}),chunks=[];recording=rec;rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};rec.onstop=()=>{stream.getTracks().forEach(t=>t.stop());if(recording===rec){recording=null;recordStream=null}if(token===soundGeneration){soundBusy=false;prepareSound(new Blob(chunks,{type:rec.mimeType}),token)}};rec.onerror=()=>{stopRecording(true);recording=null;soundBusy=false;$('#sound-status').textContent='錄音失敗，請再試或上傳音訊。';soundControls()};rec.start();soundBusy=false;$('#sound-status').textContent='錄音中…最多 8 秒，按停止完成。';recordTimer=setTimeout(()=>stopRecording(),8000);soundControls()}catch(e){if(token===soundGeneration){soundBusy=false;$('#sound-status').textContent='未能使用麥克風。請允許此網站錄音，或上傳 MP3。';soundControls()}}};
$('#sound-stop').onclick=()=>stopRecording();$('#sound-preview').onclick=()=>{if(soundDraft)playStudentSound(soundDraft)};$('#sound-remove').onclick=()=>{stopStudentSound();soundDraft=null;$('#sound-status').textContent='按「儲存音效」確認移除。'+soundEmptyMessage();soundControls()};
$('#sound-download').onclick=()=>{if(!soundDraft)return;const url=URL.createObjectURL(soundDraft),a=document.createElement('a');a.href=url;a.download=soundTarget.name+'-'+soundLabel()+'.wav';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000)};
$('#sound-save').onclick=async()=>{if(soundBusy||recording||!soundTarget)return;const target={...soundTarget},blob=soundDraft; soundBusy=true;soundControls();try{const row={key:target.key,blob};await soundStore('readwrite',s=>blob?s.put(row):s.delete(target.key));if(blob)studentSounds.set(target.key,row);else studentSounds.delete(target.key);closeSound();toast('已儲存 '+target.name+' 的'+soundLabel(target)+'（此裝置）')}catch(e){$('#sound-status').textContent='儲存失敗，請檢查瀏覽器儲存空間。'}finally{soundBusy=false;soundControls()}};
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopRecording(true);stopStudentSound()}});
const priorSoundClick=$('#sound').onclick;$('#sound').onclick=()=>{priorSoundClick?.();if(!audioEnabled)stopStudentSound()};
const soundSettingsButton=document.createElement('button');soundSettingsButton.type='button';soundSettingsButton.id='student-sound-settings';soundSettingsButton.textContent='♫ 設定個人加分音效';soundSettingsButton.onclick=()=>{const s=students[editing];if(s)openStudentSound(s);else toast('請先儲存新增學生，再設定音效。')};$('#edit-form').insertBefore(soundSettingsButton,$('#edit-save'));

const deductSoundSettingsButton=document.createElement('button');deductSoundSettingsButton.type='button';deductSoundSettingsButton.id='deduct-sound-settings';deductSoundSettingsButton.textContent='♫ 設定共用扣分音效';deductSoundSettingsButton.onclick=()=>openSoundEditor({key:deductionSoundKey,name:'全班共用',kind:'deduct'});$('#settings-dialog .dialog-head').insertAdjacentElement('afterend',deductSoundSettingsButton);
