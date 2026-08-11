import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const context={globalThis:{}};vm.runInNewContext(await readFile(new URL('../load-insights.js',import.meta.url),'utf8'),context);
const {balance}=context.globalThis.LoadwiseInsights;

test('balanced cargo reports centered safe distribution',()=>{
  const value=balance({container:{l:100,w:100,h:100},placed:[{x:25,y:25,z:0,l:50,w:50,h:20,weight:100}]});
  assert.equal(value.level,'safe');assert.equal(value.door,50);assert.equal(value.left,50);
});

test('off-center cargo reports danger',()=>{
  const value=balance({container:{l:100,w:100,h:100},placed:[{x:80,y:80,z:0,l:10,w:10,h:10,weight:100}]});
  assert.equal(value.level,'danger');assert.equal(Math.round(value.xOffset),35);assert.equal(Math.round(value.yOffset),35);
});
