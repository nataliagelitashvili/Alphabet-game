/* Layered parallax level renderer (canvas, logical 480x270, nearest-neighbour). Level scenes come from LL.assets.manifest.scenes. */
LL.scene={
 async start(cv,id,note){const m=LL.assets.manifest.scenes[id],keys=Object.keys(m),imgs=await Promise.all(keys.map(k=>LL.assets.load(m[k])));
  const miss=keys.filter((k,i)=>!imgs[i]);
  if(miss.length){note.textContent='ილუსტრაციები მოსალოდნელია: '+miss.map(k=>m[k]).join(', ');cv.hidden=true;return}
  note.textContent='';cv.hidden=false;const W=480,H=270,x=cv.getContext('2d');cv.width=W;cv.height=H;x.imageSmoothingEnabled=false;
  const speed={sky:3,far:8,mid:18,fore:40},L=keys.map((k,i)=>({img:imgs[i],v:speed[k]||10}));let mx=0;
  cv.onpointermove=e=>{mx=(e.offsetX/cv.clientWidth-.5)*16};
  const dust=[...Array(24)].map(()=>({x:Math.random()*W,y:Math.random()*H,s:.2+Math.random()*.5}));
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;let t=0;
  const loop=()=>{if(!reduce)t+=1/60;L.forEach(l=>{const w=l.img.width*H/l.img.height,o=((t*l.v+mx*l.v/20)%w+w)%w;for(let px=-o;px<W;px+=w)x.drawImage(l.img,px,0,w,H)});
   if(!reduce){x.fillStyle='rgba(255,240,190,.6)';dust.forEach(d=>{d.x=(d.x+d.s)%W;d.y+=Math.sin(t+d.x/30)*.1;x.fillRect(d.x|0,d.y|0,1,1)})}
   requestAnimationFrame(loop)};loop()}
};
