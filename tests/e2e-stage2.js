// Playwright E2E ช่วงที่ 2
//   node tests/e2e-stage2.js server            → เปิดเซิร์ฟเวอร์ชั่วคราว (ฐานข้อมูลชั่วคราว) แล้วทดสอบ 2 บริบทเบราว์เซอร์แยกกัน
//   node tests/e2e-stage2.js local  [baseUrl]  → โหมด localStorage (GitHub Pages) ; baseUrl เช่น https://songyisong88.github.io/roselanna-pos/
const {chromium}=require(process.env.PW||'/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright');
const {spawn}=require('child_process'); const path=require('path'), os=require('os'), fs=require('fs');
const MODE=process.argv[2]||'server'; const ROOT=path.join(__dirname,'..');
const SH=path.join(ROOT,'shots','stage2')+'/'; fs.mkdirSync(SH,{recursive:true});
const tag=MODE==='server'?'srv':'loc';
let fails=0; const ok=(n,c,x)=>{ if(!c) fails++; console.log(c?'PASS':'FAIL',n,x||''); };
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const norm=s=>String(s).replace(/\s+/g,' ').trim();

async function startServer(){
  const port=3150+Math.floor(Math.random()*40); const db=path.join(os.tmpdir(),'rl-e2e-'+process.pid+'.sqlite');
  const p=spawn('node',['src/index.js','--reset'],{cwd:path.join(ROOT,'server'),env:Object.assign({},process.env,{PORT:String(port),ROSELANNA_DB:db,ROSELANNA_QUIET:'1'}),stdio:'ignore'});
  const base='http://127.0.0.1:'+port;
  for(let i=0;i<50;i++){ try{ const r=await fetch(base+'/api/health'); if(r.ok) return {base,stop:()=>{p.kill();[db,db+'-wal',db+'-shm'].forEach(f=>{try{fs.unlinkSync(f)}catch(e){}})}}; }catch(e){} await sleep(200); }
  p.kill(); throw new Error('server did not start');
}
async function startStatic(){
  const p=spawn('python3',['-u','-m','http.server','0','--bind','127.0.0.1'],{cwd:ROOT,stdio:['ignore','pipe','ignore']});
  const port=await new Promise(res=>{ p.stdout.on('data',d=>{ const m=String(d).match(/port (\d+)/); if(m) res(+m[1]); }); setTimeout(()=>res(0),3000); });
  if(!port){ p.kill(); throw new Error('static server failed'); }
  return {base:'http://127.0.0.1:'+port+'/',stop:()=>p.kill()};
}
function watch(p,errs,ext,origin){
  p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{ if(m.type()==='error'&&!/favicon/.test(m.text())) errs.push(m.text()); });
  p.on('request',r=>{ const u=r.url(); if(!u.startsWith(origin)&&!/^(data|blob):/.test(u)) ext.push(u); });
}

(async()=>{
  const srv = MODE==='server' ? await startServer() : (process.argv[3]?{base:process.argv[3].replace(/\/?$/,'/'),stop(){}}:await startStatic());
  const BASE=srv.base.replace(/\/?$/,'/'); const origin=new URL(BASE).origin;
  const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
  const mk=(vw)=>b.newContext({viewport:vw||{width:1280,height:900},deviceScaleFactor:1,locale:'th-TH',timezoneId:'Asia/Bangkok'});
  const errs=[],ext=[];
  try{
  // ---------- 0 หน้าแรก: ลิงก์ธรรมดา 2 อัน ----------
  const ctxA=await mk({width:420,height:880});               // ลูกค้า (มือถือ)
  const ctxB=MODE==='server'?await mk():ctxA;                // ร้าน: โหมดเซิร์ฟเวอร์ = บริบทแยก, โหมด localStorage = เครื่องเดียวกัน (อีกแท็บ)
  const land=await ctxA.newPage(); watch(land,errs,ext,origin);
  await land.goto(BASE+(MODE==='server'?'':'')); await land.waitForSelector('#goCustomer');
  ok('landing has exactly two plain links',(await land.$$('a')).length===2 && await land.$eval('#goCustomer',a=>a.getAttribute('href'))==='customer/' && await land.$eval('#goShop',a=>a.getAttribute('href'))==='shop/');
  await land.screenshot({path:SH+tag+'-00-landing.png'});
  await land.close();

  // ---------- 1 เว็บลูกค้า ----------
  const A=await ctxA.newPage(); watch(A,errs,ext,origin);
  await A.goto(BASE+'customer/'); await A.waitForSelector('.line-head');
  const html=await A.content();
  ok('customer page: no staff UI / no link to /shop',!/href="[^"]*shop/.test(html) && !(await A.$('#roleSel,#viewTabs,#shopBar,[data-p],#view-pos,#view-dash,#logoutBtn')) && !/POS|แดชบอร์ด|ออกจากระบบ/.test(await A.innerText('body')));
  ok('customer page does not load staff scripts',!(await A.$$eval('script[src]',s=>s.map(x=>x.src))).some(u=>/pos\.js|dash\.js|shop-app/.test(u)));
  await A.screenshot({path:SH+tag+'-01-customer-home.png',fullPage:true});
  await A.click('[data-c=branch][data-v=bkk]'); await A.click('[data-c=service][data-v=thai]');
  await A.click('[data-c=off][data-v="1"]'); await A.waitForSelector('.slot:not([disabled])');
  const slots=await A.$$eval('.slot',els=>els.map(e=>[+e.dataset.v,e.disabled]));
  ok('slots listed (10:00–21:00)',slots.length>=11,'n='+slots.length);
  const pick=slots.find(s=>!s[1]&&s[0]===600)||slots.find(s=>!s[1]);
  await A.click(`[data-c=time][data-v="${pick[0]}"]`);
  await A.screenshot({path:SH+tag+'-02-customer-select.png',fullPage:true});
  await A.click('#confirmBtn'); await A.waitForSelector('#successCard');
  const bid=await A.evaluate(()=>RL.customer.st.done.id); const bday=await A.evaluate(()=>RL.customer.st.done.day);
  ok('customer booking confirmed',!!bid,bid);
  await A.screenshot({path:SH+tag+'-03-customer-success.png',fullPage:true});
  const pts0=await A.evaluate(()=>RL.db.points.total);

  // ---------- 2 เว็บร้าน: แคชเชียร์ (บริบท/แท็บอื่น) ----------
  const B=await ctxB.newPage(); watch(B,errs,ext,origin);
  await B.goto(BASE+'shop/'); await B.waitForSelector('.login-card');
  ok('shop page: login screen first, no customer UI',!!(await B.$('[data-l=role][data-v=cashier]')) && !(await B.$('#view-customer,.line-head,[data-c]')) && !(await B.$$eval('script[src]',s=>s.map(x=>x.src))).some(u=>/customer/.test(u)) && !/href="[^"]*customer/.test(await B.content()));
  await B.screenshot({path:SH+tag+'-04-shop-login.png',fullPage:true});
  await B.click('[data-l=role][data-v=cashier]'); await B.click('#lgGo'); await B.waitForSelector('.pos');
  ok('cashier: only POS tab, no dashboard',(await B.$$('#viewTabs button')).length===0);
  await B.click('[data-p=day][data-v="1"]');
  await B.waitForSelector(`[data-p=sel][data-v="${bid}"]`,{timeout:12000});
  ok('customer booking appears in the POS (other '+(MODE==='server'?'browser context':'tab')+')',true);
  await B.click(`[data-p=sel][data-v="${bid}"]`);
  await B.screenshot({path:SH+tag+'-05-pos-booking.png',fullPage:true});
  await B.click('[data-p=start]'); await B.waitForSelector('[data-p=paynow]');
  await B.click('[data-p=addon][data-v=herb]'); await B.waitForTimeout(250);
  await B.screenshot({path:SH+tag+'-06-pos-checkout.png',fullPage:true});
  await B.click('[data-p=paynow]'); await B.waitForSelector('.pts-pill');
  const ptsTxt=norm(await B.innerText('.pts-pill')); const earned=+(ptsTxt.match(/\+(\d+)/)||[])[1];
  ok('checkout: customer gets points = floor(total/10)',earned===Math.floor((500+200)*0.9/10),ptsTxt);   // นวดไทย 500 + ประคบ 200, สมาชิก −10%
  await B.screenshot({path:SH+tag+'-07-pos-receipt.png',fullPage:true});

  // ---------- 3 ลูกค้าเห็นคะแนนเพิ่ม ----------
  await A.click('[data-c=tab][data-v=pts]');
  await A.waitForFunction(p=>RL.db.points.total>p,pts0,{timeout:12000});
  const pts1=await A.evaluate(()=>RL.db.points.total);
  ok('customer sees new points ('+pts0+' → '+pts1+')',pts1===pts0+earned);
  await A.waitForTimeout(300); await A.screenshot({path:SH+tag+'-08-customer-points.png',fullPage:true});
  for(const t of ['price','promo']){ await A.click(`[data-c=tab][data-v=${t}]`); await A.screenshot({path:SH+tag+'-09-customer-'+t+'.png',fullPage:true}); }

  // ---------- 4 เจ้าของ: แดชบอร์ด ----------
  const ctxC=MODE==='server'?await mk():ctxA; const C=await ctxC.newPage(); watch(C,errs,ext,origin);
  await C.goto(BASE+'shop/'); await C.waitForSelector('.login-card,.pos');
  if(await C.$('.login-card')){ await C.click('[data-l=role][data-v=owner]'); await C.click('#lgGo'); }
  else { await C.click('#logoutBtn'); await C.waitForSelector('.login-card'); await C.click('[data-l=role][data-v=owner]'); await C.click('#lgGo'); }
  await C.waitForSelector('#viewTabs button[data-v=dash]'); await C.click('#viewTabs button[data-v=dash]'); await C.waitForSelector('#revTotal');
  const shown=+(norm(await C.innerText('#revTotal')).replace(/[^\d]/g,''));
  const expected=await C.evaluate(async()=>{ const d=await RL.store.dashboard('today','all'); return d.revenue; });
  ok('owner dashboard revenue equals store calc (฿'+shown+')',shown===expected && shown>0);
  if(MODE==='server'){
    const tok=await C.evaluate(()=>localStorage.getItem('roselanna_shop_token_v2'));
    const api=await (await fetch(BASE+'api/dashboard?period=today',{headers:{Authorization:'Bearer '+tok}})).json();
    ok('dashboard matches server API aggregate',api.revenue===shown,'api='+api.revenue);
  }
  await C.screenshot({path:SH+tag+'-10-owner-dashboard.png',fullPage:true});
  await C.selectOption('#dashBranch','cnx'); await C.waitForTimeout(400);
  await C.screenshot({path:SH+tag+'-11-owner-dashboard-cnx.png',fullPage:true});

  // ---------- 5 สิทธิ์ ----------
  const ctxD=MODE==='server'?await mk():ctxA; const D=await ctxD.newPage(); watch(D,errs,ext,origin);
  await D.goto(BASE+'shop/'); await D.waitForSelector('.login-card,.pos,#revTotal');
  if(!(await D.$('.login-card'))){ await D.click('#logoutBtn'); await D.waitForSelector('.login-card'); }
  await D.click('[data-l=role][data-v=manager]'); await D.selectOption('#lgBranch','cnx'); await D.click('#lgGo'); await D.waitForSelector('.pos',{timeout:8000}).catch(async e=>{await D.screenshot({path:'/tmp/fail.png'});console.log('HTML',(await D.innerText('body')).slice(0,400));throw e;});
  ok('manager(cnx): POS locked to own branch',await D.$eval('#posBranch',s=>s.disabled&&s.value==='cnx'));
  await D.click('#viewTabs button[data-v=dash]'); await D.waitForSelector('#revTotal');
  ok('manager(cnx): dashboard scoped to own branch only',await D.$eval('#dashBranch',s=>s.disabled&&s.value==='cnx')&&(await D.$$('.bar-col')).length===1);
  await D.screenshot({path:SH+tag+'-12-manager-dashboard.png',fullPage:true});
  await D.click('#logoutBtn'); await D.waitForSelector('.login-card');
  await D.click('[data-l=role][data-v=therapist]'); await D.selectOption('#lgBranch','bkk'); await D.click('#lgGo'); await D.waitForSelector('.pos');
  ok('therapist: no dashboard tab, no walk-in, no sales chip',(await D.$$('#viewTabs button')).length===0 && !(await D.$('[data-p=walk]')) && !(await D.$('#salesChip')));
  await D.screenshot({path:SH+tag+'-13-therapist-pos.png',fullPage:true});
  if(MODE==='server'){
    const tt=await D.evaluate(()=>localStorage.getItem('roselanna_shop_token_v2'));
    const r1=await fetch(BASE+'api/dashboard',{headers:{Authorization:'Bearer '+tt}}); ok('server: therapist token → dashboard 403',r1.status===403);
    const r2=await fetch(BASE+'api/pos/snapshot?branch=cnx',{headers:{Authorization:'Bearer '+tt}}); ok('server: therapist(bkk) token → other branch 403',r2.status===403);
    const r3=await fetch(BASE+'api/pos/bookings/'+bid+'/checkout',{method:'POST',headers:{Authorization:'Bearer '+tt,'Content-Type':'application/json'},body:'{}'}); ok('server: therapist cannot checkout (403)',r3.status===403);
    const r4=await fetch(BASE+'api/dashboard'); ok('server: no token → 401',r4.status===401);
  }
  // ---------- 6 หน้าจอมือถือของร้าน ----------
  const ctxM=await mk({width:390,height:844}); const M=await ctxM.newPage(); watch(M,errs,ext,origin);
  await M.goto(BASE+'shop/'); await M.waitForSelector('.login-card'); await M.screenshot({path:SH+tag+'-14-shop-login-mobile.png',fullPage:true});
  await M.click('[data-l=role][data-v=owner]'); await M.click('#lgGo'); await M.waitForSelector('.pos'); await M.screenshot({path:SH+tag+'-15-pos-mobile.png',fullPage:true});
  ok('no horizontal overflow on mobile POS',await M.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));
  ok('no external requests (only own origin)',ext.length===0,ext.slice(0,3).join(' '));
  ok('no console/page errors',errs.length===0,errs.slice(0,3).join(' | '));
  }catch(e){ fails++; console.log('FAIL exception',e.stack||e); }
  await b.close(); srv.stop();
  console.log(fails?('\n'+fails+' FAILED'):'\nALL PASSED'); process.exit(fails?1:0);
})();
