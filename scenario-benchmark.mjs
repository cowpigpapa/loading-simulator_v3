import {readdir,readFile,writeFile} from 'node:fs/promises';
import vm from 'node:vm';

const context=vm.createContext({console,setTimeout,clearTimeout,performance});
for(const file of ['load-insights.js','solution-validator.js','app.js'])vm.runInContext(await readFile(file,'utf8'),context);
const files=(await readdir('test-projects')).filter(name=>name.endsWith('.csv')).sort(),expected={
  '01-single-small.csv':[1,0],'02-single-medium.csv':[1,0],'03-single-large.csv':[2,0],'04-mixed-heavy.csv':[1,0],'05-mixed-sizes.csv':[1,0],
  '06-cylinders.csv':[1,0],'07-tall-stability.csv':[1,0],'08-fragile-topload.csv':[1,0],'09-width-combination.csv':[1,0],'10-partial-unloadable.csv':[1,2]
},rows=[];
for(const file of files){
  context.csv=await readFile(`test-projects/${file}`,'utf8');
  const products=vm.runInContext('parseCSV(csv).map(mapRow)',context),units=products.flatMap((p,pi)=>Array.from({length:p.qty},(_,n)=>({...p,pi,unit:n+1,volume:p.l*p.w*p.h}))),plans=[];
  context.units=units;
  for(const priority of ['sequence','hybrid','volume','width','balance']){
    context.priority=priority;
    plans.push(await vm.runInContext(`packShipmentAsync(CONTAINERS['20ft'],units,priority,()=>{},false)`,context));
  }
  context.plans=plans;const selected=vm.runInContext('selectBestStrategy(plans)',context),validation=context.LoadwiseValidator.validateShipment({priority:selected.priority,containers:selected.loads,unallocated:selected.remaining,totalUnits:units.length});context.selected=selected;
  rows.push({file,units:units.length,selected:selected.priority,loaded:validation.metrics.loaded,unallocated:validation.metrics.unallocated,containers:validation.metrics.containers,valid:validation.valid,score:vm.runInContext('strategyScore(selected)',context),errors:validation.errors});
}
console.table(rows.map(({score,errors,...row})=>row));
await writeFile('benchmarks/scenarios.json',JSON.stringify({generatedAt:new Date().toISOString(),rows},null,2));
const regressions=rows.filter(row=>!row.valid||!expected[row.file]||row.containers>expected[row.file][0]||row.unallocated>expected[row.file][1]);
if(regressions.length){console.error('Scenario benchmark failed',regressions.map(row=>row.file));process.exitCode=1}
