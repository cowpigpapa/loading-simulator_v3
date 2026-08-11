import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context={};context.globalThis=context;vm.createContext(context);vm.runInContext(await readFile(new URL('../project-model.js',import.meta.url),'utf8'),context);
const model=context.LoadwiseProjectModel;

test('manual and file products share one normalized model',()=>{
  const snapshot=model.createSnapshot([{name:'펌프',group:'기계',shape:'box',qty:'2',l:'1000',w:'800',h:'700',weight:'120',source:'excel'}],'40hc','intelligent');
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),{schemaVersion:2,algorithmVersion:'legacy',products:[{name:'펌프',group:'기계',shape:'box',qty:2,l:1000,w:800,h:700,weight:120,rotate:false,fragile:false,source:'excel'}],containerType:'40hc',optimization:'intelligent',resultSummary:null});
});

test('legacy snapshots migrate and current metadata is preserved',()=>{
  const legacy=model.normalizeSnapshot({schemaVersion:1,products:[],containerType:'40ft',optimization:'sequence'});
  assert.equal(legacy.schemaVersion,2);assert.equal(legacy.algorithmVersion,'legacy');assert.equal(legacy.resultSummary,null);
  const current=model.createSnapshot([],'20ft','intelligent',{algorithmVersion:model.CURRENT_ALGORITHM_VERSION,resultSummary:{state:'complete',loaded:36,total:36,containerCount:1,totalWeight:6692,calculatedAt:'2026-08-11T00:00:00.000Z'}});
  assert.equal(current.algorithmVersion,'extreme-dblf-width-2026.08');assert.equal(current.resultSummary.loaded,36);assert.equal(current.resultSummary.totalWeight,6692);
});

test('width-first optimization is preserved',()=>{
  assert.equal(model.createSnapshot([],'20ft','width').optimization,'width');
});

test('invalid project values fall back safely',()=>{
  const snapshot=model.normalizeSnapshot({products:[{name:'',qty:0}],containerType:'x',optimization:'x'});
  assert.equal(snapshot.products.length,0);assert.equal(snapshot.containerType,'20ft');assert.equal(snapshot.optimization,'intelligent');
});
