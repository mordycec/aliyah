'use strict';
// Aliyah: rules, state and two-phone connection. ui.js draws the screens.
const CITIES=[
  {he:'ירושלים',en:'Jerusalem'},
  {he:'צפת',en:'Tzfat'},
  {he:'טבריה',en:'Tiberias'},
  {he:'חברון',en:'Hebron'},
  {he:'באר שבע',en:'Be’er Sheva'}
];
const HEB={2:'ב',3:'ג',4:'ד',5:'ה',6:'ו',7:'ז',8:'ח',9:'ט',10:'י'};
const LKEY='aliyah-game-v1', OKEY='aliyah-online-v1', NKEY='aliyah-names-v1', MKEY='aliyah-myname-v1';
const CODE_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ';
const app=document.getElementById('app'), layer=document.getElementById('layer');

// mode: 'local' (one phone) or 'online' (two phones). S is the game state.
let mode=null, S=null, session=null, screen='start', modal=null, peek=false, sel=null;
let joinCode='', joinError='', leftName='';
const net={peer:null,conn:null,status:'idle',lastSeen:0,timers:{}};
let wake=null;

/* ---------- Storage and helpers ---------- */
function put(k,v){try{ if(v===null) localStorage.removeItem(k); else localStorage.setItem(k,JSON.stringify(v)); }catch(e){}}
function get(k){try{ const r=localStorage.getItem(k); return r?JSON.parse(r):null; }catch(e){ return null; }}
function putOnline(){ if(session) put(OKEY,session); }
function validState(x){ return !!x && typeof x==='object' && Array.isArray(x.hands) && Array.isArray(x.names) && Array.isArray(x.exp) && Array.isArray(x.road); }
function esc(s){ return String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function num(n){ return n<0 ? '−'+Math.abs(n) : String(n); }
function fmt(n){ return n<0 ? '−'+Math.abs(n) : (n>0 ? '+'+n : '0'); }
function shuffle(a){ for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function byOrder(a,b){ return a.c-b.c || a.v-b.v; }
function buildDeck(){
  const d=[]; let id=0;
  for(let c=0;c<5;c++){
    for(let w=0;w<3;w++) d.push({id:id++,c,v:0});
    for(let v=2;v<=10;v++) d.push({id:id++,c,v});
  }
  return shuffle(d);
}
function expScore(cards){
  if(!cards.length) return 0;
  let w=0,sum=0;
  for(const k of cards){ if(k.v===0) w++; else sum+=k.v; }
  let s=(sum-20)*(1+w);
  if(cards.length>=8) s+=20;
  return s;
}
function total(p){ return S.exp[p].reduce((s,e)=>s+expScore(e),0); }
function cardName(k){ return k.v ? `${CITIES[k.c].en} ${k.v}` : `a Traveler’s Prayer for ${CITIES[k.c].en}`; }
function lastNum(p,c){ const e=S.exp[p][c]; return e.length ? e[e.length-1].v : 0; }
function canPlay(p,k){
  const e=S.exp[p][k.c];
  if(k.v===0) return e.every(x=>x.v===0);
  return k.v>lastNum(p,k.c);
}
function whyNot(p,k){
  if(k.v===0) return 'Traveler’s Prayers go on a journey before any numbers. You can still discard it.';
  return `Your ${CITIES[k.c].en} journey is already at ${lastNum(p,k.c)}, and cards have to keep going up. You can still discard it.`;
}
function viewer(){ return mode==='online' ? session.me : S.turn; }
function myTurn(){ return mode==='local' || (!!S && S.turn===session.me); }
function current(){ return sel===null ? null : (S.hands[S.turn].find(k=>k.id===sel)||null); }
function genCode(){ let s=''; for(let i=0;i<4;i++) s+=CODE_CHARS[Math.floor(Math.random()*CODE_CHARS.length)]; return s; }

function commit(){
  if(mode==='online'){ S.ver=(S.ver||0)+1; session.S=S; putOnline(); send({t:'state',S}); }
  else put(LKEY,S);
  render();
}

/* ---------- Game rules ---------- */
function newMatch(names){
  S={v:1,ver:0,names,match:[0,0],round:0,starter:0};
  startRound();
}
function startRound(){
  S.round+=1;
  const deck=buildDeck();
  const h0=deck.splice(0,8).sort(byOrder), h1=deck.splice(0,8).sort(byOrder);
  Object.assign(S,{
    deck, hands:[h0,h1],
    exp:[[[],[],[],[],[]],[[],[],[],[],[]]],
    road:[[],[],[],[],[]],
    turn:S.starter, phase:mode==='local'?'pass':'play', hidden:false,
    undo:null, justDiscarded:null, move:null, last:null, result:null
  });
  sel=null; peek=false; screen='game';
  commit(); window.scrollTo(0,0);
}
function take(k){ const h=S.hands[S.turn]; h.splice(h.indexOf(k),1); }
function snapshot(){ return JSON.stringify({hands:S.hands,exp:S.exp,road:S.road}); }
function play(){
  if(!myTurn() || S.phase!=='play') return;
  const k=current(); if(!k || !canPlay(S.turn,k)) return;
  S.undo={snap:snapshot(),sel:k.id};
  take(k); S.exp[S.turn][k.c].push(k);
  S.justDiscarded=null;
  S.move=`${S.names[S.turn]} played ${cardName(k)}`;
  S.phase='draw'; sel=null; commit();
}
function discard(){
  if(!myTurn() || S.phase!=='play') return;
  const k=current(); if(!k) return;
  S.undo={snap:snapshot(),sel:k.id};
  take(k); S.road[k.c].push(k);
  S.justDiscarded=k.c;
  S.move=`${S.names[S.turn]} discarded ${cardName(k)}`;
  S.phase='draw'; sel=null; commit();
}
function undo(){
  if(!myTurn() || S.phase!=='draw' || !S.undo) return;
  const o=JSON.parse(S.undo.snap);
  S.hands=o.hands; S.exp=o.exp; S.road=o.road;
  sel=S.undo.sel; S.undo=null; S.justDiscarded=null; S.move=null; S.phase='play';
  commit();
}
function give(k){ S.hands[S.turn].push(k); S.hands[S.turn].sort(byOrder); }
function drawDeck(){
  if(!myTurn() || S.phase!=='draw' || !S.deck.length) return;
  give(S.deck.pop());
  S.move+=' and drew from the deck.';
  finishTurn();
}
function drawRoad(i){
  if(!myTurn() || S.phase!=='draw' || i===S.justDiscarded) return;
  const pile=S.road[i]; if(!pile.length) return;
  const k=pile.pop(); give(k);
  S.move+=` and took ${cardName(k)} from the road.`;
  finishTurn();
}
function finishTurn(){
  S.undo=null; S.last=S.move; S.move=null; S.justDiscarded=null;
  if(S.deck.length===0){ endRound(); return; }
  S.turn=1-S.turn; S.phase=mode==='local'?'pass':'play';
  commit();
}
function endRound(){
  const per=[0,1].map(p=>S.exp[p].map(expScore));
  const tot=per.map(a=>a.reduce((x,y)=>x+y,0));
  S.match[0]+=tot[0]; S.match[1]+=tot[1];
  S.result={per,tot}; S.phase='over'; peek=false;
  commit();
}
function nextRound(){ if(!S || S.phase!=='over') return; S.starter=1-S.starter; startRound(); }

/* ---------- Two phones: connection ---------- */
const PEER_OPTS={debug:0};
function hostId(code){ return 'aliyah-game-v1-'+code; }
function later(key,fn,ms){ clearTimeout(net.timers[key]); net.timers[key]=setTimeout(fn,ms); }
function connOpen(){ return !!(net.conn && net.conn.open); }
function send(m){ if(connOpen()){ try{ net.conn.send(m); }catch(e){} } }
function teardownPeer(delay){
  const p=net.peer, c=net.conn;
  net.peer=null; net.conn=null;
  for(const k in net.timers) clearTimeout(net.timers[k]);
  net.timers={};
  const kill=()=>{ try{ c&&c.close(); }catch(e){} try{ p&&p.destroy(); }catch(e){} };
  if(delay) setTimeout(kill,delay); else kill();
}
function startNet(){
  if(!session) return;
  if(typeof window.Peer!=='function'){ setStatus('nolib'); return; }
  teardownPeer();
  const host=session.role==='host';
  let p;
  try{ p=host ? new window.Peer(hostId(session.code),PEER_OPTS) : new window.Peer(PEER_OPTS); }
  catch(e){ setStatus('reconnecting'); later('restart',startNet,4000); return; }
  net.peer=p;
  setStatus(connOpen()?'connected':(host?'starting':'connecting'));
  p.on('open',()=>{
    if(net.peer!==p) return;
    if(host){ if(!connOpen()) setStatus('waiting'); }
    else connectToHost();
  });
  p.on('connection',c=>{
    if(net.peer!==p) return;
    if(!host){ try{ c.close(); }catch(e){} return; }
    adoptConn(c);
  });
  p.on('disconnected',()=>{
    if(net.peer!==p || p.destroyed) return;
    later('peerReconnect',()=>{ if(net.peer===p && !p.destroyed && p.disconnected){ try{ p.reconnect(); }catch(e){ startNet(); } } },1500);
  });
  p.on('error',err=>{
    if(net.peer!==p) return;
    const t=err && err.type;
    if(t==='peer-unavailable'){ if(!connOpen()) setStatus('nohost'); later('connect',connectToHost,3000); return; }
    if(t==='unavailable-id'){ setStatus('reconnecting'); later('restart',startNet,3000); return; }
    if(t==='browser-incompatible'){ setStatus('nolib'); return; }
    if(!connOpen()) setStatus('reconnecting');
    later('restart',()=>{
      if(net.peer!==p) return;
      if(p.destroyed || !connOpen()){ startNet(); }
      else if(p.disconnected){ try{ p.reconnect(); }catch(e){} }
    },4000);
  });
}
function connectToHost(){
  if(!session || session.role!=='guest') return;
  const p=net.peer;
  if(!p || p.destroyed){ startNet(); return; }
  if(connOpen()) return;
  if(p.disconnected){ try{ p.reconnect(); }catch(e){} later('connect',connectToHost,2000); return; }
  if(!p.open && !p.id){ later('connect',connectToHost,1500); return; }
  let c;
  try{ c=p.connect(hostId(session.code),{reliable:true,serialization:'json'}); }catch(e){ later('connect',connectToHost,3000); return; }
  if(!c){ later('connect',connectToHost,3000); return; }
  adoptConn(c);
  later('connectTimeout',()=>{ if(net.conn===c && !c.open){ net.conn=null; try{ c.close(); }catch(e){} connectToHost(); } },10000);
}
function adoptConn(c){
  if(net.conn && net.conn!==c){ const old=net.conn; net.conn=null; try{ old.close(); }catch(e){} }
  net.conn=c;
  c.on('open',()=>{
    if(net.conn!==c) return;
    net.lastSeen=Date.now();
    setStatus('connected');
    send({t:'hello',name:session.myName,S:session.S});
  });
  c.on('data',d=>{ if(net.conn!==c) return; net.lastSeen=Date.now(); onMsg(d); });
  const lost=()=>{
    if(net.conn!==c) return;
    net.conn=null;
    if(!session) return;
    if(session.role==='guest'){ setStatus('reconnecting'); later('connect',connectToHost,1500); }
    else setStatus('waiting');
  };
  c.on('close',lost); c.on('error',lost);
}
function onMsg(m){
  if(!m || typeof m!=='object' || !session) return;
  if(m.t==='hello'){
    if(m.name) session.oppName=String(m.name).slice(0,16);
    if(validState(m.S) && newer(m.S)) adopt(m.S,false);
    if(session.role==='host' && !S){
      newMatch([session.myName, session.oppName||'Player 2']);
      return;
    }
    putOnline();
    if(S) send({t:'state',S});
    if(screen==='lobby') render();
    return;
  }
  if(m.t==='state'){ if(validState(m.S) && newer(m.S)) adopt(m.S,true); return; }
  if(m.t==='bye'){
    leftName=S ? S.names[1-session.me] : (session.oppName||'The other player');
    put(OKEY,null);
    teardownPeer();
    modal='left'; renderLayer();
  }
}
function newer(x){
  if(!S) return true;
  const a=x.ver||0, b=S.ver||0;
  return a>b || (a===b && session.role==='guest');
}
function adopt(ns,notify){
  const wasMine=!!S && S.turn===session.me && S.phase!=='over';
  S=ns; session.S=S; putOnline();
  if(S.turn!==session.me || S.phase!=='play' || !S.hands[session.me].some(k=>k.id===sel)) sel=null;
  if(S.phase!=='over') peek=false;
  screen='game';
  if(notify && !wasMine && S.turn===session.me && S.phase==='play'){
    try{ if(navigator.vibrate) navigator.vibrate(40); }catch(e){}
  }
  render();
}
function resumeNet(){
  if(mode!=='online' || !session) return;
  const p=net.peer;
  if(!p || p.destroyed){ startNet(); return; }
  if(p.disconnected){ try{ p.reconnect(); }catch(e){ startNet(); return; } }
  if(connOpen()) send({t:'hello',name:session.myName,S:session.S});
  else if(session.role==='guest') later('connect',connectToHost,800);
}
setInterval(()=>{
  if(mode!=='online' || !session) return;
  if(connOpen()){
    send({t:'ping'});
    if(Date.now()-net.lastSeen>20000){
      const c=net.conn; net.conn=null; try{ c.close(); }catch(e){}
      if(session.role==='guest'){ setStatus('reconnecting'); connectToHost(); } else setStatus('waiting');
    }
  }
},5000);

function oppName(){ return S ? S.names[1-session.me] : (session.oppName || 'the other player'); }
function statusText(){
  const o=esc(oppName());
  switch(net.status){
    case 'nolib': return 'Two-phone play needs an internet connection. Check your connection and open the app again.';
    case 'connected': return S ? `Connected to ${o}` : 'Connected. Dealing the cards…';
    case 'waiting': return S ? `Waiting for ${o} to reconnect…` : 'Waiting for the other player to join…';
    case 'nohost': return S ? `Waiting for ${o} to reconnect…` : `Looking for game ${esc(session.code)}. Keep the game open on the other phone.`;
    case 'reconnecting': return 'Reconnecting…';
    default: return 'Connecting…';
  }
}
function statusHTML(){ return `<span class="dot${net.status==='connected'?' on':''}"></span><span>${statusText()}</span>`; }
function setStatus(s){ net.status=s; const el=document.getElementById('netstatus'); if(el) el.innerHTML=statusHTML(); }

async function requestWake(){
  if(wake || mode!=='online' || screen!=='game' || document.visibilityState!=='visible' || !('wakeLock' in navigator)) return;
  try{ wake=await navigator.wakeLock.request('screen'); wake.addEventListener('release',()=>{ wake=null; }); }catch(e){ wake=null; }
}
function releaseWake(){ if(wake){ try{ wake.release(); }catch(e){} wake=null; } }

function startOnline(role,name,code){
  put(MKEY,name);
  session={role,code,me:role==='host'?0:1,myName:name,oppName:null,S:null};
  mode='online'; S=null; sel=null; peek=false; screen='lobby';
  putOnline(); render(); startNet();
}
function endOnline(sayBye){
  if(sayBye){ send({t:'bye'}); teardownPeer(400); } else teardownPeer();
  put(OKEY,null); releaseWake();
  session=null; mode=null; S=null; sel=null; peek=false; modal=null; screen='start';
  render();
}
