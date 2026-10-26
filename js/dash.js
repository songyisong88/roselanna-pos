/* แดชบอร์ดเจ้าของร้าน: คำนวณจากยอดขายใน localStorage */
(function(){
'use strict';
const R=window.RL, E=R.esc, I=R.ico;
const D = R.dash = {};
const el = () => document.getElementById('view-dash');
const role = () => R.curRole();

D.sel = () => role().dashAll ? R.ui.dashBranch : role().branchLock;
D.last = '';
D.nice = max => { const steps=[1000,2000,5000,10000,20000,50000,100000]; let st=steps[0]; for(const s of steps){ st=s; if(max/s<=4.2) break; } return {step:st, top:Math.max(st*Math.ceil(max/st),st*2)}; };
D.render = function(){
  return R.store.dashboard(R.ui.dashPeriod, D.sel()).then(d=>{ D.last=JSON.stringify(d); D.paint(d); })
    .catch(err=>{ R.toast(err.message||'โหลดแดชบอร์ดไม่สำเร็จ'); });
};
D.refresh = function(){
  return R.store.dashboard(R.ui.dashPeriod, D.sel()).then(d=>{ const j=JSON.stringify(d); if(j!==D.last){ D.last=j; D.paint(d); } }).catch(()=>{});
};
D.paint = function(d){
  const r=role(), sc=d.scope, w={prev:d.prevLabel};
  const rev=d.revenue, chg=d.changePct, perBranch=d.perBranch;
  const nz = D.nice(Math.max(...perBranch.map(b=>b.rev),1));
  const svc = d.services.map(x=>({v:R.service(x.id), n:x.n, rev:x.rev}));
  const smax=Math.max(...svc.map(x=>x.n),1);
  const top = d.therapists.map(x=>({t:R.ther(x.id), n:x.n, c:x.c}));
  const bks=d.bookings, util=d.util, overall=d.overall;
  const name = r.dashAll?'คุณเจ้าของร้าน':'ผู้จัดการ'+R.branch(r.branchLock).name;

  let h='<div class="dash">';
  h+='<header class="dash-head"><div class="dash-av"><img src="../assets/logo-emblem.svg" alt="" width="40" height="42"></div><div class="grow"><h1>'+R.greeting()+' '+name+'</h1><p>ภาพรวมของสาขาคุณ'+(R.ui.dashPeriod==='today'?'วันนี้':'ใน 7 วันล่าสุด')+'</p></div>'+
   '<button class="icon-btn bell" data-d="toast" data-v="ยังไม่มีการแจ้งเตือนใหม่ (ตัวอย่าง)" aria-label="การแจ้งเตือน">'+I('bell')+'<i class="nd"></i></button></header>';
  h+='<div class="dash-ctl"><div class="seg2"><button class="'+(R.ui.dashPeriod==='today'?'on':'')+'" data-d="period" data-v="today">วันนี้</button><button class="'+(R.ui.dashPeriod==='7d'?'on':'')+'" data-d="period" data-v="7d">7 วันล่าสุด</button></div>'+
   '<label class="pill-sel sm">'+I('store')+'<select id="dashBranch" '+(r.dashAll?'':'disabled')+' aria-label="เลือกสาขา"><option value="all">ทุกสาขา</option>'+R.BRANCHES.map(b=>'<option value="'+b.id+'" '+((r.dashAll?R.ui.dashBranch:r.branchLock)===b.id?'selected':'')+'>'+b.name+'</option>').join('')+'</select>'+(r.dashAll?I('chev-d'):I('lock','lk'))+'</label></div>';
  h+='<div class="dash-grid">';
  h+='<section class="card rev-card">'+R.sprig()+'<small class="cap">รายได้รวม'+(R.ui.dashPeriod==='today'?'วันนี้':' 7 วันล่าสุด')+' '+I('info','sm')+'</small><div class="rev-num" id="revTotal">'+R.baht(rev)+'</div>'+
   '<div class="chg '+(chg>=0?'up':'dn')+'">'+I(chg>=0?'up':'down')+'<b>'+Math.abs(chg).toFixed(1)+'%</b> เทียบ'+w.prev+' (ช่วงเวลาเดียวกัน)</div><small class="tiny">'+d.count+' รายการขาย · ข้อมูลตัวอย่าง</small></section>';
  // กราฟ
  const ticks=[]; for(let v=0; v<=nz.top; v+=nz.step) ticks.push(v);
  h+='<section class="card chart-card"><div class="card-head"><h2>รายได้ตามสาขา</h2><span class="grow"></span><span class="lg"><i class="dot g"></i>รายได้ (฿)</span></div><div class="chart" id="revChart"><div class="y">'+ticks.slice().reverse().map(v=>'<span style="bottom:'+(v/nz.top*100)+'%">'+(v>=1000?(v/1000)+'K':v)+'</span>').join('')+'</div><div class="plot">'+ticks.map(v=>'<i class="gl" style="bottom:'+(v/nz.top*100)+'%"></i>').join('')+
   '<div class="bars">'+perBranch.map(b=>'<div class="bar-col" data-branch="'+b.id+'"><div class="bar-val"><span class="lf">'+I('leaf')+'</span><b>'+R.baht(b.rev)+'</b></div><div class="bar" style="height:'+(b.rev/nz.top*100)+'%"></div></div>').join('')+'</div></div></div>'+
   '<div class="x-labs">'+perBranch.map(b=>'<div><b>'+R.branch(b.id).short+'</b><small>'+(b.id==='bkk'?'สาขาหลัก':'สาขาที่ '+(R.BRANCHES.findIndex(x=>x.id===b.id)+1))+'</small></div>').join('')+'</div></section>';
  // การจอง
  h+='<section class="card"><div class="card-head"><h2>การจองตามสาขา</h2><span class="grow"></span>'+I('calendar')+'</div><table class="tbl"><thead><tr><th></th><th>คิววันนี้</th><th>รอเริ่ม</th><th>จองล่วงหน้า</th></tr></thead><tbody>'+bks.map(b=>'<tr><td><b>'+R.branch(b.id).short+'</b></td><td>'+b.today+'</td><td>'+b.wait+'</td><td>'+b.fut+'</td></tr>').join('')+'<tr class="sum"><td>รวม</td><td>'+bks.reduce((a,b)=>a+b.today,0)+'</td><td>'+bks.reduce((a,b)=>a+b.wait,0)+'</td><td>'+bks.reduce((a,b)=>a+b.fut,0)+'</td></tr></tbody></table><p class="tiny">จองผ่าน LINE (วันนี้เป็นต้นไป): '+bks.reduce((a,b)=>a+b.line,0)+' คิว</p></section>';
  // บริการ
  h+='<section class="card"><div class="card-head"><h2>บริการยอดนิยม</h2><span class="grow"></span>'+I('lotus')+'</div>'+svc.map((x,i)=>'<div class="svc-bar"><span class="rk">'+(i+1)+'</span><span class="grow"><b>'+x.v.name+'</b><div class="hb"><i style="width:'+(x.n/smax*100)+'%"></i></div></span><span class="nums"><b>'+x.n+' ครั้ง</b><small>'+R.baht(x.rev)+'</small></span></div>').join('')+'</section>';
  // หมอนวด
  h+='<section class="card"><div class="card-head"><h2>ค่าคอมมิชชันหมอนวด</h2><span class="grow"></span><small class="tiny nm">อัตรา '+Math.round(R.COMM_RATE*100)+'% (ตัวอย่าง)</small></div>'+
   (top.length?top.map((x,i)=>'<div class="th-row">'+R.avatar(x.t,38)+'<span class="rk">'+(i+1)+'</span><span class="grow"><b>คุณ'+x.t.name+'</b><small>'+R.branch(x.t.branch).short+' · '+x.n+' คิว</small></span><b class="gold">'+R.baht(x.c)+'</b></div>').join(''):'<p class="hint">ยังไม่มีข้อมูล</p>')+'</section>';
  // ห้อง
  h+='<section class="card"><div class="card-head"><h2>อัตราการใช้ห้องวันนี้</h2><span class="grow"></span>'+I('info','sm')+'</div><div class="util"><div class="donut" style="--p:'+overall+'"><div><b>'+overall+'%</b><small>ภาพรวม</small></div></div><ul>'+util.map((u,i)=>'<li><i class="dot rm'+(i%3+1)+'"></i><span>'+R.branch(u.id).short+'</span><b>'+u.p+'%</b></li>').join('')+'</ul></div><p class="tiny">คิดจากเวลาที่จอง/ใช้งานเทียบกับ 3 ห้อง × 12 ชั่วโมง</p></section>';
  // เตือนวัตถุดิบ + ลูกค้าไม่กลับมา
  h+='<section class="card warm"><div class="card-head"><span class="bagc">'+I('bag')+'</span><h2>วัตถุดิบใกล้หมด</h2>'+I('alert','gold')+'</div><ul class="sup"><li><i class="dot dk"></i><b>น้ำมันนวด</b><small>เหลือ 2 ขวด</small></li><li><i class="dot lt"></i><b>ลูกประคบสมุนไพร</b><small>เหลือ 3 ชิ้น</small></li></ul><button class="btn-ghost sm" data-d="toast" data-v="ตัวอย่าง: หน้าสต็อกจะเปิดใช้ในช่วงถัดไป">ดูสต็อก '+I('chev-r')+'</button></section>';
  h+='<section class="card cen"><div class="card-head"><span class="bagc">'+I('user')+'</span><h2>ลูกค้าที่ยังไม่กลับมา</h2></div><small class="tiny">ไม่มาใช้บริการ 30 วันขึ้นไป</small><div class="big-n">'+d.lapsed+'<small> คน</small></div><button class="btn-ghost sm" data-d="toast" data-v="ตัวอย่าง: ส่งข้อความชวนกลับผ่าน LINE จะทำในช่วงถัดไป">ดูรายชื่อ '+I('chev-r')+'</button></section>';
  h+='</div>';
  h+='<div class="reset-row"><button class="btn-ghost" id="resetBtn" data-d="reset">รีเซ็ตข้อมูลเดโม</button><p class="tiny">ข้อมูลตัวอย่างทั้งหมด · รีเซ็ตแล้วจะกลับเป็นข้อมูลตั้งต้น (ลบคิวและยอดขายที่คุณทดลองสร้าง)</p></div>';
  h+='<nav class="dash-nav">'+[['home','หน้าแรก','on'],['bars','วิเคราะห์',''],['calendar','นัด',''],['user','ลูกค้า',''],['gear','ตั้งค่า','']].map(n=>'<button class="'+n[2]+'" data-d="nav" data-v="'+n[1]+'">'+I(n[0])+'<span>'+n[1]+'</span></button>').join('')+'</nav>';
  h+='</div>';
  el().innerHTML=h;
};
D.bind = function(){
  el().addEventListener('click',e=>{
    const t=e.target.closest('[data-d]'); if(!t) return; const a=t.dataset.d, v=t.dataset.v;
    if(a==='period'){ R.ui.dashPeriod=v; R.saveUi(); D.render(); }
    else if(a==='toast') R.toast(v);
    else if(a==='nav'){ if(v==='นัด'&&role().views.includes('pos')) R.go('pos'); else if(v!=='หน้าแรก') R.toast('ตัวอย่าง: เมนู “'+v+'” จะเปิดใช้ในช่วงถัดไป'); }
    else if(a==='reset'){ R.modal('<div class="modal-head"><h3>รีเซ็ตข้อมูลเดโม?</h3></div><p>คิวจองและยอดขายที่คุณสร้างไว้จะถูกลบ และกลับเป็นข้อมูลตัวอย่างตั้งต้น</p><div class="two-btn"><button class="btn-line" data-d="cancel">ยกเลิก</button><button class="btn-gold" id="doReset" data-d="doreset">รีเซ็ต</button></div>'); }
  });
  document.getElementById('modal').addEventListener('click',e=>{
    const t=e.target.closest('[data-d]'); if(!t) return;
    if(t.dataset.d==='cancel') R.closeModal();
    else if(t.dataset.d==='doreset'){ R.store.resetDemo().then(()=>{ R.closeModal(); R.pos.st.sel=null; R.dash.render(); R.toast('รีเซ็ตข้อมูลเดโมแล้ว'); }).catch(err=>{ R.closeModal(); R.toast(err.message||'รีเซ็ตไม่สำเร็จ'); }); }
  });
  el().addEventListener('change',e=>{ if(e.target.id==='dashBranch'){ R.ui.dashBranch=e.target.value; R.saveUi(); D.render(); } });
};
})();
