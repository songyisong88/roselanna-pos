// Playwright E2E: node tests/e2e.js [baseUrl]
const {chromium}=require(process.env.PW||'/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright');
const BASE=process.argv[2]||'http://localhost:18777/index.html';
const SH=__dirname+'/../shots/';
const res=[];const ok=(n,c,x)=>{res.push([c?'PASS':'FAIL',n,x||'']);console.log(c?'PASS':'FAIL',n,x||'');};
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const ctx=await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,locale:'th-TH',timezoneId:'Asia/Bangkok'});
const p=await ctx.newPage();
const errs=[],ext=[];
p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
p.on('request',r=>{const u=r.url();if(!/^(http:\/\/localhost|http:\/\/127\.0\.0\.1|file:|data:|blob:)/.test(u))ext.push(u)});
await p.clock.install({time:new Date(2026,9,26,14,5,0)});
await p.goto(BASE);await p.waitForTimeout(400);
const tab=async v=>{await p.click(`#viewTabs [data-v=${v}]`);await p.waitForTimeout(250)};
const txt=async s=>(await p.locator(s).first().innerText()).replace(/\s+/g,' ');
const num=s=>+String(s).replace(/[^\d.]/g,'');
// ---------- 1 ลูกค้า ----------
await p.screenshot({path:SH+'m1-customer-start.png',fullPage:true});
await p.click('[data-c=branch][data-v=bkk]');
await p.click('[data-c=service][data-v=thai]');
await p.click('[data-c=ther][data-v=any]');
await p.waitForTimeout(150);
const slotInfo=await p.$$eval('.slot',els=>els.map(e=>[e.dataset.v,e.disabled]));
ok('slots listed',slotInfo.length>=8,JSON.stringify(slotInfo.slice(0,4)));
ok('past slots disabled at 14:05',slotInfo.filter(s=>+s[0]<14*60+5&&!s[1]).length===0);
const firstOk=slotInfo.find(s=>!s[1]);
await p.click(`[data-c=time][data-v="${firstOk[0]}"]`);
await p.screenshot({path:SH+'m2-customer-selected.png',fullPage:true});
await p.click('#confirmBtn');await p.waitForTimeout(300);
const code=await txt('#bkCode');
ok('booking code shown',/RL-\d+/.test(code),code);
await p.screenshot({path:SH+'m3-customer-success.png',fullPage:true});
const ls=await p.evaluate(()=>JSON.parse(localStorage.getItem('roselanna_demo_db_v1')).bookings.filter(b=>b.src==='line'&&!b.seed).length);
ok('booking saved to localStorage',ls>=1,String(ls));
const ptsBefore=await p.evaluate(()=>RL.db.points.total);
// duplicate: same slot, same therapist
const booked=await p.evaluate(()=>{const b=RL.db.bookings.filter(x=>x.src==='line'&&!x.seed).pop();return b});
await p.click('[data-c=again]');await p.waitForTimeout(150);
await p.click('[data-c=branch][data-v=bkk]');await p.click('[data-c=service][data-v=thai]');
await p.click(`[data-c=ther][data-v="${booked.therapist}"]`);
const dis=await p.$eval(`[data-c=time][data-v="${booked.start}"]`,e=>e.disabled);
ok('same therapist same slot is disabled (no double booking)',dis);
await p.click('[data-c=tab][data-v=pts]');
// ---------- 2 POS ----------
await tab('pos');
await p.screenshot({path:SH+'t1-pos-grid.png',fullPage:true});
const sales0=num(await txt('#salesChip b'));
const card=p.locator(`.bk[data-v="${booked.id}"]`);
ok('LINE booking appears in POS grid',await card.count()===1);
await card.click();await p.waitForTimeout(200);
await p.click('[data-p=start]');await p.waitForTimeout(300);
ok('countdown running',/\d\d:\d\d/.test(await txt('#bigCd')),await txt('#bigCd'));
const cd1=await txt('#bigCd');await p.clock.runFor(5000);const cd2=await txt('#bigCd');
ok('countdown ticks',cd1!==cd2,cd1+' -> '+cd2);
await p.screenshot({path:SH+'t2-pos-running.png',fullPage:true});
await p.click('[data-p=addon][data-v=herb]').catch(async()=>{await p.locator('.addon').nth(1).click()});
await p.selectOption('#coDisc','member').catch(()=>{});
await p.click('[data-p=pay][data-v=qr]');
const tot=await txt('.rc-line.tot');
await p.screenshot({path:SH+'t3-pos-checkout.png',fullPage:true});
await p.click('[data-p=paynow]');await p.waitForTimeout(300);
ok('paid screen',await p.locator('#paidOk').count()>0);
await p.screenshot({path:SH+'t4-pos-paid.png',fullPage:true});
const sales1=num(await txt('#salesChip b'));
ok('today sales increased',sales1>sales0,sales0+' -> '+sales1+' ('+tot+')');
const lastSale=await p.evaluate(()=>RL.db.sales[RL.db.sales.length-1]);
ok('sale recorded with commission',lastSale&&lastSale.commission>0&&lastSale.booking===booked.id,JSON.stringify(lastSale));
// walk-in
await p.click('[data-p=back]').catch(()=>{});
await p.click('[data-p=walk]');await p.waitForTimeout(200);
await p.screenshot({path:SH+'t5-pos-walkin.png'});
await p.fill('#wName','ลูกค้าทดสอบ');
const wr=await p.$$eval('#wRoom option',o=>o.map(x=>[x.value,x.disabled]));
await p.click('[data-w=go]').catch(()=>{});await p.waitForTimeout(300);
const walks=await p.evaluate(()=>RL.db.bookings.filter(b=>/^WK-/.test(b.id)).length);
ok('walk-in created',walks>=1,JSON.stringify(wr));
await p.screenshot({path:SH+'t6-pos-after-walkin.png',fullPage:true});
// ---------- 3 แดชบอร์ด ----------
const expectedRev=await p.evaluate(()=>{const d=RL.today();return RL.db.sales.filter(s=>s.day===d).reduce((a,s)=>a+s.total,0)});
await tab('dash');
const rev=num(await txt('#revTotal'));
ok('dashboard revenue = sum of today sales',rev===expectedRev,rev+' vs '+expectedRev);
const barSum=(await p.$$eval('.bar-val b',e=>e.map(x=>+x.textContent.replace(/[^\d]/g,'')))).reduce((a,c)=>a+c,0);
ok('bar values sum to total',barSum===rev,barSum+'');
ok('bar labels have numbers',(await p.locator('.bar-val b').count())===3);
await p.screenshot({path:SH+'m4-dash.png',fullPage:true});
await p.click('[data-d=period][data-v="7d"]');await p.waitForTimeout(150);
ok('7d revenue > today',num(await txt('#revTotal'))>rev);
await p.screenshot({path:SH+'m5-dash-7d.png',fullPage:true});
await p.click('[data-d=period][data-v=today]');
// ---------- คะแนนลูกค้า ----------
await tab('customer');
const ptsAfter=await p.evaluate(()=>RL.db.points.total);
ok('customer points increased after POS payment',ptsAfter>ptsBefore,ptsBefore+' -> '+ptsAfter);
await p.click('[data-c=tab][data-v=pts]');await p.waitForTimeout(150);
await p.screenshot({path:SH+'m6-customer-points.png',fullPage:true});
for(const [t,n] of [['price','m7-customer-price'],['promo','m7b-customer-promo']]){await p.click(`[data-c=tab][data-v=${t}]`);await p.waitForTimeout(150);await p.screenshot({path:SH+n+'.png',fullPage:true});}
// ---------- บทบาท ----------
for(const [r,exp] of [['manager',['customer','pos','dash']],['cashier',['customer','pos']],['therapist',['customer','pos']]]){
  await p.selectOption('#roleSel',r);await p.waitForTimeout(200);
  const en=await p.$$eval('#viewTabs button',bs=>bs.filter(x=>!x.disabled).map(x=>x.dataset.v));
  ok('role '+r+' views',JSON.stringify(en)===JSON.stringify(exp),en.join(','));
}
await tab('pos');await p.screenshot({path:SH+'t7-pos-therapist-role.png',fullPage:true});
await p.selectOption('#roleSel','manager');await tab('dash');await p.screenshot({path:SH+'m8-dash-manager.png',fullPage:true});
await p.selectOption('#roleSel','owner');
// ---------- รีเซ็ต ----------
await tab('dash');await p.click('#resetBtn');await p.waitForTimeout(150);
await p.screenshot({path:SH+'m9-reset-modal.png'});
await p.click('#doReset');await p.waitForTimeout(250);
const left=await p.evaluate(()=>RL.db.bookings.filter(b=>!b.seed).length);
ok('reset clears demo-created bookings',left===0,String(left));
// ---------- ทดสอบเต็มทุกขนาด ----------
const sizes=[[320,640],[360,740],[390,844],[512,700],[683,900],[768,1024],[820,1180],[1024,768],[1280,800],[1440,900]];
for(const [w,h] of sizes){
  await p.setViewportSize({width:w,height:h});
  for(const v of ['customer','pos','dash']){
    await tab(v);await p.waitForTimeout(100);
    const o=await p.evaluate(()=>({sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth}));
    ok(`no horizontal overflow ${v} @${w}`,o.sw<=o.cw+1,o.sw+'/'+o.cw);
  }
}
// ภาพแท็บเล็ต
for(const [n,w,h] of [['tablet-landscape',1024,768],['tablet-portrait',820,1180],['desktop',1366,900]]){
  await p.setViewportSize({width:w,height:h});
  for(const v of ['customer','pos','dash']){await tab(v);await p.screenshot({path:`${SH}${n}-${v}.png`,fullPage:true});}
}
// เลือกคิวบนแท็บเล็ต
await p.setViewportSize({width:1024,height:768});await tab('pos');
await p.locator('.bk.booked, .bk.running').first().click();await p.waitForTimeout(200);
await p.screenshot({path:SH+'tablet-landscape-pos-selected.png',fullPage:true});
// ซูม 200% จำลอง
await p.setViewportSize({width:512,height:384});
for(const v of ['customer','pos','dash']){await tab(v);const o=await p.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]);ok('zoom200% overflow '+v,o[0]<=o[1]+1,o.join('/'));}
// สี
await p.setViewportSize({width:1024,height:768});
ok('no external requests',ext.length===0,ext.join(','));
ok('no JS errors',errs.length===0,errs.join(' | '));
console.log('\n'+res.filter(r=>r[0]==='FAIL').length+' FAIL / '+res.length);
await b.close();
})().catch(e=>{console.error('CRASH',e.message);process.exit(1)});
