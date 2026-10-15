'use strict';
// Preserve the live card layout and borders. Only square mecha framing is moved up.
const originalArtMarkup=artMarkup;
artMarkup=function(k){const markup=originalArtMarkup(k);return k.series==='mecha'?markup.replace('xMaxYMid slice','xMaxYMin slice'):markup};
const focusPlay=collectionPlay,focusEnd=collectionEnd,focusOverlay=$('#collection-overlay');
focusOverlay.setAttribute('popover','manual');let focusFallback=null;
collectionEnd=function(){if(focusOverlay.hidePopover){try{focusOverlay.hidePopover()}catch{}}if(focusFallback?.open)focusFallback.close();focusEnd()};
collectionPlay=function(s,kind,options={}){
 focusPlay(s,kind,options);if(!collectionScene||focusOverlay.hidden)return;
 document.body.append(focusOverlay);
 if(focusOverlay.showPopover){try{focusOverlay.showPopover()}catch{}}
 else{if(!focusFallback){focusFallback=document.createElement('dialog');focusFallback.className='reward-viewport-host';document.body.append(focusFallback);focusFallback.addEventListener('cancel',()=>collectionEnd())}focusFallback.append(focusOverlay);if(!focusFallback.open)focusFallback.showModal()}
 const k=collectionScene.k;if(k.art!==undefined){const portrait=focusOverlay.querySelector('.scene-portrait');portrait.innerHTML='<img class="reward-complete-art" src="./skins/scene-original/'+k.id+'.webp" alt="">'}
 if(kind==='small'&&collectionScene.kind==='small'){collectionScene.duration=1200;focusOverlay.style.setProperty('--scene-time','1200ms')}
};
// Correct only the four foreground motifs that obscured faces in the report.
const originalCollectionMotif=collectionMotif;
collectionMotif=function(c,k,w,h,t,power){
 if(!['moon','rainbow','ice','gold'].includes(k.fx))return originalCollectionMotif(c,k,w,h,t,power);
 const band=Math.min(w,h)*.04,box={x:band/2,y:band/2,w:w-band,h:h-band};c.save();c.fillStyle=k.color;c.strokeStyle=k.color;c.lineWidth=1.5;c.globalAlpha*=.65;
 for(let i=0;i<22;i++){const pt=v3Point(box,(i/22+t*.025)%1),r=band*(.1+.1*seed(i));c.save();c.translate(pt.x,pt.y);c.rotate(t*.3+i);if(k.fx==='ice')collectionPolygon(c,[[0,-r*2],[r,0],[0,r],[-r,0]],k.color);else if(k.fx==='rainbow'){c.fillStyle='hsl('+(i*31+t*20)+' 80% 75%)';c.beginPath();c.ellipse(0,0,r*1.8,r*.6,.5,0,Math.PI*2);c.fill()}else{c.beginPath();c.arc(0,0,r,0,Math.PI*2);c.fill()}c.restore()}
 if(k.fx==='moon'){c.globalAlpha*=.35;for(let j=0;j<3;j++){c.beginPath();c.moveTo(0,h);for(let x=0;x<w+12;x+=12)c.lineTo(x,h-band*(j*.3+.3)+Math.sin(x/120+t+j)*band*.15);c.lineTo(w,h);c.fill()}}
 c.restore();
};
collectionTick=function(now){if(!collectionScene)return;if(document.hidden||motionReduced()||now-collectionScene.start>=collectionScene.duration){collectionEnd();return}collectionRaf=requestAnimationFrame(collectionTick);if(now-collectionLastFrame<33)return;collectionLastFrame=now;const canvas=$('#collection-canvas'),r=focusOverlay.getBoundingClientRect(),w=r.width,h=r.height,d=Math.min(window.devicePixelRatio||1,1.25);if(!w||!h)return;if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d)}const ctx=canvas.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,w,h);collectionDraw(ctx,collectionScene,w,h,now)};
render();
