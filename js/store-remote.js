/* ROSELANNA — ที่เก็บข้อมูลโหมดเซิร์ฟเวอร์ (REST API + ฐานข้อมูลกลาง)
   ใช้เมื่อกำหนด RL_CONFIG.serverUrl ข้อมูลทุกอย่างอยู่ที่เซิร์ฟเวอร์ และเซิร์ฟเวอร์เป็นผู้ตรวจสิทธิ์/กันจองซ้ำ */
(function(){
'use strict';
const R=window.RL;
const UI2DB={owner:'owner', manager:'branch_manager', cashier:'cashier', therapist:'therapist'};
const DB2UI={owner:'owner', branch_manager:'manager', cashier:'cashier', therapist:'therapist'};

R.remoteStore = function(base){
  base=String(base).replace(/\/+$/,'');
  const S={mode:'remote', base, token:null, kind:null};
  const TOK={customer:'roselanna_customer_token_v2', staff:'roselanna_shop_token_v2'};
  const SES_KEY='roselanna_shop_session_v2';

  async function req(method, path, body, noAuth){
    const h={'Accept':'application/json'}; if(body!==undefined) h['Content-Type']='application/json';
    if(S.token&&!noAuth) h.Authorization='Bearer '+S.token;
    let res;
    try{ res=await fetch(base+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)}); }
    catch(e){ throw Object.assign(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองใหม่'),{code:'network',status:0}); }
    let j=null; try{ j=await res.json(); }catch(e){}
    if(!res.ok) throw Object.assign(new Error((j&&j.message)||'เกิดข้อผิดพลาด ('+res.status+')'),{code:j&&j.error,status:res.status});
    return j;
  }
  S.req=req;
  const upd = b => { const i=R.db.bookings.findIndex(x=>x.id===b.id); if(i>=0) R.db.bookings[i]=b; else R.db.bookings.push(b); return b; };
  const same = (a,b) => JSON.stringify(a)===JSON.stringify(b);

  /* ---- ลูกค้า ---- */
  const cache=new Map(), inflight=new Set(); S.onChange=null;
  S.init = async () => {   // ใช้ได้ทั้งหน้าลูกค้าและหน้าร้าน: หน้าลูกค้าเรียก initCustomer
    R.db={bookings:[],sales:[],points:{total:0,history:[]}};
  };
  S.initCustomer = async () => {
    S.kind='customer'; S.token=localStorage.getItem(TOK.customer);
    let me=null; if(S.token){ try{ me=await req('GET','/api/me'); }catch(e){ S.token=null; } }
    if(!me){ const r=await req('POST','/api/customer/session',{},true); S.token=r.token; localStorage.setItem(TOK.customer,S.token); me=await req('GET','/api/me'); }
    R.db={bookings:me.bookings, sales:[], points:me.points};
  };
  S.slots = (branch, svc, day, ther) => {
    const key=[branch,svc.id,day,ther||'any'].join('|');
    if(cache.has(key)) return cache.get(key);
    if(!inflight.has(key)){ inflight.add(key);
      req('GET','/api/public/availability?branch='+branch+'&service='+svc.id+'&day='+day+'&therapist='+(ther||'any'),undefined,true)
        .then(r=>{ cache.set(key,r.slots); }).catch(()=>{ cache.set(key,[]); }).finally(()=>{ inflight.delete(key); S.onChange&&S.onChange('slots'); });
    }
    return null;
  };
  S.book = async p => {
    try{ const r=await req('POST','/api/me/bookings',p); cache.clear(); R.db.bookings.push(r.booking); await S.refreshMe(); return r.booking; }
    catch(e){ cache.clear(); throw e; }
  };
  S.cancelMine = async id => { const r=await req('POST','/api/me/bookings/'+encodeURIComponent(id)+'/cancel',{}); cache.clear(); upd(r.booking); return r.booking; };
  S.refreshMe = async () => {
    const me=await req('GET','/api/me'); const nd={bookings:me.bookings,sales:[],points:me.points}; const ch=!same(nd,R.db); R.db=nd;
    if(ch) cache.clear(); return ch;
  };

  /* ---- พนักงาน ---- */
  const toSes = u => ({role:DB2UI[u.role], branch:u.branch||null, therapist:u.therapistId||null, therapistName:u.therapistName||null, name:u.name, perms:u.permissions});
  S.restore = async () => {
    S.kind='staff'; S.token=localStorage.getItem(TOK.staff); if(!S.token) return null;
    try{ const r=await req('GET','/api/auth/me'); const s=toSes(r.user||r); localStorage.setItem(SES_KEY,JSON.stringify(s)); return s; }
    catch(e){ S.token=null; localStorage.removeItem(TOK.staff); return null; }
  };
  S.login = async (role, o) => {
    o=o||{}; S.kind='staff';
    const body={role:UI2DB[role]}; if(role!=='owner') body.branch=o.branch||'bkk'; if(role==='therapist'&&o.therapist) body.therapist=o.therapist;
    const r=await req('POST','/api/auth/demo-login',body,true); S.token=r.token; localStorage.setItem(TOK.staff,S.token);
    const s=toSes(r.user); localStorage.setItem(SES_KEY,JSON.stringify(s)); return s;
  };
  S.logout = async () => { try{ await req('POST','/api/auth/logout',{}); }catch(e){} S.token=null; localStorage.removeItem(TOK.staff); localStorage.removeItem(SES_KEY); };

  S.refreshPos = async branch => {
    const r=await req('GET','/api/pos/snapshot'+(branch?'?branch='+branch:'')); const nd={bookings:r.bookings,sales:r.sales,points:R.db.points};
    const ch=!same(nd,R.db); R.db=nd; return ch;
  };
  S.start = async id => upd((await req('POST','/api/pos/bookings/'+id+'/start',{})).booking);
  S.plus10 = async id => upd((await req('POST','/api/pos/bookings/'+id+'/fast-forward',{minutes:10})).booking);
  S.patch = async (id,f) => upd((await req('PATCH','/api/pos/bookings/'+id,f)).booking);
  S.walkin = async w => upd((await req('POST','/api/pos/walkins',w)).booking);
  S.checkout = async (id,o) => { const r=await req('POST','/api/pos/bookings/'+id+'/checkout',{pay:(o&&o.pay)||'cash'}); upd(r.booking); R.db.sales.push(r.sale); return r; };
  S.dashboard = (period, branch) => req('GET','/api/dashboard?period='+period+(branch&&branch!=='all'?'&branch='+branch:''));
  S.resetDemo = () => req('POST','/api/admin/reset-demo',{});
  return S;
};
})();
