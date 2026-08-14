import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context={globalThis:{}};vm.runInNewContext(await readFile(new URL('../load-insights.js',import.meta.url),'utf8'),context);
const {balance,ctu}=context.globalThis.LoadwiseInsights;

test('balanced cargo reports centered safe distribution',()=>{
  const value=balance({container:{l:100,w:100,h:100},placed:[{x:25,y:25,z:0,l:50,w:50,h:20,weight:100}]});
  assert.equal(value.level,'safe');assert.equal(value.door,50);assert.equal(value.left,50);
});

test('off-center cargo reports danger',()=>{
  const value=balance({container:{l:100,w:100,h:100},placed:[{x:80,y:80,z:0,l:10,w:10,h:10,weight:100}]});
  assert.equal(value.level,'danger');assert.equal(Math.round(value.xOffset),35);assert.equal(Math.round(value.yOffset),35);
});

test('CTU pre-check reports centered, low and distributed cargo as safe',()=>{
  const load={container:{l:10000,w:2400,h:2400},placed:[{x:0,y:0,z:0,l:5000,w:2400,h:1000,weight:500},{x:5000,y:0,z:0,l:5000,w:2400,h:1000,weight:500}]};
  const value=ctu(load);assert.equal(value.level,'safe');assert.equal(value.checks.center,true);assert.equal(value.checks.vertical,true);assert.equal(value.checks.concentration,true);
});

test('CTU pre-check warns when over 60 percent of mass is concentrated in half length',()=>{
  const load={container:{l:10000,w:2400,h:2400},placed:[{x:0,y:0,z:0,l:4000,w:1200,h:1000,weight:800},{x:6000,y:1200,z:0,l:4000,w:1200,h:1000,weight:200}]};
  const value=ctu(load);assert.ok(value.concentration>60);assert.equal(value.checks.concentration,false);assert.notEqual(value.level,'safe');
});
