/* หน้าร้าน/พนักงาน: เข้าสู่ระบบตามบทบาท → POS และแดชบอร์ด (ไม่มีหน้าลูกค้าอยู่ในหน้านี้) */
(function(){
'use strict';
const R=window.RL, I=R.ico, E=R.esc, S=R.store;
const $=id=>document.getElementById(id);

R.ROLES = {
  owner:    {name:'เจ้าของร้าน',   views:['pos','dash'], checkout:true,  dashAll:true,  icon:'bars',  desc:'ดูได้ทุกสาขา แดชบอร์ดรวม และรับชำระเงินได้'},
  manager:  {name:'ผู้จัดการสาขา', views:['pos','dash'], checkout:true,  dashAll:false, icon:'store', desc:'ดู POS และแดชบอร์ดเฉพาะสาขาของตัวเอง'},
  cashier:  {name:'แคชเชียร์',     views:['pos'],        checkout:true,  dashAll:false, icon:'bag',   desc:'รับชำระเงินและเพิ่มลูกค้าเดินเข้า · ไม่เห็นแดชบอร์ด'},
  therapist:{name:'หมอนวด',        views:['pos'],        checkout:false, dashAll:false, icon:'user',  desc:'เห็นเฉพาะคิวของตัวเอง กดเริ่มบริการได้ · ไม่รับชำระเงิน'}
};
R.session = null;
R.curRole = () => {
  const s=R.session, b=R.ROLES[s.role], br=s.branch?R.branch(s.branch).name:'';
  const note = {
    owner:'เจ้าของร้าน: ดูได้ทุกสาขา และสลับสาขาได้',
    manager:'ผู้จัดการ'+br+': ดู POS และแดชบอร์ดเฉพาะสาขาของตัวเอง (สลับสาขาไม่ได้)',
    cashier:'แคชเชียร์'+br+': ใช้ POS รับชำระเงิน · ไม่เห็นแดชบอร์ดรายได้',
    therapist:'หมอนวด (คุณ'+(s.therapistName||'')+'): เห็นเฉพาะคิวของตัวเอง กดเริ่มบริการได้ · ไม่มีสิทธิ์รับชำระเงินและไม่เห็นยอดขาย'
  }[s.role];
  return Object.assign({}, b, {branchLock:s.role==='owner'?null:s.branch, therapist:s.role==='therapist'?s.therapist:undefined, therapistName:s.therapistName, name:s.role==='therapist'?'หมอนวด · คุณ'+s.therapistName:(s.role==='owner'?b.name:b.name+' · '+br), note});
};

/* ---------- หน้าเข้าสู่ระบบ ---------- */
const L={role:'owner', branch:'bkk', therapist:null, busy:false};
function loginHtml(){
  const roles=Object.keys(R.ROLES);
  const thers=R.THERAPISTS.filter(t=>t.branch===L.branch);
  if(!thers.some(t=>t.id===L.therapist)) L.therapist=thers[0].id;
  return '<div class="login-wrap"><div class="login-card card">'+
    '<img class="login-logo" src="../assets/logo-full.svg" alt="ROSELANNA — Thai Massage &amp; Wellness">'+
    '<h1>เข้าสู่ระบบหลังร้าน</h1><p class="login-sub">สำหรับพนักงานและเจ้าของร้านเท่านั้น</p>'+
    '<div class="role-grid" role="radiogroup" aria-label="เลือกบทบาท">'+roles.map(k=>'<button type="button" role="radio" aria-checked="'+(L.role===k)+'" class="role-card '+(L.role===k?'on':'')+'" data-l="role" data-v="'+k+'">'+I(R.ROLES[k].icon)+'<b>'+R.ROLES[k].name+'</b><small>'+R.ROLES[k].desc+'</small></button>').join('')+'</div>'+
    (L.role==='owner'?'':'<div class="two-col"><label class="fld"><span>สาขา</span><select id="lgBranch">'+R.BRANCHES.map(b=>'<option value="'+b.id+'" '+(b.id===L.branch?'selected':'')+'>'+b.name+'</option>').join('')+'</select></label>'+
      (L.role==='therapist'?'<label class="fld"><span>หมอนวด</span><select id="lgTher">'+thers.map(t=>'<option value="'+t.id+'" '+(t.id===L.therapist?'selected':'')+'>คุณ'+t.name+'</option>').join('')+'</select></label>':'<span></span>')+'</div>')+
    '<button class="btn-gold" id="lgGo" data-l="go" '+(L.busy?'disabled':'')+'>เข้าสู่ระบบ</button>'+
    '<p class="login-note">'+I('shield','sm')+'<span>เดโมตัวอย่าง: ยังไม่ต้องใช้รหัสผ่าน (ระบบจริงต้องมีรหัสผ่าน/2 ขั้นตอน) · '+(S.mode==='remote'?'เชื่อมต่อเซิร์ฟเวอร์กลาง สิทธิ์ถูกตรวจที่เซิร์ฟเวอร์':'โหมดเบราว์เซอร์ ข้อมูลเก็บในเครื่องนี้เท่านั้น')+'</span></p>'+
    '</div></div>';
}
function showLogin(msg){
  stopPolling(); R.session=null;
  $('shopBar').hidden=true; ['pos','dash'].forEach(v=>$('view-'+v).hidden=true);
  $('view-login').hidden=false; $('view-login').innerHTML=loginHtml(); document.body.dataset.view='login';
  if(msg) R.toast(msg);
}
$('view-login').addEventListener('click',async e=>{
  const t=e.target.closest('[data-l]'); if(!t||t.disabled) return; const a=t.dataset.l;
  if(a==='role'){ L.role=t.dataset.v; $('view-login').innerHTML=loginHtml(); }
  else if(a==='go'){
    L.busy=true; t.disabled=true;
    try{ const ses=await S.login(L.role,{branch:L.branch,therapist:L.therapist}); location.hash=''; await enter(ses,true); }
    catch(err){ L.busy=false; $('view-login').innerHTML=loginHtml(); R.toast(err.message||'เข้าสู่ระบบไม่สำเร็จ'); }
    L.busy=false;
  }
});
$('view-login').addEventListener('change',e=>{
  if(e.target.id==='lgBranch'){ L.branch=e.target.value; L.therapist=null; $('view-login').innerHTML=loginHtml(); }
  else if(e.target.id==='lgTher'){ L.therapist=e.target.value; }
});

/* ---------- หลังเข้าสู่ระบบ ---------- */
const VIEWS=[['pos','POS หน้าร้าน','store'],['dash','แดชบอร์ด','bars']];
async function enter(ses,fresh){
  R.session=ses; const r=R.curRole();
  if(S.mode==='remote'){ R.db={bookings:[],sales:[],points:{total:0,history:[]}}; await S.refreshPos(R.pos.branchId()); } else await S.init();
  $('view-login').hidden=true; $('view-login').innerHTML=''; $('shopBar').hidden=false;
  const h=(location.hash||'').slice(1); R.go(fresh?'pos':(r.views.includes(h)?h:(r.views.includes(R.ui.view)?R.ui.view:'pos')),true);
  startPolling();
}
R.go = function(v, noHash){
  const r=R.curRole(); if(!r.views.includes(v)) v='pos';
  R.ui.view=v; R.saveUi();
  VIEWS.forEach(x=>{ $('view-'+x[0]).hidden=(x[0]!==v); });
  if(v==='pos') R.pos.render(); else R.dash.render();
  document.body.dataset.view=v; drawBar();
  if(!noHash) history.replaceState(null,'','#'+v);
  window.scrollTo(0,0);
};
function drawBar(){
  const r=R.curRole();
  $('viewTabs').innerHTML=r.views.length<2?'':VIEWS.filter(x=>r.views.includes(x[0])).map(x=>'<button data-v="'+x[0]+'" class="'+(R.ui.view===x[0]?'on':'')+'" aria-pressed="'+(R.ui.view===x[0])+'">'+I(x[2])+'<span>'+x[1]+'</span></button>').join('');
  $('whoName').textContent=r.name;
  $('roleNote').innerHTML=I('shield','sm')+'<span>'+E(r.note)+'</span>';
}
$('viewTabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&!b.disabled) R.go(b.dataset.v); });
$('logoutBtn').addEventListener('click',async()=>{ await S.logout(); R.pos.st.sel=null; showLogin('ออกจากระบบแล้ว'); });

/* ---------- อัปเดตอัตโนมัติ ---------- */
let timers=[];
function stopPolling(){ timers.forEach(clearInterval); timers=[]; }
const modalOpen=()=>!$('modal').hidden;
function startPolling(){
  stopPolling();
  timers.push(setInterval(()=>{ if(R.ui.view==='pos') R.pos.tick(); },1000));
  if(S.mode==='remote'){
    timers.push(setInterval(async()=>{
      if(document.hidden||!R.session||R.pos.busy) return;
      try{
        if(R.ui.view==='pos'){ const ch=await S.refreshPos(R.pos.branchId()); if(ch&&!modalOpen()) R.pos.render(); }
        else await R.dash.refresh();
      }catch(err){ if(err.status===401){ await S.logout(); showLogin('หมดเวลาเข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่'); } }
    },3000));
  }
}
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&R.session&&R.ui.view==='pos') R.pos.tick(); });
if(S.mode==='local') window.addEventListener('storage',e=>{
  if(e.key===R.DB_KEY&&R.session){ S.reload(); if(!modalOpen()) R.go(R.ui.view,true); }
  else if(e.key==='roselanna_shop_session_v2'&&!e.newValue&&R.session){ showLogin(); }
});

/* ---------- เริ่มทำงาน ---------- */
(async function(){
  R.pos.bind(); R.dash.bind();
  try{ if(S.mode==='local') await S.init(); const ses=await S.restore(); if(ses) await enter(ses); else showLogin(); }
  catch(err){ showLogin(); R.toast(err.message||''); }
  window.RL_ready=true;
})();
})();
