import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const context=vm.createContext({});
vm.runInContext(await readFile(new URL('../solution-validator.js',import.meta.url),'utf8'),context);
const validate=(load,options)=>context.LoadwiseValidator.validateLoad(load,options);
const container={l:100,w:100,h:100,maxWeight:1000};

test('validator accepts a supported collision-free load',()=>assert.equal(validate({container,placed:[{x:0,y:0,z:0,l:50,w:50,h:50,weight:100},{x:0,y:0,z:50,l:50,w:50,h:50,weight:100}]}).valid,true));
test('validator rejects boundary, collision and unsupported placements',()=>{
  assert.equal(validate({container,placed:[{x:90,y:0,z:0,l:20,w:20,h:20,weight:1}]}).valid,false);
  assert.equal(validate({container,placed:[{x:0,y:0,z:0,l:50,w:50,h:50,weight:1},{x:20,y:20,z:0,l:50,w:50,h:50,weight:1}]}).valid,false);
  assert.equal(validate({container,placed:[{x:0,y:0,z:50,l:50,w:50,h:50,weight:1}]}).valid,false);
});
test('validator rejects partial support that misses the cargo center',()=>assert.equal(validate({container,placed:[{x:0,y:0,z:0,l:20,w:50,h:50,weight:1},{x:0,y:0,z:50,l:50,w:50,h:50,weight:1}]},{minSupport:.3}).valid,false));
test('validator rejects a stack whose combined center leaves its support polygon',()=>{const result=validate({container:{l:200,w:100,h:150,maxWeight:1000},placed:[{x:0,y:0,z:0,l:40,w:100,h:40,weight:10},{x:0,y:0,z:40,l:80,w:100,h:40,weight:10},{x:60,y:0,z:80,l:20,w:100,h:40,weight:500}]},{minSupport:.5});assert.equal(result.valid,false);assert.match(result.errors.join('\n'),/합성 무게중심/)});
