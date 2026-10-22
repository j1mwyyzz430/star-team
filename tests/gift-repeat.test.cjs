const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const logic=html.slice(html.indexOf('const giftWeights='),html.indexOf("let giftStudentKey='';"));
const gift=(id,rarity=2)=>({id,rarity,draw:true,stock:10});
const receipt=(giftId,other={})=>({grade:'p4',studentId:'s1',giftId,kind:'draw',status:'delivered',...other});
function setup(receipts=[],weights={2:70,3:25,4:5}){
 const c={extras:{receipts,drawWeights:weights},rand:n=>{assert(Number.isSafeInteger(n)&&n>0);return 0}};
 vm.createContext(c);vm.runInContext(logic,c);return c;
}
function weights(c,pool=[gift('a'),gift('b')],g='p4',s='s1'){
 return Array.from(c.personalGiftWeights(pool,g,s),p=>p.weight);
}
test('no history is uniform; most recent duplicate drops from 50% to 1/9 with two same-tier gifts',()=>{
 const c=setup();assert.deepEqual(weights(c),[32,32]);
 c.extras.receipts.push(receipt('a'));
 assert.deepEqual(weights(c),[4,32]);
 const seen={a:0,b:0};
 for(let ticket=0;ticket<36;ticket++){
  const rolls=[0,ticket];c.rand=n=>{const x=rolls.shift();assert(x<n);return x};
  seen[c.chooseGift([gift('a'),gift('b')],'p4','s1').id]++;
 }
 assert.deepEqual(seen,{a:4,b:32});
});
test('more frequent gifts receive less weight, remain possible, and the last gift has extra reduction',()=>{
 const c=setup([receipt('a'),receipt('a'),receipt('a'),receipt('b')]);
 assert.deepEqual(weights(c,[gift('a'),gift('b'),gift('new')]),[4,4,32]);
 c.extras.receipts.push(receipt('a'));assert.deepEqual(weights(c),[1,16]);
});
test('history is scoped to class and permanent student ID; refunds and direct redemption do not count',()=>{
 const c=setup([receipt('a',{grade:'p5'}),receipt('a',{studentId:'s2'}),receipt('a',{status:'refunded'}),receipt('a',{kind:'redeem'})]);
 assert.deepEqual(weights(c),[32,32]);
 const g='c-11111111-2222-4333-8444-555555555555',s='s-11111111-2222-4333-8444-555555555555';
 c.extras.receipts.push(receipt('a',{grade:g,studentId:s,status:'pending'}));
 assert.deepEqual(weights(c,[gift('a'),gift('b')],g,s),[4,32]);
 assert.deepEqual(weights(c),[32,32]);
 c.extras.receipts.push(receipt('a',{grade:undefined}));
 assert.deepEqual(weights(c,[gift('a'),gift('b')],'p6'),[4,32]);
});
test('only last ten valid personal draws count; cleared receipts start fresh and reads do not mutate state',()=>{
 const c=setup([receipt('a'),...Array.from({length:10},()=>receipt('b')),receipt('a',{status:'refunded'})]);
 const before=JSON.stringify(c.extras);assert.deepEqual(weights(c),[32,1]);assert.equal(JSON.stringify(c.extras),before);
 c.extras.receipts=[];assert.deepEqual(weights(c),[32,32]);
});
test('rarity tickets stay unchanged even when a tier contains only repeated gifts',()=>{
 const c=setup([receipt('a'),receipt('a'),receipt('a')],{2:7,3:2,4:1});
 const pool=[gift('a'),gift('b'),gift('c',3),gift('d',4)],tiers={2:0,3:0,4:0};
 for(let i=0;i<10;i++){
  let calls=0;c.rand=n=>{const x=calls++===0?i:n-1;assert(x<n);return x};
  tiers[c.chooseGift(pool,'p4','s1').rarity]++;
 }
 assert.deepEqual(tiers,{2:7,3:2,4:1});
 c.rand=()=>0;assert.equal(c.chooseGift([gift('a')],'p4','s1').id,'a');
 c.extras.drawWeights={2:0,3:2,4:0};assert.equal(c.chooseGift(pool,'p4','s1').id,'c');
 assert.throws(()=>c.chooseGift([gift('a')],'p4','s1'),/沒有可抽禮物/);
 assert.throws(()=>c.chooseGift([],'p4','s1'),/沒有可抽禮物/);
});
