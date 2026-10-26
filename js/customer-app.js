/* หน้าลูกค้า (จำลองใน LINE) — ไม่มีส่วนของพนักงานอยู่ในหน้านี้ */
(function(){
'use strict';
const R=window.RL, S=R.store, C=R.customer;
const stage=()=>document.getElementById('view-customer');
function rerender(){ const y=window.scrollY; C.render(); window.scrollTo(0,y); }

async function start(){
  try{
    if(S.mode==='remote') await S.initCustomer(); else await S.init();
  }catch(err){
    stage().innerHTML='<div class="phone-wrap"><div class="phone"><div class="line-body"><section class="card"><h3>เชื่อมต่อระบบจองไม่ได้</h3><p class="hint">'+R.esc(err.message||'')+'</p><button class="btn-gold" onclick="location.reload()">ลองอีกครั้ง</button></section></div></div></div>';
    return;
  }
  C.bind(); C.render();
  if(S.mode==='remote'){
    S.onChange=()=>{ if(C.st.tab==='book'&&!C.st.done) rerender(); };
    setInterval(async()=>{
      if(document.hidden||C.busy) return;
      try{ const ch=await S.refreshMe(); if(ch&&(C.st.tab==='pts'||(C.st.tab==='book'&&!C.st.done))) rerender(); }catch(e){}
    }, 4000);
  } else {
    window.addEventListener('storage',e=>{ if(e.key===R.DB_KEY){ S.reload(); rerender(); } });
  }
}
start();
window.RL_ready = true;
})();
