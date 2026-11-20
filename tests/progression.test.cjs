const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const collection=fs.readFileSync(__dirname+'/../skins/collection-v5.js','utf8');
const ctx=vm.createContext({});
const names=['xpAtLevel','levelOf','skinOf','skinUnlockXp','skinUnlockLabel','canEquip','levelMarkup'];
vm.runInContext(html.match(/const skins=\[.*?\];/)[0]+'\n'+names.map(name=>html.match(new RegExp('^function '+name+'\\(.*$', 'm'))[0]).join('\n')+'\n'+collection.split('const collectionOldLayer')[0],ctx);
const evaluate=code=>vm.runInContext(code,ctx);

test('levels 1–100 retain every existing XP boundary; progression continues beyond 100',()=>{
 for(let l=1;l<=100;l++){
  const n=l-1,oldXp=3*n+Math.floor(n*n*.34);
  assert.equal(ctx.xpAtLevel(l),oldXp);
  assert.equal(ctx.levelOf({xp:oldXp}).level,l);
  if(l>1)assert.equal(ctx.levelOf({xp:oldXp-1}).level,l-1);
 }
 assert.equal(ctx.xpAtLevel(100),3629);
 assert.equal(ctx.xpAtLevel(101),3700);
 for(const l of [101,102,110,150,1000,17000]){
  const xp=ctx.xpAtLevel(l),value=ctx.levelOf({xp});
  assert.equal(value.level,l);assert.equal(value.progress,0);
  assert.equal(value.next,ctx.xpAtLevel(l+1));
  assert.equal(ctx.levelOf({xp:xp-1}).level,l-1);
 }
 for(const xp of [3629,3699,4029,4829,6229,99999999]){
  const l=ctx.levelOf({xp});assert(ctx.xpAtLevel(l.level)<=xp&&l.next>xp);
  assert(l.progress>=0&&l.progress<100);
 }
 const legacy={score:5000};assert.equal(ctx.levelOf(legacy).level,ctx.levelOf({xp:5000}).level);
 assert(!ctx.levelMarkup({xp:5000}).includes('Lv.100'));
});

test('all 18 beast awakenings unlock at exactly Lv.100, preserving lower-level skin access',()=>{
 evaluate(`for(const k of collectionBeasts){
  if(collectionStage({xp:3628},k)!==0||collectionStage({xp:3629},k)!==3)throw Error(k.id);
  if(!canEquip({xp:3629},k))throw Error('beast not equippable');
 }`);
 assert.equal(evaluate('collectionBeasts.length'),18);
 assert.equal(evaluate('collectionRoad.filter(m=>m.xp===3629).length'),54);
 assert.equal(evaluate("collectionNext({xp:3629}).id"),'m1-rail');
 assert.equal(evaluate("collectionCanPlay({theme:'default',xp:10000})"),false);
 assert.equal(evaluate("collectionCanPlay({theme:'t1-flare',xp:10000})"),false);
 assert.equal(evaluate("canEquip({xp:xpAtLevel(8)},skins.find(k=>k.id==='t0-inferno'))"),true);
});

test('all three mecha keep their exact XP thresholds and do not unlock at Lv.100',()=>{
 const mechas=evaluate("skins.filter(k=>k.series==='mecha')");
 assert.deepEqual(Array.from(mechas,k=>k.unlockXp),[4029,4829,6229]);
 for(const k of mechas){
  assert.equal(ctx.canEquip({xp:3629},k),false);
  assert.equal(ctx.canEquip({xp:k.unlockXp-1},k),false);
  assert.equal(ctx.collectionStage({xp:k.unlockXp-1},k),0);
  assert.equal(ctx.canEquip({xp:k.unlockXp},k),true);
  assert.equal(ctx.collectionStage({xp:k.unlockXp},k),3);
  assert(ctx.levelOf({xp:k.unlockXp}).level>100);
 }
 assert.equal(evaluate('collectionNext({xp:6229})'),undefined);
});
