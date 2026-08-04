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
for (const [value,expected] of [["yes",true],["예",true],["true",true],["1",true],["no",false],["아니오",false],["false",false],["0",false]]) test(`flag ${value}`, () => assert.equal(run(`parseFlag('${value}','flag',2)`), expected));
test("blank flag rejected", () => assert.throws(() => run(`parseFlag('','flag',2)`), /2행/));
test("zero quantity rejected", () => assert.throws(() => run(`mapRow({'제품명':'A','형상':'박스형','길이':1,'너비':1,'높이':1,'중량':1,'수량':0,'눕힘허용':'no','상부적재금지':'no'},0)`), /수량/));
test("fractional quantity rejected", () => assert.throws(() => run(`mapRow({'제품명':'A','형상':'박스형','길이':1,'너비':1,'높이':1,'중량':1,'수량':1.5,'눕힘허용':'no','상부적재금지':'no'},0)`), /수량/));
test("unknown shape rejected", () => assert.throws(() => run(`mapRow({'제품명':'A','형상':'bag','길이':1,'너비':1,'높이':1,'중량':1,'수량':1,'눕힘허용':'no','상부적재금지':'no'},0)`), /형상/));

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
test("complete requires zero unallocated", () => { context.ship = {containers:[{placed:[1,2]}],unallocated:[],totalUnits:2};assert.equal(run(`shipmentOutcome(ship).state`),"complete") });
test("auto chooses safe for fragile cargo", () => { context.caseItems=Array.from({length:5},()=>({...base,fragile:true}));assert.equal(run(`recommendPackingStrategy(caseItems,CONTAINERS['20ft']).priority`),"sequence") });
test("auto chooses safe for cylinders", () => { context.caseItems=Array.from({length:5},()=>({...base,shape:"cylinder"}));assert.equal(run(`recommendPackingStrategy(caseItems,CONTAINERS['20ft']).priority`),"sequence") });
test("auto chooses safe for slender cargo", () => { context.caseItems=Array.from({length:5},()=>({...base,h:2500}));assert.equal(run(`recommendPackingStrategy(caseItems,CONTAINERS['20ft']).priority`),"sequence") });
test("auto chooses maximum for dense regular cargo", () => { context.caseItems=Array.from({length:30},()=>({...base,l:1200,w:1000,h:900,rotate:true}));assert.equal(run(`recommendPackingStrategy(caseItems,CONTAINERS['20ft']).priority`),"volume") });
test("safe mode never stacks cylinders", () => { context.caseItems=Array.from({length:20},(_,i)=>({...base,shape:"cylinder",l:900,w:900,h:700,unit:i+1,volume:567000000}));const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'sequence')`);assert.ok(packed.placed.length>0);assert.ok(packed.rejected.length>0);assert.ok(packed.placed.every(p=>p.z===0)) });
test("maximum mode never stacks cylinders without cradles", () => { context.caseItems=Array.from({length:20},(_,i)=>({...base,shape:"cylinder",l:900,w:900,h:700,unit:i+1,volume:567000000}));const packed=run(`packPlan(CONTAINERS['20ft'],caseItems,'volume')`);assert.ok(packed.placed.length>0);assert.ok(packed.rejected.length>0);assert.ok(packed.placed.every(p=>p.z===0)) });
test("tall stack needs support on both lateral axes", () => { context.sideCargo=[{x:0,y:900,z:0,l:1000,w:500,h:2200}];assert.deepEqual({...run(`lateralSupportAxes({x:1000,y:1000,z:0},[800,800,2200],sideCargo,CONTAINERS['20ft'])`)},{x:true,y:false}) });
