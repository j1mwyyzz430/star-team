// Deterministic 8-second image flow + elemental overlay, authored for Star Team.
export const PERIOD=8;
const TAU=Math.PI*2;
const seed=i=>{const n=Math.sin(i*127.1+311.7)*43758.5453;return n-Math.floor(n)};
const fract=x=>x-Math.floor(x);
export class LivingArt {
 constructor(canvas){
  this.canvas=canvas;this.gl=canvas.getContext('webgl',{alpha:false,antialias:false,preserveDrawingBuffer:true});
  if(!this.gl)throw Error('WebGL unavailable');const gl=this.gl;
  const vertex=`attribute vec2 position;varying vec2 screen;void main(){screen=vec2((position.x+1.0)*.5,(1.0-position.y)*.5);gl_Position=vec4(position,0.0,1.0);}`;
  const fragment=`precision mediump float;varying vec2 screen;uniform sampler2D art;uniform float phase,strength,mode;uniform vec2 crop,center,face,flow;
  float spot(vec2 p,vec2 at,vec2 size){vec2 d=(p-at)/size;return exp(-dot(d,d)*2.0);}
  void main(){
   vec2 uv=(screen-.5)*crop+center;
   float protect=1.0-.98*spot(uv,face,vec2(.13,.14));
   float local=spot(uv,flow,vec2(.38,.42));
   vec2 delta=vec2(0.0);
   if(mode<.5){float heat=smoothstep(.32,1.0,uv.y);delta.x=sin(uv.y*23.0+phase*2.0)*.007*heat;delta.y=cos(uv.x*20.0+phase)*.003*heat;}
   else if(mode<1.5){delta.x=sin(uv.y*9.0+phase)*.010;delta.y=cos(uv.x*8.0+phase)*.004;}
   else if(mode<2.5){delta.x=sin(phase)*(.008+.018*abs(uv.x-face.x));delta.y=sin(phase+uv.x*5.0)*.011;}
   else if(mode<3.5){delta.x=sin(uv.y*16.0+phase*2.0)*.010;delta.y=sin(uv.x*11.0+phase)*.006;}
   else if(mode<4.5){delta.x=sin(uv.y*7.0+phase)*.002;delta.y=cos(phase)*.002;}
   else{delta.x=sin(uv.y*13.0+phase)*.003;delta.y=cos(uv.x*9.0+phase)*.003;}
   uv+=delta*protect*local*strength;
   uv=(uv-center)/(1.025+.004*sin(phase))+center;
   vec3 color=texture2D(art,clamp(uv,vec2(.002),vec2(.998))).rgb;
   float glow=(.5+.5*sin(phase+uv.y*4.0))*.055*strength*local*protect;
   gl_FragColor=vec4(color*(1.0+glow),1.0);
  }`;
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
  const v=shader(gl.VERTEX_SHADER,vertex),f=shader(gl.FRAGMENT_SHADER,fragment),program=gl.createProgram();gl.attachShader(program,v);gl.attachShader(program,f);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.deleteShader(v);gl.deleteShader(f);gl.useProgram(program);
  const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  this.uniforms=Object.fromEntries(['phase','strength','mode','crop','center','face','flow','art'].map(k=>[k,gl.getUniformLocation(program,k)]));this.texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(this.uniforms.art,0);
 }
 setImage(img,beast){this.beast=beast;this.image=img;this.gl.bindTexture(this.gl.TEXTURE_2D,this.texture);this.gl.texImage2D(this.gl.TEXTURE_2D,0,this.gl.RGBA,this.gl.RGBA,this.gl.UNSIGNED_BYTE,img)}
 draw(seconds,stars){if(!this.image||this.gl.isContextLost())return;const gl=this.gl,u=this.uniforms,b=this.beast,w=this.canvas.width,h=this.canvas.height;const {crop,center}=framing(this.image,b,w/h);gl.viewport(0,0,w,h);gl.uniform1f(u.phase,fract(seconds/PERIOD)*TAU);gl.uniform1f(u.strength,.35+stars*.16);gl.uniform1f(u.mode,({heat:0,mist:1,wing:2,water:3,clock:4,crystal:5,wind:2})[b.mode]);gl.uniform2fv(u.crop,crop);gl.uniform2fv(u.center,center);gl.uniform2fv(u.face,b.face);gl.uniform2fv(u.flow,b.flow);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)}
}
export function framing(img,b,aspect){const imageAspect=img.naturalWidth/img.naturalHeight,crop=imageAspect>aspect?[aspect/imageAspect,1]:[1,imageAspect/aspect];return {crop,center:[Math.max(crop[0]/2,Math.min(1-crop[0]/2,b.face[0]-.12)),Math.max(crop[1]/2,Math.min(1-crop[1]/2,b.face[1]+.08))]}}
function polygon(c,x,y,r,n,angle,color){c.beginPath();for(let j=0;j<n;j++){const a=angle+j*TAU/n;j?c.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r):c.moveTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}c.closePath();c.strokeStyle=color;c.stroke()}
function star(c,x,y,r,color,a){c.save();c.translate(x,y);c.rotate(a);c.fillStyle=color;c.beginPath();for(let j=0;j<8;j++){const rr=j%2?r*.25:r,angle=j*TAU/8;j?c.lineTo(Math.cos(angle)*rr,Math.sin(angle)*rr):c.moveTo(Math.cos(angle)*rr,Math.sin(angle)*rr)}c.closePath();c.fill();c.restore()}
function ellipse(c,x,y,rx,ry,angle){c.beginPath();c.ellipse(x,y,rx,ry,angle,0,TAU);c.stroke()}
export function drawElements(c,b,img,w,h,seconds,stars,awards=[]){
 const phase=fract(seconds/PERIOD)*TAU,p=phase/TAU,scale=Math.min(w,h),color=b.color,key=b.key;
 c.clearRect(0,0,w,h);c.save();c.globalCompositeOperation='screen';c.lineWidth=1.2;c.strokeStyle=color;c.fillStyle=color;
 const power=.3+stars*.13;
 // Each scene uses a different motion vocabulary. All periodic arguments are integers.
 if(['aurora','ocean','verdant','omni'].includes(key)){
  for(let j=0;j<(stars>=4?5:3);j++){c.globalAlpha=.12*power;c.lineWidth=key==='aurora'?8:2;c.beginPath();for(let i=0;i<=80;i++){const x=i/80*w,y=h*(.25+j*.12)+Math.sin(i*.07+phase+j)*h*.045; i?c.lineTo(x,y):c.moveTo(x,y)}c.stroke()}
 }
 if(['chrono','cosmos','abyss','sovereign','eclipse'].includes(key)){
  const cx=key==='chrono'?w*.65:w*.22,cy=key==='chrono'?h*.43:h*.33;
  for(let j=0;j<(stars>=4?3:1);j++){c.globalAlpha=.24*power;const r=scale*(.13+j*.045);ellipse(c,cx,cy,r,r*(key==='cosmos'?.5:1),key==='cosmos'?phase+j:0);
   const count=key==='chrono'?24:12;for(let i=0;i<count;i++){const a=i*TAU/count+phase*(j%2?-1:1),len=key==='sovereign'?15:7;c.beginPath();c.moveTo(cx+Math.cos(a)*r,cy+Math.sin(a)*r);c.lineTo(cx+Math.cos(a)*(r+len),cy+Math.sin(a)*(r+len));c.stroke()}}
 }
 if(key==='tempest'){
  for(let j=0;j<2;j++){c.globalAlpha=Math.pow(Math.max(0,Math.sin(phase+j*2.2)),10)*.6*power;c.lineWidth=2;const x=w*(j?.87:.12);c.beginPath();for(let i=0;i<10;i++){const xx=x+(seed(i+31*j)-.5)*w*.12,yy=h*(.12+i*.066);i?c.lineTo(xx,yy):c.moveTo(xx,yy)}c.stroke()}
 }
 if(key==='seraph'){
  for(let j=0;j<(stars>=3?6:3);j++){const a=j/6*TAU+Math.sin(phase)*.1,x=w*.5+Math.cos(a)*w*.42,y=h*.42+Math.sin(a)*h*.28;c.save();c.translate(x,y);c.rotate(a+Math.PI/2);c.globalAlpha=(.15+.2*(.5+.5*Math.sin(phase+j)))*power;c.fillStyle='#fff1bc';c.beginPath();c.moveTo(0,-h*.15);c.lineTo(3,0);c.lineTo(0,h*.035);c.lineTo(-3,0);c.closePath();c.fill();c.restore()}
 }
 if(['glacier','crystal'].includes(key)){
  for(let j=0;j<5;j++){const x=w*(.1+seed(j+34)*.75)+Math.sin(phase+j)*8,y=h*(.15+seed(j+76)*.6)+Math.cos(phase+j)*13;c.globalAlpha=.3*power;polygon(c,x,y,scale*(.014+seed(j)*.018),key==='glacier'?6:4,phase*(j%2?1:-1),color)}
 }
 if(['rainbow','genesis'].includes(key)){
  for(let j=0;j<(stars>=4?5:3);j++){
   const a=phase+j*1.7,x=w*(.18+seed(j+23)*.6)+Math.cos(a)*w*.06,y=h*(.15+seed(j+17)*.5)+Math.sin(a)*h*.06;
   c.save();c.translate(x,y);c.rotate(Math.sin(a)*.4);c.globalAlpha=.45*power;c.fillStyle='hsl('+((j*65+p*360)%360)+' 90% 79%)';const flap=.25+.75*Math.pow(Math.sin(phase*4+j),2);c.scale(flap,1);
   c.beginPath();c.ellipse(-7,0,9,4,-.55,0,TAU);c.ellipse(7,0,9,4,.55,0,TAU);c.fill();c.restore();
  }
 }
 const count=10+stars*7;
 for(let i=0;i<count;i++){
  const q=fract(p+seed(i+12)),fade=Math.pow(Math.sin(q*Math.PI),2),s=seed(i+73),r=(1+seed(i+43)*2.4)*scale/500;
  let x=seed(i+177)*w,y=(1-q)*h;
  if(['glacier','lunar'].includes(key))y=q*h;
  if(['comet','aurora','tempest'].includes(key)){x=q*w;y=(.15+s*.7)*h-Math.sin(q*Math.PI)*h*.06}
  else x+=Math.sin(phase+i)*12;
  c.globalAlpha=fade*(.3+stars*.07);c.fillStyle=color;c.strokeStyle=color;c.lineWidth=1;
  if(key==='comet'||key==='inferno'){c.beginPath();c.moveTo(x,y);c.lineTo(x-(key==='comet'?30:5),y+(key==='comet'?10:15));c.stroke()}
  else if(key==='ocean'||key==='abyss'){ellipse(c,x,y,r*1.7,r*1.7,0)}
  else if(['verdant','lunar','omni'].includes(key)){c.save();c.translate(x,y);c.rotate(phase+i);c.fillStyle=key==='lunar'?'#e1c7ff':color;c.beginPath();c.ellipse(0,0,r*2.5,r,0,0,TAU);c.fill();c.restore()}
  else if(i%4===0)star(c,x,y,r*2,color,phase+i);
  else{c.beginPath();c.arc(x,y,r,0,TAU);c.fill()}
 }
 // Protect the recognizable face from the added light layer.
 if(img){const {crop,center}=framing(img,b,w/h),x=((b.face[0]-center[0])/crop[0]+.5)*w,y=((b.face[1]-center[1])/crop[1]+.5)*h;c.globalCompositeOperation='destination-out';c.globalAlpha=1;const mask=c.createRadialGradient(x,y,scale*.035,x,y,scale*.14);mask.addColorStop(0,'#000');mask.addColorStop(1,'#0000');c.fillStyle=mask;c.fillRect(0,0,w,h)}
 c.restore();
 // The star-4/5 edge ornaments stay out of the center and name area.
 if(stars>=4){c.save();c.strokeStyle=stars===5?'#f4d7ff':color;c.lineWidth=1.5;for(let j=0;j<2;j++){const q=fract(p+j*.5),x=w*(.05+.9*q);c.globalAlpha=Math.pow(Math.sin(q*Math.PI),2)*.65;star(c,x,14,5,c.strokeStyle,phase);star(c,w-x,h-14,5,c.strokeStyle,phase)}c.restore()}
 for(const event of awards){const q=event.age/.8;if(q<0||q>1)continue;c.save();c.globalAlpha=(1-q)*.65;c.strokeStyle=color;c.lineWidth=3;c.beginPath();c.ellipse(w*.27,h*.46,scale*(.04+q*.5),scale*(.04+q*.35),0,0,TAU);c.stroke();for(let i=0;i<10;i++){const a=i*TAU/10;star(c,w*.27+Math.cos(a)*q*scale*.4,h*.46+Math.sin(a)*q*scale*.3,3*(1-q),color,a)}c.restore()}
}
