'use strict';
// Cosmetic renderer only. It never reads or changes balances, experience, receipts, or RNG.
const v3OriginalBorder = borderAmbient;
const v3OriginalAmbient = ambient;
const v3OriginalBurst = burst;
const v3OriginalTint = fxTint;
const v3OriginalLayer = skinLayer;
const v3Families = {tide:'moon',aurora:'rainbow',comet:'time',eclipse:'gold',crystal:'ice',cosmos:'void',seraph:'genesis',omni:'genesis'};
fxTint = function(k,i,t){
  if(['aurora','seraph','omni'].includes(k.fx))return ['#93f4ff','#d5adff','#ffbde8','#ffefa2','#a5ffe0'][Math.abs(i)%5];
  if(k.fx==='eclipse')return i%3===0?'#fff4d5':i%3===1?'#fcb869':'#ec733b';
  if(k.fx==='crystal')return i%3===0?'#eee8ff':i%3===1?'#b789ff':'#69d3ff';
  return v3OriginalTint(k,i,t);
};
skinLayer = function(s){
  const k=skinOf(s),base=v3OriginalLayer(s);
  return k?.tier===0&&k.fx!=='fire'?base.replace('<canvas class="skin-fx"','<span class="v3-foil" aria-hidden="true"></span><canvas class="skin-fx"'):base;
};
function v3Rect(ctx,x,y,w,h,r){
  r=Math.max(1,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.lineTo(x+w-r,y);ctx.quadraticCurveTo(x+w,y,x+w,y+r);ctx.lineTo(x+w,y+h-r);ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);ctx.lineTo(x+r,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-r);ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
}
function v3Point(box,p){
  const {x,y,w,h}=box,q=fract(p)*2*(w+h);
  if(q<w)return {x:x+q,y,a:-Math.PI/2};
  if(q<w+h)return {x:x+w,y:y+q-w,a:0};
  if(q<2*w+h)return {x:x+w-(q-w-h),y:y+h,a:Math.PI/2};
  return {x,y:y+h-(q-2*w-h),a:Math.PI};
}
function v3Track(ctx,box,p,length,color,alpha,width=2){
  ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<=24;i++){const q=v3Point(box,p-length+length*i/24);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)}ctx.stroke();ctx.restore();
}
function v3Crystal(ctx,x,y,size,angle,color,alpha){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.globalAlpha=alpha;
  const g=ctx.createLinearGradient(-size,0,size,0);g.addColorStop(0,color);g.addColorStop(.47,'#ffffff');g.addColorStop(.54,color);g.addColorStop(1,'#3e4d9970');ctx.fillStyle=g;
  ctx.beginPath();ctx.moveTo(0,-size*1.9);ctx.lineTo(size*.62,-size*.25);ctx.lineTo(size*.4,size*.85);ctx.lineTo(-size*.4,size*.85);ctx.lineTo(-size*.62,-size*.25);ctx.closePath();ctx.fill();
  ctx.globalAlpha=alpha*.85;ctx.strokeStyle='#f2f8ff';ctx.lineWidth=.8;ctx.stroke();ctx.beginPath();ctx.moveTo(0,-size*1.9);ctx.lineTo(0,size*.85);ctx.moveTo(-size*.62,-size*.25);ctx.lineTo(0,size*.2);ctx.lineTo(size*.62,-size*.25);ctx.stroke();ctx.restore();
}
function v3Sigil(ctx,x,y,r,t,color,complexity=1,alpha=.65){
  ctx.save();ctx.translate(x,y);ctx.rotate(t);ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=1.2;
  for(let j=0;j<complexity;j++){ctx.beginPath();ctx.arc(0,0,r-j*4,0,Math.PI*2);ctx.stroke()}
  for(let j=0;j<12;j++){const a=j*Math.PI/6;ctx.beginPath();ctx.moveTo(Math.cos(a)*(r-4),Math.sin(a)*(r-4));ctx.lineTo(Math.cos(a)*(r+(j%3?2:5)),Math.sin(a)*(r+(j%3?2:5)));ctx.stroke()}
  ctx.rotate(-t*2);ctx.beginPath();for(let j=0;j<6;j++){const a=j*Math.PI/3;const px=Math.cos(a)*(r-7),py=Math.sin(a)*(r-7);j?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.closePath();ctx.stroke();ctx.restore();
}
function v3Crescent(ctx,x,y,r,angle,color,alpha){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.beginPath();ctx.arc(0,0,r,-Math.PI/2,Math.PI/2);ctx.bezierCurveTo(r*.13,r*.63,r*.13,-r*.63,0,-r);ctx.fill();ctx.restore();
}
function v3Corona(ctx,x,y,r,t,color,alpha){
  ctx.save();ctx.translate(x,y);ctx.globalAlpha=alpha;ctx.strokeStyle=color;ctx.lineWidth=2.8;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;
  for(let i=0;i<18;i++){const a=i*Math.PI/9+t*.08,l=5+3*Math.sin(t+i)**2;ctx.beginPath();ctx.moveTo(Math.cos(a)*(r+3),Math.sin(a)*(r+3));ctx.lineTo(Math.cos(a)*(r+3+l),Math.sin(a)*(r+3+l));ctx.stroke()}
  ctx.restore();
}
function v3Ribbon(ctx,box,t,color,alpha,width=3,phase=0){
  ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=alpha;ctx.lineWidth=width;ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<=110;i++){const p=i/110,q=v3Point(box,p),wave=Math.sin(p*Math.PI*10-t+phase)*5;const px=q.x+Math.cos(q.a)*wave,py=q.y+Math.sin(q.a)*wave;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();ctx.restore();
}
function v3Feathers(ctx,box,t,color,alpha,quantity=14){
  for(let i=0;i<quantity;i++){const p=(i+.5)/quantity,q=v3Point(box,p),a=q.a+Math.sin(t*.45+i)*.13,s=7+4*Math.sin(t*.65+i)**2;
    ctx.save();ctx.translate(q.x,q.y);ctx.rotate(a+Math.PI/2);ctx.fillStyle=color;ctx.globalAlpha=alpha;ctx.beginPath();ctx.moveTo(0,0);ctx.bezierCurveTo(-s*.65,-s*.8,-s*.35,-s*2.5,0,-s*2.9);ctx.bezierCurveTo(s*.65,-s*1.6,s*.6,-s*.4,0,0);ctx.fill();ctx.globalAlpha=alpha*.65;ctx.strokeStyle='#fff7e2';ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(0,-2);ctx.lineTo(0,-s*2.4);ctx.stroke();ctx.restore();
  }
}
borderAmbient = function(ctx,k,w,h,t,reduced,pulse=0){
  if(k.fx==='fire')return v3OriginalBorder(ctx,k,w,h,t,reduced,pulse);
  const inset=matchMedia('(max-width:720px)').matches?25:35,box={x:inset+2,y:inset+2,w:w-2*inset-4,h:h-2*inset-4};
  if(box.w<25||box.h<25)return;
  if(reduced){t=0;pulse=0}
  const {x,y,w:cw,h:ch}=box,fx=k.fx,c=k.color,rank=fx==='genesis'?14:Math.min(k.rank||1,14),speed=reduced?0:t,corners=[[x+3,y+3],[x+cw-3,y+3],[x+cw-3,y+ch-3],[x+3,y+ch-3]];
  ctx.save();ctx.strokeStyle=c;ctx.shadowColor=c;ctx.shadowBlur=7+pulse*10;ctx.lineWidth=2;ctx.globalAlpha=.78;v3Rect(ctx,x,y,cw,ch,20);ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=.8;ctx.globalAlpha=.45;v3Rect(ctx,x+5,y+5,cw-10,ch-10,17);ctx.stroke();
  if(fx==='ice'||fx==='crystal'){
    const crystal=fx==='crystal';corners.forEach(([cx,cy],j)=>{for(let n=0;n<3;n++)v3Crystal(ctx,cx,cy,crystal?12+n*2:9+n*2,j*Math.PI/2+(n-1)*.48,fxTint(k,n,t),.4+.22*Math.sin(speed*.65+j+n)**2);frost(ctx,cx,cy,18,c,.45,speed*.08)});
    for(let i=0;i<10;i++){const q=v3Point(box,(i+.5)/10);v3Crystal(ctx,q.x,q.y,5+2*Math.sin(speed*.6+i)**2,q.a+Math.PI/2,c,.58)}
    v3Track(ctx,box,speed*.07,.22,'#f3fcff',.7,2.2);
  }else if(fx==='storm'){
    for(let j=0;j<2;j++){ctx.globalAlpha=.58;ctx.strokeStyle=j?'#f3dcff':c;ctx.lineWidth=j?1.2:2.4;ctx.beginPath();for(let i=0;i<=58;i++){const q=v3Point(box,i/58),r=Math.sin(i*17+Math.floor(speed*1.6))*5;const px=q.x+Math.cos(q.a)*r,py=q.y+Math.sin(q.a)*r;i?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke()}
    corners.forEach(([cx,cy],i)=>lightning(ctx,cx,cy,(i%2?-1:1)*16,(i<2?-1:1)*19,speed*.5+i,c,.45));
  }else if(fx==='nature'){
    v3Ribbon(ctx,box,speed*.6,'#a9ffe3',.45,2);v3Ribbon(ctx,box,-speed*.4,c,.7,3,Math.PI);
    for(let i=0;i<18;i++){const q=v3Point(box,(i+.5)/18);leaf(ctx,q.x+Math.cos(q.a)*5,q.y+Math.sin(q.a)*5,5,c,.72,q.a+Math.PI/2+Math.sin(speed*.5+i)*.2)}
    corners.forEach(([cx,cy],i)=>{halo(ctx,cx,cy,14,'#d2ffb2',.24);drawDot(ctx,cx,cy,4,'#ffdb9b',.68,'gold',speed*.12+i)});
  }else if(fx==='gold'||fx==='eclipse'){
    v3Track(ctx,box,speed*.025,.5,'#ffeebd',.7,4);
    corners.forEach(([cx,cy],i)=>{if(fx==='eclipse')v3Corona(ctx,cx,cy,15,speed+i,'#ffd48d',.7);else v3Sigil(ctx,cx,cy,14,speed*.1*(i%2?1:-1),c,2,.62)});
    for(let i=0;i<12;i++){const q=v3Point(box,(i+.5)/12);drawDot(ctx,q.x,q.y,3.2,'#fff2c9',.7,'gold',Math.PI/4)}
    if(fx==='eclipse'){v3Corona(ctx,x+cw*.73,y+2,22,speed,'#ffe3ab',.65);v3Crescent(ctx,x+cw*.73,y+2,20,-speed*.09,'#be7929',.55)}
  }else if(fx==='moon'){
    corners.forEach(([cx,cy],i)=>{v3Crescent(ctx,cx,cy,14,speed*.08+i*Math.PI/2,'#ecf3ff',.68);ring(ctx,cx,cy,19,19,0,c,.28)});
    for(let i=0;i<7;i++){const q=v3Point(box,i/7+speed*.014);frost(ctx,q.x,q.y,5,'#e7f0ff',.62,speed*.08+i)}
    v3Track(ctx,box,-speed*.03,.26,c,.64,3);
  }else if(fx==='time'||fx==='cosmos'){
    corners.forEach(([cx,cy],i)=>{v3Sigil(ctx,cx,cy,15+i%2*3,speed*.12*(i%2?-1:1),c,fx==='cosmos'?3:2,.62);ring(ctx,cx,cy,24,11,-speed*.13,c,.42,1)});
    v3Track(ctx,box,speed*.026,.24,c,.74,3);v3Track(ctx,box,-speed*.019+.5,.22,'#fff0bc',.55,2);
    if(fx==='cosmos')for(let i=0;i<14;i++){const q=v3Point(box,(i+.5)/14);const next=v3Point(box,(i+1.5)/14);trail(ctx,next.x,next.y,next.x-q.x,next.y-q.y,c,.2);drawDot(ctx,q.x,q.y,2.3,'#e2f5ff',.85,'gold',speed*.08)}
  }else if(fx==='tide'){
    for(let j=0;j<3;j++)v3Ribbon(ctx,box,speed*.7+j*.9,j===1?'#ddfbff':c,.36+j*.1,2+j,j);
    corners.forEach(([cx,cy],i)=>{for(let j=0;j<2;j++)ring(ctx,cx,cy,12+j*7,12+j*7,0,c,.24+j*.12);halo(ctx,cx,cy,16,c,.18)});
    for(let i=0;i<10;i++){const q=v3Point(box,(i+.5)/10+speed*.012);ring(ctx,q.x,q.y,2+i%3,2+i%3,0,'#d2fcff',.6)}
  }else if(fx==='comet'){
    for(let j=0;j<3;j++){const p=speed*(.04+j*.014)+j/3;for(let i=0;i<22;i++){const q=v3Point(box,p-i*.0045);drawDot(ctx,q.x,q.y,Math.max(.5,3.6-i*.14),i<4?'#fffbe0':c,(1-i/22)*.65,'spark')}const q=v3Point(box,p);halo(ctx,q.x,q.y,12,'#d4f9ff',.3);drawDot(ctx,q.x,q.y,3.4,'#fff6cb',.9,'gold',speed*.3)}
  }else if(fx==='void'){
    corners.forEach(([cx,cy],i)=>{for(let j=0;j<3;j++)ring(ctx,cx,cy,10+j*5,4+j*3,speed*.1+i,c,.25+j*.13,1.4);halo(ctx,cx,cy,13,'#efd9ff',.22)});
    for(let i=0;i<20;i++){const q=v3Point(box,(i+.5)/20+speed*.017);v3Crystal(ctx,q.x,q.y,4.6,q.a+Math.PI/2,'#b998e9',.55)}
    v3Track(ctx,box,-speed*.033,.32,'#dec3ff',.75,3);
  }else{
    // Prism, aurora, and the final celestial skins have wide ribbons and physical feather rays.
    const celestial=['genesis','seraph','omni'].includes(fx),layers=fx==='genesis'?5:celestial?4:3;
    for(let j=0;j<layers;j++)v3Ribbon(ctx,box,speed*(j%2?-.65:.55)+j*.8,fxTint(k,j,speed),.4,2+j*.6,j);
    if(celestial)v3Feathers(ctx,box,speed,fx==='genesis'?'#fff1b7':fxTint(k,3,speed),.42,Math.min(24,10+rank));
    corners.forEach(([cx,cy],i)=>{v3Sigil(ctx,cx,cy,celestial?18:12,speed*.12*(i%2?-1:1),fxTint(k,i,speed),celestial?3:1,.57);if(fx==='omni'||fx==='genesis')ring(ctx,cx,cy,25,12,-speed*.11,fxTint(k,i+2,speed),.45,1.3)});
    if(fx==='rainbow')for(let i=0;i<8;i++){const q=v3Point(box,(i+.5)/8+speed*.012);leaf(ctx,q.x-3,q.y,4,fxTint(k,i,speed),.6,-.6);leaf(ctx,q.x+3,q.y,4,fxTint(k,i+2,speed),.6,.6)}
  }
  if(pulse>.02){v3Track(ctx,box,t*.22,.3,'#fff8e6',pulse*.8,3+rank*.1);corners.forEach(([cx,cy])=>halo(ctx,cx,cy,16+pulse*10,c,pulse*.25))}
  ctx.restore();
};
ambient = function(ctx,k,w,h,t,small=false){
  const family=v3Families[k.fx];v3OriginalAmbient(ctx,family?{...k,fx:family}:k,w,h,t,small);
  if(!family)return;
  const r=Math.min(w,h),cx=w*(small?.5:.78),cy=h*.46;ctx.save();
  if(['tide','cosmos','comet'].includes(k.fx)){ring(ctx,cx,cy,r*.28,r*.13,-t*.09,k.color,.35,1.5);ring(ctx,cx,cy,r*.23,r*.1,t*.11,'#e8f4ff',.3)}
  if(k.fx==='eclipse')v3Corona(ctx,cx,cy,r*.24,t,k.color,.4);
  if(k.fx==='crystal')for(let j=0;j<5;j++)v3Crystal(ctx,w*(.55+j*.09),h*(.32+.22*Math.sin(j)**2),small?4:9,Math.sin(t*.1+j)*.5,fxTint(k,j,t),.26);
  if(['aurora','seraph','omni'].includes(k.fx)){for(let j=0;j<3;j++)ring(ctx,cx,cy,r*(.2+j*.055),r*(.09+j*.035),t*.07+j*.75,fxTint(k,j,t),.3,1.6)}
  ctx.restore();
};
burst = function(ctx,k,w,h,elapsed){
  const family=v3Families[k.fx];v3OriginalBurst(ctx,family?{...k,fx:family}:k,w,h,elapsed);
  if(k.tier===2||elapsed<0||elapsed>1600||k.fx==='fire')return;
  const p=elapsed/1600,r=Math.min(w,h)*(0.1+p*.37),alpha=Math.sin(p*Math.PI)*.45;ctx.save();
  v3Sigil(ctx,w*.75,h*.43,r,p*.8,fxTint(k,2,p),k.level>=70?3:2,alpha);
  if(k.fx==='ice'||k.fx==='crystal')for(let i=0;i<8;i++){const a=i*Math.PI/4+p*.4;v3Crystal(ctx,w*.75+Math.cos(a)*r,h*.43+Math.sin(a)*r,4+p*6,a,fxTint(k,i,p),alpha)}
  if(k.level>=85)ring(ctx,w*.75,h*.43,r*1.2,r*.4,-p*1.4,fxTint(k,3,p),alpha,2);
  ctx.restore();
};
// State may finish loading before this asset arrives; rebuild decorative layers once.
if(loaded&&!spinning&&!giftBusy){render();drawWheel()}
