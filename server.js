const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;
const DAY_MS=120_000, NIGHT_MS=60_000, POST_VOTE_MS=10_000;
app.use(express.static('public'));
app.get('/health', (_, res) => res.json({ ok: true, game: 'Lupus In Tabula' }));
const rooms = new Map();
const ROLE = {
 wolf:{name:'늑대',team:'wolf'}, hench:{name:'똘마니',team:'wolf'}, seer:{name:'예언자',team:'town'}, guard:{name:'보디가드',team:'town'}, medium:{name:'영매',team:'town'}, tracker:{name:'추격자',team:'town'}, watcher:{name:'감시자',team:'town'}, heir:{name:'후계자',team:'town'}, veteran:{name:'퇴역군인',team:'town'}, fanatic:{name:'광신도',team:'town'}, citizen:{name:'시민',team:'town'}
};
const COLORS=['#e35d6a','#5bb4e8','#b8d75a','#b28ae8','#f0c45a','#75d5c5','#f49b50','#ee78b8','#a7b6c8','#4e88f0','#9d86ee'];
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function roleSet(n){
 let r=['wolf','wolf','seer','guard','medium','tracker','veteran','fanatic'];
 if(n===11)r.push('hench','watcher','heir');
 if(n===10)r.push('hench','watcher');
 if(n===9)r.push('heir');
 if(n===8)r.push('citizen');
 if(n===7)r=['wolf','wolf','seer','guard','medium','veteran','fanatic'];
 if(n===6)r=['wolf','seer','guard','medium','veteran','fanatic'];
 if(n===5)r=['wolf','seer','medium','veteran','fanatic'];
 while(r.length<n)r.push('citizen'); return shuffle(r.slice(0,n));
}
function log(room, channel, text, to=null){room.logs.push({id:crypto.randomUUID(),channel,text,to,at:Date.now()}); if(room.logs.length>300)room.logs.shift();}
function living(room){return room.players.filter(p=>p.alive);}
function remember(p,night,target,result,kind='조사'){
 p.intel ||= [];
 p.intel.push({night,target,kind,result});
 if(p.intel.length>100)p.intel.shift();
}
function wolfAllies(room,p){
 if(p.role==='wolf')return room.players.filter(x=>x.role==='wolf').map(x=>x.id);
 if(p.role==='hench'&&p.foundWolves?.length)return room.players.filter(x=>x.role==='wolf').map(x=>x.id);
 return [];
}
function knownLabel(room,viewer,target){
 if(room.phase==='ended')return ROLE[target.role].name;
 if(viewer.id===target.id)return viewer.role==='heir'&&viewer.inheritedRole?'후계자 - '+ROLE[viewer.inheritedRole].name:(ROLE[target.role]?.name||'');
 if(viewer.role==='hench'&&target.team==='town'&&!target.alive)return ROLE[target.role].name;
 if(viewer.role==='wolf'&&target.role==='hench'&&target.foundWolves?.length)return '똘마니 (동맹)';
 if(wolfAllies(room,viewer).includes(target.id))return '늑대인간 (동맹)';
 return viewer.knownRoles?.[target.id]||'';
}

function activeRole(p){return p.role==='heir'&&p.inheritedRole?p.inheritedRole:p.role;}
function attemptInheritance(room){
 if(living(room).length!==7)return;
 const deadTown=room.deaths?.find(x=>x.team==='town'&&x.role!=='heir');
 if(!deadTown)return;
 for(const p of living(room).filter(x=>x.role==='heir'&&!x.inheritedRole)){
  p.inheritedRole=deadTown.role;
  remember(p,room.night,deadTown.id,'후계자 - '+ROLE[deadTown.role].name,'직업 승계');
  log(room,'private',`생존자가 7명이 되어 ${ROLE[deadTown.role].name} 직업을 계승했습니다.`,p.id);
 }
}
function pubPlayer(p, viewer, room){const self=p.id===viewer.id;const revealed=room.phase==='ended';return {id:p.id,name:p.name,color:p.color,alive:p.alive,ready:p.ready,isYou:self,role:revealed?p.role:null,roleName:revealed?ROLE[p.role].name:null,knownLabel:knownLabel(room,viewer,p),team:(self||revealed)?p.team:null,hasVoted:!!room.votes[p.id],vote:room.voteClosed?room.votes[p.id]??null:undefined};}
function isAttackingWolf(room,p){
 const wolves=living(room).filter(x=>x.role==='wolf');
 return wolves.length===1?wolves[0].id===p.id: wolves.length>1&&wolves.find(x=>x.wolfNo===(room.night%2===1?1:2))?.id===p.id;
}
function stateFor(room, viewer){
 const wolves=viewer.role==='wolf' ? room.players.filter(p=>p.role==='wolf').map(p=>({id:p.id,name:p.name})) : [];
 const foundWolves=viewer.foundWolves||[];
 const logs=room.logs.filter(m=>{
  if(m.channel==='all')return true;
  if(m.channel==='private')return m.to===viewer.id;
  if(m.channel==='wolf')return viewer.role==='wolf'||(viewer.role==='hench'&&foundWolves.length>0);
  if(m.channel==='ghost')return !viewer.alive;
  if(m.channel==='whisper')return m.to===viewer.id||m.from===viewer.id;
  return false;
 }).map(m=>({id:m.id||`${m.at}-${m.channel}-${m.text}`,channel:m.channel,text:m.text,at:m.at,from:m.fromName||'SYSTEM'}));
 return {code:room.code,hostId:room.hostId,phase:room.phase,day:room.day,night:room.night,rule:room.rule,deadline:room.deadline,players:room.players.map(p=>pubPlayer(p,viewer,room)),self:{id:viewer.id,name:viewer.name,role:activeRole(viewer),baseRole:viewer.role,roleName:viewer.role ? (viewer.inheritedRole?'후계자 - '+ROLE[viewer.inheritedRole].name:ROLE[viewer.role].name) : null,team:viewer.team,alive:viewer.alive,usedRip:viewer.usedRip,foundWolves,intel:viewer.intel||[],nightDone:!!room.nightActions[viewer.id]?.done,henchJoined:viewer.role==='hench'&&!!viewer.foundWolves?.length,canWolfAttack:viewer.role==='wolf'&&isAttackingWolf(room,viewer)},knownWolves:wolves,logs,votesCast:Object.keys(room.votes).length,voteTally: tally(room),voteClosed:room.voteClosed,closeRequests:room.closeRequests?.length||0,closeRequested:room.closeRequests?.includes(viewer.id)||false,extendedToday:room.extendedToday?.includes(viewer.id)||false,public:room.public,winner:room.winner,notice:room.notice};
}
function tally(room){const counts={};for(const p of living(room))counts[p.id]=0;for(const [v,t] of Object.entries(room.votes)){if(t>0&&counts[t]!==undefined)counts[t]++;}return counts;}
function emitRoom(room){for(const p of room.players){const s=io.sockets.sockets.get(p.socketId);if(s)s.emit('state',stateFor(room,p));}}
function broadcast(room, channel, text, to=null, from=null){room.logs.push({id:crypto.randomUUID(),channel,text,to,from,fromName:from?room.players.find(p=>p.id===from)?.name:null,at:Date.now()});if(room.logs.length>300)room.logs.shift();emitRoom(room);}
function cancelTimer(room){if(room.timer){clearTimeout(room.timer);room.timer=null;}}
function scheduleDayEnd(room){
 cancelTimer(room);
 const ms=Math.max(0,room.deadline-Date.now());
 room.timer=setTimeout(()=>{if(room.phase==='day'&&!room.voteClosed)closeVote(room,true)},ms);
}
function scheduleNightEnd(room){
 cancelTimer(room);
 const ms=Math.max(0,room.deadline-Date.now());
 room.timer=setTimeout(()=>{if(room.phase==='night')resolveNight(room)},ms);
}
function playForRoom(room,type){io.to(room.code).emit('soundEffect',{type,at:Date.now()});}

function makeRoom(socket,name){let code;do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));const p={id:1,socketId:socket.id,name:name.slice(0,16)||'방랑자',color:COLORS[0],alive:true,ready:false,role:null,team:null,usedRip:false,veteranSave:true,foundWolves:[],intel:[],knownRoles:{}};const room={code,hostId:socket.id,players:[p],phase:'lobby',day:0,night:0,rule:'basic',logs:[],votes:{},voteClosed:false,deadline:null,timer:null,nightActions:{},extendedToday:[],closeRequests:[],deaths:[],public:[],winner:null,notice:'방이 생성되었습니다. 방 코드를 친구에게 공유하세요.'};rooms.set(code,room);socket.join(code);socket.data.room=code;socket.data.playerId=1;emitRoom(room);return room;}
function getRoom(socket){const code=socket.data.room;return code?rooms.get(code):null;}
function getPlayer(room,socket){return room?.players.find(p=>p.socketId===socket.id);}
function clearRoomTimers(room){cancelTimer(room);}
function enterDay(room){
 cancelTimer(room);room.phase='day';room.day=Math.max(1,room.day+1);
 room.voteClosed=false;room.votes={};room.closeRequests=[];room.extendedToday=[];
 room.deadline=Date.now()+DAY_MS;
 room.notice=`${room.day}일차 낮입니다. 기본 토론 시간은 2분입니다.`;
 room.nightActions={};emitRoom(room);playForRoom(room,'day');scheduleDayEnd(room);
}
function enterNight(room){
 cancelTimer(room);room.phase='night';room.night++;
 room.deadline=Date.now()+NIGHT_MS;room.nightActions={};
 room.notice=`${room.night}번째 밤입니다. 1분 안에 능력을 사용하세요.`;
 room.players.forEach(p=>p.protected=false);
 const wolves=living(room).filter(p=>p.role==='wolf');
 if(wolves.length>1){const activeNo=room.night%2===1?1:2;wolves.filter(p=>p.wolfNo!==activeNo).forEach(p=>room.nightActions[p.id]={done:true,skip:true});}
 emitRoom(room);playForRoom(room,'night');scheduleNightEnd(room);
}
function closeVote(room,timeout=false){
 if(room.phase!=='day'||room.voteClosed)return;
 cancelTimer(room);room.voteClosed=true;
 const counts=tally(room);let max=0,leaders=[];
 for(const [id,n] of Object.entries(counts)){
  if(n>max){max=n;leaders=[+id]}else if(n===max&&n>0)leaders.push(+id);
 }
 if(leaders.length===1){
  const victim=room.players.find(p=>p.id===leaders[0]);
  if(victim){const first=Object.entries(room.votes).find(([v,t])=>t===victim.id);
   kill(room,victim,'vote',first?+first[0]:null);
   room.notice=`${victim.name}이(가) 최다 득표했습니다.`;
  }
 }else room.notice=timeout?'투표 시간이 종료되었습니다. 처형은 없습니다.':'투표가 마감되었습니다. 동률 또는 무효 투표로 처형이 없습니다.';
 // The last wolf's execution must finish immediately, without the post-vote delay.
 checkWin(room);
 if(room.phase==='ended')return;
 room.deadline=Date.now()+POST_VOTE_MS;
 room.notice+=' 10초 후 밤이 시작됩니다.';
 emitRoom(room);
 room.timer=setTimeout(()=>{if(room.phase==='day'&&room.voteClosed)enterNight(room)},POST_VOTE_MS);
}
function kill(room,p,how,firstVoter){if(!p||!p.alive)return;p.alive=false;room.deaths ||= [];room.deaths.push({id:p.id,role:p.role,team:p.team});log(room,'all',`${p.id}번 ${p.name}이(가) ${how==='vote'?'투표로 처형되었습니다.':'밤에 사망했습니다.'}`);if(how==='vote'&&p.role==='fanatic'&&firstVoter){const v=room.players.find(x=>x.id===firstVoter);if(v&&v.alive){v.alive=false;room.deaths.push({id:v.id,role:v.role,team:v.team});log(room,'all',`광신도의 저주! 최초 투표자 ${v.id}번 ${v.name}도 함께 사망했습니다.`)}}attemptInheritance(room);}
function checkWin(room){if(room.phase==='ended')return;const alive= living(room);const wolves=alive.filter(p=>p.role==='wolf').length;const wolfTeam=alive.filter(p=>p.team==='wolf').length;const town=alive.filter(p=>p.team==='town').length;if(wolves===0){finish(room,'시민팀')}else if(wolfTeam>=town){finish(room,'늑대팀')}}
function finish(room,winner){cancelTimer(room);room.phase='ended';room.winner=winner;room.deadline=null;room.notice=`${winner} 승리! 모든 플레이어의 직업이 공개되었습니다.`;log(room,'all',room.notice);emitRoom(room);}
function allNightDone(room){const livingPlayers=living(room);const actionable=livingPlayers.filter(p=>['wolf','seer','guard','medium','tracker','watcher','hench'].includes(activeRole(p))&&!(p.role==='hench'&&p.foundWolves?.length));return actionable.every(p=>room.nightActions[p.id]?.done);}
function resolveNight(room){if(room.phase!=='night')return;cancelTimer(room);let wolves=living(room).filter(p=>p.role==='wolf');let attacker=null;if(wolves.length===1)attacker=wolves[0];else if(wolves.length>1){const turn=room.night%2===1?1:2;attacker=wolves.find(p=>p.wolfNo===turn)||wolves[0];}
 let targetId=null,rip=false;if(attacker){const action=room.nightActions[attacker.id];if(action?.target) {targetId=action.target;rip=!!action.rip}}
 let attackedVictim=null,attackSucceeded=false;if(targetId){const target=room.players.find(p=>p.id===targetId&&p.alive);if(target){attackedVictim=target.id;if(target.protected&&!rip){if(room.rule!=='chaos'){playForRoom(room,'saved');log(room,'all','보디가드의 보호로 누군가 늑대의 공격에서 살아남았습니다.')}}else if(target.role==='veteran'&&target.veteranSave&&!rip){target.veteranSave=false;if(room.rule!=='chaos'){playForRoom(room,'honor');log(room,'all','퇴역군인이 늑대의 공격을 버텼습니다.')}}else {kill(room,target,'night');attackSucceeded=true;playForRoom(room,rip?'rip':'scratch')}}}
 if(room.rule==='chaos'&&!attackSucceeded)log(room,'all','오늘 밤에는 아무도 죽지 않았습니다.');
 for(const tracker of room.players.filter(x=>activeRole(x)==='tracker'&&x.alive)){
 const action=room.nightActions[tracker.id];
 if(!action?.done||!action.target)continue;
 const hit=attackSucceeded&&!rip&&action.target===attackedVictim;
 const result=hit&&attacker?`공격한 늑대 ${attacker.id}번`:'늑대 공격자 확인 실패';
 remember(tracker,room.night,action.target,result,'추격');
 if(hit&&attacker)tracker.knownRoles[attacker.id]='늑대인간';
 log(room,'private',`추격 결과: ${action.target}번 — ${result}.`,tracker.id);
 }
 for(const p of room.players){p.protected=false;}
 checkWin(room);if(room.phase!=='ended')enterDay(room);
}
function nightAction(socket, data){const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.phase!=='night'||!p.alive)return socket.emit('errorMessage','지금은 밤 행동을 할 수 없습니다.');if(room.nightActions[p.id]?.done)return socket.emit('errorMessage','이번 밤의 행동은 이미 완료했습니다.');if(p.role==='hench'&&p.foundWolves?.length)return socket.emit('errorMessage','동맹에 합류한 똘마니는 추가 탐색을 하지 않습니다.');const role=activeRole(p);const target=room.players.find(x=>x.id===Number(data.target));if(!target)return socket.emit('errorMessage','대상을 찾을 수 없습니다.');
 if(['seer','guard','tracker','watcher','wolf','hench'].includes(role)&&(!target.alive||target.id===p.id))return socket.emit('errorMessage','살아있는 다른 플레이어를 선택하세요.');if(role==='medium'&&target.alive)return socket.emit('errorMessage','영매는 사망한 플레이어를 선택해야 합니다.');
 const action={done:true,target:target.id};
 if(p.role==='wolf'){const wolves=living(room).filter(x=>x.role==='wolf');if(wolves.length>1){const activeNo=room.night%2===1?1:2;if(p.wolfNo!==activeNo)return socket.emit('errorMessage',`이번 밤은 늑대 ${activeNo}번의 공격 차례입니다.`)}action.rip=!!data.rip&&!p.usedRip;if(action.rip)p.usedRip=true;log(room,'wolf',`늑대 ${p.wolfNo}번이 ${target.id}번에게 ${action.rip?'참살':'일반 공격'}을 지정했습니다.`);for(const ally of room.players.filter(x=>x.role==='wolf'||(x.role==='hench'&&x.foundWolves?.length)))remember(ally,room.night,target.id,`늑대 ${p.wolfNo}번 · ${action.rip?'참살':'일반 공격'}`,'동맹 공격')}
 else if(role==='guard'){target.protected=true;remember(p,room.night,target.id,'보호 대상으로 지정','보호')}
 else if(role==='seer'){
 const result=target.role==='wolf'?'늑대인간':'늑대인간 아님';
 remember(p,room.night,target.id,result,'예언');
 p.knownRoles[target.id]=result;
 log(room,'private',`예언 결과: ${target.id}번은 ${result}.`,p.id);
}
 else if(role==='watcher'){
 const result=target.role==='hench'?'똘마니':'똘마니 아님';
 remember(p,room.night,target.id,result,'감시');
 p.knownRoles[target.id]=result;
 log(room,'private',`감시 결과: ${target.id}번은 ${result}.`,p.id);
}
 else if(p.role==='hench'){if(target.role==='wolf'){p.foundWolves=[...new Set([...p.foundWolves,target.id])];remember(p,room.night,target.id,'늑대인간 발견 · 동맹 합류','탐색');
 for(const w of room.players.filter(x=>x.role==='wolf'))for(const rec of (w.intel||[]).filter(x=>x.kind==='동맹 공격'))if(!p.intel.some(x=>x.kind===rec.kind&&x.night===rec.night&&x.target===rec.target))p.intel.push({...rec});log(room,'private',`찾았습니다! ${target.id}번 ${target.name}은 늑대입니다. 동맹 대화가 열렸습니다.`,p.id);log(room,'wolf',`똘마니 ${p.id}번이 늑대 ${target.id}번을 찾아 동맹에 합류했습니다.`)}else {remember(p,room.night,target.id,'늑대인간 아님','탐색');log(room,'private',`조사 결과: ${target.id}번은 늑대가 아닙니다.`,p.id)}}
 else if(role==='medium'){const category=target.team==='wolf'?(target.role==='hench'?'평범한 시민':'늑대'):(['seer','guard'].includes(target.role)?'예언자/보디가드':'평범한 시민팀');remember(p,room.night,target.id,category,'영매');p.knownRoles[target.id]=category;log(room,'private',`영매 결과: ${target.id}번은 ${category}입니다.`,p.id)}
 else if(role==='tracker'){log(room,'private',`추적 대상: ${target.id}번. 결과는 밤이 끝나면 개인 기록에 남습니다.`,p.id)}
 room.nightActions[p.id]=action;emitRoom(room);if(allNightDone(room)){emitRoom(room);setTimeout(()=>resolveNight(room),700)} }
io.on('connection',socket=>{
 socket.on('createRoom',({name})=>{const room=makeRoom(socket,String(name||'방랑자'));socket.emit('joined',{code:room.code});});
 socket.on('joinRoom',({code,name})=>{code=String(code||'').trim().toUpperCase();const room=rooms.get(code);if(!room)return socket.emit('errorMessage','해당 방 코드를 찾을 수 없습니다.');if(room.phase!=='lobby')return socket.emit('errorMessage','이미 게임이 시작된 방입니다.');if(room.players.length>=11)return socket.emit('errorMessage','방이 가득 찼습니다.');const id=Math.max(0,...room.players.map(p=>p.id))+1;const p={id,socketId:socket.id,name:String(name||'여행자').slice(0,16),color:COLORS[(id-1)%COLORS.length],alive:true,ready:false,role:null,team:null,usedRip:false,veteranSave:true,foundWolves:[],intel:[],knownRoles:{}};room.players.push(p);socket.join(code);socket.data.room=code;socket.data.playerId=id;room.notice=`${p.name}이(가) 방에 입장했습니다.`;log(room,'all',room.notice);socket.emit('joined',{code});emitRoom(room);});
 socket.on('rematch',()=>{
 const room=getRoom(socket),p=getPlayer(room,socket);
 if(!room||!p||room.phase!=='ended'||room.hostId!==socket.id)return;
 cancelTimer(room);
 room.phase='lobby';room.day=0;room.night=0;room.deadline=null;room.winner=null;
 room.votes={};room.voteClosed=false;room.closeRequests=[];room.extendedToday=[];room.nightActions={};room.deaths=[];room.public=[];room.logs=[];
 for(const x of room.players){x.role=null;x.team=null;x.inheritedRole=null;x.alive=true;x.usedRip=false;x.foundWolves=[];x.knownRoles={};x.intel=[];x.ready=false;}
 room.notice='같은 방에서 새 게임을 준비합니다. 방장이 게임 시작을 누르세요.';
 emitRoom(room);
 });
 socket.on('setRule',rule=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.hostId!==socket.id||room.phase!=='lobby')return;room.rule=['basic','basic2','chaos'].includes(rule)?rule:'basic';emitRoom(room)});
 socket.on('startGame',()=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.hostId!==socket.id||room.phase!=='lobby')return;if(room.players.length<5)return socket.emit('errorMessage','최소 5명이 필요합니다.');const roles=roleSet(room.players.length);room.players.forEach((p,i)=>{p.role=roles[i];p.team=ROLE[p.role].team;p.alive=true;p.usedRip=false;p.veteranSave=true;p.foundWolves=[];p.intel=[];p.knownRoles={};p.inheritedRole=null;if(p.role==='wolf')p.wolfNo=room.players.filter((x,j)=>j<=i&&roles[j]==='wolf').length});room.day=0;room.night=0;room.votes={};room.public=[];room.logs=[];room.deaths=[];room.closeRequests=[];room.phase='day';room.notice='게임이 시작되었습니다.';if(room.rule==='basic'){enterDay(room)}else{enterNight(room);room.notice='2턴제 준비 밤입니다. 능력을 사용할 수 있습니다.';emitRoom(room)}});
 socket.on('chat',({channel,text,to})=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.phase==='ended')return;const msg=String(text||'').trim().slice(0,300);if(!msg)return;if(!p.alive&&channel!=='ghost')return socket.emit('errorMessage','사망자는 유령 대화만 사용할 수 있습니다.');if(room.phase==='night'&&channel==='all')return socket.emit('errorMessage','밤에는 전체 대화를 할 수 없습니다.');if(channel==='wolf'&&!(p.role==='wolf'||(p.role==='hench'&&p.foundWolves.length)))return socket.emit('errorMessage','아직 동맹 대화를 사용할 수 없습니다.');if(channel==='ghost'&&p.alive)return socket.emit('errorMessage','유령만 사용할 수 있는 대화입니다.');if(channel==='whisper'){if(room.phase!=='day')return socket.emit('errorMessage','귓속말은 낮에만 가능합니다.');const target=room.players.find(x=>x.id===Number(to));if(!target||!target.alive||target.id===p.id)return socket.emit('errorMessage','살아있는 다른 플레이어에게만 귓속말을 보낼 수 있습니다.');room.logs.push({id:crypto.randomUUID(),channel:'whisper',text:msg,to:target.id,from:p.id,fromName:`${p.id}번 ${p.name} → ${target.id}번 ${target.name}`,at:Date.now()});const s=io.sockets.sockets.get(target.socketId);if(s){s.emit('state',stateFor(room,target));s.emit('whisperNotice',{from:p.id});}socket.emit('state',stateFor(room,p));return;}if(channel==='all'&&room.phase!=='day')return;room.logs.push({id:crypto.randomUUID(),channel:channel==='ghost'?'ghost':channel==='wolf'?'wolf':'all',text:msg,from:p.id,fromName:`${p.id}번 ${p.name}`,at:Date.now()});if(room.logs.length>300)room.logs.shift();emitRoom(room)});
 socket.on('vote',targetId=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.phase!=='day'||room.voteClosed||!p.alive)return socket.emit('errorMessage','지금은 투표할 수 없습니다.');if(Object.prototype.hasOwnProperty.call(room.votes,p.id))return socket.emit('errorMessage','오늘의 투표권은 이미 사용했습니다.');const target=Number(targetId);if(target!==0&&!living(room).some(x=>x.id===target))return socket.emit('errorMessage','투표 대상을 찾을 수 없습니다.');room.votes[p.id]=target;room.notice=target?`${p.name}이(가) 투표했습니다.`:`${p.name}이(가) 기권했습니다.`;emitRoom(room);if(living(room).every(x=>Object.prototype.hasOwnProperty.call(room.votes,x.id)))closeVote(room,false)});
 socket.on('extendDay',()=>{
  const room=getRoom(socket),p=getPlayer(room,socket);
  if(!room||!p||!p.alive||room.phase!=='day'||room.voteClosed)return;
  room.extendedToday ||= [];
  if(room.extendedToday.includes(p.id))return socket.emit('errorMessage','오늘은 이미 1분 연장을 사용했습니다.');
  if(Date.now()>=room.deadline)return socket.emit('errorMessage','이미 낮 시간이 종료되었습니다.');
  room.extendedToday.push(p.id);
  room.deadline+=DAY_MS;
  room.notice='생존자가 토론 시간을 1분 연장했습니다.';
  emitRoom(room);scheduleDayEnd(room);
 });
 socket.on('closeVote',()=>{
 const room=getRoom(socket),p=getPlayer(room,socket);
 if(!room||!p||!p.alive||room.phase!=='day'||room.voteClosed)return;
 room.closeRequests ||= [];
 if(!room.closeRequests.includes(p.id))room.closeRequests.push(p.id);
 if(living(room).every(x=>room.closeRequests.includes(x.id)))closeVote(room,false);
 else emitRoom(room);
 });
 socket.on('nightAction',data=>nightAction(socket,data));
 socket.on('skipNight',()=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p||room.phase!=='night'||!p.alive)return;if(room.nightActions[p.id]?.done)return socket.emit('errorMessage','이번 밤 행동은 이미 완료했습니다.');room.nightActions[p.id]={done:true};emitRoom(room);if(allNightDone(room))resolveNight(room)});
 socket.on('publish',data=>{const room=getRoom(socket),p=getPlayer(room,socket);if(!room||!p)return;
 const value=String(typeof data==='object'&&data!==null?data.text:data||'').trim().slice(0,500);
 if(!value)return;
 const allowedColors=['#f4e9d6','#eecb7b','#b8e2ff','#b8f0c9','#ffb6c1','#e3c5ff'];
 const color=allowedColors.includes(data?.color)?data.color:allowedColors[0];
 const size=[16,18,20,22].includes(Number(data?.size))?Number(data.size):18;
 room.public=room.public.filter(x=>x.playerId!==p.id);
 room.public.push({id:crypto.randomUUID(),playerId:p.id,name:p.name,text:value,color,size});emitRoom(room);
});
 socket.on('disconnect',()=>{const room=getRoom(socket);if(!room)return;const p=room.players.find(x=>x.socketId===socket.id);if(p){p.connected=false;room.notice=`${p.name} 연결이 끊어졌습니다.`;log(room,'all',room.notice);emitRoom(room);if(room.phase==='lobby'){room.players=room.players.filter(x=>x.socketId!==socket.id);if(!room.players.length){clearRoomTimers(room);rooms.delete(room.code)}else{if(room.hostId===socket.id)room.hostId=room.players[0].socketId;emitRoom(room)}}}});
});
server.listen(PORT,()=>console.log(`Lupus In Tabula server listening on ${PORT}`));
