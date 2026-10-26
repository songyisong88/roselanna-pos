/* มุมมอง POS หน้าร้านบนแท็บเล็ต */
(function(){
'use strict';
const R=window.RL, E=R.esc, I=R.ico;
const P = R.pos = {st:{sel:null, dayOff:0, receipt:null, walk:null}};
const el = () => document.getElementById('view-pos');
const role = () => R.curRole();
const COLS = 12;

P.branchId = () => role().branchLock || R.ui.branch;
P.dayKey = () => R.dayKey(R.addDays(new Date(), P.st.dayOff));
P.discOf = b => b.disc!=null ? b.disc : (b.vip?15:(b.member?10:0));
P.remain = b => b.endsAt - Date.now();
P.fmtCd = ms => { if(ms<=0) return 'หมดเวลา'; const t=Math.ceil(ms/1000); return R.pad(Math.floor(t/60))+':'+R.pad(t%60); };
P.list = () => {
  const r=role(); let l=R.bookingsOn(P.branchId(), P.dayKey());
  if(r.therapist) l=l.filter(b=>b.therapist===r.therapist);
  return l;
};
P.salesToday = () => R.db.sales.filter(s=>s.branch===P.branchId()&&s.day===R.today());

P.render = function(){
  const st=P.st, r=role(), bid=P.branchId(), br=R.branch(bid), day=P.dayKey();
  const keepScroll = el().querySelector('.sch-scroll'); const sl = keepScroll?keepScroll.scrollLeft:null;
  const list=P.list(); const sales=P.salesToday(); const totalToday=sales.reduce((a,s)=>a+s.total,0);
  let h='<div class="pos">';
  h+='<header class="pos-head"><img class="logo-h" src="../assets/logo-horizontal.svg" alt="ROSELANNA — Thai Massage &amp; Wellness">'+
   '<label class="pill-sel">'+I('pin')+'<select id="posBranch" '+(r.branchLock?'disabled':'')+' aria-label="เลือกสาขา">'+R.BRANCHES.map(b=>'<option value="'+b.id+'" '+(b.id===bid?'selected':'')+'>'+b.name+'</option>').join('')+'</select>'+(r.branchLock?I('lock','lk'):I('chev-d'))+'</label>'+
   '<div class="head-right"><div class="date-box">'+I('calendar')+'<div><small>'+(st.dayOff===0?'วันนี้':R.thDow(day))+'</small><b>'+R.thDateShort(day)+'</b></div></div></div></header>';
  h+='<div class="pos-main"><section class="card sched">';
  h+='<div class="card-head">'+I('calendar')+'<h2>ตารางห้องวันนี้</h2><span class="grow"></span>'+
     '<button class="icon-btn sm" data-p="day" data-v="-1" '+(st.dayOff===0?'disabled':'')+' aria-label="วันก่อนหน้า">'+I('chev-l')+'</button><button class="icon-btn sm" data-p="day" data-v="1" '+(st.dayOff===3?'disabled':'')+' aria-label="วันถัดไป">'+I('chev-r')+'</button></div>';
  h+='<div class="sch-tools">'+R.ROOMS.map((rm,i)=>'<span class="room-chip"><i class="dot rm'+(i+1)+'"></i>'+rm.code+' '+rm.name+'</span>').join('')+
     '<span class="grow"></span>'+(r.checkout?'<span class="sales-chip" id="salesChip">'+I('bag')+'ยอดขายวันนี้ <b>'+R.baht(totalToday)+'</b> · '+sales.length+' รายการ</span>':'')+
     (r.therapist?'':'<button class="btn-ghost" data-p="walk">'+I('walk')+'ลูกค้าเดินเข้า</button>')+'</div>';
  // กริด
  h+='<div class="sch"><div class="sch-rooms"><div class="sch-corner"></div>'+R.ROOMS.map((rm,i)=>'<div class="rm-lab"><span class="rm-ic rm'+(i+1)+'">'+I('bed')+'</span><b>'+rm.code+'</b><small>'+rm.name+'</small></div>').join('')+'</div>'+
     '<div class="sch-scroll" id="schScroll"><div class="sch-track"><div class="sch-hours">'+[...Array(COLS)].map((_,i)=>'<span style="left:'+(i/COLS*100)+'%">'+R.hm(R.OPEN+i*60)+'</span>').join('')+'</div>'+
     R.ROOMS.map((rm,i)=>'<div class="sch-row" data-room="'+rm.id+'">'+
        list.filter(b=>b.room===rm.id).map(b=>P.card(b,i+1)).join('')+
        '<button class="add-cell" data-p="walkroom" data-v="'+rm.id+'" aria-label="เพิ่มลูกค้าเดินเข้า '+rm.code+'" '+(r.therapist?'hidden':'')+'>'+I('plus')+'</button></div>').join('')+
     '<div class="now-line" id="nowLine" hidden><span>ตอนนี้</span></div></div></div></div>';
  h+='<div class="sch-legend"><span><i class="sw act"></i>กำลังให้บริการ</span><span><i class="sw up"></i>คิวที่จองไว้ (สีตามห้อง)</span><span><i class="sw done"></i>ชำระแล้ว</span><span>'+I('clock')+'เวลา 24 ชม. · ช่องละ 1 ชั่วโมง</span></div>';
  if(r.therapist) h+='<p class="role-hint">'+I('info')+'แสดงเฉพาะคิวของคุณ'+E(r.therapistName||'')+' · กดคิวแล้วเริ่มบริการได้ แต่ไม่มีสิทธิ์รับชำระเงิน</p>';
  h+='</section>';
  h+='<aside class="card checkout" id="coPanel">'+P.panel()+'</aside></div></div>';
  el().innerHTML=h;
  const sc=document.getElementById('schScroll');
  if(sc){ if(sl!=null) sc.scrollLeft=sl; else { const nm=R.nowMin(); const w=sc.scrollWidth; sc.scrollLeft=Math.max(0,((nm-R.OPEN)/720)*w - sc.clientWidth*0.35); } }
  P.tick();
};

P.card = function(b,n){
  const sv=R.service(b.service), th=R.ther(b.therapist), left=(b.start-R.OPEN)/720*100, w=b.dur/720*100;
  const late = b.status==='booked' && P.dayKey()===R.today() && b.start+10<R.nowMin();
  const cls=['bk','rm'+n,b.status,(P.st.sel===b.id?'sel':''),late?'late':''].join(' ');
  return '<button class="'+cls+'" style="left:calc('+left+'% + 3px);width:calc('+w+'% - 6px)" data-p="sel" data-v="'+b.id+'" aria-label="'+sv.name+' '+R.hm(b.start)+' คุณ'+th.name+'">'+
   '<span class="t">'+R.hm(b.start)+'–'+R.hm(b.start+b.dur)+'</span><span class="d">'+b.dur+' นาที</span><b>'+sv.name+'</b><span class="who">'+R.avatar(th,18)+'คุณ'+th.name+'</span>'+
   (b.status==='running'?'<span class="cd" data-end="'+b.endsAt+'">'+P.fmtCd(P.remain(b))+'</span>':'')+
   (b.status==='paid'?'<span class="paid-mk">'+I('check')+'</span>':'')+
   (b.src==='line'&&b.status==='booked'?'<span class="src-mk" title="จองผ่าน LINE">LINE</span>':'')+'</button>';
};

/* ----- แผงชำระเงิน ----- */
P.panel = function(){
  const st=P.st, r=role();
  const b = st.sel && R.db.bookings.find(x=>x.id===st.sel);
  let h='<div class="card-head">'+I('bag')+'<h2>ชำระเงิน</h2><span class="grow"></span><span class="demo-mini">ตัวอย่าง</span></div>';
  if(!b || !R.live(b)){
    return h+'<div class="empty">'+R.anyAvatar(64)+'<b>เลือกคิวจากตาราง</b><p>แตะการ์ดคิวด้านซ้าย เพื่อเริ่มบริการและชำระเงิน<br>หรือกด “ลูกค้าเดินเข้า” เพื่อเพิ่มคิวใหม่</p></div>';
  }
  const sv=R.service(b.service), th=R.ther(b.therapist), rm=R.room(b.room);
  if(b.status==='paid'){
    const s=R.db.sales.find(x=>x.booking===b.id) || R.db.sales.find(x=>x.id===b.saleId);
    return h+P.receipt(b,s);
  }
  const addonTotal=(b.addons||[]).reduce((a,id)=>a+R.ADDONS.find(x=>x.id===id).price,0);
  const sub=sv.price+addonTotal, pct=P.discOf(b), disc=Math.round(sub*pct/100), total=sub-disc;
  const pay=b.pay||'cash';
  h+='<div class="svc-card"><div class="thumb">'+R.massageScene(sv.id)+'</div><div class="grow"><b>'+sv.name+'</b><small>'+sv.dur+' นาที · '+rm.code+' '+rm.name+'</small><small>'+E(b.custName||'ลูกค้า')+' · '+E(b.id)+'</small></div><span class="price-tag">'+R.baht(sv.price)+'</span></div>';
  const freeTh = R.THERAPISTS.filter(t=>t.branch===b.branch && (t.id===b.therapist||R.therFree(t.id,b.day,b.start,b.start+b.dur)));
  h+='<div class="ther-card">'+R.avatar(th,46)+'<div class="grow"><small class="cap">หมอนวด</small><b>คุณ'+th.name+'</b><small>ระดับ '+th.level+'</small></div>'+
     '<div class="stat-col"><span class="avail '+(b.status==='running'?'run':'')+'"><i></i>'+(b.status==='running'?'กำลังให้บริการ':'ตามนัด')+'</span>'+
     (r.therapist?'':'<select id="coTher" aria-label="เปลี่ยนหมอนวด" '+(b.status==='running'?'disabled':'')+'>'+freeTh.map(t=>'<option value="'+t.id+'" '+(t.id===b.therapist?'selected':'')+'>คุณ'+t.name+'</option>').join('')+'</select>')+'</div></div>';
  // สถานะ/ตัวจับเวลา
  if(b.status==='running'){
    h+='<div class="timer-box"><span class="cap">เวลาที่เหลือ</span><b class="big-cd" id="bigCd" data-end="'+b.endsAt+'">'+P.fmtCd(P.remain(b))+'</b><button class="btn-ghost sm" data-p="plus10" title="สำหรับทดสอบเดโม">เร่งเวลา +10 นาที (ทดสอบ)</button></div>';
  } else {
    h+='<button class="btn-start" data-p="start">'+I('play')+'เริ่มบริการ · เริ่มจับเวลา '+sv.dur+' นาที</button>';
  }
  h+='<div class="sec-t"><span>ส่วนเสริม</span>'+I('plus')+'</div><div class="addons">'+R.ADDONS.map(a=>'<label class="addon"><span>'+a.name+'</span><b>'+R.baht(a.price)+'</b><input type="checkbox" data-p="addon" data-v="'+a.id+'" '+((b.addons||[]).includes(a.id)?'checked':'')+'><i class="cbx">'+I('check')+'</i></label>').join('')+'</div>';
  h+='<div class="totals"><div class="rc-line"><span>ยอดรวมก่อนลด</span><b id="coSub">'+R.baht(sub)+'</b></div>'+
     '<div class="rc-line disc"><span>ส่วนลดสมาชิก <select id="coDisc" aria-label="ส่วนลดสมาชิก">'+R.TIERS.map(t=>'<option value="'+t.pct+'" '+(t.pct===pct?'selected':'')+'>'+t.name+(t.pct?' −'+t.pct+'%':'')+'</option>').join('')+'</select></span><b>−'+R.baht(disc)+'</b></div>'+
     '<div class="rc-line tot"><span>ยอดสุทธิ</span><b id="coTotal">'+R.baht(total)+'</b></div></div>';
  h+='<div class="sec-t"><span>วิธีชำระเงิน</span></div><div class="pay-tiles">'+[['cash','cash','เงินสด'],['qr','qr','พร้อมเพย์ QR'],['card','card','บัตร']].map(x=>'<button class="pay-tile '+(pay===x[0]?'on':'')+'" data-p="pay" data-v="'+x[0]+'" aria-pressed="'+(pay===x[0])+'">'+(pay===x[0]?'<span class="pt-ck">'+I('check')+'</span>':'')+I(x[1],'big')+'<b>'+x[2]+'</b><small>'+R.baht(total)+'</small></button>').join('')+'</div>';
  if(pay==='qr') h+='<div class="qr-mock">'+I('qr','big')+'<span>แสดง QR พร้อมเพย์ให้ลูกค้าสแกน (ตัวอย่าง ไม่มีการชำระจริง)</span></div>';
  h+='<div class="secure">'+I('shield')+'ตัวอย่างเท่านั้น · ไม่มีการตัดเงินจริง</div>';
  if(!r.checkout) h+='<div class="locked">'+I('lock')+'บทบาทหมอนวดไม่มีสิทธิ์รับชำระเงิน</div>';
  else h+='<button class="btn-pay" id="payBtn" data-p="paynow" '+(b.status==='running'?'':'disabled')+'>'+I('lock')+'ชำระเงิน '+R.baht(total)+'</button>'+(b.status==='running'?'':'<p class="tiny c">กด “เริ่มบริการ” ก่อน จึงจะชำระเงินได้</p>');
  h+='<button class="link-back" data-p="back">'+I('home')+'กลับไปตารางเวลา</button>';
  return h;
};
P.receipt = function(b,s){
  if(!s) return '<div class="empty"><b>ชำระแล้ว</b></div>';
  const sv=R.service(s.service), th=R.ther(s.therapist);
  const pts=s.points||0;
  return '<div class="paid-ok" id="paidOk"><div class="ok-mark">'+I('check')+'</div><h3>ชำระเงินสำเร็จ</h3><small>บันทึกยอดขายแล้ว · '+R.PAY[s.pay]+'</small></div>'+
   '<div class="totals"><div class="rc-line"><span>'+sv.name+' '+sv.dur+' นาที</span><b>'+R.baht(sv.price)+'</b></div>'+(s.addons||[]).map(id=>{const a=R.ADDONS.find(x=>x.id===id);return '<div class="rc-line"><span>'+a.name+'</span><b>'+R.baht(a.price)+'</b></div>';}).join('')+
   '<div class="rc-line disc"><span>ส่วนลดสมาชิก '+s.pct+'%</span><b>−'+R.baht(s.gross-s.total)+'</b></div><div class="rc-line tot"><span>ยอดสุทธิ</span><b>'+R.baht(s.total)+'</b></div>'+
   '<div class="rc-line"><span>หมอนวด · ค่าคอม ('+Math.round(R.COMM_RATE*100)+'%)</span><b>คุณ'+th.name+' · '+R.baht(s.commission)+'</b></div></div>'+
   (pts?'<div class="pts-pill">'+I('leafc')+'ลูกค้าได้รับ <b>+'+pts+' คะแนน</b> (เห็นในหน้า “คะแนนของฉัน” ฝั่งลูกค้า)</div>':'')+
   '<button class="btn-pay" data-p="back">กลับไปตารางเวลา</button>';
};

/* ----- ลูกค้าเดินเข้า ----- */
P.walkHtml = function(){
  const w=P.st.walk, bid=P.branchId(), day=R.today(), nm=Math.floor(R.nowMin());
  const sv=R.service(w.svc); const open = nm>=R.OPEN && nm+sv.dur<=R.CLOSE+30 && P.dayKey()===day;
  const rooms=R.ROOMS.map(rm=>({rm, free: !R.bookingsOn(bid,day).some(b=>b.room===rm.id&&b.start<nm+sv.dur&&nm<b.start+b.dur)}));
  const ths=R.THERAPISTS.filter(t=>t.branch===bid).map(t=>({t, free:R.therFree(t.id,day,nm,nm+sv.dur)}));
  if(!rooms.some(x=>x.rm.id===w.room&&x.free)) w.room=(rooms.find(x=>x.free)||{rm:{id:null}}).rm.id;
  if(!ths.some(x=>x.t.id===w.ther&&x.free)) w.ther=(ths.find(x=>x.free)||{t:{id:null}}).t.id;
  return '<div class="modal-head"><h3>'+I('walk')+'เพิ่มลูกค้าเดินเข้า</h3><button class="icon-btn" data-w="close" aria-label="ปิด">'+I('x')+'</button></div>'+
   '<label class="fld"><span>ชื่อลูกค้า (ไม่บังคับ)</span><input id="wName" type="text" maxlength="30" placeholder="เช่น คุณสมศรี" value="'+E(w.name)+'"></label>'+
   '<div class="fld"><span>บริการ</span><div class="seg">'+R.SERVICES.map(v=>'<button class="'+(w.svc===v.id?'on':'')+'" data-w="svc" data-v="'+v.id+'">'+v.name+'<small>'+v.dur+' นาที · '+R.baht(v.price)+'</small></button>').join('')+'</div></div>'+
   '<div class="two-col"><label class="fld"><span>ห้อง (ว่างตอนนี้)</span><select id="wRoom">'+rooms.map(x=>'<option value="'+x.rm.id+'" '+(x.free?'':'disabled')+' '+(x.rm.id===w.room?'selected':'')+'>'+x.rm.code+' '+x.rm.name+(x.free?'':' (ไม่ว่าง)')+'</option>').join('')+'</select></label>'+
   '<label class="fld"><span>หมอนวด (ว่างตอนนี้)</span><select id="wTher">'+ths.map(x=>'<option value="'+x.t.id+'" '+(x.free?'':'disabled')+' '+(x.t.id===w.ther?'selected':'')+'>คุณ'+x.t.name+(x.free?'':' (ไม่ว่าง)')+'</option>').join('')+'</select></label></div>'+
   '<label class="fld"><span>ส่วนลดสมาชิก</span><select id="wTier">'+R.TIERS.map(t=>'<option value="'+t.pct+'" '+(+w.tier===t.pct?'selected':'')+'>'+t.name+(t.pct?' −'+t.pct+'%':'')+'</option>').join('')+'</select></label>'+
   (open?'':'<p class="warn">'+I('alert')+'ตอนนี้อยู่นอกเวลาทำการ (10:00–22:00) หรือกำลังดูตารางวันอื่น จึงเพิ่มคิวเดินเข้าไม่ได้</p>')+
   ((!w.room||!w.ther)?'<p class="warn">'+I('alert')+'ไม่มีห้องหรือหมอนวดว่างพร้อมกันตอนนี้</p>':'')+
   '<button class="btn-gold" data-w="go" '+((open&&w.room&&w.ther)?'':'disabled')+'>เริ่มบริการทันที</button>';
};
P.openWalk = function(room){
  P.st.walk={svc:'thai',room:room||null,ther:null,name:'',tier:0};
  R.modal(P.walkHtml());
};
P.walkRefresh = () => { const m=document.getElementById('modal'); if(!m.hidden&&P.st.walk){ m.querySelector('.modal-card').innerHTML=P.walkHtml(); } };

/* ----- ตัวจับเวลา ----- */
P.tick = function(){
  document.querySelectorAll('#view-pos [data-end]').forEach(n=>{ const ms=+n.dataset.end-Date.now(); n.textContent=P.fmtCd(ms); n.classList.toggle('over',ms<=0); });
  const nl=document.getElementById('nowLine'); if(nl){ const nm=R.nowMin(); const show=P.dayKey()===R.today()&&nm>=R.OPEN&&nm<=R.CLOSE; nl.hidden=!show; if(show) nl.style.left=((nm-R.OPEN)/720*100)+'%'; }
};

P.busy = false;
P.act = async function(a, v, b){
  const S=R.store;
  if(a==='start'&&b){ await S.start(b.id); R.toast('เริ่มบริการและจับเวลาแล้ว'); }
  else if(a==='plus10'&&b){ await S.plus10(b.id); }
  else if(a==='addon'&&b){ const set=new Set(b.addons||[]); set.has(v)?set.delete(v):set.add(v); await S.patch(b.id,{addons:[...set]}); }
  else if(a==='pay'&&b){ await S.patch(b.id,{pay:v}); }
  else if(a==='paynow'&&b&&b.status==='running'&&role().checkout){ const r=await S.checkout(b.id,{pay:b.pay||'cash'}); R.toast('บันทึกยอดขายแล้ว '+R.baht(r.sale.total)); }
};
P.bind = function(){
  el().addEventListener('click',async e=>{
    const t=e.target.closest('[data-p]'); if(!t||t.disabled||P.busy) return; const a=t.dataset.p, v=t.dataset.v, st=P.st;
    const b=st.sel&&R.db.bookings.find(x=>x.id===st.sel);
    if(a==='sel'){ st.sel=v; }
    else if(a==='back'){ st.sel=null; }
    else if(a==='day'){ st.dayOff=Math.max(0,Math.min(3,st.dayOff+(+v))); st.sel=null; }
    else if(a==='walk'){ return P.openWalk(); }
    else if(a==='walkroom'){ return P.openWalk(v); }
    else { P.busy=true; try{ await P.act(a,v,b); }catch(err){ R.toast(err.message||'ทำรายการไม่สำเร็จ'); try{ await R.store.refreshPos(P.branchId()); }catch(e2){} } P.busy=false; }
    P.render();
    if(window.innerWidth<=860){ if(a==='sel'){ const c=document.getElementById('coPanel'); c&&c.scrollIntoView({behavior:'smooth',block:'start'}); } else if(a==='back'){ el().scrollIntoView({block:'start'}); } }
  });
  el().addEventListener('change',async e=>{
    const b=P.st.sel&&R.db.bookings.find(x=>x.id===P.st.sel);
    try{
      if(e.target.id==='posBranch'){ R.ui.branch=e.target.value; R.saveUi(); P.st.sel=null; await R.store.refreshPos(P.branchId()); }
      else if(e.target.id==='coDisc'&&b){ await R.store.patch(b.id,{disc:+e.target.value}); }
      else if(e.target.id==='coTher'&&b){ await R.store.patch(b.id,{therapist:e.target.value}); }
    }catch(err){ R.toast(err.message||'ทำรายการไม่สำเร็จ'); try{ await R.store.refreshPos(P.branchId()); }catch(e2){} }
    P.render();
  });
  document.getElementById('modal').addEventListener('click',e=>{
    const t=e.target.closest('[data-w]'); const w=P.st.walk; if(!t||!w||t.disabled) return; const a=t.dataset.w;
    if(a==='close'){ R.closeModal(); P.st.walk=null; }
    else if(a==='svc'){ w.svc=t.dataset.v; P.walkRefresh(); }
    else if(a==='go'){ P.createWalk(); }
  });
  document.getElementById('modal').addEventListener('input',e=>{ if(e.target.id==='wName'&&P.st.walk) P.st.walk.name=e.target.value; });
  document.getElementById('modal').addEventListener('change',e=>{ const w=P.st.walk; if(!w) return;
    if(e.target.id==='wRoom') w.room=e.target.value; else if(e.target.id==='wTher') w.ther=e.target.value; else if(e.target.id==='wTier') w.tier=+e.target.value; });
};
P.createWalk = async function(){
  const w=P.st.walk, bid=P.branchId();
  try{
    const b=await R.store.walkin({branch:bid, service:w.svc, room:w.room, therapist:w.ther, tier:+w.tier, name:(w.name||'').trim()});
    R.closeModal(); P.st.walk=null; P.st.sel=b.id; P.st.dayOff=0; P.render(); R.toast('เพิ่มลูกค้าเดินเข้าและเริ่มจับเวลาแล้ว');
  }catch(err){ R.toast(err.message||'ห้องหรือหมอนวดไม่ว่างแล้ว'); try{ await R.store.refreshPos(bid); }catch(e2){} P.walkRefresh(); }
};
})();
