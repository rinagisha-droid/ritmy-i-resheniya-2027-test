/* Surface: NASA SVS CGI Moon Kit. Ephemeris: Astronomy Engine (MIT).
   Orthographic ray/sphere renderer in J2000 coordinates, IAU lunar body axes. */
(function(root){
 'use strict';
 const R=Math.PI/180, A=root.Astronomy;
 const vec=v=>[v.x,v.y,v.z], dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
 const sub=(a,b)=>a.map((v,i)=>v-b[i]);
 const norm=a=>{const l=Math.hypot(...a);return a.map(v=>v/l)};
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const ufa=new A.Observer(54.7351,55.9587,150);
 function state(date){
  const moon=vec(A.GeoMoon(date)), sun=vec(A.GeoVector('Sun',date,true));
  const obs=vec(A.ObserverVector(date,ufa,false));
  const view=norm(sub(obs,moon));
  // The difference between two observer heights is the local zenith.
  const high=vec(A.ObserverVector(date,new A.Observer(ufa.latitude,ufa.longitude,1150),false));
  const zenith=norm(sub(high,obs));
  let up=norm(sub(zenith,view.map(v=>v*dot(zenith,view))));
  const right=norm(cross(up,view)); up=norm(cross(view,right));
  const light=norm(sub(sun,moon)), axis=A.RotationAxis('Moon',date), north=vec(axis.north);
  const node=[-Math.sin(axis.ra*15*R),Math.cos(axis.ra*15*R),0];
  const east=cross(north,node), w=axis.spin*R;
  const prime=node.map((v,i)=>v*Math.cos(w)+east[i]*Math.sin(w));
  const bodyEast=cross(north,prime);
  const eq=A.Equator('Moon',date,ufa,true,true), hor=A.Horizon(date,ufa,eq.ra,eq.dec,'normal');
  return {date,view,up,right,light,north,prime,bodyEast,
   a:A.MoonPhase(date),lit:100*A.Illumination('Moon',date).phase_fraction,
   z:Math.floor(A.EclipticGeoMoon(date).lon/30),alt:hor.altitude,az:hor.azimuth};
 }
 let texturePromise;
 function texture(){return texturePromise??=(new Promise((resolve,reject)=>{
  const im=new Image(); im.onload=()=>{const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);resolve({pixels:ctx.getImageData(0,0,c.width,c.height).data,w:c.width,h:c.height})};
  im.onerror=()=>{texturePromise=null;reject(new Error('Moon texture unavailable'))};im.src='assets/moon-nasa.jpg';
 }));}
 function paint(canvas,s,t,size=360){
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'), out=ctx.createImageData(size,size), radius=size*.475;
  for(let py=0;py<size;py++)for(let px=0;px<size;px++){
   const x=(px+.5-size/2)/radius,y=(size/2-py-.5)/radius,rr=x*x+y*y;if(rr>=1)continue;
   const z=Math.sqrt(1-rr), n=s.right.map((v,i)=>v*x+s.up[i]*y+s.view[i]*z);
   const lon=Math.atan2(dot(n,s.bodyEast),dot(n,s.prime));
   const lat=Math.asin(Math.max(-1,Math.min(1,dot(n,s.north))));
   const u=((.5+lon/(2*Math.PI))%1+1)%1, v=.5-lat/Math.PI;
   const tx=Math.min(t.w-1,Math.floor(u*t.w)),ty=Math.min(t.h-1,Math.max(0,Math.floor(v*t.h)));
   const ti=4*(ty*t.w+tx),oi=4*(py*size+px),mu=dot(n,s.light);
   // Lunar diffuse reflection plus deliberately faint earthshine for a readable dark disc.
   const lit=Math.max(0,mu), surface=lit>0?(.5*lit+.5*lit/(lit+z+.00001)):0;
   const brightness=.15+.85*Math.pow(surface,.65);
   for(let ch=0;ch<3;ch++)out.data[oi+ch]=Math.min(255,t.pixels[ti+ch]*brightness*1.32);
   out.data[oi+3]=Math.round(255*Math.min(1,(1-Math.sqrt(rr))*radius));
  }
  ctx.putImageData(out,0,0);
 }
 async function draw(host,s,size=360){
  const canvas=document.createElement('canvas');canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label',`Луна, освещено ${s.lit.toFixed(1)} процента, вид из Уфы`);
  host.replaceChildren(canvas);
  try {const t=await texture();if(canvas.isConnected)paint(canvas,s,t,size)}
  catch {if(canvas.isConnected)host.textContent='Не удалось загрузить изображение Луны';}
 }
 root.LunarView={state,draw,paint};
})(globalThis);
