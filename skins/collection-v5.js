'use strict';
// Collection progress is derived from saved XP. Rendering never spends stars,
// changes XP, changes wheel odds, or writes separate unlock flags.
const collectionBeasts=skins.filter(k=>k.tier===0&&!k.series).sort((a,b)=>a.level-b.level);
const collectionTitles={fire:'熔火龍息',ice:'冰河踏境',rainbow:'萬蝶光海',gold:'獅皇日輪',nature:'萬葉甦生',storm:'蒼雷奔襲',tide:'星海躍潮',moon:'月影九尾',aurora:'風嵐天幕',comet:'彗星疾行',time:'時輪逆轉',eclipse:'日蝕加冕',crystal:'晶龍稜域',void:'虛空裂界',cosmos:'玄武星圖',seraph:'六劍聖陣',omni:'萬象祥雲',genesis:'創世展翼',rail:'磁軌躍遷',sonic:'音浪主場',mecha:'天穹王座'};
function collectionStart(k){const i=collectionBeasts.findIndex(b=>b.id===k?.id);return i<0?Infinity:100+i*120+5*i*(i-1)}
function collectionExtra(s){return Math.max(0,(s?.xp??s?.score??0)-xpAtLevel(100))}
function collectionStage(s,k=skinOf(s)){if(!k||k.tier!==0)return 0;if(k.series==='mecha')return canEquip(s,k)?3:0;const n=collectionExtra(s)-collectionStart(k);return n<0?0:n<40?1:n<80?2:3}
function collectionMilestones(){return [...collectionBeasts.flatMap(k=>['專屬邊框','出場動畫','終極演出'].map((name,i)=>({xp:xpAtLevel(100)+collectionStart(k)+40*i,name:k.name+' · '+name,id:k.id,stage:i+1}))),...skins.filter(k=>k.series==='mecha').map(k=>({xp:skinUnlockXp(k),name:k.name+' · 新角色',id:k.id,stage:3}))].sort((a,b)=>a.xp-b.xp)}
const collectionRoad=collectionMilestones();
function collectionNext(s){return collectionRoad.find(m=>m.xp>(s.xp??s.score??0))}
let collectionTab='beasts',collectionScene=null,collectionRaf=0,collectionLastFrame=0;
const collectionOldLevel=levelMarkup,collectionOldLayer=skinLayer,collectionOldClass=skinClass,collectionOldWardrobe=renderWardrobe,collectionOldOpen=openSkin,collectionOldWinner=showWinnerSkin;
levelMarkup=function(s){if(levelOf(s).level<100)return collectionOldLevel(s);const next=collectionNext(s),xp=s.xp??s.score,done=collectionRoad.filter(m=>m.xp<=xp).length,prev=collectionRoad.filter(m=>m.xp<=xp).at(-1)?.xp??xpAtLevel(100),progress=next?Math.min(100,100*(xp-prev)/(next.xp-prev)):100;return '<div class="level-row"><span class="level-badge">Lv.100</span><span>覺醒收藏 '+done+'/'+collectionRoad.length+' · '+(next?'再 '+(next.xp-xp)+' 經驗':'全收藏完成')+'</span></div><div class="xp-track" aria-label="覺醒收藏進度 '+Math.round(progress)+'%"><i style="width:'+progress+'%"></i></div>'};
skinClass=function(s){return collectionOldClass(s)+(collectionStage(s)?' awakened stage-'+collectionStage(s):'')};
skinLayer=function(s){const stage=collectionStage(s);return collectionOldLayer(s).replace('class="skin-border"','class="skin-border" data-awakening="'+stage+'"')+(stage?'<span class="awakening-seal" aria-hidden="true">'+['','Ⅰ','Ⅱ','Ⅲ'][stage]+'</span>':'')};
function collectionSwatch(k){return '<div class="skin-swatch" style="'+skinStyle({theme:k.id})+'">'+artMarkup(k)+'<span class="skin-tier">'+(k.series?'機甲':'覺醒')+'</span><span class="skin-swatch-name">'+esc(k.name)+'</span></div>'}
renderWardrobe=function(){collectionOldWardrobe();const s=students.find(s=>s.id===$('#skin-student').value)||students[0];$('#skin-filters').hidden=collectionTab!=='beasts';if(!s){$('#collection-summary').innerHTML='';return}const xp=s.xp??s.score,next=collectionNext(s),done=collectionRoad.filter(m=>m.xp<=xp).length;
 $('#collection-summary').innerHTML='<div class="collection-banner"><div><span class="eyebrow">CHAPTER II · 專屬收藏</span><h3>'+ (levelOf(s).level<100?'先收藏角色，再收藏專屬演出':'Lv.100 之後，冒險繼續')+'</h3><p>'+esc(s.name)+' · '+done+' / '+collectionRoad.length+' 項專屬收藏 · '+collectionExtra(s)+' 覺醒經驗</p><small>'+(next?'下一項：'+esc(next.name)+' · 再 '+(next.xp-xp)+' 經驗':'全部解鎖！選擇你最喜歡的角色，繼續集星。')+'</small></div><span class="collection-emblem" aria-hidden="true">✦</span></div>';
 if(collectionTab==='awakening'){$('#skin-grid').innerHTML=collectionBeasts.map((k,i)=>{const stage=collectionStage(s,k);return '<article class="skin-tile awakening-tile" data-tier="0">'+collectionSwatch(k)+'<p class="small">第 '+(i+1)+' 位 · '+esc(collectionTitles[k.fx])+'</p><div class="awakening-steps">'+['專屬邊框','出場動畫','終極演出'].map((label,j)=>'<div class="'+(stage>j?'earned':'')+'"><b>'+(stage>j?'✓':'◇')+' '+label+'</b><small>100 級後 ＋'+(collectionStart(k)+j*40)+' 經驗</small></div>').join('')+'</div><button data-skin-preview="'+k.id+'">預覽專屬演出</button><small class="collection-auto">'+(stage?'已解鎖部分會在裝備此角色時自動啟用':'免費解鎖；收藏角色與演出分開累積')+'</small></article>'}).join('')}
 else{$('#skin-grid').innerHTML=skins.filter(k=>collectionTab==='mecha'?k.series==='mecha':!k.series&&(skinFilter==='all'||String(k.tier)===skinFilter)).map(k=>'<article class="skin-tile '+(s.theme===k.id?'equipped':'')+'" data-tier="'+k.tier+'">'+(k.series?collectionSwatch(k):'<div class="skin-swatch" style="'+skinStyle({theme:k.id})+'">'+artMarkup(k)+'<span class="skin-tier">T'+k.tier+'</span><span class="skin-swatch-name">'+esc(k.name)+'</span></div>')+'<p class="small">'+(s.theme===k.id?'✓ 使用中':canEquip(s,k)?'已解鎖 · 免費換裝':skinUnlockLabel(k)+' 解鎖')+'</p><button data-skin-preview="'+k.id+'">試看'+(k.tier<2?'特效':'名片')+'</button></article>').join('')}
};
$('#skin-student').onchange=renderWardrobe;
$('#collection-tabs').onclick=e=>{const b=e.target.closest('[data-collection]');if(!b)return;collectionTab=b.dataset.collection;$$('#collection-tabs button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));renderWardrobe()};
openSkin=function(id){collectionOldOpen(id);const k=skins.find(k=>k.id===id),s=students.find(s=>s.id===$('#skin-student').value);if(!k||!s)return;const isMythic=k.tier===0;$('#collection-big-demo').hidden=!isMythic;$('#collection-super-demo').hidden=!isMythic;if(!isMythic)return;
 const preview={...s,theme:id,xp:Math.max(s.xp??s.score,k.series?skinUnlockXp(k):xpAtLevel(100)+collectionStart(k)+80)};
 $('#skin-stage').innerHTML='<article id="skin-preview-card" class="card'+skinClass(preview)+'" style="'+skinStyle(preview)+'">'+skinLayer(preview)+'<div class="student-top">'+avatar(s)+'<strong class="student-name">'+esc(s.name)+'</strong></div><div class="preview-score">★ '+s.score+'</div><div class="preview-copy">完整專屬預覽 · 不會改分數或解鎖進度</div>'+skinLabel(preview)+'</article>';
 $('#skin-title').textContent=(k.series?'星核機甲 · ':'神獸覺醒 · ')+k.name;$('#skin-detail').textContent=collectionTitles[k.fx]+'：'+k.desc+'。裝備後，已解鎖的專屬效果會自動啟用。';$('#skin-notice').textContent='預覽展示完整演出；'+(k.series?(canEquip(s,k)?'機甲已解鎖。':skinUnlockLabel(k)+' 解鎖。'):'你已取得 '+collectionStage(s,k)+' / 3 項專屬。')+' 換裝、試播均不扣星星。';
};
function collectionPreview(kind){const s=students.find(s=>s.id===$('#skin-student').value),k=skins.find(k=>k.id===previewSkinId);if(!s||!k)return;skinBurst($('#skin-preview-card'),{...s,theme:k.id});collectionPlay({...s,theme:k.id},kind,{preview:true,stage:3});}
$('#skin-demo').onclick=()=>collectionPreview('small');$('#collection-big-demo').onclick=()=>collectionPreview('big');$('#collection-super-demo').onclick=()=>collectionPreview('rainbow');
function collectionAward(before,after,ids){const changed=after.filter(s=>ids.includes(s.id)&&s.score>(before.find(b=>b.id===s.id)?.score??s.score));if(!changed.length)return;const priority=s=>s.score%30===0?3:s.score%10===0?2:1;const s=changed.reduce((a,b)=>priority(b)>priority(a)?b:a),kind=priority(s)===3?'rainbow':priority(s)===2?'big':'small';collectionPlay(s,kind,{names:changed.map(s=>s.name)});tone(kind==='small'?0:1);const newly=changed.flatMap(s=>collectionRoad.filter(m=>m.xp>(before.find(b=>b.id===s.id)?.xp??before.find(b=>b.id===s.id)?.score??0)&&m.xp<=(s.xp??s.score)).map(m=>s.name+'：'+m.name));if(newly.length)toast('新收藏！'+newly.join('、'));else if(kind==='small')toast(changed.length===1?'＋1 ★ 太棒了！':changed.length+' 位學生 ＋1 ★')}
showWinnerSkin=function(s){collectionOldWinner(s);collectionPlay(s,'wheel')};
function collectionEnd(){collectionScene=null;$('#collection-overlay').hidden=true;$('#collection-scene').innerHTML='';if(collectionRaf&&typeof cancelAnimationFrame==='function')cancelAnimationFrame(collectionRaf);collectionRaf=0}
function collectionPlay(s,kind,{preview=false,stage=collectionStage(s),names=[s.name]}={}){
 if(motionReduced()){if(preview)toast('動態已關閉。可在頁頂開啟動態，或檢查裝置的減少動態設定。');else if(kind!=='small')toast(names.join('、')+(kind==='wheel'?'被抽中了！':kind==='rainbow'?'獲得彩色星星！':'獲得大星星！'));return}
 const k=skinOf(s)||{id:'plain',name:'星星小隊',fx:'rainbow',color:'#f5c96f',dark:'#211734',rank:1},now=performance.now();
 // Keep a major scene on-screen while a quick subsequent award adds a pulse.
 if(!preview&&kind==='small'&&collectionScene&&collectionScene.kind!=='small'&&now-collectionScene.start<collectionScene.duration){collectionScene.pulses.push({at:now,color:k.color});collectionScene.pulses=collectionScene.pulses.slice(-4);$('#collection-followup').textContent=names.join('、')+' ＋1 ★';return}
 collectionEnd();const duration=kind==='small'?750:kind==='rainbow'?2450:kind==='wheel'?1700:1550;
 collectionScene={s:{...s},k,kind,stage,preview,names,start:now,duration,pulses:[]};const overlay=$('#collection-overlay');
 // A modal's top layer eclipses ordinary z-index. Move the visual into it for previews.
 (preview?$('#skin-dialog'):document.body).append(overlay);overlay.hidden=false;overlay.className='collection-overlay scene-'+kind+' scene-fx-'+k.fx+(stage>=2?' scene-awakened':'');overlay.style.cssText='--scene-color:'+k.color+';--scene-dark:'+k.dark+';--scene-time:'+duration+'ms';
 const title=kind==='small'?'＋1 ★':kind==='big'?'大星星 GET！':kind==='rainbow'?'彩色星星 GET！':'幸運之星！';
 $('#collection-scene').innerHTML='<div class="scene-vignette"></div><div class="scene-portrait">'+artMarkup(k)+'</div><div class="scene-copy">'+(kind==='small'?'':avatar(s))+'<span class="scene-kicker">'+(preview?'專屬演出預覽':stage>=2?esc(collectionTitles[k.fx]||k.name):'STAR TEAM')+'</span><strong>'+esc(names.length>1?names.length+' 位同學一起集星':s.name)+'</strong><b class="scene-title '+(kind==='rainbow'?'scene-prism':'')+'">'+title+'</b><small id="collection-followup">'+(preview?'分數與收藏進度不變':names.length>1?esc(names.join('、')):esc(k.name))+'</small></div>';
 if(typeof requestAnimationFrame==='function')collectionRaf=requestAnimationFrame(collectionTick);
}
function collectionTick(now){if(!collectionScene)return;if(document.hidden||motionReduced()||now-collectionScene.start>=collectionScene.duration){collectionEnd();return}collectionRaf=requestAnimationFrame(collectionTick);if(now-collectionLastFrame<33)return;collectionLastFrame=now;const c=$('#collection-canvas'),w=window.innerWidth||1024,h=window.innerHeight||768,d=Math.min(window.devicePixelRatio||1,1.25);if(c.width!==Math.round(w*d)||c.height!==Math.round(h*d)){c.width=Math.round(w*d);c.height=Math.round(h*d)}const ctx=c.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);collectionDraw(ctx,collectionScene,w,h,now)}
function collectionPolygon(c,pts,fill){c.fillStyle=fill;c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fill()}
const collectionSheets={};
function collectionTexture(c,kind,x,y,size,t,angle=0){let img=collectionSheets[kind];if(!img){img=new Image();img.src='./skins/elements-'+kind+'-v4.webp';collectionSheets[kind]=img}if(!img.complete||!img.naturalWidth)return false;const cell=img.naturalWidth/4,q=t*9,n=Math.floor(q)%16,f=q-Math.floor(q),a=c.globalAlpha;c.save();c.translate(x,y);c.rotate(angle);for(const [frame,alpha] of [[n,1-f],[(n+1)%16,f]]){c.globalAlpha=a*alpha;c.drawImage(img,frame%4*cell,Math.floor(frame/4)*cell,cell,cell,-size/2,-size/2,size,size)}c.restore();return true}
// Filled material silhouettes complement the existing texture renderer. Every
// theme gets a different composition rather than a shared recoloured particle ring.
function collectionMotif(c,k,w,h,t,power=1){
 const cx=w/2,cy=h/2,r=Math.min(w,h)*.32,fx=k.fx,T=Math.PI*2;c.save();c.globalAlpha*=.85;c.strokeStyle=k.color;c.fillStyle=k.color;c.lineWidth=2;
 if(fx==='fire'){
  for(let j=0;j<7;j++){const x=w*(.13+j*.125);borderFlame(c,x,h*.88,0,r*(.7+.2*Math.sin(j+t)),Math.floor(t*13+j*2)%16,.8)}
 }else if(fx==='genesis'){
  collectionTexture(c,'crown',w*.64,h*.4,r*2.3,t);for(let j=0;j<7;j++){const a=j*Math.PI*2/7+t*.2;collectionTexture(c,'crown',cx+Math.cos(a)*r*1.3,cy+Math.sin(a)*r*.8,r*.28,t+j*.17,a)}
 }else if(['seraph','rainbow'].includes(fx)){
  const count=fx==='genesis'?18:fx==='seraph'?6:12;c.translate(cx,cy);
  for(let side of [-1,1])for(let i=0;i<count;i++){c.save();c.scale(side,1);c.rotate(-.65+i*.045+Math.sin(t*2+i*.12)*.06);const x=r*(.2+i*.052),y=-r*(.15+i*.02),len=r*(.6+.4*Math.sin(i/count*Math.PI))*power;const g=c.createLinearGradient(x,y,x+len,y-len*.55);g.addColorStop(0,fx==='fire'?'#ff6028':k.color);g.addColorStop(.7,fx==='genesis'?'#fff2ce':fx==='rainbow'?'hsl('+(i*29+t*20)+' 90% 75%)':k.color);g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(x+len*.25,y-len*.34,x+len*.7,y-len*.2,x+len,y-len*.8);c.bezierCurveTo(x+len*.65,y+len*.1,x+len*.25,y+len*.09,x,y);c.fill();c.restore()}
 }else if(['tide','aurora','omni','moon'].includes(fx)){
  for(let j=0;j<5;j++){const y=h*(.58+j*.08),amp=r*(fx==='tide'?.14:.07);c.globalAlpha=.16+j*.075;c.beginPath();c.moveTo(0,h);for(let x=0;x<=w+12;x+=12)c.lineTo(x,y+Math.sin(x/(r*.8)+t*(1+j*.12)+j)*amp);c.lineTo(w,h);c.closePath();const g=c.createLinearGradient(0,y,0,h);g.addColorStop(0,fx==='omni'?'hsl('+(j*60+t*10)+' 85% 75%)':k.color);g.addColorStop(1,k.dark);c.fillStyle=g;c.fill()}
  if(fx==='moon'){c.globalAlpha=.9;c.fillStyle='#eff9ff';c.beginPath();c.arc(w*.75,h*.25,r*.55,0,T);c.fill();c.fillStyle=k.dark;c.beginPath();c.arc(w*.75+r*.2,h*.25-r*.12,r*.5,0,T);c.fill()}
 }else if(['ice','crystal'].includes(fx)){
  for(let side of [-1,1])for(let i=0;i<9;i++){const x=side<0?w*.06+i*w*.025:w*.94-i*w*.025,y=h*.82,hh=r*(.35+.75*seed(i+4))*(.9+.1*Math.sin(t+i));c.save();c.translate(x,y);c.rotate(side*(.12+i*.08));v3Crystal(c,0,-hh*.2,hh*.48,0,i%2?'#edffff':k.color,.8);c.restore()}
 }else if(fx==='void'){
  collectionTexture(c,'void',w*.62,h*.42,r*2.3,t);c.globalAlpha*=.35;
  for(let j=0;j<8;j++){const a=j*T/8+t*.08,x=cx+Math.cos(a)*r*1.5,y=cy+Math.sin(a)*r;c.lineCap='round';c.lineWidth=22*power;const g=c.createLinearGradient(x,y,cx,cy);g.addColorStop(0,k.dark);g.addColorStop(.5,'#8c46c2');g.addColorStop(1,'#edccff');c.strokeStyle=g;c.beginPath();c.moveTo(x,y);c.bezierCurveTo(cx+Math.cos(a+.8)*r*1.8,cy+Math.sin(a+.8)*r*.8,cx+Math.cos(a-1)*r*.4,cy+Math.sin(a-1)*r*.4,cx+Math.cos(a+t)*r*.28,cy+Math.sin(a+t)*r*.28);c.stroke()}
 }else if(fx==='nature'){
  for(let j=0;j<28;j++){const a=j*2.4+t*.18,rad=r*(.6+seed(j)*.85),x=cx+Math.cos(a)*rad*1.5,y=cy+Math.sin(a)*rad;c.save();c.translate(x,y);c.rotate(a+t*.2);c.fillStyle=j%3?'#a4f7a0':'#fff4b4';c.beginPath();c.moveTo(0,0);c.bezierCurveTo(28,-35,50,-12,0,0);c.bezierCurveTo(12,24,38,15,0,0);c.fill();c.restore()}
 }else if(fx==='storm'){
  for(let j=0;j<7;j++){c.beginPath();for(let i=0;i<12;i++){const x=w*j/6+Math.sin(i*2+j+t*4)*40,y=h*i/11;i?c.lineTo(x,y):c.moveTo(x,y)}c.strokeStyle=k.color;c.lineWidth=6;c.globalAlpha=.35;c.stroke();c.strokeStyle='#fff';c.lineWidth=1.5;c.globalAlpha=.9;c.stroke()}
 }else if(fx==='comet'||fx==='rail'){
  for(let j=0;j<12;j++){const q=fract(t*.35+j/12),x=q*w*1.6-w*.3,y=j*h/12;const g=c.createLinearGradient(x-180,y,x,y);g.addColorStop(0,'#ffffff00');g.addColorStop(1,k.color);c.fillStyle=g;c.save();c.translate(cx,cy);c.rotate(fx==='rail'?-.08:-.45);c.translate(-cx,-cy);c.fillRect(x-180,y,180,j%3===0?7:3);if(fx==='rail')collectionPolygon(c,[[x,y-14],[x+40,y-14],[x+58,y+4],[x,y+4]],'#ddfaff');c.restore()}
 }else if(fx==='sonic'){
  for(let j=0;j<36;j++){const hh=(.15+.85*Math.abs(Math.sin(t*3+j*.63)))*h*.32,x=j*w/36;c.fillStyle=j%3?'#ad8aff':k.color;c.globalAlpha=.6;c.fillRect(x,h-hh,w/50,hh);c.fillRect(x,0,w/50,hh*.6)}
 }else{
  const orbits=fx==='genesis'?5:fx==='mecha'?4:3;for(let j=0;j<orbits;j++){c.save();c.translate(cx,cy);c.rotate(t*(j%2?-.15:.15)+j*.5);c.scale(1.4,.65+j*.14);c.lineWidth=2;c.beginPath();c.arc(0,0,r*(.7+j*.22),0,T);c.stroke();for(let i=0;i<8;i++){const a=i*T/8,rr=r*(.7+j*.22),x=Math.cos(a)*rr,y=Math.sin(a)*rr;if(fx==='mecha'||fx==='time')collectionPolygon(c,[[x-12,y-8],[x+12,y-8],[x+18,y+8],[x-18,y+8]],i%2?'#fff4ce':k.color);else{c.beginPath();c.arc(x,y,fx==='cosmos'?9:4,0,T);c.fill()}}c.restore()}
  if(fx==='eclipse'){c.fillStyle='#080916';c.beginPath();c.arc(cx,cy,r*.55,0,T);c.fill();c.strokeStyle='#ffcf8d';c.lineWidth=8;c.stroke()}
 }
 c.restore();
}
function collectionDraw(c,scene,w,h,now){const {k,kind,stage,start,duration}=scene,t=(now-start)/1000,p=(now-start)/duration,fade=Math.min(1,p*8,(1-p)*5);c.save();c.globalAlpha=Math.max(0,fade);const small=kind==='small';
 if(small){c.save();const g=c.createRadialGradient(w/2,h/2,Math.min(w,h)*.25,w/2,h/2,Math.max(w,h)*.7);g.addColorStop(0,'#ffffff00');g.addColorStop(1,k.color+'88');c.fillStyle=g;c.fillRect(0,0,w,h);c.globalAlpha*=.5;collectionMotif(c,k,w,h,t,.55);c.restore()}
 else{c.save();c.globalAlpha*=stage>=2?.9:.5;collectionMotif(c,k,w,h,t,kind==='rainbow'?1.25:1);c.restore();if(stage&&k.tier===0)borderAmbient(c,k,w,h,t,false,.4);if(stage>=3&&kind==='rainbow'){c.save();const g=c.createRadialGradient(w*.65,h*.4,10,w*.65,h*.4,Math.min(w,h)*.65);g.addColorStop(0,k.color+'44');g.addColorStop(.4,k.color+'12');g.addColorStop(1,'#ffffff00');c.fillStyle=g;c.fillRect(0,0,w,h);c.restore()}}
 for(const pulse of scene.pulses){const q=(now-pulse.at)/750;if(q<0||q>1)continue;c.globalAlpha=(1-q)*.5;c.strokeStyle=pulse.color;c.lineWidth=6;c.beginPath();c.arc(w*.5,h*.5,q*Math.max(w,h)*.7,0,Math.PI*2);c.stroke()}
 c.restore();
}
// Called inside the original visible-only 30fps border scheduler.
function collectionFrame(c,k,w,h,t,stage,reduced){if(!stage&&!k.series)return;c.save();const time=reduced?0:t,box={x:35,y:35,w:w-70,h:h-70};c.strokeStyle=k.color;c.lineWidth=2;c.globalAlpha=.8;
 if(k.series==='mecha'){
  for(let j=0;j<16;j++){const p=v3Point(box,j/16),bob=Math.sin(time*1.4+j)*3;c.save();c.translate(p.x,p.y);c.rotate(p.a+Math.PI/2);const g=c.createLinearGradient(-17,0,17,0);g.addColorStop(0,k.dark);g.addColorStop(.45,k.color);g.addColorStop(.52,'#fff7dc');g.addColorStop(1,k.dark);collectionPolygon(c,[[-18,5],[-20,-8-bob],[-10,-17-bob],[12,-17-bob],[20,-7],[17,5]],g);c.fillStyle=k.color;c.fillRect(-9,-11,18,2);if(k.fx==='sonic'){c.globalAlpha=.8;for(let b=0;b<3;b++)c.fillRect(-9+b*7,-18-Math.abs(Math.sin(time*3+j+b))*12,4,8+Math.abs(Math.sin(time*3+j+b))*12)}c.restore()}
 }else{
  // Permanent collectible crest corners are a second structural layer above V4 materials.
  for(let j=0;j<4;j++){const x=j%2?w-35:35,y=j>1?h-35:35;c.save();c.translate(x,y);c.rotate(j%2?Math.PI/2:0);const g=c.createLinearGradient(-22,-22,20,20);g.addColorStop(0,'#fff7d9');g.addColorStop(.5,k.color);g.addColorStop(1,k.dark);collectionPolygon(c,[[-24,3],[-24,-16],[-14,-25],[4,-25],[10,-14],[-10,-10],[-13,10]],g);collectionCorner(c,k,time+j,g);c.restore()}
  if(stage>=2)for(let j=0;j<4;j++)v3Track(c,box,time*.04+j/4,.08,k.color,.8,3);
  if(stage>=3){c.save();c.translate(w/2,24);const bob=reduced?0:Math.sin(time*1.5)*3;collectionPolygon(c,[[-37,0],[-35,-16+bob],[-17,-7+bob],[0,-28+bob],[17,-7+bob],[35,-16+bob],[37,0]],'#fff0ba');c.fillStyle=k.color;c.beginPath();c.arc(0,-10+bob,5,0,Math.PI*2);c.fill();c.restore()}
 }
 c.restore();
}
function collectionCorner(c,k,t,g){const fx=k.fx;c.fillStyle=g;c.strokeStyle=k.color;c.lineWidth=3;
 if(['ice','crystal'].includes(fx)){v3Crystal(c,-9,-12,15,.3+Math.sin(t)*.04,k.color,.9)}
 else if(['fire','genesis','seraph','comet'].includes(fx)){for(let i=0;i<(fx==='genesis'?5:3);i++){c.save();c.rotate(-.5+i*.3+Math.sin(t)*.05);c.beginPath();c.moveTo(-10,-8);c.bezierCurveTo(-29,-19,-17,-38+i*2,4,-48+i*3);c.bezierCurveTo(-3,-24,0,-16,-10,-8);c.fill();c.restore()}}
 else if(['nature','rainbow','omni'].includes(fx)){for(let i=0;i<4;i++){c.save();c.rotate(i*Math.PI/2+Math.sin(t)*.12);c.beginPath();c.moveTo(-7,-7);c.bezierCurveTo(-37,-32,3,-43,-7,-7);c.fill();c.restore()}}
 else if(['void','tide','aurora','moon'].includes(fx)){c.lineCap='round';c.lineWidth=7;for(let i=0;i<3;i++){c.beginPath();c.moveTo(-10,10);c.bezierCurveTo(-42,1,-42,-40,-14,-34);c.bezierCurveTo(9,-30,6,-13+Math.sin(t+i)*5,-10,-14);c.stroke();c.rotate(.6)}}
 else if(fx==='storm'){collectionPolygon(c,[[-10,-42],[-30,-17],[-14,-15],[-23,10],[3,-23],[-13,-23]],g)}
 else{c.save();c.translate(-8,-12);c.rotate(t*.15);c.lineWidth=2;c.beginPath();c.arc(0,0,19,0,Math.PI*2);c.stroke();for(let i=0;i<8;i++){c.rotate(Math.PI/4);collectionPolygon(c,[[-3,-16],[0,-29],[3,-16]],g)}c.restore()}
}
const collectionOldAmbient=ambient,collectionOldBorder=borderAmbient;
ambient=function(c,k,w,h,t,mini){if(!k.series)return collectionOldAmbient(c,k,w,h,t,mini);c.save();c.globalAlpha=.22;collectionMotif(c,k,w,h,t,.5);c.restore()};
borderAmbient=function(c,k,w,h,t,reduced,boost){if(!k.series)return collectionOldBorder(c,k,w,h,t,reduced,boost);collectionFrame(c,k,w,h,t,3,reduced)};
document.addEventListener('visibilitychange',()=>{if(document.hidden)collectionEnd()});
$('#skin-dialog').addEventListener?.('close',()=>{if(collectionScene?.preview)collectionEnd()});
const collectionMotionClick=$('#motion').onclick;$('#motion').onclick=()=>{collectionMotionClick();if(motionReduced())collectionEnd()};
render();
