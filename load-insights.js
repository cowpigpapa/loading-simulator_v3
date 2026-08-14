(function(root){
  function balance(load){
    const total=load?.placed?.reduce((sum,p)=>sum+Number(p.weight||0),0)||0,c=load?.container;
    if(!total||!c)return null;
    const cog=load.placed.reduce((a,p)=>({x:a.x+(p.x+p.l/2)*p.weight,y:a.y+(p.y+p.w/2)*p.weight,z:a.z+(p.z+p.h/2)*p.weight}),{x:0,y:0,z:0});
    cog.x/=total;cog.y/=total;cog.z/=total;
    const xOffset=(cog.x/c.l-.5)*100,yOffset=(cog.y/c.w-.5)*100,max=Math.max(Math.abs(xOffset),Math.abs(yOffset)),level=max<=5?'safe':max<=10?'caution':'danger';
    return{total,cog,xOffset,yOffset,level,door:(1-cog.x/c.l)*100,rear:cog.x/c.l*100,left:(1-cog.y/c.w)*100,right:cog.y/c.w*100};
  }
  function ctu(load){
    const b=balance(load),placed=load?.placed||[],c=load?.container;if(!b||!c)return null;
    const half=c.l/2,starts=new Set([0,half]);placed.forEach(p=>{starts.add(Math.max(0,Math.min(half,p.x)));starts.add(Math.max(0,Math.min(half,p.x+p.l-half)))});
    const halfMass=Math.max(...[...starts].map(start=>placed.reduce((sum,p)=>sum+p.weight*Math.max(0,Math.min(start+half,p.x+p.l)-Math.max(start,p.x))/p.l,0))),concentration=halfMass/b.total*100,vertical=b.cog.z/c.h*100,maxOffset=Math.max(Math.abs(b.xOffset),Math.abs(b.yOffset));
    const level=maxOffset>10||vertical>60?'danger':maxOffset>5||vertical>50||concentration>60?'caution':'safe';
    return{...b,concentration,vertical,maxOffset,level,checks:{center:maxOffset<=5,centerLimit:maxOffset<=10,vertical:vertical<=50,concentration:concentration<=60}};
  }
  root.LoadwiseInsights={balance,ctu};
})(globalThis);
