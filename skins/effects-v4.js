'use strict';
// All effects in this file are decorative. The existing visible-only canvas scheduler
// owns rendering; no timers, gameplay state, score writes, or random draws are added.
(() => {
  const originalBorder = borderAmbient, originalAmbient = ambient, originalBurst = burst;
  const sheets = {};
  const sheetNames = new Set(['water','wind','leaves','ice','void','crown']);
  const TAU = Math.PI * 2;
  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  function polygon(c,points,fill,alpha=1) { c.save(); c.globalAlpha*=alpha; c.fillStyle=fill; c.beginPath(); points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p)); c.closePath(); c.fill(); c.restore(); }
  function gradient(c,x,y,r,a,b) { const g=c.createRadialGradient(x,y,0,x,y,r); g.addColorStop(0,a); g.addColorStop(1,b); return g; }
  function orb(c,x,y,r,color,alpha=1) { c.save();c.globalAlpha*=alpha;c.fillStyle=color;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore(); }
  function sprite(c,kind,x,y,angle,size,t,seed,alpha=.88) {
    if(!sheetNames.has(kind))return false;
    let img=sheets[kind];
    if(!img){img=new Image();img.src='./skins/elements-'+kind+'-v4.webp';sheets[kind]=img}
    if(!img.complete || !img.naturalWidth)return false;
    const frame=t*9+seed*5,n=(Math.floor(frame)%16+16)%16,next=(n+1)%16,mix=frame-Math.floor(frame),cell=img.naturalWidth/4;
    c.save();c.translate(x,y);c.rotate(angle+Math.PI/2);const inherited=c.globalAlpha*alpha;
    // Fractional-frame blending uses the shared 30 fps clock, avoiding a 9 fps step.
    // The asymmetric anchor keeps large flowing textures inside the outside gutter.
    c.globalAlpha=inherited*(1-mix);c.drawImage(img,n%4*cell,Math.floor(n/4)*cell,cell,cell,-size/2,-size*.65,size,size);
    if(mix>.001){c.globalAlpha=inherited*mix;c.drawImage(img,next%4*cell,Math.floor(next/4)*cell,cell,cell,-size/2,-size*.65,size,size)}
    c.restore();return true;
  }
  function plume(c,x,y,a,s,t,color,white='#edffff',alpha=.75) {
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);c.globalAlpha*=alpha;
    const g=c.createLinearGradient(0,s*.25,0,-s);g.addColorStop(0,color);g.addColorStop(.62,color);g.addColorStop(1,white);c.fillStyle=g;
    c.beginPath();c.moveTo(-s*.43,s*.12);c.bezierCurveTo(-s*.5,-s*.24,-s*.13,-s*.49,s*.12,-s*.4);c.bezierCurveTo(s*.55,-s*.33,s*.32,-s*.77,-s*.14,-s*.69);c.bezierCurveTo(s*.48,-s*.96,s*.69,-s*.2,s*.22,-s*.06);c.bezierCurveTo(s*.05,s*.12,-s*.16,s*.18,-s*.43,s*.12);c.fill();
    c.strokeStyle=white;c.globalAlpha*=.85;c.lineWidth=Math.max(1,s*.055);c.beginPath();c.moveTo(-s*.29,-s*.1);c.bezierCurveTo(-s*.02,-s*.35,s*.32,-s*.08,s*.36,-s*.47);c.stroke();
    for(let j=0;j<3;j++)orb(c,(j-1)*s*.23+Math.sin(t+j)*s*.04,-s*(.42+j*.18),s*(.035+j*.008),white,alpha*.8);c.restore();
  }
  function cloud(c,x,y,s,color,alpha=.68) { c.save();c.globalAlpha*=alpha;c.fillStyle=color; c.beginPath();for(let i=0;i<5;i++){const px=x+(i-2)*s*.27,py=y-Math.sin(i*Math.PI/4)*s*.22;c.moveTo(px+s*.24,py);c.arc(px,py,s*(.19+(i%2)*.04),0,TAU)}c.fill();c.restore(); }
  function foliage(c,x,y,a,s,t,color='#61df81') {
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2+Math.sin(t)*.13);
    c.strokeStyle='#b7ce68';c.lineWidth=2.4;c.beginPath();c.moveTo(0,s*.2);c.quadraticCurveTo(-s*.14,-s*.28,0,-s*.95);c.stroke();
    for(let j=0;j<4;j++){const side=j%2?1:-1,yy=-s*(.15+j*.17);c.save();c.translate(0,yy);c.rotate(side*.65);const g=c.createLinearGradient(-s*.3,0,s*.3,-s*.35);g.addColorStop(0,'#217b55');g.addColorStop(.5,color);g.addColorStop(1,'#e5ffc3');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(side*s*.53,-s*.08,side*s*.51,-s*.4,side*s*.36,-s*.48);c.bezierCurveTo(side*s*.04,-s*.37,-side*s*.09,-s*.13,0,0);c.fill();c.strokeStyle='#edffb5';c.lineWidth=.7;c.beginPath();c.moveTo(0,0);c.lineTo(side*s*.34,-s*.43);c.stroke();c.restore()}c.restore();
  }
  function gem(c,x,y,a,s,color,alpha=.9) {
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);c.globalAlpha*=alpha;
    polygon(c,[[-s*.42,s*.15],[-s*.48,-s*.32],[0,-s],[s*.38,-s*.4],[s*.35,s*.1]],color);
    polygon(c,[[0,-s],[-s*.18,-s*.35],[0,s*.13],[s*.38,-s*.4]],'#edfbff',.7);
    polygon(c,[[-s*.48,-s*.32],[-s*.18,-s*.35],[0,s*.13],[-s*.42,s*.15]],'#162a72',.54);
    c.strokeStyle='#f0fbff';c.lineWidth=1;c.beginPath();c.moveTo(-s*.42,s*.15);c.lineTo(-s*.48,-s*.32);c.lineTo(0,-s);c.lineTo(s*.38,-s*.4);c.stroke();c.restore();
  }
  function butterfly(c,x,y,s,t,color) {
    c.save();c.translate(x,y);c.rotate(Math.sin(t*.7)*.23);c.scale(.55+.45*Math.abs(Math.sin(t*2)),1);
    for(const side of [-1,1]) {const g=c.createLinearGradient(0,0,side*s,0);g.addColorStop(0,'#ffe8ff');g.addColorStop(.45,color);g.addColorStop(1,'#3c1b77');c.fillStyle=g;c.beginPath();c.moveTo(0,0);c.bezierCurveTo(side*s*.4,-s*1.4,side*s*1.2,-s*.7,side*s*.85,-s*.05);c.bezierCurveTo(side*s*1.2,s*.9,side*s*.23,s*.78,0,0);c.fill();orb(c,side*s*.58,-s*.3,s*.09,'#fff7cb',.95)}
    c.strokeStyle='#fff6ef';c.lineWidth=1.2;c.beginPath();c.moveTo(0,-s*.25);c.lineTo(0,s*.4);c.stroke();c.restore();
  }
  function gear(c,x,y,r,t,color,large=false) {
    c.save();c.translate(x,y);c.rotate(t);const points=[];for(let j=0;j<48;j++){const a=j/48*TAU,rr=r*(j%4<2?1:.83);points.push([Math.cos(a)*rr,Math.sin(a)*rr])}polygon(c,points,color,.88);
    orb(c,0,0,r*.62,'#312237',.97);c.strokeStyle='#ffe6a2';c.lineWidth=1.4;c.beginPath();c.arc(0,0,r*.57,0,TAU);c.stroke();
    for(let i=0;i<6;i++){c.rotate(TAU/6);c.fillStyle='#ffe3a9';c.fillRect(r*.3,-1,r*.27,2)}orb(c,0,0,r*.13,'#fff6c5');c.restore();
  }
  function feather(c,x,y,a,s,color) {
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);c.fillStyle=color;c.beginPath();c.moveTo(0,s*.18);c.bezierCurveTo(-s*.58,-s*.05,-s*.43,-s*.62,0,-s);c.bezierCurveTo(s*.36,-s*.73,s*.45,-s*.2,0,s*.18);c.fill();c.strokeStyle='#c59755';c.lineWidth=.8;c.beginPath();c.moveTo(0,s*.14);c.lineTo(0,-s*.84);for(let j=0;j<5;j++){const yy=-s*(.05+j*.13);c.moveTo(0,yy);c.lineTo(s*.24,yy-s*.13);c.moveTo(0,yy);c.lineTo(-s*.26,yy-s*.14)}c.stroke();c.restore();
  }
  function sword(c,x,y,a,s) {
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);
    polygon(c,[[0,-s],[-s*.12,-s*.72],[-s*.08,-s*.07],[s*.08,-s*.07],[s*.12,-s*.72]],'#c9f5ff');polygon(c,[[0,-s],[0,-s*.07],[s*.08,-s*.07],[s*.12,-s*.72]],'#fff7df');
    polygon(c,[[-s*.31,-s*.18],[0,-s*.05],[s*.31,-s*.18],[s*.22,.04],[0,0],[-s*.22,.04]],'#dfba68');c.fillStyle='#8c6036';c.fillRect(-s*.04,0,s*.08,s*.22);orb(c,0,s*.23,s*.075,'#fff0b4');c.restore();
  }
  function tentacle(c,x,y,a,s,t,color) {
    c.save();c.translate(x,y);c.rotate(a+Math.PI/2);c.fillStyle=color;c.beginPath();c.moveTo(-s*.16,s*.12);c.bezierCurveTo(-s*.32,-s*.12,-s*.13,-s*.55,s*.24,-s*.58);c.bezierCurveTo(s*.58,-s*.64,s*.32,-s*.9,s*.1,-s*.73);c.bezierCurveTo(s*.35,-s*1.04,s*.73,-s*.54,s*.35,-s*.42);c.bezierCurveTo(-s*.05,-s*.28,s*.2,-s*.01,s*.12,s*.12);c.fill();
    for(let j=0;j<5;j++)orb(c,Math.sin(j*.62+t*.2)*s*.12,-s*(.06+j*.085),s*(.034-j*.003),'#e9a4ff',.83);c.restore();
  }
  function corona(c,x,y,r,t,ultimate=false) {
    c.save();c.translate(x,y);c.rotate(t*.06);
    for(let i=0;i<24;i++){const a=i/24*TAU,l=r*(1.23+.27*Math.sin(i*3+t*.7)**2);polygon(c,[[Math.cos(a-.06)*r,Math.sin(a-.06)*r],[Math.cos(a+.045)*l,Math.sin(a+.045)*l],[Math.cos(a+.08)*r,Math.sin(a+.08)*r]],ultimate?['#fff1ba','#fec5f0','#95ffff'][i%3]:'#ffb94f',.8)}
    orb(c,0,0,r,'#ffbf68',.85);orb(c,0,0,r*.82,ultimate?'#ffe8ab':'#190f29',1);if(ultimate){gem(c,0,0,0,r*.67,'#fff8e0',.94)}c.restore();
  }
  function rock(c,x,y,r,t,color) { c.save();c.translate(x,y);c.rotate(t);polygon(c,[[-r,-r*.2],[-r*.35,-r*.9],[r*.66,-r*.68],[r,r*.25],[r*.13,r*.72],[-r*.6,r*.57]],color,.9);polygon(c,[[-r*.35,-r*.9],[r*.66,-r*.68],[r*.13,r*.12],[-r,-r*.2]],'#a6c8ef',.6);c.restore(); }
  function rail(c,box,t,color,width=8) {
    // A solid irregular band, not a hairline: ornamental material lives on its outer edge.
    c.save();c.strokeStyle=color;c.globalAlpha=.34;c.lineWidth=width;c.lineJoin='round';v3Rect(c,box.x,box.y,box.w,box.h,19);c.stroke();c.restore();
  }
  function motif(c,fx,x,y,a,s,t,k,index=0,allowSprite=true) {
    const color=k.color||'#bdf6ff',phase=t+index*.71;
    if(fx==='tide') { if(!allowSprite||!sprite(c,'water',x,y,a,s*1.55,t,index,.86))plume(c,x,y,a,s,phase,'#159dcc'); }
    else if(fx==='aurora') { if(!allowSprite||!sprite(c,'wind',x,y,a,s*1.65,t*.78,index,.74))plume(c,x,y,a,s,phase,'#89d5de','#fff7ed',.65); }
    else if(fx==='nature') {foliage(c,x,y,a,s,phase);if(allowSprite)sprite(c,'leaves',x,y,a,s*1.3,t*.55,index,.55);}
    else if(fx==='ice'||fx==='crystal') {if(fx==='ice'&&allowSprite&&sprite(c,'ice',x,y,a,s*1.7,t*.6,index,.9))return;const tilt=Math.sin(phase*.83)*.13;gem(c,x,y,a+tilt,s,fx==='ice'?'#57bce2':'#b16beb');gem(c,x+Math.cos(a+1.3)*s*.22,y+Math.sin(a+1.3)*s*.22,a+.4-tilt,s*.63,fx==='ice'?'#b7f5ff':'#e7bcff',.83);const flash=Math.sin(phase*1.25)**10;if(flash>.08){orb(c,x+Math.cos(a)*s*.48,y+Math.sin(a)*s*.48,1.4+flash*1.8,'#ffffff',flash*.85);}}
    else if(fx==='rainbow') butterfly(c,x+Math.cos(a)*s*.18,y+Math.sin(a)*s*.18,s*.59,phase,fxTint(k,index,t));
    else if(fx==='gold') {gear(c,x,y,s*.57,Math.sin(phase*.22)*.15,'#e3ae46');gem(c,x,y,a,s*.6,'#ffdfa0',.82);}
    else if(fx==='moon') {cloud(c,x,y+s*.13,s*.93,'#b9cef2',.65);v3Crescent(c,x,y-s*.12,s*.44,a+.3,'#fbf8df',.95);for(let j=0;j<3;j++)orb(c,x+(j-1)*s*.23,y+s*.23,s*.065,'#ffdeec',.82);}
    else if(fx==='time') {gear(c,x,y,s*.7,phase*.16*(index%2?-1:1),'#c6974e');for(let j=0;j<5;j++)orb(c,x+(j-2)*s*.16,y+s*(.15+((t*.19+j*.15)%1)*.6),1.1,'#ffe1a0',.65);}
    else if(fx==='eclipse') corona(c,x,y,s*.5,phase);
    else if(fx==='void') {if(!allowSprite||!sprite(c,'void',x,y,a+Math.sin(phase*.85)*.12,s*1.75,t*.7,index,.94))tentacle(c,x,y,a+Math.sin(phase*.85)*.22,s*(1.12+Math.sin(phase*.7)*.1),phase,index%2?'#7738ad':'#412677');}
    else if(fx==='cosmos') {rock(c,x,y,s*.4,phase*.13,'#507bba');ring(c,x,y,s*.85,s*.29,a+t*.11,'#b4e0ff',.6,2);orb(c,x+Math.cos(phase*.6)*s*.74,y+Math.sin(phase*.6)*s*.3,s*.13,'#f0dcb9');}
    else if(fx==='seraph') {feather(c,x-s*.26,y,a-.45,s*.72,'#fff2c5');feather(c,x+s*.26,y,a+.45,s*.72,'#d9f5ff');sword(c,x,y,a,s);}
    else if(fx==='omni') {if(allowSprite)sprite(c,'wind',x,y,a,s*1.45,t*.6,index,.65);cloud(c,x,y,s*1.1,'#b8ebea',.73);plume(c,x,y,a,s*.9,phase,'#75d5c7','#ffefae',.72);gem(c,x,y,a,s*.48,'#e5ce75');}
    else if(fx==='genesis') {if(allowSprite&&sprite(c,'crown',x,y,a,s*1.7,t*.6,index,.96))return;feather(c,x,y,a-.4,s*1.1,fxTint(k,index,t));feather(c,x,y,a+.4,s*.98,'#fff4c4');gem(c,x,y,a,s*.55,'#ffe19a');}
    else if(fx==='comet') {feather(c,x,y,a,s*.85,'#d7ebff');feather(c,x,y,a+.4,s*.64,'#ffd5f1');for(let j=0;j<3;j++)orb(c,x-Math.cos(a)*j*4,y-Math.sin(a)*j*4,2-j*.45,'#fff4c8',.8-j*.17);}
    else if(fx==='storm') {gem(c,x,y,a,s*.6,'#b8a1ee',.75);c.save();c.translate(x,y);c.rotate(a+Math.PI/2);polygon(c,[[s*.12,-s],[-s*.29,-s*.38],[-s*.02,-s*.37],[-s*.2,s*.19],[s*.35,-s*.5],[s*.08,-s*.45]],'#eadbff',.9);c.restore();}
  }
  borderAmbient = function(c,k,w,h,t,reduced,pulse=0) {
    if(k.fx==='fire')return originalBorder(c,k,w,h,t,reduced,pulse);
    if(k.tier!==0)return originalBorder(c,k,w,h,t,reduced,pulse);
    if(reduced){t=0;pulse=0}
    const inset=matchMedia('(max-width:720px)').matches?25:35,box={x:inset+2,y:inset+2,w:w-2*inset-4,h:h-2*inset-4};if(box.w<25||box.h<25)return;
    const fx=k.fx,ultimate=fx==='genesis',fluid=fx==='tide'||fx==='aurora',textured=['tide','aurora','ice','void','nature','genesis','omni'].includes(fx),mobile=inset===25,dense=['void','crystal','nature','ice','seraph','genesis'].includes(fx),n=textured?Math.ceil(2*(box.w+box.h)/(mobile?31:fx==='genesis'?39:43)):dense?18:14,s=clamp(Math.min(box.w,box.h)*.105+(k.rank||1)*.28,16,inset*.8),corners=[[box.x,box.y],[box.x+box.w,box.y],[box.x+box.w,box.y+box.h],[box.x,box.y+box.h]];
    c.save();rail(c,box,t,k.color,ultimate?14:fx==='tide'?12:8);
    for(let i=0;i<n;i++){
      const drift=['tide','aurora','rainbow','comet'].includes(fx)?t*(fx==='comet'?.022:.008):0,q=v3Point(box,(i+.37)/n+drift),sway=Math.sin(t*.8+i*.9)*(fx==='void'?4:fx==='ice'||fx==='crystal'?3.5:fluid?1.3:2);
      const factor={tide:1.55,aurora:1.65,ice:1.7,void:1.75,nature:1.3,genesis:1.7,omni:1.45}[fx];
      const materialSize=textured?(mobile?33:fx==='genesis'?54:48+(i%3)*2)/factor:s*(.82+(i%3)*.13);
      motif(c,fx,q.x+Math.cos(q.a)*sway,q.y+Math.sin(q.a)*sway,q.a,materialSize,t,k,i,!reduced);
    }
    if(fx==='tide'||fx==='aurora')for(let i=0;i<14;i++){const q=v3Point(box,(i+.2)/14+t*.012),out=8+Math.sin(t+i)*5;orb(c,q.x+Math.cos(q.a)*out,q.y+Math.sin(q.a)*out,fx==='tide'?1.7:1,'#e5ffff',.55)}
    if(fx==='storm'||fx==='omni')corners.forEach(([x,y],i)=>{lightning(c,x,y,(i%2?-1:1)*s,(i<2?-1:1)*s,t*.7+i,fx==='omni'?'#fff2b2':'#d8bdff',.6);});
    if(fx==='nature')corners.forEach(([x,y],i)=>{cloud(c,x,y,12,'#79b655',.4);for(let j=0;j<5;j++){const a=j/5*TAU+t*.1;orb(c,x+Math.cos(a)*7,y+Math.sin(a)*7,3.3,'#ffe6c0',.8)}orb(c,x,y,2.6,'#fff591')});
    if(fx==='aurora')corners.forEach(([x,y],i)=>plume(c,x,y,i*Math.PI/2,s*1.06,t,'#6dbcd0','#eef6ff',.48));
    if(fx==='eclipse') { const px=box.x+box.w*.5,py=box.y;corona(c,px,py,s*.94,t); }
    if(fx==='crystal')corners.forEach(([x,y],i)=>{for(let j=0;j<3;j++)gem(c,x,y,i*Math.PI/2+(j-1)*.47,s*(1.0+j*.03),'#bd87f4',.8)});
    if(fx==='cosmos')corners.forEach(([x,y],i)=>{for(let j=0;j<3;j++){const a=t*.22+j/3*TAU+i;rock(c,x+Math.cos(a)*s*.8,y+Math.sin(a)*s*.45,5+j*1.2,t+j,'#82a9cf')}});
    if(ultimate){
      corners.forEach(([x,y],i)=>{corona(c,x,y,s*.68,t+i,true);for(let j=0;j<3;j++)feather(c,x,y,i*Math.PI/2+(j-1)*.6,s*(1.05+j*.08),['#fff2bd','#d5edff','#ffb7e7'][j])});
      const head=v3Point(box,.14);sword(c,head.x,head.y,-Math.PI/2,s*1.1);
      for(let i=0;i<6;i++){const q=v3Point(box,i/6+t*.014);plume(c,q.x,q.y,q.a,s*.75,t+i,['#ffc57d','#98edff','#dba5ff'][i%3],'#fff8da',.53)}
    }
    if(pulse>.02){c.globalAlpha=pulse*.72;c.strokeStyle='#fff3d8';c.lineWidth=3+pulse*3;v3Rect(c,box.x,box.y,box.w,box.h,18);c.stroke();}
    c.restore();
  };
  ambient = function(c,k,w,h,t,small=false) {
    originalAmbient(c,k,w,h,t,small);
    if(k.tier!==0||k.fx==='fire')return;
    // Wheel portraits and the card interior receive the SAME material signature.
    // Keep these motifs on the perimeter; student identity and balances remain legible.
    const size=clamp(Math.min(w,h)*(small?.15:.065),5,small?13:19),n=small?3:4;
    c.save();c.globalAlpha=.76;
    for(let i=0;i<n;i++){const a=i/n*TAU+t*.055,x=small?w*.5+Math.cos(a)*w*.35:w*(i%2?.93:.08),y=small?h*.5+Math.sin(a)*h*.34:h*(i<2?.14:.88);motif(c,k.fx,x,y,small?a:-Math.PI/2,size,t,k,i,small)}c.restore();
  };
  burst = function(c,k,w,h,elapsed) {
    originalBurst(c,k,w,h,elapsed);if(k.tier!==0||k.fx==='fire'||elapsed<0||elapsed>1300)return;
    const p=elapsed/1300,alpha=Math.sin(p*Math.PI),cx=w*.77,cy=h*.4,r=Math.min(w,h)*(.12+p*.34);c.save();c.globalAlpha=alpha*.7;
    for(let i=0;i<6;i++){const a=i/6*TAU+p*.45;motif(c,k.fx,cx+Math.cos(a)*r,cy+Math.sin(a)*r,a,11+8*p,p*2,k,i,true)}c.restore();
  };
  if(loaded&&!spinning&&!giftBusy){render();drawWheel()}
})();
