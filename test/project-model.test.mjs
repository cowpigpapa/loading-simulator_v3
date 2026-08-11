import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const context={};context.globalThis=context;vm.createContext(context);vm.runInContext(await readFile(new URL('../project-model.js',import.meta.url),'utf8'),context);
const model=context.LoadwiseProjectModel;

test('manual and file products share one normalized model',()=>{
  const snapshot=model.createSnapshot([{name:'펌프',group:'기계',shape:'box',qty:'2',l:'1000',w:'800',h:'700',weight:'120',source:'excel'}],'40hc','intelligent');
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot)),{schemaVersion:1,products:[{name:'펌프',group:'기계',shape:'box',qty:2,l:1000,w:800,h:700,weight:120,rotate:false,fragile:false,source:'excel'}],containerType:'40hc',optimization:'intelligent'});
});

test('invalid project values fall back safely',()=>{
  const snapshot=model.normalizeSnapshot({products:[{name:'',qty:0}],containerType:'x',optimization:'x'});
  assert.equal(snapshot.products.length,0);assert.equal(snapshot.containerType,'20ft');assert.equal(snapshot.optimization,'intelligent');
});
