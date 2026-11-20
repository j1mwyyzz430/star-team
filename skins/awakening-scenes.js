'use strict';
// Live rewards share one clock. Score changes and audio remain in their existing handlers.
const awakeningOverlay=$('#collection-overlay');
const awakeningDurations={small:2100,big:3200,rainbow:4400,wheel:2800};
let awakeningFallback=null;
function awakeningAsset(k){return k?.art!==undefined?'./skins/scene-original/'+k.id+'.webp':''}
function awakeningMembers(s,participants,preview){
 const seen=new Set();return (participants?.length?participants:[s]).filter(p=>{
  if(seen.has(p.id)||(!preview&&!collectionCanPlay(p)))return false;seen.add(p.id);return true;
 }).map(p=>({...p}));
}
function awakeningArt(k,cls='awakening-art'){
 const src=awakeningAsset(k);return src?'<img class="'+cls+'" src="'+src+'" alt="" decoding="async">':'';
}
function awakeningFace(s){return '<div class="awakening-face"><span class="awakening-orbit"></span>'+avatar(s)+'</div>'}
function awakeningCaption(kind){return kind==='small'?'＋1 ★':kind==='big'?'大星星 GET！':kind==='rainbow'?'彩色星星 GET！':'幸運之星！'}
function awakeningOpenLayer(){
 // Popovers stay above wardrobe dialogs and below no other page content.
 awakeningOverlay.setAttribute('popover','manual');document.body.append(awakeningOverlay);
 let opened=false;if(awakeningOverlay.showPopover)try{awakeningOverlay.showPopover();opened=true}catch{}
 if(!opened){
  awakeningOverlay.removeAttribute('popover');
  if(!awakeningFallback){awakeningFallback=document.createElement('dialog');awakeningFallback.className='reward-viewport-host';awakeningFallback.addEventListener('cancel',e=>{e.preventDefault();collectionEnd()});document.body.append(awakeningFallback)}
  awakeningFallback.append(awakeningOverlay);if(!awakeningFallback.open)awakeningFallback.showModal();
 }
}
collectionEnd=function(){
 const prior=collectionScene;collectionScene=null;
 if(collectionRaf)cancelAnimationFrame(collectionRaf);collectionRaf=0;
 awakeningOverlay.getAnimations?.({subtree:true}).forEach(a=>a.cancel());
 if(awakeningOverlay.hidePopover)try{awakeningOverlay.hidePopover()}catch{}
 if(awakeningFallback?.open)awakeningFallback.close();
 awakeningOverlay.hidden=true;awakeningOverlay.setAttribute('aria-hidden','true');
 $('#collection-scene').replaceChildren();
 if(prior?.returnFocus?.isConnected&&typeof prior.returnFocus.focus==='function')prior.returnFocus.focus({preventScroll:true});
};
collectionPlay=function(s,kind,{preview=false,participants,names=[s.name],stage=collectionStage(s)}={}){
 if(!preview){stage=collectionStage(s);if(!collectionCanPlay(s)){if(kind!=='small')toast(names.join('、')+(kind==='wheel'?'被抽中了！':kind==='rainbow'?'獲得彩色星星！':'獲得大星星！'));return false}}
 if(motionReduced()){if(preview)toast('動態已關閉。可在頁頂開啟，或檢查裝置的減少動態設定。');else if(kind!=='small')toast(names.join('、')+(kind==='wheel'?'被抽中了！':kind==='rainbow'?'獲得彩色星星！':'獲得大星星！'));return false}
 const members=awakeningMembers(s,participants,preview);if(!members.length)return false;
 const k=skinOf(s)||{id:'plain',name:'星星小隊',color:'#f5c96f',dark:'#211734',fx:'rainbow'};
 const now=performance.now();
 if(!preview&&members.length===1&&kind==='small'&&collectionScene&&collectionScene.kind!=='small'&&now-collectionScene.start<collectionScene.duration){
  collectionScene.pulses.push({at:now,color:k.color});collectionScene.pulses=collectionScene.pulses.slice(-4);
  const follow=$('#collection-followup');if(follow)follow.textContent=s.name+' ＋1 ★';return;
 }
 collectionEnd();
 const perPage=innerHeight>innerWidth?4:6,pageDuration=awakeningDurations[kind]||2800;
 const count=Math.ceil(members.length/perPage),duration=pageDuration*count;
 collectionScene={s:{...s},k,kind,stage:preview?stage:collectionStage(s),preview,names:members.map(p=>p.name),participants:members,perPage,pageDuration,start:now,duration,pulses:[],page:-1,returnFocus:document.activeElement};
 awakeningOverlay.hidden=false;awakeningOverlay.setAttribute('aria-hidden','false');
 awakeningOpenLayer();awakeningRenderAt(collectionScene,0);
 collectionRaf=requestAnimationFrame(collectionTick);
};
function awakeningMount(scene,page){
 const group=scene.participants.length>1,members=scene.participants.slice(page*scene.perPage,(page+1)*scene.perPage);
 const k=skinOf(members[0])||scene.k,kind=scene.kind;
 awakeningOverlay.className='collection-overlay awakening-overlay awakening-'+kind+(group?' awakening-group':'')+(scene.stage>=3?' awakening-ultimate':'');
 awakeningOverlay.style.cssText='--scene-color:'+k.color+';--scene-dark:'+k.dark+';--awakening-duration:'+scene.pageDuration+'ms';
 const label=kind==='small'?'星光登場':kind==='big'?'神獸召喚':kind==='rainbow'?(scene.stage>=3?'星冠覺醒':'彩星綻放'):'幸運降臨';
 let content;
 if(group){
  const cols=members.length<=2?members.length:members.length<=4?2:3,rows=Math.ceil(members.length/cols);
  content='<div class="awakening-team" style="--team-cols:'+cols+';--team-rows:'+rows+'">'+members.map((p,i)=>{
   const pk=skinOf(p)||k;return '<article class="awakening-member" style="--member-color:'+pk.color+';--member-dark:'+pk.dark+';--member-delay:'+i*55+'ms" data-student-id="'+esc(p.id)+'">'+awakeningArt(pk,'awakening-member-art')+'<div class="awakening-member-shade"></div>'+awakeningFace(p)+'<strong>'+esc(p.name)+'</strong><span>'+esc(pk.name)+'</span>'+((scene.preview||collectionStage(p)>=3)&&kind==='rainbow'?'<i class="awakening-member-crown" aria-hidden="true">♛</i>':'')+'</article>';
  }).join('')+'</div><div class="awakening-copy awakening-team-copy"><span class="awakening-eyebrow">'+scene.participants.length+' 位同學 · '+label+'</span><b class="awakening-title">'+awakeningCaption(kind)+'</b><small id="collection-followup">'+(scene.preview?'試看演出 · 分數與收藏進度不變':'一起努力，一起閃耀')+'</small></div>';
 }else{
  content='<div class="awakening-hero">'+awakeningFace(members[0])+'<svg class="awakening-crown" viewBox="0 0 260 100" aria-hidden="true"><path d="M20 25 75 57 130 6 185 57 240 25 222 84 38 84Z"/><path d="M38 94H222"/></svg></div><div class="awakening-copy"><span class="awakening-eyebrow">'+(scene.preview?'專屬演出預覽 · ':'')+label+'</span><strong class="awakening-name">'+esc(members[0].name)+'</strong><b class="awakening-title">'+awakeningCaption(kind)+'</b><small id="collection-followup">'+(scene.preview?'試看演出 · 分數與收藏進度不變':esc(k.name))+'</small></div>';
 }
 $('#collection-scene').innerHTML='<div class="awakening-world">'+awakeningArt(k)+'<div class="awakening-world-shade"></div></div><div class="awakening-aura"></div><div class="awakening-summon-star" aria-hidden="true">✦</div>'+content+'<div class="awakening-topline"><span>'+esc(k.name)+'</span><span>'+(group?'第 '+(page+1)+' / '+Math.ceil(scene.participants.length/scene.perPage)+' 幕':'LV.'+levelOf(members[0]).level+' · AWAKENING')+'</span></div><button type="button" id="awakening-close" aria-label="略過演出">略過 ×</button><div class="awakening-progress"><i></i></div>';
 $('#awakening-close').onclick=()=>collectionEnd();
 // Broken local portraits/art must not leave a broken-image icon over the ceremony.
 awakeningOverlay.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{
  if(img.classList.contains('avatar')){const fallback=document.createElement('span');fallback.className='avatar';fallback.textContent=[...img.alt][0]||'★';img.replaceWith(fallback)}else img.remove();
 },{once:true}));
 scene.page=page;scene.animations=awakeningOverlay.getAnimations({subtree:true});scene.animations.forEach(a=>{a.pause();a.currentTime=0});
}
function awakeningRenderAt(scene,elapsed){
 const page=Math.min(Math.ceil(scene.participants.length/scene.perPage)-1,Math.floor(Math.max(0,elapsed)/scene.pageDuration));
 if(page!==scene.page)awakeningMount(scene,page);
 const local=Math.max(0,elapsed-page*scene.pageDuration),p=local/scene.pageDuration;
 scene.animations.forEach(a=>a.currentTime=local);
 awakeningOverlay.style.opacity=String(Math.min(1,local/150,(scene.pageDuration-local)/230));
 const progress=$('.awakening-progress i');if(progress)progress.style.transform='scaleX('+Math.max(0,1-elapsed/scene.duration)+')';
 const rect=awakeningOverlay.getBoundingClientRect(),canvas=$('#collection-canvas'),w=rect.width,h=rect.height,d=Math.min(devicePixelRatio||1,1.25);
 if(!w||!h)return;
 if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}
 const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
 awakeningDraw(c,scene,w,h,local/1000,p,elapsed);
}
collectionTick=function(now){
 const scene=collectionScene;if(!scene)return;
 if(document.hidden||motionReduced()||now-scene.start>=scene.duration){collectionEnd();return}
 collectionRaf=requestAnimationFrame(collectionTick);
 if(now-collectionLastFrame<33)return;collectionLastFrame=now;awakeningRenderAt(scene,now-scene.start);
};
function awakeningSeed(i){const v=Math.sin(i*127.1+311.7)*43758.5453;return v-Math.floor(v)}
function awakeningStar(c,x,y,r,color,rotation=0){
 c.save();c.translate(x,y);c.rotate(rotation);c.fillStyle=color;c.beginPath();
 for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,rr=i%2?r*.44:r;i?c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr):c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr)}c.closePath();c.fill();c.restore();
}
function awakeningDraw(c,scene,w,h,t,p,elapsed){
 const rainbow=scene.kind==='rainbow',big=scene.kind==='big'||scene.kind==='wheel',group=scene.participants.length>1;
 const color=(skinOf(scene.participants[scene.page*scene.perPage])||scene.k).color;
 const portrait=h>w,short=Math.min(w,h),cx=group?w*.5:scene.kind==='small'&&!portrait?w*.27:w*.5,cy=group?h*.45:portrait?h*.35:h*.40;
 c.save();c.globalCompositeOperation='screen';c.globalAlpha=Math.max(0,Math.min(1,p*6,(1-p)*5));
 // Three different trajectories: streaming sparks, expanding shockwave, orbital fireworks.
 if(!big&&!rainbow){
  for(let i=0;i<52;i++){
   const q=(t*.28+awakeningSeed(i))%1,x=w*(q*1.3-.15),y=h*(.12+awakeningSeed(i+75)*.78)-Math.sin(q*Math.PI)*h*.12;
   c.globalAlpha=Math.sin(q*Math.PI)*.65;c.strokeStyle=i%4?color:'#fff3d2';c.lineWidth=i%3===0?2:1;
   c.beginPath();c.moveTo(x-18,y+6);c.lineTo(x,y);c.stroke();if(i%7===0)awakeningStar(c,x,y,4,color,t*.3);
  }
 }else if(big){
  for(let j=0;j<3;j++){
   const q=Math.max(0,Math.min(1,(t-.22-j*.16)/1.15));if(q<=0||q>=1)continue;
   const radius=short*(.13+q*.85);c.globalAlpha=(1-q)*.75;c.strokeStyle=j%2?'#fff0b3':color;c.lineWidth=(1-q)*8+1;c.beginPath();c.ellipse(cx,cy,radius,radius*.7,0,0,Math.PI*2);c.stroke();
  }
  for(let i=0;i<70;i++){
   const angle=awakeningSeed(i)*Math.PI*2,q=Math.max(0,t-.35),speed=100+awakeningSeed(i+90)*330;
   c.globalAlpha=Math.max(0,1-q/2.5)*.7;const x=cx+Math.cos(angle)*(short*.19+q*speed),y=cy+Math.sin(angle)*(short*.19+q*speed*.65);
   awakeningStar(c,x,y,2+awakeningSeed(i+40)*5,i%3?color:'#fff0b4',angle+t);
  }
 }else{
  for(let j=0;j<3;j++){
   c.save();c.translate(cx,cy);c.rotate(t*(j%2?-.25:.18)+j*.75);c.scale(1.55,.6+j*.13);c.globalAlpha=.32;c.strokeStyle=['#ffd477','#c7a0ff','#7fe7ff'][j];c.lineWidth=2;c.beginPath();c.arc(0,0,short*(.26+j*.055),0,Math.PI*2);c.stroke();c.restore();
  }
  const power=scene.stage>=3?1:.6;
  for(let burst=0;burst<4;burst++){
   const age=t-(.35+burst*.36);if(age<0||age>2.8)continue;
   const bx=w*(burst%2?.86:.14),by=h*(burst<2?.25:.65);
   for(let i=0;i<30*power;i++){
    const angle=i/30*Math.PI*2,speed=(55+awakeningSeed(i+burst*70)*170)*power;
    const x=bx+Math.cos(angle)*age*speed,y=by+Math.sin(angle)*age*speed+age*age*25;
    c.globalAlpha=Math.max(0,1-age/2.8)*.75;awakeningStar(c,x,y,2+awakeningSeed(i+22)*4,'hsl('+(i*31+burst*70)+' 95% 78%)',age+i);
   }
  }
 }
 // A quiet moving dust field links all characters without pasted flame sprites.
 for(let i=0;i<30;i++){
  const x=awakeningSeed(i+710)*w,y=((awakeningSeed(i+190)+t*.025)%1)*h;
  c.globalAlpha=.12+.23*(.5+.5*Math.sin(t*1.8+i));c.fillStyle=i%3?color:'#fff';c.beginPath();c.arc(x,y,1+awakeningSeed(i+44)*2,0,Math.PI*2);c.fill();
 }
 for(const pulse of scene.pulses){const q=(scene.start+elapsed-pulse.at)/750;if(q<0||q>1)continue;c.globalAlpha=(1-q)*.5;c.strokeStyle=pulse.color;c.lineWidth=4;c.beginPath();c.arc(cx,cy,q*Math.max(w,h)*.8,0,Math.PI*2);c.stroke()}
 c.restore();
}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&collectionScene){e.preventDefault();collectionEnd()}});
// The existing full-screen button remains an explicit user action; no forced mode changes.
$('#fullscreen').onclick=async()=>{
 try{
  if(document.fullscreenElement||document.webkitFullscreenElement){const exit=document.exitFullscreen||document.webkitExitFullscreen;if(exit)await exit.call(document);return}
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(!request)throw Error('unsupported');await request.call(root);
 }catch{toast('此瀏覽器未能隱藏網址列；iPad 可用 Safari「分享 → 加入主畫面」，再由主畫面開啟。')}
};
