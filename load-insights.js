(function(root){
  function balance(load){
    const total=load?.placed?.reduce((sum,p)=>sum+Number(p.weight||0),0)||0,c=load?.container;
    if(!total||!c)return null;
    const cog=load.placed.reduce((a,p)=>({x:a.x+(p.x+p.l/2)*p.weight,y:a.y+(p.y+p.w/2)*p.weight,z:a.z+(p.z+p.h/2)*p.weight}),{x:0,y:0,z:0});
    cog.x/=total;cog.y/=total;cog.z/=total;
    const xOffset=(cog.x/c.l-.5)*100,yOffset=(cog.y/c.w-.5)*100,max=Math.max(Math.abs(xOffset),Math.abs(yOffset)),level=max<=5?'safe':max<=10?'caution':'danger';
    return{total,cog,xOffset,yOffset,level,door:(1-cog.x/c.l)*100,rear:cog.x/c.l*100,left:(1-cog.y/c.w)*100,right:cog.y/c.w*100};
  }
  root.LoadwiseInsights={balance};
})(globalThis);
