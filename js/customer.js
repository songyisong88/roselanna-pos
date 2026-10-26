/* มุมมองลูกค้า: จำลองหน้าจอใน LINE (ตัวอย่าง ไม่เชื่อม LINE จริง) */
(function(){
'use strict';
const R=window.RL, E=R.esc, I=R.ico;
const C = R.customer = {st:{tab:'book', branch:null, service:null, ther:'any', off:0, time:null, done:null}};
const el = () => document.getElementById('view-customer');

C.render = function(){
  const s=C.st;
  const tabs=[['book','calendar','จองคิว'],['price','tag','ราคา'],['promo','gift','โปรโมชั่น'],['pts','leafc','คะแนนของฉัน']];
  el().innerHTML =
   '<div class="phone-wrap"><div class="phone">'+
   '<div class="line-head"><button class="icon-btn" data-c="back" aria-label="ย้อนกลับ">'+I('chev-l')+'</button>'+
   '<div class="line-av"><img src="assets/logo-emblem.svg" alt="" width="30" height="31"></div>'+
   '<div class="line-title"><b>ROSELANNA</b><span class="verified">'+I('check')+'</span><small>Official Account · จำลองหน้าจอใน LINE</small></div>'+
   '<span class="line-act">'+I('phone')+I('dots')+'</span></div>'+
   '<div class="line-body">'+
   (s.tab==='book' ? (s.done?C.success():C.booking()) : s.tab==='price'?C.price():s.tab==='promo'?C.promo():C.points())+
   '</div>'+
   '<nav class="line-tabs">'+tabs.map(t=>'<button data-c="tab" data-v="'+t[0]+'" class="'+(s.tab===t[0]?'on':'')+'">'+I(t[1])+'<span>'+t[2]+'</span></button>').join('')+'</nav>'+
   '</div><p class="demo-foot">หน้าจอจำลอง · ไม่ได้เชื่อมต่อ LINE จริง · ข้อมูลตัวอย่าง</p></div>';
};

C.booking = function(){
  const s=C.st, br=s.branch&&R.branch(s.branch), sv=s.service&&R.service(s.service);
  const days=[...Array(7)].map((_,i)=>R.dayKey(R.addDays(new Date(),i)));
  const day=days[s.off];
  let h='';
  h+='<div class="bubble-row"><div class="line-av sm"><img src="assets/logo-emblem.svg" alt="" width="22" height="23"></div><div class="bubble">สวัสดีค่ะ '+I('sparkle','g')+'<br>ยินดีต้อนรับสู่ ร้านนวดและสุขภาพ <b>โรเซลานนา</b><br>จองคิวผ่อนคลายแบบไทยได้ง่าย ๆ ทุกสาขา<small>'+R.hm(new Date().getHours()*60+new Date().getMinutes())+' น.</small></div></div>';
  // สาขา
  h+='<section class="card"><h3>'+I('pin')+'เลือกสาขา</h3>'+R.BRANCHES.map(b=>
    '<button class="row-btn '+(s.branch===b.id?'sel':'')+'" data-c="branch" data-v="'+b.id+'" aria-pressed="'+(s.branch===b.id)+'"><span class="grow"><b>'+b.name+'</b><small>'+b.addr+'</small></span><span class="chip">'+I('pin')+b.dist+'</span>'+(s.branch===b.id?'<span class="tick">'+I('check')+'</span>':I('chev-r','muted'))+'</button>').join('')+'</section>';
  // บริการ
  h+='<section class="card"><h3>'+I('lotus')+'เลือกบริการ</h3>'+R.SERVICES.map(v=>
    '<button class="svc-row '+(s.service===v.id?'sel':'')+'" data-c="service" data-v="'+v.id+'" aria-pressed="'+(s.service===v.id)+'"><span class="svc-badge">'+R.svcIcon(v.id,38)+'</span><span class="grow"><b>'+v.name+'</b><small>'+v.sub+'</small></span><span class="price"><b>'+R.baht(v.price)+'</b><small>'+v.dur+' นาที</small></span><span class="radio '+(s.service===v.id?'on':'')+'">'+(s.service===v.id?I('check'):'')+'</span></button>').join('')+'</section>';
  // หมอนวด
  if(br){
    h+='<section class="card"><h3>'+I('user')+'เลือกหมอนวด</h3><div class="ther-row">'+
     '<button class="ther '+(s.ther==='any'?'sel':'')+'" data-c="ther" data-v="any" aria-pressed="'+(s.ther==='any')+'">'+R.anyAvatar(44)+'<b>ไม่ระบุ</b><small>ว่างก่อนได้ก่อน</small></button>'+
     R.THERAPISTS.filter(t=>t.branch===br.id).map(t=>'<button class="ther '+(s.ther===t.id?'sel':'')+'" data-c="ther" data-v="'+t.id+'" aria-pressed="'+(s.ther===t.id)+'">'+R.avatar(t,44)+'<b>คุณ'+t.name+'</b><small>ระดับ '+t.level+'</small></button>').join('')+'</div></section>';
  }
  // วัน/เวลา
  h+='<section class="card"><h3>'+I('clock')+'เลือกวันและเวลา</h3><div class="date-nav"><button class="icon-btn" data-c="off" data-v="-1" '+(s.off===0?'disabled':'')+' aria-label="วันก่อนหน้า">'+I('chev-l')+'</button><b id="dateLbl">'+R.thDate(day)+'</b><button class="icon-btn" data-c="off" data-v="1" '+(s.off===6?'disabled':'')+' aria-label="วันถัดไป">'+I('chev-r')+'</button></div>';
  if(!br||!sv){ h+='<p class="hint">เลือกสาขาและบริการก่อน เพื่อดูเวลาที่ว่าง</p>'; }
  else {
    const slots=R.slotsFor(br.id,sv,day,s.ther);
    h+='<div class="slots">'+slots.map(x=>{
      const k=x.start, sel=s.time===k;
      return '<button class="slot '+(sel?'sel':'')+(x.ok?'':' off')+'" data-c="time" data-v="'+k+'" '+(x.ok?'':'disabled')+' aria-pressed="'+sel+'" aria-label="'+R.hm(k)+(x.ok?'':(x.past?' ผ่านไปแล้ว':' ถูกจองแล้ว'))+'">'+R.hm(k)+'</button>'; }).join('')+'</div>'+
     '<div class="legend"><span><i class="dot free"></i>ว่าง</span><span><i class="dot sel"></i>ที่เลือก</span><span><i class="dot off"></i>ถูกจองแล้ว/ผ่านไปแล้ว</span></div>';
  }
  h+='<div class="note-line">'+I('leaf')+'กรุณามาให้ตรงเวลา 10–15 นาที เพื่อประสบการณ์ที่ดีที่สุด</div></section>';
  // สรุป
  const ready = br&&sv&&s.time!=null;
  const miss=[]; if(!br)miss.push('สาขา'); if(!sv)miss.push('บริการ'); if(s.time==null)miss.push('เวลา');
  h+='<section class="card sum"><h3>'+I('receipt')+'สรุปการจอง</h3>'+
    (ready?'<div class="sum-grid"><span>สาขา</span><b>'+br.name+'</b><span>บริการ</span><b>'+sv.name+' '+sv.dur+' นาที</b><span>หมอนวด</span><b>'+(s.ther==='any'?'ไม่ระบุ (ระบบจัดให้)':'คุณ'+R.ther(s.ther).name)+'</b><span>วัน-เวลา</span><b>'+R.thDate(day)+' · '+R.hm(s.time)+' น.</b><span>ราคา (ส่วนลดสมาชิก 10%)</span><b>'+R.baht(sv.price*0.9)+'</b></div>':'<p class="hint">ยังต้องเลือก: '+miss.join(' · ')+'</p>')+
    '<button class="btn-gold" id="confirmBtn" data-c="confirm" '+(ready?'':'disabled')+'>ยืนยันการจอง</button></section>';
  return h;
};

C.success = function(){
  const b=C.st.done, br=R.branch(b.branch), sv=R.service(b.service), th=R.ther(b.therapist);
  const gross=R.priceOf(b), total=Math.round(gross*0.9), pts=Math.floor(total/10);
  return '<section class="card ok-card" id="successCard"><div class="ok-mark">'+I('check')+'</div><h2>จองคิวสำเร็จ</h2><p class="muted">แสดงรหัสนี้กับพนักงานหน้าร้าน</p><div class="code" id="bkCode">'+b.id+'</div>'+
    '<div class="sum-grid"><span>สาขา</span><b>'+br.name+'</b><span>บริการ</span><b>'+sv.name+' '+sv.dur+' นาที</b><span>หมอนวด</span><b>คุณ'+th.name+'</b><span>วัน-เวลา</span><b>'+R.thDate(b.day)+' · '+R.hm(b.start)+'–'+R.hm(b.start+b.dur)+' น.</b></div></section>'+
    '<section class="card receipt"><h3>'+I('receipt')+'ตัวอย่างใบเสร็จ / คะแนนสะสม</h3><div class="rc-line"><span>'+sv.name+' '+sv.dur+' นาที</span><b>'+R.baht(gross)+'</b></div><div class="rc-line disc"><span>ส่วนลดสมาชิก 10%</span><b>−'+R.baht(gross-total)+'</b></div><div class="rc-line tot"><span>ยอดโดยประมาณ</span><b>'+R.baht(total)+'</b></div>'+
    '<div class="pts-pill">'+I('leafc')+'จะได้รับ <b>+'+pts+' คะแนน</b> เมื่อชำระเงินที่ร้าน</div><p class="tiny">* ตัวอย่างเท่านั้น ยังไม่มีการชำระเงินจริง</p></section>'+
    '<div class="two-btn"><button class="btn-line" data-c="again">จองคิวอีกครั้ง</button><button class="btn-gold" data-c="gopts">ดูคะแนนของฉัน</button></div>';
};

C.price = function(){
  return '<section class="card"><h3>'+I('tag')+'รายการราคา</h3>'+R.SERVICES.map(v=>'<div class="svc-row static"><span class="svc-badge">'+R.svcIcon(v.id,38)+'</span><span class="grow"><b>'+v.name+'</b><small>'+v.sub+'</small></span><span class="price"><b>'+R.baht(v.price)+'</b><small>'+v.dur+' นาที</small></span></div>').join('')+'</section>'+
   '<section class="card"><h3>'+I('plus')+'บริการเสริม</h3>'+R.ADDONS.map(a=>'<div class="rc-line"><span>'+a.name+'</span><b>+'+R.baht(a.price)+'</b></div>').join('')+'<p class="tiny">ราคาตัวอย่างเพื่อสาธิตระบบ</p></section>';
};
C.promo = function(){
  const P=[['สมาชิกใหม่ ลด 10%','สมัครผ่าน LINE วันนี้ รับส่วนลดทันทีทุกบริการ','sparkle'],['จองครบ 5 ครั้ง รับสปาเท้าฟรี','สะสมการจองผ่านระบบ ครบแล้วรับสิทธิ์ทันที','gift'],['นวดคู่ ลด 100 บาท','จองพร้อมกัน 2 ท่าน วันธรรมดา 10:00–15:00','lotus']];
  return '<section class="card"><h3>'+I('gift')+'โปรโมชั่น (ตัวอย่าง)</h3>'+P.map(p=>'<div class="promo"><span class="svc-badge">'+I(p[2],'big')+'</span><span class="grow"><b>'+p[0]+'</b><small>'+p[1]+'</small></span></div>').join('')+'</section>';
};
C.points = function(){
  const pt=R.db.points, next=2000, pct=Math.min(100,pt.total/next*100);
  const mine=R.db.bookings.filter(b=>b.cust==='me'&&R.live(b)).sort((a,b)=>(a.day+a.start).toString().localeCompare((b.day+b.start).toString()));
  return '<section class="card pts-card"><h3>'+I('leafc')+'คะแนนของฉัน</h3><div class="pts-big" id="ptsTotal">'+R.num(pt.total)+'<small> คะแนน</small></div><div class="bar"><i style="width:'+pct+'%"></i></div><p class="tiny">อีก '+R.num(Math.max(0,next-pt.total))+' คะแนน เป็นสมาชิก VIP (ลด 15%) · ข้อมูลตัวอย่าง</p></section>'+
   '<section class="card"><h3>'+I('calendar')+'คิวของฉัน</h3>'+(mine.length?mine.map(b=>'<div class="my-bk"><span class="grow"><b>'+R.service(b.service).name+' · '+R.branch(b.branch).short+'</b><small>'+R.thDateShort(b.day)+' · '+R.hm(b.start)+' น. · '+b.id+'</small></span>'+(b.status==='paid'?'<span class="chip">ชำระแล้ว</span>':b.status==='running'?'<span class="chip on">กำลังใช้บริการ</span>':'<button class="chip btn" data-c="cancel" data-v="'+b.id+'">ยกเลิก</button>')+'</div>').join(''):'<p class="hint">ยังไม่มีคิวจอง</p>')+'</section>'+
   '<section class="card"><h3>'+I('list')+'ประวัติคะแนน</h3>'+pt.history.map(h=>'<div class="rc-line"><span>'+E(h.t)+'<small class="blk">'+R.thDateShort(h.day)+'</small></span><b>'+E(h.d)+'</b></div>').join('')+'</section>';
};

C.confirm = function(){
  const s=C.st; const br=R.branch(s.branch), sv=R.service(s.service); const day=R.dayKey(R.addDays(new Date(),s.off));
  const res=R.pick(br.id,day,s.time,sv.dur,s.ther);
  if(!res||(day===R.today()&&s.time<=R.nowMin())){ R.toast('ขออภัย ช่วงเวลานี้ถูกจองไปแล้ว กรุณาเลือกเวลาอื่น'); s.time=null; C.render(); return; }
  const b={id:R.nextId('RL-'),branch:br.id,day,start:s.time,dur:sv.dur,service:sv.id,room:res.room,therapist:res.therapist,status:'booked',cust:'me',custName:'คุณลูกค้า LINE',member:true,src:'line',addons:[],created:Date.now()};
  R.db.bookings.push(b); R.save(); s.done=b; s.time=null; C.render(); window.scrollTo(0,0);
};

C.bind = function(){
  el().addEventListener('click',e=>{
    const t=e.target.closest('[data-c]'); if(!t||t.disabled) return; const a=t.dataset.c, v=t.dataset.v, s=C.st;
    if(a==='branch'){ s.branch=v; s.ther='any'; s.time=null; }
    else if(a==='service'){ s.service=v; s.time=null; }
    else if(a==='ther'){ s.ther=v; s.time=null; }
    else if(a==='off'){ s.off=Math.max(0,Math.min(6,s.off+(+v))); s.time=null; }
    else if(a==='time'){ s.time=+v; }
    else if(a==='tab'){ s.tab=v; s.done=null; }
    else if(a==='confirm'){ return C.confirm(); }
    else if(a==='again'){ s.done=null; }
    else if(a==='gopts'){ s.tab='pts'; s.done=null; }
    else if(a==='cancel'){ const b=R.db.bookings.find(x=>x.id===v); if(b){ b.status='cancelled'; R.save(); R.toast('ยกเลิกคิวแล้ว'); } }
    else if(a==='back'){ s.done=null; s.tab='book'; }
    const y=window.scrollY; C.render(); window.scrollTo(0,(a==='tab'||a==='again'||a==='gopts'||a==='back')?0:y);
  });
};
})();
