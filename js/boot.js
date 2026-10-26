/* เลือกที่เก็บข้อมูล: เซิร์ฟเวอร์ (ถ้าตั้งค่าไว้) หรือ localStorage */
(function(){
'use strict';
const R=window.RL; let url=(window.RL_CONFIG||{}).serverUrl;
try{ const q=new URLSearchParams(location.search).get('server');
  if(q&&/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(q)) url=q; }catch(e){}   // ?server= ใช้ได้เฉพาะ localhost
R.store = url ? R.remoteStore(url) : R.localStore();
})();
