/* ROSELANNA demo — core: ข้อมูล, ตัวช่วย, เอนจินห้อง/หมอนวด, ข้อมูลตัวอย่าง (ทั้งหมดเป็นข้อมูลตัวอย่าง) */
(function(){
'use strict';
const RL = window.RL = {};
RL.OPEN = 10*60; RL.CLOSE = 22*60;
RL.BRANCHES = [
  {id:'bkk', name:'สาขากรุงเทพ', short:'กรุงเทพ', addr:'ซอยทองหล่อ 10 · กรุงเทพฯ', dist:'1.5 กม.', w:1.25},
  {id:'cnx', name:'สาขาเชียงใหม่', short:'เชียงใหม่', addr:'ถนนนิมมานเหมินท์ ซอย 9 · เชียงใหม่', dist:'4.2 กม.', w:1.0},
  {id:'hkt', name:'สาขาภูเก็ต', short:'ภูเก็ต', addr:'ถนนถลาง · เมืองภูเก็ต', dist:'10.5 กม.', w:0.85}
];
RL.ROOMS = [
  {id:'r1', code:'R1', name:'ห้องลานนา'},
  {id:'r2', code:'R2', name:'ห้องบัวหลวง'},
  {id:'r3', code:'R3', name:'ห้องจำปา'}
];
RL.SERVICES = [
  {id:'thai',   name:'นวดไทย',            sub:'ดั้งเดิมเพื่อการผ่อนคลาย', dur:60, price:500, w:4},
  {id:'oil',    name:'นวดน้ำมัน',          sub:'บำรุงร่างกาย นุ่มลึก',     dur:90, price:800, w:3},
  {id:'office', name:'ออฟฟิศซินโดรม',     sub:'คลายปวดคอ บ่า ไหล่',      dur:90, price:900, w:2},
  {id:'foot',   name:'สปาเท้า',           sub:'ผ่อนคลายเท้าและน่อง',     dur:60, price:450, w:2}
];
RL.ADDONS = [
  {id:'oilup', name:'อัปเกรดน้ำมันหอมระเหย', price:150},
  {id:'herb',  name:'ประคบสมุนไพรร้อน',      price:200},
  {id:'scrub', name:'ขัดผิวเท้า',            price:150}
];
RL.TIERS = [
  {id:'none', name:'ไม่มีส่วนลด', pct:0},
  {id:'member', name:'สมาชิก', pct:10},
  {id:'vip', name:'สมาชิก VIP', pct:15}
];
RL.COMM_RATE = 0.30;
RL.THER = [
  ['เมย์',2,0],['ดา',3,1],['นิด',1,2],
  ['ปาน',2,3],['แพร',2,0],['มะลิ',1,1],
  ['นุ่น',3,2],['ฟ้า',2,3],['อ้อม',1,0]
];
RL.THERAPISTS = [];
RL.BRANCHES.forEach((b,bi)=>{ for(let i=0;i<3;i++){ const t=RL.THER[bi*3+i];
  RL.THERAPISTS.push({id:b.id+'-'+(i+1), branch:b.id, name:t[0], level:t[1], av:t[2]}); }});
RL.PAY = {cash:'เงินสด', qr:'พร้อมเพย์ QR', card:'บัตร'};
RL.ROLES = {
  owner:   {name:'เจ้าของร้าน',   views:['customer','pos','dash'], branchLock:null, checkout:true,  dashAll:true,  note:'เจ้าของร้าน: ดูได้ทุกมุมมอง ทุกสาขา และสลับสาขาได้'},
  manager: {name:'ผู้จัดการสาขา', views:['customer','pos','dash'], branchLock:'bkk', checkout:true, dashAll:false, note:'ผู้จัดการสาขา: ดู POS และแดชบอร์ดเฉพาะสาขากรุงเทพ (สลับสาขาไม่ได้)'},
  cashier: {name:'แคชเชียร์',     views:['customer','pos'],        branchLock:'bkk', checkout:true, dashAll:false, note:'แคชเชียร์: ใช้ POS รับชำระเงินสาขากรุงเทพ · ไม่เห็นแดชบอร์ดรายได้'},
  therapist:{name:'หมอนวด',       views:['customer','pos'],        branchLock:'bkk', checkout:false, dashAll:false, therapist:'bkk-1', note:'หมอนวด (คุณเมย์): เห็นเฉพาะคิวของตัวเอง กดเริ่มบริการได้ · ไม่มีสิทธิ์รับชำระเงินและไม่เห็นยอดขาย'}
};

/* ---------- ตัวช่วย ---------- */
const TH_D=['อาทิตย์','จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์'];
const TH_M=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
RL.esc = s => String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
RL.pad = n => String(n).padStart(2,'0');
RL.hm = m => RL.pad(Math.floor(m/60))+':'+RL.pad(m%60);
RL.baht = n => '฿'+Math.round(n).toLocaleString('en-US');
RL.num = n => Math.round(n).toLocaleString('en-US');
RL.dayKey = d => { d=new Date(d); return d.getFullYear()+'-'+RL.pad(d.getMonth()+1)+'-'+RL.pad(d.getDate()); };
RL.addDays = (d,n) => { const x=new Date(d); x.setDate(x.getDate()+n); return x; };
RL.today = () => RL.dayKey(Date.now());
RL.nowMin = () => { const d=new Date(); return d.getHours()*60+d.getMinutes()+d.getSeconds()/60; };
RL.dayFromKey = k => { const p=k.split('-'); return new Date(+p[0],+p[1]-1,+p[2]); };
RL.thDate = k => { const d=RL.dayFromKey(k); return TH_D[d.getDay()]+' '+d.getDate()+' '+TH_M[d.getMonth()]+' '+(d.getFullYear()+543); };
RL.thDateShort = k => { const d=RL.dayFromKey(k); return d.getDate()+' '+TH_M[d.getMonth()]+' '+(d.getFullYear()+543); };
RL.thDow = k => TH_D[RL.dayFromKey(k).getDay()];
RL.branch = id => RL.BRANCHES.find(b=>b.id===id);
RL.service = id => RL.SERVICES.find(s=>s.id===id);
RL.ther = id => RL.THERAPISTS.find(t=>t.id===id);
RL.room = id => RL.ROOMS.find(r=>r.id===id);
RL.tier = pct => RL.TIERS.find(t=>t.pct===pct)||RL.TIERS[0];
RL.ico = (n,c) => '<svg class="ico '+(c||'')+'" aria-hidden="true"><use href="#i-'+n+'"/></svg>';
RL.greeting = () => { const h=new Date().getHours(); return h<12?'สวัสดีตอนเช้า':h<17?'สวัสดีตอนบ่าย':'สวัสดีตอนเย็น'; };

/* ---------- ภาพประกอบเวกเตอร์ (โทนทอง/ครีมเท่านั้น) ---------- */
RL.avatar = (t, size) => {
  const hair='#5A4515', skin='#F7E4B6', cloth=['#E0BE62','#C99A1E','#EAD59B','#D8B04A'][t.av%4];
  const styles=[
    '<path d="M9 21c-1-9 3-14 11-14s12 5 11 14c-1-5-4-8-11-8s-10 3-11 8z" fill="'+hair+'"/><circle cx="31" cy="12" r="0"/>',
    '<path d="M8 28c-2-12 3-21 12-21s14 9 12 21c-2 0-3-3-3-8-5 0-9-2-11-6-1 5-3 8-6 14z" fill="'+hair+'"/>',
    '<path d="M9 21c-1-9 3-14 11-14s12 5 11 14c-1-5-4-8-11-8s-10 3-11 8z" fill="'+hair+'"/><circle cx="20" cy="5" r="4.2" fill="'+hair+'"/>',
    '<path d="M9 21c-1-9 3-14 11-14s12 5 11 14c-2-4-5-6-11-6s-9 2-11 6z" fill="'+hair+'"/><path d="M30 14c4 3 4 10 1 15" stroke="'+hair+'" stroke-width="3.2" fill="none" stroke-linecap="round"/>'
  ];
  const s=size||40;
  return '<svg class="avatar" width="'+s+'" height="'+s+'" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#F8EFD3"/><path d="M5 40c1-8 7-12 15-12s14 4 15 12z" fill="'+cloth+'"/>'+
    '<rect x="17" y="22" width="6" height="7" rx="2" fill="'+skin+'"/><ellipse cx="20" cy="17" rx="7.2" ry="8" fill="'+skin+'"/>'+styles[t.av%4]+
    '<circle cx="17.2" cy="17.5" r=".9" fill="#5A4515"/><circle cx="22.8" cy="17.5" r=".9" fill="#5A4515"/><path d="M18.3 21c1 .8 2.4.8 3.4 0" stroke="#B88A12" stroke-width="1" fill="none" stroke-linecap="round"/></svg>';
};
RL.anyAvatar = (s) => '<svg class="avatar" width="'+(s||40)+'" height="'+(s||40)+'" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="#F8EFD3"/><g fill="none" stroke="#C99A1E" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c3 3 4.500 6 4.500 9s-1.800 5.500-4.500 7.500c-2.700-2-4.500-4.500-4.500-7.500S17 13 20 10z"/><path d="M20 28c-4.500 0-9-2-11-6 4.500-.7 8 .6 11 3.500M20 28c4.500 0 9-2 11-6-4.500-.7-8 .6-11 3.500"/></g></svg>';
RL.svcIcon = (id, s) => {
  const g={
    thai:'<path d="M14 30l-3-9a2 2 0 013.600-1.200L17 24V12a2 2 0 014 0v8M21 20v-9a2 2 0 014 0v10M25 21v-7a2 2 0 014 0v14c0 5-3 9-8 9h-3c-4 0-6-2-8-5z"/>',
    oil:'<path d="M19 8h10v4l3 5v17a3 3 0 01-3 3H19a3 3 0 01-3-3V17l3-5z"/><path d="M19 12h10M24 24c-3 3.500-4 5-4 6.500a4 4 0 008 0c0-1.500-1-3-4-6.500z"/>',
    office:'<circle cx="24" cy="11" r="4.500"/><path d="M10 38c0-8 5-12 14-12s14 4 14 12M16 26l-3-4M32 26l3-4M10 18l-2-2M38 18l2-2"/>',
    foot:'<path d="M20 38c-4-2-5-8-4-14s3-12 8-12 6 4 5 9-2 7-1 11-3 7-8 6z"/><circle cx="31" cy="10" r="1.500"/><circle cx="34.500" cy="14" r="1.300"/><circle cx="35.500" cy="19" r="1.200"/>'
  }[id]||'';
  return '<svg class="svc-ico" width="'+(s||44)+'" height="'+(s||44)+'" viewBox="0 0 48 48" fill="none" stroke="#B88A12" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+g+'</svg>';
};
RL.sprig = () => '<svg class="sprig" viewBox="0 0 120 150" fill="none" stroke="#C99A1E" stroke-width="1.200" stroke-linecap="round" aria-hidden="true"><path d="M70 148c2-40 8-80 40-142"/>'+
  [[78,120,-30],[84,98,35],[92,78,-40],[98,56,30],[104,36,-35],[70,128,40],[72,104,-52],[78,84,48],[88,62,-55],[96,42,44]].map(l=>'<path transform="translate('+l[0]+' '+l[1]+') rotate('+l[2]+')" d="M0 0c-9-4-14-14-12-24 10 2 15 12 12 24zM0 0l-9-16"/>').join('')+'</svg>';
RL.massageScene = (id) => '<svg class="scene" viewBox="0 0 120 90" aria-hidden="true"><rect width="120" height="90" fill="#F8EFD3"/><circle cx="96" cy="22" r="16" fill="#F2E1AE"/>'+
  '<path d="M10 70h100v8H10z" fill="#E0BE62"/><rect x="14" y="58" width="92" height="14" rx="7" fill="#F3DFAE" stroke="#C99A1E" stroke-width="1.500"/>'+
  '<ellipse cx="30" cy="52" rx="6.500" ry="6" fill="#F7E4B6" stroke="#B88A12" stroke-width="1.200"/><path d="M36 54c10-3 30-3 42 2" fill="#EAD59B" stroke="#B88A12" stroke-width="1.200"/>'+
  '<path d="M26 47c0-7 8-9 12-4" fill="#5A4515"/><circle cx="62" cy="28" r="7" fill="#F7E4B6" stroke="#B88A12" stroke-width="1.200"/><path d="M54 25c1-8 14-9 16-1-4-2-9-2-16 1z" fill="#5A4515"/>'+
  '<path d="M50 52c-1-14 2-18 12-18s14 6 12 18z" fill="#C99A1E"/><path d="M66 40c5 5 6 9 3 14" stroke="#B88A12" stroke-width="2" fill="none" stroke-linecap="round"/>'+
  '<g stroke="#C99A1E" stroke-width="1.100" fill="none"><path d="M12 10c8 2 14 8 14 16M12 10c1 7-3 12-9 14"/></g></svg>';

/* ---------- ฐานข้อมูลใน localStorage ---------- */
const DB_KEY='roselanna_demo_db_v1', UI_KEY='roselanna_demo_ui_v1', DB_VER=1;
RL.db = null; RL.ui = {role:'owner', view:'customer', branch:'bkk', dashBranch:'all', dashPeriod:'today'};
RL.save = () => { try{ localStorage.setItem(DB_KEY, JSON.stringify(RL.db)); }catch(e){} };
RL.saveUi = () => { try{ localStorage.setItem(UI_KEY, JSON.stringify(RL.ui)); }catch(e){} };
RL.nextId = prefix => { RL.db.seq = (RL.db.seq||1000)+1; return prefix+RL.db.seq; };

/* ---------- เอนจินห้อง/หมอนวด ---------- */
const ov = (a0,a1,b0,b1)=>a0<b1&&b0<a1;
RL.live = b => b.status!=='cancelled';
RL.bookingsOn = (branch, day, list) => (list||RL.db.bookings).filter(b=>b.branch===branch&&b.day===day&&RL.live(b));
RL.roomFree = (branch, day, s, e, list) => {
  const bs=RL.bookingsOn(branch,day,list);
  return RL.ROOMS.find(r=>!bs.some(b=>b.room===r.id&&ov(s,e,b.start,b.start+b.dur)))||null;
};
RL.therFree = (tid, day, s, e, list) => !(list||RL.db.bookings).some(b=>b.therapist===tid&&b.day===day&&RL.live(b)&&ov(s,e,b.start,b.start+b.dur));
RL.pick = (branch, day, s, dur, tid, list) => {
  const e=s+dur; const room=RL.roomFree(branch,day,s,e,list); if(!room) return null;
  const ts=RL.THERAPISTS.filter(t=>t.branch===branch);
  let th=null;
  if(tid&&tid!=='any'){ if(!RL.therFree(tid,day,s,e,list)) return null; th=RL.ther(tid); }
  else { th=ts.find(t=>RL.therFree(t.id,day,s,e,list)); if(!th) return null; }
  return {room:room.id, therapist:th.id};
};
RL.slotsFor = (branch, svc, day, tid) => {
  const out=[]; const isToday = day===RL.today(); const nm=RL.nowMin();
  for(let s=RL.OPEN; s+svc.dur<=RL.CLOSE; s+=60){
    const past = isToday && s<=nm;
    const res = past?null:RL.pick(branch,day,s,svc.dur,tid);
    out.push({start:s, ok:!!res, past});
  }
  return out;
};
RL.priceOf = b => { const sv=RL.service(b.service); return sv.price + (b.addons||[]).reduce((a,id)=>a+(RL.ADDONS.find(x=>x.id===id)||{price:0}).price,0); };

/* ---------- ข้อมูลตัวอย่าง (สุ่มแบบคงที่ ไม่ต้องเรียกเครือข่าย) ---------- */
function rng(seed){ let s=seed>>>0; return ()=>{ s=(s+0x6D2B79F5)>>>0; let t=s; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }
const NAMES=['คุณพิมพ์','คุณน้อย','คุณบอล','คุณแอน','คุณต้น','คุณมิ้นท์','คุณเอก','คุณหญิง','คุณโอม','คุณฝ้าย','คุณปอ','คุณนุ่น','คุณกอล์ฟ','คุณเฟิร์น'];
function wpick(r, arr){ const t=arr.reduce((a,x)=>a+x.w,0); let v=r()*t; for(const x of arr){ v-=x.w; if(v<=0) return x; } return arr[0]; }
function genDay(r, list, branch, day, cutoff, mkBooking){
  const bw = RL.branch(branch).w;
  for(let h=RL.OPEN/60; h<RL.CLOSE/60; h++){
    const s=h*60; if(s>cutoff) break;
    const peak = (h>=12&&h<=14)||(h>=17&&h<=20)?1.0:0.62;
    let n=0; const x=r()*bw*peak; n = x>0.95?2:(x>0.38?1:0);
    for(let i=0;i<n;i++){
      const svc=wpick(r,RL.SERVICES);
      const res=RL.pick(branch,day,s,svc.dur,'any',list); if(!res) continue;
      const b={id:'',branch,day,start:s,dur:svc.dur,service:svc.id,room:res.room,therapist:res.therapist,
        status:'booked',cust:'x',custName:NAMES[Math.floor(r()*NAMES.length)],member:r()<0.55,vip:r()<0.12,src:r()<0.5?'line':'walkin',addons:r()<0.25?[RL.ADDONS[Math.floor(r()*3)].id]:[],seed:true};
      list.push(b); mkBooking&&mkBooking(b,r);
    }
  }
}
RL.seed = () => {
  const r=rng(20261026), todayD=new Date(), todayK=RL.dayKey(todayD), nm=RL.nowMin();
  const db={v:DB_VER, seedDay:todayK, seq:1000, bookings:[], sales:[], points:{total:1240, history:[
    {t:'ซื้อบริการ นวดไทย 60 นาที', d:'+50', day:RL.dayKey(RL.addDays(todayD,-9))},
    {t:'โบนัสสมาชิกใหม่', d:'+200', day:RL.dayKey(RL.addDays(todayD,-30))}]}};
  const mkSale=(b,rr,ts)=>{
    const sv=RL.service(b.service); const gross=RL.priceOf(b); const pct=b.vip?15:(b.member?10:0);
    const total=Math.round(gross*(1-pct/100)); const pay=['cash','qr','card'][Math.floor(rr()*3)];
    db.sales.push({id:'S'+(db.sales.length+1),branch:b.branch,day:b.day,ts,service:b.service,therapist:b.therapist,gross,addons:b.addons||[],pct,total,pay,commission:Math.round(total*RL.COMM_RATE),seed:true});
  };
  RL.BRANCHES.forEach(br=>{
    // 13 วันที่ผ่านมา: เฉพาะยอดขาย
    for(let d=-13; d<=-1; d++){
      const day=RL.dayKey(RL.addDays(todayD,d)); const list=[];
      genDay(r,list,br.id,day,RL.CLOSE,(b,rr)=>{ const ts=RL.dayFromKey(day).getTime()+(b.start+b.dur)*60000; mkSale(b,rr,ts); });
    }
    // วันนี้: คิวในตาราง + ยอดขายจากคิวที่เสร็จแล้ว
    const list=[];
    genDay(r,list,br.id,todayK,RL.CLOSE,(b,rr)=>{ b.id='RL-'+(++db.seq); });
    list.forEach(b=>{
      const end=b.start+b.dur;
      if(end<=nm){ b.status='paid'; b.paidAt=RL.dayFromKey(todayK).getTime()+end*60000; mkSale(b,r,b.paidAt); db.sales[db.sales.length-1].booking=b.id; }
      else if(b.start<=nm){ b.status='running'; b.startedAt=RL.dayFromKey(todayK).getTime()+b.start*60000; b.endsAt=b.startedAt+b.dur*60000; }
    });
    db.bookings.push(...list);
    // พรุ่งนี้และมะรืน: เฉพาะคิวจอง (กันเต็มทั้งวัน)
    for(let d=1; d<=3; d++){
      const day=RL.dayKey(RL.addDays(todayD,d)); const l2=[];
      genDay(r,l2,br.id,day,RL.CLOSE,(b)=>{ b.id='RL-'+(++db.seq); });
      db.bookings.push(...l2.filter((b,i)=>i%2===0 || r()<0.4));
    }
  });
  db.sales.forEach((s,i)=>s.id='S'+(i+1));
  db.saleSeq=db.sales.length;
  return db;
};
RL.load = () => {
  let db=null;
  try{ db=JSON.parse(localStorage.getItem(DB_KEY)||'null'); }catch(e){}
  if(!db||db.v!==DB_VER||db.seedDay!==RL.today()){ db=RL.seed(); RL.db=db; RL.save(); } else RL.db=db;
  try{ Object.assign(RL.ui, JSON.parse(localStorage.getItem(UI_KEY)||'{}')); }catch(e){}
};
RL.resetDemo = () => { RL.db=RL.seed(); RL.save(); };

/* ---------- toast / modal ---------- */
let tt=null;
RL.toast = msg => { const t=document.getElementById('toast'); t.textContent=msg; t.classList.add('show'); clearTimeout(tt); tt=setTimeout(()=>t.classList.remove('show'),2600); };
RL.modal = (html, onOpen) => { const m=document.getElementById('modal'); m.innerHTML='<div class="modal-card" role="dialog" aria-modal="true">'+html+'</div>'; m.hidden=false; onOpen&&onOpen(m); };
RL.closeModal = () => { const m=document.getElementById('modal'); m.hidden=true; m.innerHTML=''; };
document.addEventListener('click',e=>{ const m=document.getElementById('modal'); if(e.target===m) RL.closeModal(); });
})();
