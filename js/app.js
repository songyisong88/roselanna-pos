/* ตัวสลับมุมมอง + สิทธิ์ผู้ใช้ (จำลอง) */
(function(){
'use strict';
const R=window.RL, I=R.ico;
const VIEWS=[['customer','ฝั่งลูกค้า (LINE)','leafc'],['pos','POS หน้าร้าน','store'],['dash','แดชบอร์ดเจ้าของ','bars']];
R.load();
function role(){ return R.ROLES[R.ui.role]||R.ROLES.owner; }
R.go = function(v, noHash){
  const r=role(); if(!r.views.includes(v)) v='customer';
  R.ui.view=v; R.saveUi();
  VIEWS.forEach(x=>{ const s=document.getElementById('view-'+x[0]); s.hidden=(x[0]!==v); });
  if(v==='customer') R.customer.render(); else if(v==='pos') R.pos.render(); else R.dash.render();
  document.body.dataset.view=v;
  drawTabs(); if(!noHash) history.replaceState(null,'','#'+v);
  window.scrollTo(0,0);
};
function drawTabs(){
  const r=role();
  document.getElementById('viewTabs').innerHTML=VIEWS.map(x=>{ const ok=r.views.includes(x[0]);
    return '<button data-v="'+x[0]+'" class="'+(R.ui.view===x[0]?'on':'')+'" '+(ok?'':'disabled')+' aria-pressed="'+(R.ui.view===x[0])+'">'+I(ok?x[2]:'lock')+'<span>'+x[1]+'</span></button>'; }).join('');
  document.getElementById('roleNote').innerHTML=I('shield','sm')+'<span>'+r.note+'</span>';
  document.getElementById('roleSel').value=R.ui.role;
}
R.customer.bind(); R.pos.bind(); R.dash.bind();
document.getElementById('viewTabs').addEventListener('click',e=>{ const b=e.target.closest('button'); if(b&&!b.disabled) R.go(b.dataset.v); });
document.getElementById('roleSel').addEventListener('change',e=>{
  R.ui.role=e.target.value; R.saveUi(); R.pos.st.sel=null; R.toast('เปลี่ยนสิทธิ์เป็น “'+role().name+'”'); R.go(role().views.includes(R.ui.view)?R.ui.view:'customer');
});
const h=(location.hash||'').slice(1);
R.go(['customer','pos','dash'].includes(h)?h:R.ui.view, true);
setInterval(()=>{ if(R.ui.view==='pos') R.pos.tick(); },1000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&R.ui.view==='pos') R.pos.tick(); });
window.addEventListener('storage',e=>{ if(e.key==='roselanna_demo_db_v1'){ R.load(); R.go(R.ui.view,true); } });
})();
