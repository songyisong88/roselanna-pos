/* ROSELANNA — คำนวณตัวเลขแดชบอร์ด (ใช้ร่วมกันระหว่างโหมดเบราว์เซอร์และเซิร์ฟเวอร์ เพื่อให้ตัวเลขตรงกัน) */
(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./catalog.js'));
  else root.RL_DASH = factory(root.RL_CATALOG);
})(typeof self !== 'undefined' ? self : this, function(C){
  const DAY = 86400000;
  /* input: {sales, bookings, scope:[branchIds], period:'today'|'7d', now:ms, midnight:ms, today:'YYYY-MM-DD', lapsed:number}
     sale: {branch, ts, total, service, therapist, commission}; booking: {branch, day, status, src, dur} */
  function calc(i){
    const w = i.period==='today'
      ? {s:i.midnight, e:i.now, L:DAY, prev:'เมื่อวาน'}
      : {s:i.midnight-6*DAY, e:i.now, L:7*DAY, prev:'7 วันก่อนหน้า'};
    const sc = i.scope;
    const inW = (s,w0,w1) => sc.includes(s.branch) && s.ts>=w0 && s.ts<=w1;
    const cur = i.sales.filter(s=>inW(s,w.s,w.e)), prev = i.sales.filter(s=>inW(s,w.s-w.L,w.e-w.L));
    const sum = (a,f)=>a.reduce((t,x)=>t+f(x),0);
    const revenue = sum(cur,s=>s.total), prevRevenue = sum(prev,s=>s.total);
    const changePct = prevRevenue>0 ? (revenue-prevRevenue)/prevRevenue*100 : 0;
    const perBranch = sc.map(id=>({id, rev:sum(cur.filter(s=>s.branch===id),s=>s.total)}));
    const services = C.SERVICES.map(v=>({id:v.id, n:cur.filter(s=>s.service===v.id).length, rev:sum(cur.filter(s=>s.service===v.id),s=>s.total)})).sort((a,b)=>b.n-a.n);
    const tm = {}; cur.forEach(s=>{ const o=tm[s.therapist]||(tm[s.therapist]={n:0,c:0}); o.n++; o.c+=s.commission; });
    const therapists = Object.keys(tm).map(id=>({id,n:tm[id].n,c:tm[id].c})).sort((a,b)=>b.c-a.c).slice(0,5);
    const live = b => b.status!=='cancelled';
    const bookings = sc.map(id=>{
      const l = i.bookings.filter(b=>b.branch===id&&live(b)); const td = l.filter(b=>b.day===i.today);
      return {id, today:td.length, wait:td.filter(b=>b.status==='booked').length, fut:l.filter(b=>b.day>i.today).length, line:l.filter(b=>b.src==='line'&&b.day>=i.today).length};
    });
    const util = sc.map(id=>{
      const mins = i.bookings.filter(b=>b.branch===id&&b.day===i.today&&live(b)).reduce((a,b)=>a+b.dur,0);
      return {id, p:Math.min(100,Math.round(mins/(3*720)*100))};
    });
    const overall = util.length ? Math.round(util.reduce((a,u)=>a+u.p,0)/util.length) : 0;
    return {period:i.period, scope:sc, prevLabel:w.prev, revenue, prevRevenue, changePct, count:cur.length,
      perBranch, services, therapists, bookings, util, overall, lapsed:i.lapsed};
  }
  return {calc, DAY};
});
