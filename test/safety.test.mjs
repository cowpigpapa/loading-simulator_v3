import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../app.js", import.meta.url), "utf8");
const context = vm.createContext({ console, setTimeout, clearTimeout, performance });
vm.runInContext(source, context);
const run = code => vm.runInContext(code, context);
const base = { name:"box", group:"기타", shape:"box", l:1000, w:800, h:700, weight:100, qty:1, rotate:false, fragile:false, color:"#000", volume:560000000 };

test("quoted newline CSV", () => assert.equal(run(`parseCSV('name,note\\nA,"line1\\nline2"')[0].note`), "line1\nline2"));
test("escaped quote CSV", () => assert.equal(run(`parseCSV('name,note\\nA,"a""b"')[0].note`), 'a"b'));
test("unclosed quote rejected", () => assert.throws(() => run(`parseCSV('name\\n"A')`), /따옴표/));
for(const [number,name] of ['single-small','single-medium','single-large','mixed-heavy','mixed-sizes','cylinders','tall-stability','fragile-topload','width-combination','partial-unloadable'].entries()){
  const id=String(number+1).padStart(2,'0'),file=new URL(`../test-projects/${id}-${name}.csv`,import.meta.url);
  test(`simulation file ${id} parses into valid products`,async()=>{context.csvText=await readFile(file,'utf8');assert.ok(run(`parseCSV(csvText).map(mapRow).length`)>0)});
}
test("uploaded labels are HTML escaped", () => assert.equal(run(`esc('<img src=x onerror=alert(1)>')`), "&lt;img src=x onerror=alert(1)&gt;"));
for (const [value,expected] of [["yes",true],["예",true],["true",true],["1",true],["no",false],["아니오",false],["false",false],["0",false]]) test(`flag ${value}`, () => assert.equal(run(`parseFlag('${value}','flag',2)`), expected));
test("blank flag rejected", () => assert.throws(() => run(`parseFlag('','flag',2)`), /2행/));
test("zero quantity rejected", () => assert.throws(() => run(`mapRow({'제품명':'A','형상':'박스형','길이':1,'너비':1,'높이':1,'중량':1,'수량':0,'눕힘허용':'no','상부적재금지':'no'},0)`), /수량/));
test("fractional quantity rejected", () => assert.throws(() => run(`mapRow({'제품명':'A','형상':'박스형','길이':1,'너비':1,'높이':1,'중량':1,'수량':1.5,'눕힘허용':'no','상부적재금지':'no'},0)`), /수량/));
test("unknown shape rejected", () => assert.throws(() => run(`mapRow({'제품명':'A','형상':'bag','길이':1,'너비':1,'높이':1,'중량':1,'수량':1,'눕힘허용':'no','상부적재금지':'no'},0)`), /형상/));
test("uploaded top-load capacity is optional", () => assert.equal(run(`mapRow({name:'A',shape:'box',length:1,width:1,height:1,weight:1,quantity:1,rotation:'no',fragile:'no'},0).maxTopLoadKg`), null));
test("uploaded top-load capacity is preserved", () => assert.equal(run(`mapRow({name:'A',shape:'box',length:1,width:1,height:1,weight:1,quantity:1,rotation:'no',fragile:'no',maxtopload:500},0).maxTopLoadKg`), 500));
test("negative uploaded top-load capacity is rejected", () => assert.throws(() => run(`mapRow({name:'A',shape:'box',length:1,width:1,height:1,weight:1,quantity:1,rotation:'no',fragile:'no',maxtopload:-1},0)`), /상부 허용하중/));

for (const [name,change] of [
  ["small",{}],["rotated",{rotate:true,l:1800,w:600,h:500}],["cylinder",{shape:"cylinder",l:900,w:900,h:700}],
  ["fragile",{fragile:true}],["tall",{l:800,w:800,h:1800}],["wide",{l:1200,w:1100,h:600}],
  ["heavy",{weight:5000}],["many",{qty:12}]
]) test(`packing invariants: ${name}`, () => {
  const items = Array.from({length:change.qty||4}, (_,i)=>({...base,...change,unit:i+1}));
  context.inputItems = items;
  const packed = run(`packPlan(CONTAINERS['20ft'], inputItems, 'sequence')`);
  const c = packed.container;
  assert.ok(packed.placed.every(p=>p.x>=0&&p.y>=0&&p.z>=0&&p.x+p.l<=c.l&&p.y+p.w<=c.w&&p.z+p.h<=c.h));
  assert.ok(packed.totalWeight<=c.maxWeight);
  for(let i=0;i<packed.placed.length;i++)for(let j=i+1;j<packed.placed.length;j++){const a=packed.placed[i],b=packed.placed[j];assert.ok(!(a.x<b.x+b.l&&a.x+a.l>b.x&&a.y<b.y+b.w&&a.y+a.w>b.y&&a.z<b.z+b.h&&a.z+a.h>b.z));}
  assert.equal(packed.placed.length+packed.rejected.length, items.length);
  context.packedResult = packed;
  assert.equal(run(`packedResult.placed.every((p,i)=>p.z===0||placementSupportRatio(p,p,[p.l,p.w,p.h],packedResult.placed.slice(0,i))>=.999999)`), true);
  assert.equal(run(`packedResult.placed.every(p=>!p.fragile||!packedResult.placed.some(q=>q!==p&&Math.abs(p.z+p.h-q.z)<2&&p.x<q.x+q.l&&p.x+p.l>q.x&&p.y<q.y+q.w&&p.y+p.w>q.y))`), true);
});

test("oversize algorithm rejects all", () => { context.caseItems=Array.from({length:4},(_,i)=>({...base,l:14000,unit:i+1,volume:14000*800*700}));const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'sequence')`);assert.equal(packed.placed.length,0);context.ship={containers:[packed],unallocated:packed.rejected,totalUnits:4};assert.equal(run(`shipmentOutcome(ship).state`),"failed") });
test("overweight algorithm rejects all", () => { context.caseItems=[{...base,weight:30000,unit:1}];const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'sequence')`);assert.equal(packed.placed.length,0);context.ship={containers:[packed],unallocated:packed.rejected,totalUnits:1};assert.equal(run(`shipmentOutcome(ship).rate`),0) });
test("partial is not complete", () => { context.ship = {containers:[{placed:[1,2]}],unallocated:[3],totalUnits:3};assert.equal(run(`shipmentOutcome(ship).state`),"partial") });
test("partial result notice names rejected cargo and quantity", () => { context.ship = {containers:[{placed:[1]}],unallocated:[{name:"초대형 펌프",reason:"공간 또는 지지 조건 부족"},{name:"초대형 펌프",reason:"공간 또는 지지 조건 부족"}],totalUnits:3};const notice=run(`unallocatedNotice(ship)`);assert.match(notice,/초대형 펌프 × 2/);assert.match(notice,/미배치 화물 2개/) });
test("complete requires zero unallocated", () => { context.ship = {containers:[{placed:[1,2]}],unallocated:[],totalUnits:2};assert.equal(run(`shipmentOutcome(ship).state`),"complete") });
test("one container is described as a single load, not split", () => { context.caseContainer={name:'20ft Dry'};assert.equal(run(`containerPlanMessage(caseContainer,1)`),'20ft Dry 1대에 한 번에 적재합니다.');assert.equal(run(`containerPlanMessage(caseContainer,2)`),'20ft Dry 2대로 분할 적재합니다.') });
test("balance placement prefers the candidate closer to container center", () => { context.caseItem={...base,weight:100};context.casePlaced=[];assert.ok(run(`placementBalanceScore(caseItem,{x:2000,y:776,z:0},[1000,800,700],casePlaced,CONTAINERS['20ft']) < placementBalanceScore(caseItem,{x:0,y:0,z:0},[1000,800,700],casePlaced,CONTAINERS['20ft'])`)) });
test("balance strategy preserves packing boundaries and quantity", () => { context.caseItems=Array.from({length:8},(_,i)=>({...base,unit:i+1}));const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'balance')`),c=packed.container;assert.equal(packed.placed.length+packed.rejected.length,8);assert.ok(packed.placed.every(p=>p.x>=0&&p.y>=0&&p.z>=0&&p.x+p.l<=c.l&&p.y+p.w<=c.w&&p.z+p.h<=c.h)) });
test("automatic comparison prioritizes fewer unallocated items", () => { context.LoadwiseInsights={balance:()=>({xOffset:0,yOffset:0})};context.caseBase=base;run(`casePlans=[{priority:'sequence',loads:[{container:CONTAINERS['20ft'],placed:[],rejected:[]}],remaining:[caseBase]},{priority:'width',loads:[{container:CONTAINERS['20ft'],placed:[],rejected:[]}],remaining:[]}]`);assert.equal(run(`selectBestStrategy(casePlans).priority`),'width') });
test("automatic comparison prefers the safer CTU distribution after shipment completeness", () => { context.LoadwiseInsights={balance:load=>({xOffset:load.risk,yOffset:0}),ctu:load=>({xOffset:load.risk,yOffset:0,concentration:load.concentration,vertical:20,level:load.risk>10?'danger':'safe'})};run(`casePlans=[{priority:'sequence',loads:[{risk:14,concentration:80,placed:[]}],remaining:[]},{priority:'width',loads:[{risk:2,concentration:55,placed:[]}],remaining:[]}]`);assert.equal(run(`selectBestStrategy(casePlans).priority`),'width') });
for(const mode of ["sequence","volume"])test(`${mode} allows fully supported cylinder stacking`, () => { context.caseItems=Array.from({length:20},(_,i)=>({...base,shape:"cylinder",l:900,w:900,h:700,unit:i+1,volume:567000000}));const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'${mode}')`);assert.ok(packed.placed.some(p=>p.z>0));context.packedResult=packed;assert.equal(run(`packedResult.placed.filter(p=>p.z>0).every((p,i)=>placementSupportRatio(p,p,[p.l,p.w,p.h],packedResult.placed)===1&&supportingItems(p,p,[p.l,p.w,p.h],packedResult.placed).every(q=>q.shape==='cylinder'))`),true) });
test("width-first chooses the smallest short-side residual before used length", () => { context.caseItem={...base,l:900,w:500,h:400,rotate:true};context.casePlaced=[{...base,x:0,y:0,z:0,l:900,w:1300,h:400}];const best=run(`findExtremePlacement({l:5000,w:2352,h:2393,maxWeight:28200},caseItem,casePlaced,'width')`);assert.equal(best.s.x,0);assert.equal(best.s.y,1300);assert.equal(best.d[1],900) });
test("width-first keeps 100 percent upper support", () => assert.equal(run(`validSupport({...${JSON.stringify(base)}},{x:0,y:0,z:700},[1000,800,700],[{...${JSON.stringify(base)},x:0,y:0,z:0,l:700,w:800,h:700}],'width',CONTAINERS['20ft'])`),false));
test("safe-width hybrid keeps 100 percent upper support", () => assert.equal(run(`validSupport({...${JSON.stringify(base)}},{x:0,y:0,z:700},[1000,800,700],[{...${JSON.stringify(base)},x:0,y:0,z:0,l:700,w:800,h:700}],'hybrid',CONTAINERS['20ft'])`),false));
test("safe-width hybrid preserves boundaries and quantity", () => { context.caseItems=Array.from({length:18},(_,i)=>({...base,w:i%3===0?700:800,unit:i+1}));const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'hybrid')`),c=packed.container;assert.equal(packed.placed.length+packed.rejected.length,18);assert.ok(packed.placed.every(p=>p.x>=0&&p.y>=0&&p.z>=0&&p.x+p.l<=c.l&&p.y+p.w<=c.w&&p.z+p.h<=c.h)) });
test("packing rejects a placement that exceeds cumulative top-load capacity", () => { context.baseLayer={...base,x:0,y:0,z:0,l:1000,w:800,h:700,maxTopLoadKg:50};context.upper={...base,weight:100};assert.equal(run(`compressionSafe(upper,{x:0,y:0,z:700},[1000,800,700],[baseLayer])`),false) });
test("extreme placement rejects a freely floating candidate", () => assert.equal(run(`isExtremePlacement({x:100,y:100,z:0},[100,100,100],[])`),false));
test("50 percent rear support is accepted", () => { context.sideCargo=[{x:1800,y:1000,z:0,l:1000,w:400,h:1100}];assert.equal(run(`lateralSupportDirections({x:1000,y:1000,z:0},[800,800,2200],sideCargo,CONTAINERS['20ft']).back`),true) });
test("automatic securing never invents a lashing band", () => { const c=run(`CONTAINERS['20ft']`);context.caseLoad={container:{...c},placed:[{...base,x:c.l-800,y:0,z:0,l:800,w:800,h:2200,name:'tall'}]};const plan=run(`buildSecuringPlan(caseLoad,'sea')`);assert.equal('bands' in plan,false);assert.ok(plan.reviews.length>0) });
test("low stable second-tier box needs no combined-transport review", () => { const c=run(`CONTAINERS['20ft']`);context.caseLoad={container:{...c},placed:[{...base,x:1000,y:0,z:0,l:600,w:500,h:450,name:'base'},{...base,x:1000,y:0,z:450,l:600,w:500,h:450,name:'upper'}]};const plan=run(`buildSecuringPlan(caseLoad,'combined')`);assert.equal(plan.reviews.length,0) });
test("sea transport is stricter than road transport for high cargo", () => { const c=run(`CONTAINERS['20ft']`);context.caseLoad={container:{...c},placed:[{...base,x:c.l-800,y:0,z:0,l:800,w:800,h:2200,name:'tall'}]};assert.ok(run(`buildSecuringPlan(caseLoad,'sea').reviews.length`)>run(`buildSecuringPlan(caseLoad,'road').reviews.length`)) });
test("sea transport adds a larger placement risk than road transport", () => { context.caseItem={...base,h:1600};context.caseContainer=run(`CONTAINERS['20ft']`);assert.ok(run(`transportPlacementRisk(caseItem,{x:1000,y:500,z:700},[800,800,1600],[],caseContainer,'sea')`)>run(`transportPlacementRisk(caseItem,{x:1000,y:500,z:700},[800,800,1600],[],caseContainer,'road')`)) });
test("unsupported high stack is marked for rearrangement instead of a band", () => { const c=run(`CONTAINERS['20ft']`);context.caseLoad={container:{...c},placed:[{...base,x:1000,y:0,z:0,l:800,w:800,h:900,name:'base'},{...base,x:1000,y:0,z:900,l:800,w:800,h:900,name:'upper'}]};const plan=run(`buildSecuringPlan(caseLoad,'sea')`);assert.equal(plan.reviews.some(r=>r.product==='upper'&&r.severity==='rearrange'),true) });
test("three missing directions make slender placement invalid", () => assert.equal(run(`validSupport({...${JSON.stringify(base)},h:2200},{x:1000,y:0,z:0},[800,800,2200],[],'sequence',CONTAINERS['20ft'])`),false));
test("rear and left support allow slender placement", () => assert.equal(run(`validSupport({...${JSON.stringify(base)},h:2200},{x:0,y:0,z:0},[800,800,2200],[],'sequence',CONTAINERS['20ft'])`),true));
