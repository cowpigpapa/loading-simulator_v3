import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context={};context.globalThis=context;vm.createContext(context);vm.runInContext(await readFile(new URL('../project-model.js',import.meta.url),'utf8'),context);
const model=context.LoadwiseProjectModel;

test('manual and file products share one normalized model',()=>{
  const snapshot=model.createSnapshot([{name:'펌프',group:'기계',shape:'box',qty:'2',l:'1000',w:'800',h:'700',weight:'120',source:'excel'}],'40hc','intelligent');
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),{schemaVersion:4,algorithmVersion:'legacy',products:[{name:'펌프',group:'기계',shape:'box',qty:2,l:1000,w:800,h:700,weight:120,maxTopLoadKg:null,rotate:false,fragile:false,source:'excel'}],containerType:'40hc',optimization:'intelligent',transportMode:'combined',resultSummary:null,fieldResult:null});
});

test('legacy snapshots migrate and current metadata is preserved',()=>{
  const legacy=model.normalizeSnapshot({schemaVersion:1,products:[],containerType:'40ft',optimization:'sequence'});
  assert.equal(legacy.schemaVersion,4);assert.equal(legacy.algorithmVersion,'legacy');assert.equal(legacy.transportMode,'combined');assert.equal(legacy.resultSummary,null);assert.equal(legacy.fieldResult,null);
  const current=model.createSnapshot([],'20ft','intelligent',{algorithmVersion:model.CURRENT_ALGORITHM_VERSION,resultSummary:{state:'complete',loaded:36,total:36,containerCount:1,totalWeight:6692,calculatedAt:'2026-08-11T00:00:00.000Z'}});
  assert.equal(current.algorithmVersion,'extreme-dblf-validated-portfolio-2026.08');assert.equal(current.resultSummary.loaded,36);assert.equal(current.resultSummary.totalWeight,6692);
});

test('field comparison survives project normalization',()=>{
  const snapshot=model.createSnapshot([],'20ft','intelligent',{fieldResult:{loaded:35,containers:2,notes:'현장 변경',recordedAt:'2026-08-11T00:00:00.000Z'}});
  assert.equal(snapshot.fieldResult.loaded,35);assert.equal(snapshot.fieldResult.containers,2);assert.equal(snapshot.fieldResult.notes,'현장 변경');
});

test('optional top-load capacity is preserved without inventing a default',()=>{
  assert.equal(model.createSnapshot([{name:'상자',qty:1,l:1,w:1,h:1,weight:1,maxTopLoadKg:250}],'20ft','sequence').products[0].maxTopLoadKg,250);
  assert.equal(model.createSnapshot([{name:'상자',qty:1,l:1,w:1,h:1,weight:1}],'20ft','sequence').products[0].maxTopLoadKg,null);
});

test('width-first optimization is preserved',()=>{
  assert.equal(model.createSnapshot([],'20ft','width').optimization,'width');
});

test('safe-width hybrid optimization is preserved',()=>{
  assert.equal(model.createSnapshot([],'20ft','hybrid').optimization,'hybrid');
});

test('balance-first optimization is preserved',()=>{
  assert.equal(model.createSnapshot([],'20ft','balance').optimization,'balance');
});

test('transport mode is preserved and invalid values fall back to combined',()=>{
  assert.equal(model.createSnapshot([],'20ft','sequence',{transportMode:'sea'}).transportMode,'sea');
  assert.equal(model.normalizeSnapshot({transportMode:'invalid'}).transportMode,'combined');
});

test('invalid project values fall back safely',()=>{
  const snapshot=model.normalizeSnapshot({products:[{name:'',qty:0}],containerType:'x',optimization:'x'});
  assert.equal(snapshot.products.length,0);assert.equal(snapshot.containerType,'20ft');assert.equal(snapshot.optimization,'intelligent');
});
