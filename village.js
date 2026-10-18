/* LUPUS IN TABULA v3.3: expanded navigation + high-detail animated sprites + dynamic color-matched animated player sprites.
   Rendering only: voting, role logic, chats and timers remain in the original game. */
(()=>{'use strict';
const canvas=document.getElementById('villageCanvas');if(!canvas)return;
const ctx=canvas.getContext('2d'),W=1200,H=550,RENDER_SCALE=Math.min(2,Math.max(1,window.devicePixelRatio||1));canvas.width=Math.round(W*RENDER_SCALE);canvas.height=Math.round(H*RENDER_SCALE);ctx.setTransform(RENDER_SCALE,0,0,RENDER_SCALE,0,0);
// FINAL 2.5: approved original-resolution lossless scenery, 80% camera, 85% characters, 90% nameplates.
const CAMERA_ZOOM=.80, CHARACTER_ZOOM=.85, NAMEPLATE_ZOOM=.90;
const CAMERA_OFFSET_X=W*(1-CAMERA_ZOOM)/2, CAMERA_OFFSET_Y=H*(1-CAMERA_ZOOM)/2;
const background=new Image();background.src='/village_final25_crisp.png?v=2.5';
const sprites=new Image();sprites.src='/village_characters_user.png?v=graphics7-original';
const deathSprites=new Image();deathSprites.src='/village_characters_death.png?v=graphics7-original';
const actors=new Map(),bubbles=new Map(),seen=new Set(),spotlights=new Map();
let currentRoom='',previousPhase='',lastSend=0,lastTick=performance.now(),lastState=null;
const fallbackColors=['#e35d6a','#5bb4e8','#b8d75a','#b28ae8','#f0c45a','#75d5c5','#f49b50','#ee78b8','#a7b6c8','#4e88f0','#9d86ee'];
const starts=[[.35,.47],[.24,.60],[.62,.47],[.79,.59],[.85,.77],[.35,.76],[.64,.65],[.48,.85],[.61,.85],[.79,.83],[.18,.79]];
function stateNow(){return typeof state!=='undefined'&&state?state:lastState}
function box(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1.6;ctx.stroke()}}
function circle(x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill()}
// Expanded accessible plaza; only the fountain is a hard obstacle.
const NAV={minX:.055,maxX:.955,minY:.265,maxY:.945,cx:.50,cy:.525,rx:.127,ry:.165};
function walkable(x,y){
 if(x<NAV.minX||x>NAV.maxX||y<NAV.minY||y>NAV.maxY)return false;
 const dx=(x-NAV.cx)/NAV.rx,dy=(y-NAV.cy)/NAV.ry;
 return dx*dx+dy*dy>=1;
}
function clampGoal(x,y){
 x=Math.max(NAV.minX,Math.min(NAV.maxX,x));y=Math.max(NAV.minY,Math.min(NAV.maxY,y));
 if(!walkable(x,y)){
  const dx=(x-NAV.cx)/NAV.rx,dy=(y-NAV.cy)/NAV.ry;
  const angle=Math.atan2(dy||.0001,dx||.0001);
  x=NAV.cx+(NAV.rx+.012)*Math.cos(angle);
  y=NAV.cy+(NAV.ry+.012)*Math.sin(angle);
 }
 return {x,y};
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
 const r=canvas.getBoundingClientRect();let x=((e.clientX-r.left)/r.width*W-CAMERA_OFFSET_X)/(W*CAMERA_ZOOM);
 let y=((e.clientY-r.top)/r.height*H-CAMERA_OFFSET_Y)/(H*CAMERA_ZOOM);
 const goal=clampGoal(x,y);const a=actors.get(s.self.id);if(!a)return;
 a.tx=goal.x;a.ty=goal.y;a.lastClick=Date.now();
});
function drawActor(a,t,night){const x=a.x*W,y=a.y*H,col=a.color;
 ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(CHARACTER_ZOOM/CAMERA_ZOOM,CHARACTER_ZOOM/CAMERA_ZOOM);
 // Glowing ground rings: gold marks yourself, numbered color marks everyone else.
 if(a.alive){ctx.save();ctx.shadowColor=a.isYou?'#ffe47b':col;ctx.shadowBlur=night?(a.isYou?13:7):(a.isYou?27:13);
 ctx.beginPath();ctx.ellipse(0,9,a.isYou?26:23,9,0,0,Math.PI*2);ctx.strokeStyle=a.isYou?'#ffe27b':col;ctx.lineWidth=night?(a.isYou?3:2):(a.isYou?4:3);ctx.stroke();ctx.restore();}
 else{ctx.fillStyle='#7e1828bb';ctx.beginPath();ctx.ellipse(0,-5,30,12,0,0,Math.PI*2);ctx.fill();}
 if(a.alive){ctx.save();ctx.globalAlpha=.27;ctx.beginPath();ctx.ellipse(2,9,19,6,0,0,Math.PI*2);ctx.fillStyle='#07111b';ctx.fill();ctx.restore();}
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
 // Nameplates are separated from artwork and therefore never remain baked into the scene.
 // Nameplates are 90% of the original on-screen size, independent of camera zoom.
 ctx.save();ctx.translate(x,y);ctx.scale(NAMEPLATE_ZOOM/CAMERA_ZOOM,NAMEPLATE_ZOOM/CAMERA_ZOOM);ctx.translate(-x,-y);
 const name=`${a.name}${a.isYou?' (나)':''}`;
 ctx.font='bold 14px system-ui,sans-serif';const width=Math.min(180,Math.max(85,ctx.measureText(name).width+44));
 const ly=y-94; // Align label with visible head, accounting for transparent sprite-cell top margin
 box(x-width/2,ly,width,25,7,a.alive?(night?'#0a1423f2':'#07111de9'):'#22252ce2',a.isYou?'#e8c778':'#7384998a');
 circle(x-width/2+14,ly+12.5,10,col);
 ctx.fillStyle='#101521';ctx.textAlign='center';ctx.font='bold 12px system-ui';ctx.fillText(a.id,x-width/2+14,ly+16.7);
 ctx.fillStyle=a.alive?(night?'#d5d8e4':'#fff7e8'):'#adb0b6';ctx.font='bold 14px system-ui';ctx.fillText(name,x+12,ly+17);
 const b=bubbles.get(a.id);
 if(b&&b.until>Date.now()&&a.alive&&!night){
  const raw=String(b.text||'').replace(/\s+/g,' ').trim().slice(0,110);
  const lines=[];let line='';ctx.font='bold 13px system-ui,sans-serif';
  for(const ch of [...raw]){if(ctx.measureText(line+ch).width>218&&line){lines.push(line);line=ch}else line+=ch;if(lines.length>=2)break}
  if(line&&lines.length<3)lines.push(line);
  if(lines.length===3&&raw.length>lines.join('').length)lines[2]=lines[2].slice(0,-1)+'…';
  const bw=Math.max(110,Math.min(250,Math.max(...lines.map(t=>ctx.measureText(t).width),0)+42));
  const bh=16+lines.length*19;const bx=Math.max(6,Math.min(W-bw-6,x-bw/2));const by=Math.max(5,ly-bh-18);
  ctx.save();ctx.shadowColor='#000b';ctx.shadowBlur=15;ctx.shadowOffsetY=4;
  box(bx,by,bw,bh,12,'#fffdf4','#17233a');ctx.restore();
  ctx.save();ctx.lineWidth=3;ctx.strokeStyle=a.isYou?'#ffcf5b':a.color;ctx.beginPath();ctx.roundRect(bx+2,by+2,bw-4,bh-4,10);ctx.stroke();
  ctx.fillStyle='#fffdf4';ctx.beginPath();const tip=Math.max(bx+14,Math.min(bx+bw-14,x));ctx.moveTo(tip-8,by+bh-2);ctx.lineTo(tip+8,by+bh-2);ctx.lineTo(tip,by+bh+11);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#17233a';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(tip-8,by+bh-2);ctx.lineTo(tip,by+bh+11);ctx.lineTo(tip+8,by+bh-2);ctx.stroke();
  ctx.fillStyle='#15202f';ctx.textAlign='center';ctx.font='bold 13px system-ui,sans-serif';
  lines.forEach((text,i)=>ctx.fillText(text,bx+bw/2,by+22+i*19));ctx.restore();
 }

 ctx.restore();
}
function frame(t){const s=stateNow(),night=s?.phase==='night',locked=night||s?.phase==='ended';const dt=Math.min(40,t-lastTick);lastTick=t;
 ctx.clearRect(0,0,W,H);
 // Expanded art fills the entire canvas, without blur or empty margins.
 if(background.complete&&background.naturalWidth){ctx.drawImage(background,0,0,background.naturalWidth,background.naturalHeight,0,0,W,H)}
 else{ctx.fillStyle='#302c30';ctx.fillRect(0,0,W,H)}
 ctx.save();ctx.translate(CAMERA_OFFSET_X,CAMERA_OFFSET_Y);ctx.scale(CAMERA_ZOOM,CAMERA_ZOOM);
 // Subtle scene grading and vignetting, without covering the characters.
 const grad=ctx.createRadialGradient(W*.5,H*.52,H*.12,W*.5,H*.48,W*.69);grad.addColorStop(0,'#00000000');grad.addColorStop(1,'#07101a75');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 for(const a of actors.values()){
 if(!locked&&a.alive){const dx=a.tx-a.x,dy=a.ty-a.y,dist=Math.hypot(dx,dy);
 if(dist>.002){const speed=dt*.00015,step=Math.min(speed,dist),nx=a.x+dx/dist*step,ny=a.y+dy/dist*step;
 if(walkable(nx,ny)){a.x=nx;a.y=ny;a.dir=Math.abs(dx)>Math.abs(dy)?(dx>0?2:1):(dy>0?0:3);a.step+=dt/125}
 else{
  // Slide along the fountain perimeter instead of getting permanently stuck.
  const rx=(a.x-NAV.cx)/NAV.rx,ry=(a.y-NAV.cy)/NAV.ry;
  const tangentX=-ry*NAV.rx,tangentY=rx*NAV.ry;
  const dot=tangentX*dx+tangentY*dy,sign=dot>=0?1:-1;
  const norm=Math.hypot(tangentX,tangentY)||1;
  const px=a.x+sign*tangentX/norm*step,py=a.y+sign*tangentY/norm*step;
  if(walkable(px,py)){a.x=px;a.y=py;a.dir=Math.abs(tangentX)>Math.abs(tangentY)?(sign*tangentX>0?2:1):(sign*tangentY>0?0:3);a.step+=dt/125}
  else{const escape=clampGoal(a.x,a.y);a.x=escape.x;a.y=escape.y;}
 }
 if(a.isYou&&t-lastSend>145&&typeof socket!=='undefined'){socket.emit('villageMove',{x:a.x,y:a.y});lastSend=t}
 }}
 }
 // Darkness is drawn over the scenery but BEFORE players to keep sprites legible.
 if(night){ctx.fillStyle='#07142ac5';ctx.fillRect(0,0,W,H);
 const glow=ctx.createRadialGradient(280,155,10,280,155,430);glow.addColorStop(0,'#ffc77b25');glow.addColorStop(1,'#0000');ctx.fillStyle=glow;ctx.fillRect(0,0,W,H)}
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


 ctx.restore();requestAnimationFrame(frame)}requestAnimationFrame(frame);
})();
