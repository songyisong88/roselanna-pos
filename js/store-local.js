/* ROSELANNA — ที่เก็บข้อมูลโหมดเบราว์เซอร์ (localStorage)
   ใช้เมื่อไม่ได้ตั้งค่าเซิร์ฟเวอร์ (เช่น เดโมบน GitHub Pages) พฤติกรรมเหมือนช่วงที่ 1 ทุกอย่าง
   หมายเหตุ: โหมดนี้ไม่มีฐานข้อมูลกลาง และสิทธิ์ผู้ใช้เป็นเพียงการจำลองในหน้าจอ */
(function(){
'use strict';
const R=window.RL, SES_KEY='roselanna_shop_session_v2';
const ok = v => Promise.resolve(v);
const fail = (m,code,status) => Promise.reject(Object.assign(new Error(m),{code,status}));
const NAMES={owner:'เจ้าของร้าน', manager:'ผู้จัดการสาขา', cashier:'แคชเชียร์', therapist:'หมอนวด'};

R.localStore = function(){
  const S={mode:'local'};
  S.init = () => { R.load(); return ok(); };
  S.reload = () => { R.load(); };

  /* ---- ลูกค้า ---- */
  S.slots = (branch, svc, day, ther) => R.slotsFor(branch, svc, day, ther);
  S.book = p => {
    const sv=R.service(p.service), res=R.pick(p.branch,p.day,p.start,sv.dur,p.therapist);
    if(!res||(p.day===R.today()&&p.start<=R.nowMin())) return fail('ช่วงเวลานี้ถูกจองไปแล้ว','slot_taken',409);
    const b={id:R.nextId('RL-'),branch:p.branch,day:p.day,start:p.start,dur:sv.dur,service:sv.id,room:res.room,therapist:res.therapist,status:'booked',cust:'me',custName:'คุณลูกค้า LINE',member:true,src:'line',addons:[],created:Date.now()};
    R.db.bookings.push(b); R.save(); return ok(b);
  };
  S.cancelMine = id => { const b=R.db.bookings.find(x=>x.id===id&&x.cust==='me'); if(!b) return fail('ไม่พบคิว','not_found',404); b.status='cancelled'; R.save(); return ok(b); };
  S.refreshMe = () => { R.load(); return ok(true); };

  /* ---- เข้าสู่ระบบพนักงาน (จำลอง) ---- */
  S.restore = () => { try{ const s=JSON.parse(localStorage.getItem(SES_KEY)||'null'); return ok(s&&NAMES[s.role]?s:null); }catch(e){ return ok(null); } };
  S.login = (role, o) => {
    o=o||{}; const branch=role==='owner'?null:(o.branch||'bkk');
    const th=role==='therapist'?(o.therapist||branch+'-1'):null;
    const s={role, branch, therapist:th, therapistName:th?R.ther(th).name:null, name:NAMES[role]};
    localStorage.setItem(SES_KEY, JSON.stringify(s)); return ok(s);
  };
  S.logout = () => { localStorage.removeItem(SES_KEY); return ok(); };

  /* ---- POS ---- */
  S.refreshPos = () => { R.load(); return ok(true); };
  const find = id => R.db.bookings.find(x=>x.id===id);
  S.start = id => { const b=find(id); b.status='running'; b.startedAt=Date.now(); b.endsAt=b.startedAt+b.dur*60000; R.save(); return ok(b); };
  S.plus10 = id => { const b=find(id); b.endsAt-=10*60000; R.save(); return ok(b); };
  S.patch = (id, f) => { const b=find(id); ['addons','pay','disc','therapist'].forEach(k=>{ if(f[k]!==undefined) b[k]=f[k]; }); R.save(); return ok(b); };
  S.walkin = w => {
    const day=R.today(), nm=Math.floor(R.nowMin()), sv=R.service(w.service);
    if(R.bookingsOn(w.branch,day).some(b=>b.room===w.room&&b.start<nm+sv.dur&&nm<b.start+b.dur)||!R.therFree(w.therapist,day,nm,nm+sv.dur)) return fail('ห้องหรือหมอนวดไม่ว่างแล้ว','slot_taken',409);
    const now=Date.now();
    const b={id:R.nextId('WK-'),branch:w.branch,day,start:nm,dur:sv.dur,service:sv.id,room:w.room,therapist:w.therapist,status:'running',startedAt:now,endsAt:now+sv.dur*60000,cust:'walk',custName:w.name||'ลูกค้าเดินเข้า',member:+w.tier>0,disc:+w.tier,src:'walkin',addons:[]};
    R.db.bookings.push(b); R.save(); return ok(b);
  };
  S.checkout = (id, o) => {
    const b=find(id); if(b.status==='paid') return fail('ชำระเงินแล้ว','already_paid',409);
    const sv=R.service(b.service), addonTotal=(b.addons||[]).reduce((a,x)=>a+R.ADDONS.find(y=>y.id===x).price,0);
    const gross=sv.price+addonTotal, pct=b.disc!=null?b.disc:(b.vip?15:(b.member?10:0)), total=gross-Math.round(gross*pct/100);
    const pts=b.cust==='me'?Math.floor(total/R.PTS_DIV):0;
    R.db.saleSeq=(R.db.saleSeq||R.db.sales.length)+1;
    const sale={id:'S'+R.db.saleSeq,branch:b.branch,day:R.today(),ts:Date.now(),service:b.service,therapist:b.therapist,gross,addons:(b.addons||[]).slice(),pct,total,pay:(o&&o.pay)||b.pay||'cash',commission:Math.round(total*R.COMM_RATE),booking:b.id,points:pts};
    R.db.sales.push(sale); b.status='paid'; b.paidAt=sale.ts; b.saleId=sale.id; b.disc=pct;
    if(pts){ R.db.points.total+=pts; R.db.points.history.unshift({t:'ซื้อบริการ '+sv.name+' '+sv.dur+' นาที',d:'+'+pts,day:R.today()}); }
    R.save(); return ok({booking:b, sale});
  };

  /* ---- แดชบอร์ด ---- */
  S.dashboard = (period, branch, ses) => {
    const r=(ses||R.session)||{}; const all=!r.branch;
    const scope = all ? (branch&&branch!=='all'?[branch]:R.BRANCHES.map(b=>b.id)) : [r.branch];
    const m=new Date(); m.setHours(0,0,0,0);
    return ok(window.RL_DASH.calc({sales:R.db.sales, bookings:R.db.bookings, scope, period, now:Date.now(), midnight:m.getTime(), today:R.today(), lapsed:28}));
  };
  S.resetDemo = () => { R.resetDemo(); return ok(); };
  return S;
};
})();
