const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync(__dirname+'/server.js','utf8');
const noop=()=>{};
const sockets=new Map();
const fakeIO={sockets:{sockets},to:()=>({emit:noop}),on:noop};
const fakeServer={listen:noop};
const fakeApp={use:noop,get:noop};
const requireMock=name=>name==='express'?Object.assign(()=>fakeApp,{static:()=>noop}):name==='http'?{createServer:()=>fakeServer}:name==='socket.io'?{Server:class {constructor(){return fakeIO}}}:require(name);
const sandbox={require:requireMock,console,process,Date,Math,setTimeout:()=>1,clearTimeout:noop};
vm.createContext(sandbox);
vm.runInContext(src+'\nthis.__game={activeRole,attemptInheritance,kill,resolveNight,nightAction,allNightDone,closeVote,roleSet,remember,checkWin};',sandbox);
const G=sandbox.__game;
function p(id,role,alive=true){return {id,name:'P'+id,role,team:role==='wolf'?'wolf':'town',alive,veteranSave:true,protected:false,knownRoles:{},intel:[],foundWolves:[]}}
function room(players){return {players,phase:'day',day:2,night:2,rule:'basic',logs:[],deaths:[],votes:{},voteClosed:false,nightActions:{},closeRequests:[],public:[],timer:null,deadline:Date.now()+30000,notice:''}}
let cases=0;
function test(name,fn){fn();cases++;console.log('PASS',name)}
test('heir inherits witch at 7 alive and curses first voter',()=>{
 const players=[p(1,'heir'),p(2,'fanatic',false),p(3,'wolf'),p(4,'seer'),p(5,'guard'),p(6,'medium'),p(7,'tracker'),p(8,'veteran')];const r=room(players);r.deaths=[{id:2,role:'fanatic',team:'town'}];G.attemptInheritance(r);assert.equal(players[0].inheritedRole,'fanatic');G.kill(r,players[0],'vote',4);assert.equal(players[0].alive,false);assert.equal(players[3].alive,false);assert.match(r.logs.at(-1).text,/마녀의 저주/);
});
test('heir witch does not curse when killed at night',()=>{
 const players=[p(1,'heir'),p(2,'fanatic',false),p(3,'wolf'),p(4,'seer'),p(5,'guard'),p(6,'medium'),p(7,'tracker'),p(8,'veteran')];const r=room(players);r.deaths=[{id:2,role:'fanatic',team:'town'}];G.attemptInheritance(r);G.kill(r,players[0],'night',4);assert.equal(players[3].alive,true);
});
test('original witch curses first voter',()=>{const r=room([p(1,'fanatic'),p(2,'wolf'),p(3,'seer')]);G.kill(r,r.players[0],'vote',3);assert.equal(r.players[2].alive,false)});
test('heir inherits veteran and survives first normal attack only',()=>{
 const players=[p(1,'heir'),p(2,'veteran',false),p(3,'wolf'),p(4,'seer'),p(5,'guard'),p(6,'medium'),p(7,'tracker'),p(8,'fanatic')];const r=room(players);r.deaths=[{id:2,role:'veteran',team:'town'}];G.attemptInheritance(r);assert.equal(players[0].inheritedRole,'veteran');r.phase='night';r.nightActions={3:{done:true,target:1}};G.resolveNight(r);assert.equal(players[0].alive,true);assert.equal(players[0].veteranSave,false);r.phase='night';r.nightActions={3:{done:true,target:1}};G.resolveNight(r);assert.equal(players[0].alive,false);
});
test('heir veteran dies to rip even on first attack',()=>{
 const players=[p(1,'heir'),p(2,'veteran',false),p(3,'wolf'),p(4,'seer'),p(5,'guard'),p(6,'medium'),p(7,'tracker'),p(8,'fanatic')];const r=room(players);r.deaths=[{id:2,role:'veteran',team:'town'}];G.attemptInheritance(r);r.phase='night';r.nightActions={3:{done:true,target:1,rip:true}};G.resolveNight(r);assert.equal(players[0].alive,false);
});
test('inherited investigative and guard roles resolve to inherited role',()=>{for(const role of ['seer','guard','tracker','medium','watcher']){const heir=p(1,'heir');heir.inheritedRole=role;assert.equal(G.activeRole(heir),role)}});
test('inheritance not triggered at 8 alive',()=>{const ps=[p(1,'heir'),p(2,'fanatic',false),...Array.from({length:7},(_,i)=>p(i+3,'seer'))];const r=room(ps);r.deaths=[{id:2,role:'fanatic',team:'town'}];G.attemptInheritance(r);assert.equal(ps[0].inheritedRole,undefined)});
console.log('TESTS PASSED:',cases);
