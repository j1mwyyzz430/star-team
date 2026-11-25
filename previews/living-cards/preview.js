import {beasts} from './beasts.js';
import {LivingArt,drawElements,framing,PERIOD} from './renderer.js';
const $=s=>document.querySelector(s),art=$('#living-art'),fx=$('#elements'),ctx=fx.getContext('2d');
const descriptions=['原畫輕微流動 · 細緻銅框','柔和流光 · 銀色輪廓','元素軌跡 · 金色卡框','專屬光陣 · 紫晶邊框','完整元素演出 · 星環巡行'];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let selected=beasts[0],stars=3,image=null,playing=!reduced.matches,comparing=false,elapsed=0,last=0,lastDraw=0,generation=0,clicks=0,events=[],engine=null,loaded=false;
try{engine=new LivingArt(art)}catch{art.hidden=true}
const cache=new Map();
function load(src){if(!cache.has(src))cache.set(src,new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>{cache.delete(src);reject(Error('圖片載入失敗'))};im.src=src}));return cache.get(src)}
function size(){const r=$('#card').getBoundingClientRect(),d=Math.min(devicePixelRatio||1,1.5);for(const canvas of [art,fx]){const w=Math.round(r.width*d),h=Math.round(r.height*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}}return {w:fx.width,h:fx.height}}
function paint(t,awards=[]){if(!loaded)return;const {w,h}=size();if(engine)engine.draw(t,stars);drawElements(ctx,selected,image,w,h,t,stars,awards)}
function updateStatus(){
 $('#play').textContent=playing?'暫停動態':'播放動態';$('#compare').setAttribute('aria-pressed',String(comparing));$('#compare').textContent=comparing?'返回動態':'對照原畫';
 art.hidden=comparing||!engine;fx.hidden=comparing;
 $('#renderer-status').textContent=!loaded?'等待原畫載入':comparing?'正在顯示靜態原畫':!engine?'相容模式：原畫靜態，元素光效仍可播放':playing?'8 秒無縫循環 · 局部原畫流動':'已暫停 · 可切換角色或星級';
}
async function select(id){
 const b=beasts.find(b=>b.id===id);if(!b)return;const token=++generation;selected=b;loaded=false;events=[];elapsed=0;$('#award-pops').replaceChildren();$('#loading').hidden=false;$('#loading').textContent='正在載入原畫…';$('#retry').hidden=true;
 $('#card').style.setProperty('--accent',b.color);document.documentElement.style.setProperty('--accent',b.color);
 $('#download-loop').href='./loops/'+b.id+'.mp4';$('#beast-name').textContent=b.name;$('#effect-title').textContent=b.title;$('#motion-name').textContent=b.title;$('#motion-description').textContent=b.description;$('#beast-index').textContent=String(beasts.indexOf(b)+1).padStart(2,'0')+' / 18 · 神獸動態';
 document.querySelectorAll('.beast-choice').forEach(e=>e.setAttribute('aria-pressed',String(e.dataset.id===b.id)));updateStatus();
 try{const im=await load(b.src);if(token!==generation)return;image=im;const still=$('#still-art');still.src=b.src;still.alt=b.name+'原畫';const f=framing(im,b,4/3);const pos=f.center.map((v,i)=>f.crop[i]===1?50:100*(v-f.crop[i]/2)/(1-f.crop[i]));still.style.objectPosition=pos.map(v=>v+'%').join(' ');if(engine)engine.setImage(im,b);loaded=true;$('#loading').hidden=true;paint(0);updateStatus()}catch{if(token!==generation)return;$('#loading').textContent='原畫未能載入，請按「重新載入原畫」。';$('#retry').hidden=false;updateStatus()}
}
function setStars(n){stars=Math.max(1,Math.min(5,n));$('#card').dataset.stars=stars;$('#card-stars').textContent='★'.repeat(stars);$('#card-stars').setAttribute('aria-label',stars+' 星');$('#star-description').textContent=descriptions[stars-1];document.querySelectorAll('[data-stars-option]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.starsOption)===stars)));paint(elapsed)}
$('#star-options').innerHTML=Array.from({length:5},(_,i)=>'<button type="button" data-stars-option="'+(i+1)+'" aria-pressed="false">'+(i+1)+' ★</button>').join('');$('#star-options').onclick=e=>{const b=e.target.closest('[data-stars-option]');if(b)setStars(Number(b.dataset.starsOption))};
$('#beast-grid').innerHTML=beasts.map(b=>'<button type="button" class="beast-choice" data-id="'+b.id+'" aria-pressed="false"><img src="'+b.src+'" loading="lazy" alt=""><strong>'+b.name+'</strong><small>'+b.title+'</small></button>').join('');
$('#beast-grid').onclick=e=>{const b=e.target.closest('[data-id]');if(b){window.cardPreview.ready=select(b.dataset.id);history.replaceState(null,'','#'+b.dataset.id)}};
$('#play').onclick=()=>{playing=!playing;last=performance.now();updateStatus()};$('#compare').onclick=()=>{comparing=!comparing;updateStatus()};$('#retry').onclick=()=>window.cardPreview.ready=select(selected.id);
$('#award').onclick=()=>{
 clicks++;$('#demo-count').textContent='本次試按：'+clicks+' 次';const now=performance.now();events.push(now);events=events.slice(-6);
 const pop=document.createElement('span');pop.className='award-pop';pop.textContent='＋1 ★';pop.style.left=(17+clicks%4*8)+'%';$('#award-pops').append(pop);while($('#award-pops').children.length>6)$('#award-pops').firstChild.remove();
 const animation=pop.animate(reduced.matches?[{opacity:1},{opacity:0}]:[{opacity:0,transform:'translateY(10px) scale(.8)'},{opacity:1,transform:'translateY(-8px) scale(1.04)',offset:.2},{opacity:0,transform:'translateY(-65px) scale(1)'}],{duration:reduced.matches?350:850,easing:'ease-out'});animation.finished.then(()=>pop.remove()).catch(()=>{});
};
art.addEventListener('webglcontextlost',e=>{e.preventDefault();engine=null;art.hidden=true;updateStatus()});
art.addEventListener('webglcontextrestored',()=>{try{engine=new LivingArt(art);if(image)engine.setImage(image,selected);paint(elapsed);updateStatus()}catch{engine=null;updateStatus()}});
reduced.addEventListener('change',()=>{if(reduced.matches)playing=false;updateStatus()});
document.addEventListener('visibilitychange',()=>{last=performance.now()});
function tick(now){requestAnimationFrame(tick);if(document.hidden){last=now;return}if(!last)last=now;if(playing&&!comparing)elapsed+=(now-last)/1000;last=now;if(now-lastDraw<1000/30)return;lastDraw=now;events=events.filter(t=>now-t<850);if((playing&&!comparing)||events.length)paint(elapsed,reduced.matches?[]:events.map(at=>({age:(now-at)/1000})))}
new ResizeObserver(()=>paint(elapsed)).observe($('#card'));
window.cardPreview={beasts,period:PERIOD,select,setStars,get selected(){return selected},get stars(){return stars},get clicks(){return clicks},get renderer(){return engine?'webgl':'canvas-fallback'},get loaded(){return loaded},pause(){playing=false;updateStatus()},seek(t){elapsed=t;events=[];paint(t)},pixels(){return {art:art.toDataURL(),fx:fx.toDataURL()}},ready:null};
setStars(3);window.cardPreview.ready=select(beasts.some(b=>b.id===location.hash.slice(1))?location.hash.slice(1):beasts[0].id);requestAnimationFrame(tick);
