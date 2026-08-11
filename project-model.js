(function(root){
  const allowedContainers=new Set(['20ft','40ft','40hc','45hc']),allowedOptimizations=new Set(['sequence','volume','intelligent']);
  function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)&&n>0?n:fallback}
  function normalizeProduct(p={}){return{name:String(p.name||'').trim(),group:String(p.group||'기타').trim()||'기타',shape:p.shape==='cylinder'?'cylinder':'box',qty:Math.max(1,Math.floor(number(p.qty,1))),l:number(p.l),w:number(p.w),h:number(p.h),weight:number(p.weight),rotate:Boolean(p.rotate),fragile:Boolean(p.fragile),source:['manual','csv','excel','json'].includes(p.source)?p.source:'manual'}}
  function normalizeSnapshot(data={}){const products=Array.isArray(data.products)?data.products.map(normalizeProduct).filter(p=>p.name&&p.l&&p.w&&p.h&&p.weight):[];return{schemaVersion:1,products,containerType:allowedContainers.has(data.containerType)?data.containerType:'20ft',optimization:allowedOptimizations.has(data.optimization)?data.optimization:'intelligent'}}
  function createSnapshot(products,containerType,optimization){return normalizeSnapshot({products,containerType,optimization})}
  root.LoadwiseProjectModel={normalizeProduct,normalizeSnapshot,createSnapshot};
})(globalThis);
