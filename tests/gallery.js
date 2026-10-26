const {chromium}=require(process.env.PW||'/usr/local/lib/pnpm/5/.pnpm/playwright@1.63.0-alpha-2026-08-31/node_modules/playwright');
const BASE=process.argv[2]||'http://localhost:18777/index.html';const SH=__dirname+'/../shots/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
for(const [n,w,h] of [['mobile',390,844],['tablet',1024,768]]){
 const ctx=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:n==='mobile'?2:1.5,locale:'th-TH',timezoneId:'Asia/Bangkok'});
 const p=await ctx.newPage();await p.clock.install({time:new Date(2026,9,26,14,5,0)});await p.goto(BASE+'#customer');await p.waitForTimeout(500);
 const shot=async f=>{await p.waitForTimeout(250);await p.screenshot({path:`${SH}v-${n}-${f}.png`})};
 const tab=async v=>{await p.click(`#viewTabs [data-v=${v}]`)};
 await shot('01-customer-top');
 await p.click('[data-c=branch][data-v=bkk]');await p.click('[data-c=service][data-v=oil]');await p.click('[data-c=ther][data-v=bkk-2]');
 await p.evaluate(()=>document.querySelector('.slots').scrollIntoView({block:'center'}));await shot('02-customer-slots');
 const t=await p.$$eval('.slot',e=>e.filter(x=>!x.disabled).map(x=>x.dataset.v));await p.click(`[data-c=time][data-v="${t[1]}"]`);
 await p.evaluate(()=>document.querySelector('#confirmBtn').scrollIntoView({block:'center'}));await shot('03-customer-summary');
 await p.click('#confirmBtn');await p.evaluate(()=>window.scrollTo(0,0));await shot('04-customer-success');
 await p.click('[data-c=tab][data-v=pts]');await shot('05-customer-points');
 await tab('pos');await shot('06-pos-grid');
 await p.locator('.bk.running').first().click();await shot('07-pos-checkout-running');
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await shot('08-pos-checkout-bottom');
 await p.click('[data-p=back]').catch(()=>{});await p.evaluate(()=>window.scrollTo(0,0));
 await p.click('[data-p=walk]');await shot('09-pos-walkin');await p.click('[data-w=close]');
 await tab('dash');await shot('10-dash-top');
 await p.evaluate(()=>window.scrollTo(0,700));await shot('11-dash-mid');
 await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));await shot('12-dash-bottom');
 await ctx.close();}
await b.close();})();
