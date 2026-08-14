import {mkdir,readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({console,setTimeout,clearTimeout,performance});
for(const file of ['load-insights.js','solution-validator.js','app.js'])vm.runInContext(await readFile(file,'utf8'),context);
const base={name:'box',group:'benchmark',shape:'box',l:1000,w:800,h:700,weight:100,qty:1,rotate:true,fragile:false,color:'#000',volume:560000000};
const cases=[
  {name:'uniform-36',items:Array.from({length:36},(_,i)=>({...base,unit:i+1}))},
  {name:'mixed',items:Array.from({length:24},(_,i)=>({...base,l:600+(i%4)*180,w:500+(i%3)*140,h:450+(i%2)*250,weight:80+i*7,unit:i+1,volume:(600+(i%4)*180)*(500+(i%3)*140)*(450+(i%2)*250)}))},
  {name:'tall',items:Array.from({length:12},(_,i)=>({...base,l:800,w:800,h:1800,rotate:false,unit:i+1,volume:1152000000}))}
];
const rows=[];
for(const sample of cases)for(const strategy of ['sequence','hybrid','volume','width','balance']){
  context.sample=sample.items;const start=performance.now(),plan=vm.runInContext(`packShipmentAsync(CONTAINERS['20ft'],sample,'${strategy}')`,context);const shipment=await plan,elapsed=performance.now()-start,validation=context.LoadwiseValidator.validateShipment({priority:strategy,containers:shipment.loads,unallocated:shipment.remaining,totalUnits:sample.items.length});
  const volumeRate=shipment.loads.reduce((sum,load)=>sum+load.volumeRate,0)/Math.max(1,shipment.loads.length),cogRisk=shipment.loads.reduce((worst,load)=>{const b=context.LoadwiseInsights.balance(load);return Math.max(worst,b?Math.max(Math.abs(b.xOffset),Math.abs(b.yOffset)):100)},0);
  rows.push({engine:'portfolio',case:sample.name,strategy,valid:validation.valid,loaded:validation.metrics.loaded,unallocated:validation.metrics.unallocated,containers:validation.metrics.containers,volumeRate:Number(volumeRate.toFixed(1)),cogRisk:Number(cogRisk.toFixed(1)),elapsedMs:Number(elapsed.toFixed(1)),errors:validation.errors.join('; ')});
  if(strategy!=='volume'){
    context.sample=sample.items;context.strategy=strategy;const baselineStart=performance.now(),baseline=await vm.runInContext(`(async()=>{const loads=[];let remaining=sample;while(remaining.length&&loads.length<50){const raw=await packExtremeRawAsync(CONTAINERS['20ft'],remaining,strategy),load=finalizePacking(CONTAINERS['20ft'],raw);if(!load.placed.length){if(!loads.length)loads.push(load);break}loads.push(load);remaining=load.rejected}return{loads,remaining}})()`,context),baselineValidation=context.LoadwiseValidator.validateShipment({priority:strategy,containers:baseline.loads,unallocated:baseline.remaining,totalUnits:sample.items.length}),baselineVolume=baseline.loads.reduce((sum,load)=>sum+load.volumeRate,0)/Math.max(1,baseline.loads.length),baselineCog=baseline.loads.reduce((worst,load)=>{const b=context.LoadwiseInsights.balance(load);return Math.max(worst,b?Math.max(Math.abs(b.xOffset),Math.abs(b.yOffset)):100)},0);
    rows.push({engine:'single',case:sample.name,strategy,valid:baselineValidation.valid,loaded:baselineValidation.metrics.loaded,unallocated:baselineValidation.metrics.unallocated,containers:baselineValidation.metrics.containers,volumeRate:Number(baselineVolume.toFixed(1)),cogRisk:Number(baselineCog.toFixed(1)),elapsedMs:Number((performance.now()-baselineStart).toFixed(1)),errors:baselineValidation.errors.join('; ')});
  }
}
console.table(rows);
await mkdir('benchmarks',{recursive:true});
await writeFile('benchmarks/latest.json',JSON.stringify({generatedAt:new Date().toISOString(),engine:'extreme-dblf-transport-stability-2026.08',rows},null,2));
const regressions=rows.filter(r=>r.engine==='portfolio').flatMap(portfolio=>{const single=rows.find(r=>r.engine==='single'&&r.case===portfolio.case&&r.strategy===portfolio.strategy);if(!single)return[];const worse=portfolio.unallocated>single.unallocated||portfolio.containers>single.containers||(portfolio.strategy==='balance'&&portfolio.cogRisk>single.cogRisk+.1);return worse?[`${portfolio.case}/${portfolio.strategy}`]:[]});
if(rows.some(r=>!r.valid)||regressions.length){console.error('Benchmark gate failed',regressions);process.exitCode=1}
