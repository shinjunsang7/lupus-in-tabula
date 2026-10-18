/* LUPUS IN TABULA v3.3: expanded navigation + high-detail animated sprites + dynamic color-matched animated player sprites.
   Rendering only: voting, role logic, chats and timers remain in the original game. */
(()=>{'use strict';
const canvas=document.getElementById('villageCanvas');if(!canvas)return;
const ctx=canvas.getContext('2d'),W=1200,H=550,RENDER_SCALE=Math.min(3,Math.max(2,window.devicePixelRatio||1));canvas.width=Math.round(W*RENDER_SCALE);canvas.height=Math.round(H*RENDER_SCALE);ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
// FINAL 2.8: keep FINAL 2.6 small actors; draw text overlays at native screen resolution to avoid scaled-font blur.
const CAMERA_ZOOM=.80, CHARACTER_ZOOM=.68;
const CAMERA_OFFSET_X=W*(1-CAMERA_ZOOM)/2, CAMERA_OFFSET_Y=H*(1-CAMERA_ZOOM)/2;
const background=new Image();background.src='/village_final26_moonlit.png?v=2.6';
const sprites=new Image();sprites.src='/village_characters_user.png?v=graphics7-original';
const deathSprites=new Image();deathSprites.src='/village_characters_death.png?v=graphics7-original';
const actors=new Map(),bubbles=new Map(),seen=new Set(),spotlights=new Map();
let currentRoom='',previousPhase='',lastSend=0,lastTick=performance.now(),lastState=null;
const fallbackColors=['#e35d6a','#5bb4e8','#b8d75a','#b28ae8','#f0c45a','#75d5c5','#f49b50','#ee78b8','#a7b6c8','#4e88f0','#9d86ee'];
const starts=[[.35,.47],[.24,.60],[.62,.47],[.79,.59],[.85,.77],[.35,.76],[.64,.65],[.48,.85],[.61,.85],[.79,.83],[.18,.79]];
function stateNow(){return typeof state!=='undefined'&&state?state:lastState}
function box(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.6;ctx.stroke()}}
function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
// FINAL 2.9 revised: exact green-area collision mask approved by the user.
// The yellow ground ring center (a.x, a.y) is the ONLY collision anchor.
// Black pixels are blocked (water, fountain, buildings and parapets).
const navImage=new Image();navImage.src='/village_walkable_final30.png?v=3.0';
let navPixels=null,navW=0,navH=0;
navImage.onload=()=>{
 const c=document.createElement('canvas');c.width=navImage.naturalWidth;c.height=navImage.naturalHeight;
 const cx=c.getContext('2d',{willReadFrequently:true});cx.drawImage(navImage,0,0);
 navPixels=cx.getImageData(0,0,c.width,c.height).data;navW=c.width;navH=c.height;
 // Keep the player's existing position; never teleport on map load.
};
function walkable(x,y){
 if(x<0||x>=1||y<0||y>=1)return false;
 if(!navPixels)return true; // no forced repositioning before the actual map loads
 const ix=Math.max(0,Math.min(navW-1,Math.floor(x*navW)));
 const iy=Math.max(0,Math.min(navH-1,Math.floor(y*navH)));
 return navPixels[(iy*navW+ix)*4]>180;
}
function clampGoal(x,y){
 x=Math.max(.001,Math.min(.999,x));y=Math.max(.001,Math.min(.999,y));
 if(walkable(x,y))return {x,y};
 // Closest allowed point in actual map pixels, using expanding rings.
 if(!navPixels)return {x,y};
 const cx=Math.round(x*navW),cy=Math.round(y*navH);
 for(let r=3;r<Math.max(navW,navH);r+=3){
  for(let i=0;i<64;i++){
   const a=i*Math.PI/32,px=(cx+Math.cos(a)*r)/navW,py=(cy+Math.sin(a)*r)/navH;
   if(walkable(px,py))return {x:px,y:py};
  }
 }
 return {x:.5,y:.78};
}
// A* path planning on the approved walkable floor prevents characters
// getting stuck against stairs or fountain when a click is across an obstacle.
const GRID_W=185,GRID_H=85;
function pathTo(start,goal){
 if(!navPixels)return [goal];
 const sx=Math.max(0,Math.min(GRID_W-1,Math.floor(start.x*GRID_W)));
 const sy=Math.max(0,Math.min(GRID_H-1,Math.floor(start.y*GRID_H)));
 const gx=Math.max(0,Math.min(GRID_W-1,Math.floor(goal.x*GRID_W)));
 const gy=Math.max(0,Math.min(GRID_H-1,Math.floor(goal.y*GRID_H)));
 const node=(x,y)=>y*GRID_W+x;
 const xy=id=>({x:(id%GRID_W+.5)/GRID_W,y:(Math.floor(id/GRID_W)+.5)/GRID_H});
 const count=GRID_W*GRID_H, startId=node(sx,sy), goalId=node(gx,gy);
 const score=new Float32Array(count).fill(Infinity),prev=new Int32Array(count).fill(-1),closed=new Uint8Array(count);
 const heap=[];
 function push(id,f){let i=heap.length;heap.push({id,f});while(i>0){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p}heap[i]={id,f}}
 function pop(){const top=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c}heap[i]=last}return top.id}
 function pass(x,y){return x>=0&&y>=0&&x<GRID_W&&y<GRID_H&&walkable((x+.5)/GRID_W,(y+.5)/GRID_H)}
 if(!pass(gx,gy))return [goal];
 score[startId]=0;push(startId,0);
 let closest=startId,best=Infinity,loops=0;
 const dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 while(heap.length&&loops++<count*3){
  const id=pop();if(closed[id])continue;closed[id]=1;
  const x=id%GRID_W,y=Math.floor(id/GRID_W);
  const h=Math.hypot((x-gx)/GRID_W,(y-gy)/GRID_H);
  if(h<best){best=h;closest=id}
  if(id===goalId){closest=id;break}
  for(const [dx,dy] of dirs){
   const nx=x+dx,ny=y+dy;if(!pass(nx,ny))continue;
   if(dx&&dy&&(!pass(x+dx,y)||!pass(x,y+dy)))continue;
   const next=node(nx,ny),cost=Math.hypot(dx/GRID_W,dy/GRID_H);
   const g=score[id]+cost;
   if(g>=score[next])continue;
   score[next]=g;prev[next]=id;push(next,g+Math.hypot((nx-gx)/GRID_W,(ny-gy)/GRID_H));
  }
 }
 if(closest===startId)return [goal];
 const route=[];let id=closest;
 for(let k=0;k<count&&id!==startId&&id>=0;k++,id=prev[id])route.push(xy(id));
 route.reverse();
 // Coalesce grid steps into a compact set of waypoints; maintain turns.
 const compact=[];
 for(let i=0;i<route.length;i+=3)compact.push(route[i]);
 if(route.length)compact.push(route[route.length-1]);
 if(closest===goalId)compact.push(goal);
 return compact;
}
function setDestination(a,goal){
 a.route=pathTo({x:a.x,y:a.y},goal);
 const next=a.route.shift();
 if(next){a.tx=next.x;a.ty=next.y}
}
function ingest(s){if(!s)return;lastState=s;
 if(s.code!==currentRoom){actors.clear();bubbles.clear();seen.clear();spotlights.clear();currentRoom=s.code}
 const was=previousPhase;previousPhase=s.phase;
 for(const p of s.players||[]){const init=starts[(p.id-1)%starts.length];
 const spawn=clampGoal(Number.isFinite(p.mapX)?p.mapX:init[0],Number.isFinite(p.mapY)?p.mapY:init[1]);const x=spawn.x,y=spawn.y;
 let a=actors.get(p.id);if(!a){a={id:p.id,name:p.name,color:p.color||fallbackColors[(p.id-1)%11],x,y,tx:x,ty:y,alive:p.alive,isYou:p.isYou,dir:0,step:0,deathAt:null};actors.set(p.id,a)}
 else{a.name=p.name;a.color=p.color||fallbackColors[(p.id-1)%11];a.isYou=p.isYou;
 if(a.alive&&!p.alive){a.deathAt=performance.now();spotlights.set(p.id,performance.now()+4000);}a.alive=p.alive;
 if(!a.isYou){a.tx=x;a.ty=y}else if(!a.lastClick||Date.now()-a.lastClick>10000){a.tx=x;a.ty=y}}
 }
 for(const id of [...actors.keys()])if(!(s.players||[]).some(p=>p.id===id))actors.delete(id);
 for(const m of s.logs||[]){if(m.channel!=='all'||!m.id||seen.has(m.id))continue;
 seen.add(m.id);const match=String(m.from||'').match(/^(\d+)번/);
 if(match&&(s.phase==='day'||s.phase==='lobby'))bubbles.set(+match[1],{text:String(m.text||''),until:Date.now()+5200})}
 if(was==='night'&&s.phase==='day')for(const a of actors.values()){a.tx=a.x;a.ty=a.y}
}
if(typeof socket!=='undefined'){
 // Leaving a room must also clear the independent canvas renderer's cached actors.
 socket.on('leftRoom',()=>{
  actors.clear();bubbles.clear();seen.clear();spotlights.clear();
  currentRoom='';previousPhase='';lastState=null;lastSend=0;
 });
 socket.on('state',ingest);
 socket.on('deathSpotlight',p=>{if(Number.isFinite(p?.id))spotlights.set(p.id,performance.now()+4000)});
 socket.on('villagePosition',p=>{const a=actors.get(p.id);if(a&&!a.isYou&&Number.isFinite(p.x)&&Number.isFinite(p.y)){a.tx=p.x;a.ty=p.y}})
}
canvas.addEventListener('pointerdown',e=>{
 const s=stateNow();if(!s||!['day','lobby'].includes(s.phase)||!s.self?.alive)return;
 const r=canvas.getBoundingClientRect();let x=(e.clientX-r.left)/r.width;
 let y=(e.clientY-r.top)/r.height;
 const goal=clampGoal(x,y);const a=actors.get(s.self.id);if(!a)return;
 setDestination(a,goal);a.lastClick=Date.now();
});
function drawActor(a,t,night){const x=a.x*W,y=a.y*H,col=a.color;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(CHARACTER_ZOOM,CHARACTER_ZOOM);
 // Glowing ground rings: gold marks yourself, numbered color marks everyone else.
 if(a.alive){ctx.save();ctx.shadowColor=a.isYou?'#ffe47b':col;ctx.shadowBlur=night?(a.isYou?13:7):(a.isYou?27:13);
 ctx.beginPath();ctx.ellipse(0,-3,a.isYou?21:19,7,0,0,Math.PI*2);ctx.strokeStyle=a.isYou?'#ffe27b':col;ctx.lineWidth=night?(a.isYou?3:2):(a.isYou?4:3);ctx.stroke();ctx.restore();}
 else{ctx.fillStyle='#7e1828bb';ctx.beginPath();ctx.ellipse(0,-5,30,12,0,0,Math.PI*2);ctx.fill();}
 if(a.alive){ctx.save();ctx.globalAlpha=.27;ctx.beginPath();ctx.ellipse(2,-3,16,5,0,0,Math.PI*2);ctx.fillStyle='#07111b';ctx.fill();ctx.restore();}
 const walking=a.alive&&Math.hypot(a.tx-a.x,a.ty-a.y)>.003&&!night;
 if(sprites.complete&&sprites.naturalWidth){
 const direction=a.dir,frame=walking?Math.floor(a.step)%4:0;
 const sx=(direction*4+frame)*96,sy=((a.id-1)%11)*104;
 if(a.alive){ctx.imageSmoothingEnabled=false;
 ctx.save();ctx.filter=night?'brightness(0.64) saturate(0.72) sepia(0.12)':'none';ctx.shadowColor='#060a12';ctx.shadowBlur=5;ctx.drawImage(sprites,sx,sy,96,104,-45,-110+(walking?Math.sin(a.step*Math.PI/2)*2:0),90,114);ctx.restore();
 }else{
 ctx.save();ctx.globalAlpha=.9;ctx.filter=night?'brightness(0.64) saturate(0.72)':'none';
 const elapsed=a.deathAt===null?99999:performance.now()-a.deathAt;
 const deathFrame=Math.min(4,Math.floor(elapsed/230));
 if(deathSprites.complete&&deathSprites.naturalWidth){
  ctx.drawImage(deathSprites,deathFrame*96,sy,96,104,-45,-110,90,114);
 }else{ctx.translate(0,-8);ctx.rotate(Math.PI/2);ctx.drawImage(sprites,0,sy,96,104,-29,-37,58,80)}ctx.restore();
 }
 }else{box(-12,-56,24,40,5,col,'#22212a');circle(0,-60,13,'#e8b58f')}
 if(a.isYou&&a.alive){ctx.save();ctx.globalAlpha=.17+.08*Math.sin(t/240);circle(0,-51,29,'#ffec94');ctx.restore()}
 ctx.restore();

}
// Draw HUD text directly in screen coordinates, never inside the 80% camera transform.
// Source sprites have 37px of transparent top padding: visible head is about 60 world units above the feet.
function drawActorOverlay(a,night){
 const x=Math.round(a.x*W);
 const y=Math.round(a.y*H);
 const headY=y-Math.round(60*CHARACTER_ZOOM);
 const labelH=20, ly=headY-labelH-3; // 3px gap above visible hair
 const name=`${a.name}${a.isYou?' (나)':''}`;
 ctx.save();ctx.textBaseline='alphabetic';ctx.textAlign='center';
 ctx.font='700 11px system-ui, sans-serif';
 const width=Math.min(152,Math.max(72,Math.ceil(ctx.measureText(name).width)+38));
 box(Math.round(x-width/2),ly,width,labelH,6,a.alive?(night?'#0a1423f2':'#07111de9'):'#22252ce2',a.isYou?'#e8c778':'#7384998a');
 circle(Math.round(x-width/2)+11,ly+10,8,a.color);
 ctx.fillStyle='#101521';ctx.font='700 10px system-ui, sans-serif';
 ctx.fillText(a.id,Math.round(x-width/2)+11,ly+14);
 ctx.fillStyle=a.alive?(night?'#d5d8e4':'#fff7e8'):'#adb0b6';ctx.font='700 11px system-ui, sans-serif';
 ctx.fillText(name,x+10,ly+15);
 const b=bubbles.get(a.id);
 if(b&&b.until>Date.now()&&a.alive&&!night){
  const raw=String(b.text||'').replace(/\s+/g,' ').trim().slice(0,110);
  const lines=[];let line='';ctx.font='700 10.5px system-ui, sans-serif';
  for(const ch of [...raw]){if(ctx.measureText(line+ch).width>168&&line){lines.push(line);line=ch}else line+=ch;if(lines.length>=2)break}
  if(line&&lines.length<3)lines.push(line);
  if(lines.length===3&&raw.length>lines.join('').length)lines[2]=lines[2].slice(0,-1)+'…';
  const bw=Math.max(88,Math.min(200,Math.ceil(Math.max(...lines.map(t=>ctx.measureText(t).width),0))+26));
  const bh=11+lines.length*15,bx=Math.round(Math.max(6,Math.min(W-bw-6,x-bw/2)));
  const by=Math.round(Math.max(5,ly-bh-15));
  ctx.save();ctx.shadowColor='#000b';ctx.shadowBlur=12;ctx.shadowOffsetY=3;
  box(bx,by,bw,bh,10,'#fffdf4','#17233a');ctx.restore();
  ctx.save();ctx.lineWidth=2;ctx.strokeStyle=a.isYou?'#ffcf5b':a.color;
  ctx.beginPath();ctx.roundRect(bx+2,by+2,bw-4,bh-4,6);ctx.stroke();
  ctx.fillStyle='#fffdf4';ctx.beginPath();const tip=Math.max(bx+14,Math.min(bx+bw-14,x));
  ctx.moveTo(tip-7,by+bh-2);ctx.lineTo(tip+7,by+bh-2);ctx.lineTo(tip,by+bh+9);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#17233a';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(tip-7,by+bh-2);ctx.lineTo(tip,by+bh+9);ctx.lineTo(tip+7,by+bh-2);ctx.stroke();
  ctx.fillStyle='#15202f';ctx.textAlign='center';ctx.font='700 10.5px system-ui, sans-serif';
  lines.forEach((text,i)=>ctx.fillText(text,bx+bw/2,by+16+i*15));ctx.restore();
 }
 ctx.restore();
}
function frame(t){const s=stateNow(),night=s?.phase==='night',locked=night||s?.phase==='ended';const dt=Math.min(40,t-lastTick);lastTick=t;
 ctx.clearRect(0,0,W,H);
 // Expanded art fills the entire canvas, without blur or empty margins.
 if(background.complete&&background.naturalWidth){ctx.drawImage(background,0,0,background.naturalWidth,background.naturalHeight,0,0,W,H)}
 else{ctx.fillStyle='#302c30';ctx.fillRect(0,0,W,H)}
 ctx.save(); // Actor positions now align 1:1 with the background collision mask.
 // Subtle scene grading and vignetting, without covering the characters.
 const grad=ctx.createRadialGradient(W*.5,H*.52,H*.12,W*.5,H*.48,W*.69);grad.addColorStop(0,'#00000000');grad.addColorStop(1,'#07101a75');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 for(const a of actors.values()){
 if(!locked&&a.alive){const dx=a.tx-a.x,dy=a.ty-a.y,dist=Math.hypot(dx,dy);
 if(dist<=.002&&a.route?.length){const next=a.route.shift();a.tx=next.x;a.ty=next.y}
 if(dist>.002){const speed=dt*.00015,step=Math.min(speed,dist),nx=a.x+dx/dist*step,ny=a.y+dy/dist*step;
 if(walkable(nx,ny)){a.x=nx;a.y=ny;a.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?2:1):(dy>0?0:3);a.step+=dt/125}
 else{
  // Slide along walkable edges without crossing parapets or water.
  const sx=a.x+Math.sign(dx)*step,sy=a.y+Math.sign(dy)*step;
  if(walkable(sx,a.y)){a.x=sx;a.dir=dx>0?2:1;a.step+=dt/125}
  else if(walkable(a.x,sy)){a.y=sy;a.dir=dy>0?0:3;a.step+=dt/125}
  else{a.tx=a.x;a.ty=a.y;a.route=[]}
 }
 if(a.isYou&&t-lastSend>145&&typeof socket!=='undefined'){socket.emit('villageMove',{x:a.x,y:a.y});lastSend=t}
 }}
 }
 // Darkness is drawn over the scenery but BEFORE players to keep sprites legible.

 // Death reveal: preserve the scenery, dim it moderately, then cast a cool-white
 // theatrical cone and a warm ground pool onto each fallen player.
 for(const [id,until] of spotlights){if(t>until)spotlights.delete(id);}
 const lit=[...spotlights.entries()].map(([id,until])=>({actor:actors.get(id),until})).filter(x=>x.actor);
 if(lit.length){
  // Apply dimming only to the scenery; actors and their labels stay legible.
  const latest=Math.max(...lit.map(x=>x.until));
  const fade=Math.min(1,(latest-t)/650);
  ctx.save();ctx.fillStyle=`rgba(7,13,25,${(.34*Math.max(0,fade)).toFixed(3)})`;ctx.fillRect(0,0,W,H);
  for(const {actor:a,until} of lit){
   const x=a.x*W, feet=a.y*H, groundY=feet-18;
   const strength=Math.max(0,Math.min(1,(until-t)/600));
   const topY=Math.max(-75,groundY-255), topHalf=13, bottomHalf=65;
   // Soft-edged trapezoidal shaft, fading from the overhead light source.
   ctx.save();ctx.globalAlpha=.70*strength;
   const shaft=ctx.createLinearGradient(x,topY,x,groundY);
   shaft.addColorStop(0,'rgba(231,244,255,.18)');
   shaft.addColorStop(.38,'rgba(217,237,255,.21)');
   shaft.addColorStop(1,'rgba(255,250,224,.32)');
   ctx.fillStyle=shaft;ctx.beginPath();ctx.moveTo(x-topHalf,topY);ctx.lineTo(x+topHalf,topY);
   ctx.lineTo(x+bottomHalf,groundY);ctx.lineTo(x-bottomHalf,groundY);ctx.closePath();ctx.fill();
   const core=ctx.createLinearGradient(x,topY,x,groundY);
   core.addColorStop(0,'rgba(255,255,255,.20)');core.addColorStop(1,'rgba(255,255,255,.10)');
   ctx.fillStyle=core;ctx.beginPath();ctx.moveTo(x-6,topY);ctx.lineTo(x+6,topY);
   ctx.lineTo(x+25,groundY);ctx.lineTo(x-25,groundY);ctx.closePath();ctx.fill();
   const halo=ctx.createRadialGradient(x,groundY,5,x,groundY,98);
   halo.addColorStop(0,'rgba(255,250,223,.63)');halo.addColorStop(.5,'rgba(255,242,203,.31)');
   halo.addColorStop(1,'rgba(255,239,194,0)');
   ctx.fillStyle=halo;ctx.beginPath();ctx.ellipse(x,groundY,99,58,0,0,Math.PI*2);ctx.fill();
   ctx.restore();
  }
  ctx.restore();
 }
 for(const a of [...actors.values()].sort((a,b)=>a.y-b.y))drawActor(a,t,night);
 if(s?.phase==='ended'&&!lit.length){ctx.fillStyle='#07101b55';ctx.fillRect(0,0,W,H)}


 ctx.restore();
 // Full-viewport night shading after camera restoration.
 if(night){ctx.save();ctx.fillStyle='rgba(7,20,42,.69)';ctx.fillRect(0,0,W,H);ctx.restore()}
 // Labels are drawn at device-pixel resolution after the scene camera has been restored.
 for(const a of [...actors.values()].sort((a,b)=>a.y-b.y))drawActorOverlay(a,night);
 requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();
