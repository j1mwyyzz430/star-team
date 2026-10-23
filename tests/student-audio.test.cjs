const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const code=fs.readFileSync(__dirname+'/../student-audio.js','utf8');
const player=code.slice(code.indexOf('// One AudioContext clock'),code.indexOf('const soundDialog='));
const blob=id=>({arrayBuffer:async()=>id});
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(){
 const sources=[],mixes=[],tones=[],toasts=[],awards=[];
 const audio={currentTime:2,resume:async()=>{},destination:{},decodeAudioData:async id=>{if(id==='bad')throw Error('bad sound');return {id}},
  createGain(){const g={gain:{value:1},connect(){},disconnect(){this.disconnected=true}};mixes.push(g);return g},
  createBufferSource(){const source={connect(m){this.mix=m},disconnect(){this.disconnected=true},start(at){this.started=at},stop(){this.stopped=true}};sources.push(source);return source}};
 const c={audioContext:audio,window:{},document:{hidden:false},studentSounds:new Map(),soundReady:Promise.resolve(),audioEnabled:true,grade:'p6',suppressRewardTone:false,soundKey:(g,id)=>g+':'+id,toast:m=>toasts.push(m),tone:level=>tones.push(level)};
 c.collectionAward=(...args)=>{awards.push(args);c.tone(1)};
 vm.createContext(c);vm.runInContext(player,c);return {c,audio,sources,mixes,tones,toasts,awards};
}
test('all clips decode first, share one start time and a normalized output gain; buffers are reused',async()=>{
 const {c,audio,sources,mixes}=setup();let decodeCount=0;
 const resolve={};audio.decodeAudioData=id=>{decodeCount++;return new Promise(r=>resolve[id]=r)};
 const clips=[blob('a'),blob('b'),blob('c')],playing=c.playStudentSounds(clips);
 await tick();resolve.c({id:'c'});resolve.a({id:'a'});await tick();assert.equal(sources.length,0);
 resolve.b({id:'b'});await playing;
 assert.deepEqual(sources.map(s=>s.buffer.id),['a','b','c']);
 assert.deepEqual(sources.map(s=>s.started),[2.04,2.04,2.04]);assert.equal(mixes[0].gain.value,1/3);
 await c.playStudentSounds(clips);assert.equal(decodeCount,3);assert(sources.slice(0,3).every(s=>s.stopped&&s.disconnected));
 sources.slice(3).forEach(s=>s.onended());assert.equal(mixes[1].disconnected,true);
});
test('stop invalidates in-flight decodes and a later request does not start an older batch',async()=>{
 const {c,audio,sources}=setup();let release;
 audio.decodeAudioData=()=>new Promise(r=>release=r);
 const pending=c.playStudentSounds([blob('slow')]);await tick();c.stopStudentSound();release({id:'slow'});await pending;
 assert.equal(sources.length,0);
 audio.decodeAudioData=async id=>({id});await c.playStudentSounds([blob('new')]);assert.equal(sources[0].buffer.id,'new');
 c.stopStudentSound();assert(sources[0].stopped&&sources[0].disconnected);
});
test('bad clips do not prevent good clips playing; complete failure uses one fallback tone',async()=>{
 const {c,sources,mixes,tones,toasts}=setup();await c.playStudentSounds([blob('good'),blob('bad')],{reward:true});
 assert.equal(sources.length,1);assert.equal(mixes[0].gain.value,1);assert.equal(tones.length,0);assert.match(toasts[0],/部分/);
 await c.playStudentSounds([blob('bad')],{reward:true,level:1});assert.deepEqual(tones,[1]);assert(sources[0].stopped);
 await c.playStudentSounds([],{reward:true,level:0});assert.deepEqual(tones,[1,0]);
});
test('class awards use only changed students, snapshot their class, wait for stored audio, and preserve animation callbacks',async()=>{
 const {c,sources,tones,awards}=setup();let loaded;c.soundReady=new Promise(r=>loaded=r);
 const before=[{id:'s1',score:1},{id:'s2',score:1},{id:'s3',score:1},{id:'s4',score:999999}];
 const after=before.map(s=>({...s,score:['s1','s2'].includes(s.id)?2:s.score}));
 c.collectionAward(before,after,before.map(s=>s.id));c.grade='p4';
 for(const s of before)c.studentSounds.set('p6:'+s.id,{blob:blob(s.id)});
 c.studentSounds.set('p4:s1',{blob:blob('wrong-class')});loaded();await tick();
 assert.deepEqual(sources.map(s=>s.buffer.id),['s1','s2']);assert.equal(awards.length,1);assert.equal(tones.length,0);
});
test('single student and preview still work; muted awards create no sources',async()=>{
 const {c,sources}=setup();c.studentSounds.set('p6:s1',{blob:blob('single')});
 const before=[{id:'s1',score:1}],after=[{id:'s1',score:2}];
 c.collectionAward(before,after,['s1']);await tick();assert.equal(sources.length,1);
 c.audioEnabled=false;c.stopStudentSound();c.collectionAward(before,after,['s1']);await tick();assert.equal(sources.length,1);
 await c.playStudentSound(blob('preview'));assert.equal(sources[1].buffer.id,'preview');
});
