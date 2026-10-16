'use strict';
// Existing p*/s* IDs are permanent: recordings and receipts use classID:studentID.
const legacyClassNames={p1:'一年級',p2:'二年級',p3:'三年級',p4:'四年級',p5:'五年級',p6:'六年級'};
let classManagement=false;
const validClassId=id=>typeof id==='string'&&/^(?:p[1-6]|c-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(id);
const validStudentId=id=>typeof id==='string'&&/^(?:s[1-9][0-9]{0,5}|s-[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})$/.test(id);
function validateClassNames(names,lists){
 if(names!==undefined){if(!names||typeof names!=='object'||Array.isArray(names)||Object.keys(names).length>30)throw Error('班別名稱資料不正確');for(const [id,name] of Object.entries(names))if(!validClassId(id)||typeof name!=='string'||!name.trim()||name.length>30)throw Error('班別名稱須為 1–30 字');}
 if(lists)for(const id of Object.keys(lists))if(!legacyClassNames[id]&&!names?.[id])throw Error('班別名稱缺失');
}
function studentLimit(){return classManagement?100:40}
function newStudentId(index){return classManagement?'s-'+crypto.randomUUID():'s'+(index+1)}
function requireClassManagement(){if(classManagement)return true;toast('請先更新原有 Google 後台，重新整理後即可管理班別及刪除學生。');return false}
function markRosterVersion(){extras.rosterVersion=2}
function renderWheelRoster(people){
 let box=document.getElementById('wheel-roster');if(!box){box=document.createElement('div');box.id='wheel-roster';document.getElementById('wheel').closest('.wheel-wrap').after(box)}
 box.hidden=people.length<=12;
 box.innerHTML=people.length>12?'<p class="small">'+people.length+' 人參加 · 號碼對照如下，每人機會相同</p><div class="wheel-roster-list">'+people.map((s,i)=>'<span><b>'+(i+1)+'</b>'+esc(s.name)+'</span>').join('')+'</div>':'';
}
function reconcileRosterSelection(previousGrade){
 const ids=new Set(students.map(s=>s.id));
 if(previousGrade!==grade){drawn=[];winner=null;groupIds=[]}
 else{drawn=drawn.filter(id=>ids.has(id));if(!ids.has(winner))winner=null;groupIds=groupIds.map(list=>list.filter(id=>ids.has(id))).filter(list=>list.length)}
 if(!winner){$('#winner').textContent='準備好了嗎？';$('#winner-skin').innerHTML=''}
}
