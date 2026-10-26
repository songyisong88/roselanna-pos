/* ROSELANNA — ข้อมูลหลักร่วม (สาขา ห้อง บริการ ส่วนเสริม หมอนวด) ใช้ทั้งหน้าเว็บและเซิร์ฟเวอร์ (ข้อมูลตัวอย่างทั้งหมด) */
(function(root, factory){
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RL_CATALOG = factory();
})(typeof self !== 'undefined' ? self : this, function(){
  const BRANCHES = [
    {id:'bkk', name:'สาขากรุงเทพ', short:'กรุงเทพ', addr:'ซอยทองหล่อ 10 · กรุงเทพฯ', dist:'1.5 กม.', w:1.25},
    {id:'cnx', name:'สาขาเชียงใหม่', short:'เชียงใหม่', addr:'ถนนนิมมานเหมินท์ ซอย 9 · เชียงใหม่', dist:'4.2 กม.', w:1.0},
    {id:'hkt', name:'สาขาภูเก็ต', short:'ภูเก็ต', addr:'ถนนถลาง · เมืองภูเก็ต', dist:'10.5 กม.', w:0.85}
  ];
  const ROOMS = [
    {id:'r1', code:'R1', name:'ห้องลานนา'},
    {id:'r2', code:'R2', name:'ห้องบัวหลวง'},
    {id:'r3', code:'R3', name:'ห้องจำปา'}
  ];
  const SERVICES = [
    {id:'thai',   name:'นวดไทย',        sub:'ดั้งเดิมเพื่อการผ่อนคลาย', dur:60, price:500, w:4},
    {id:'oil',    name:'นวดน้ำมัน',      sub:'บำรุงร่างกาย นุ่มลึก',     dur:90, price:800, w:3},
    {id:'office', name:'ออฟฟิศซินโดรม', sub:'คลายปวดคอ บ่า ไหล่',      dur:90, price:900, w:2},
    {id:'foot',   name:'สปาเท้า',       sub:'ผ่อนคลายเท้าและน่อง',     dur:60, price:450, w:2}
  ];
  const ADDONS = [
    {id:'oilup', name:'อัปเกรดน้ำมันหอมระเหย', price:150},
    {id:'herb',  name:'ประคบสมุนไพรร้อน',      price:200},
    {id:'scrub', name:'ขัดผิวเท้า',            price:150}
  ];
  const TIERS = [
    {id:'none', name:'ไม่มีส่วนลด', pct:0},
    {id:'member', name:'สมาชิก', pct:10},
    {id:'vip', name:'สมาชิก VIP', pct:15}
  ];
  const THER = [
    ['เมย์',2,0],['ดา',3,1],['นิด',1,2],
    ['ปาน',2,3],['แพร',2,0],['มะลิ',1,1],
    ['นุ่น',3,2],['ฟ้า',2,3],['อ้อม',1,0]
  ];
  const THERAPISTS = [];
  BRANCHES.forEach((b,bi)=>{ for(let i=0;i<3;i++){ const t=THER[bi*3+i];
    THERAPISTS.push({id:b.id+'-'+(i+1), branch:b.id, name:t[0], level:t[1], av:t[2]}); }});
  return {
    OPEN:10*60, CLOSE:22*60, COMM_RATE:0.30, PTS_DIV:10, VIP_AT:2000,
    BRANCHES, ROOMS, SERVICES, ADDONS, TIERS, THERAPISTS
  };
});
