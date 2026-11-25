'use strict';
// Aliyah: screens, taps and start-up. Uses the state and rules from game.js.
/* ---------- Views ---------- */
function startHTML(){
  const myName=get(MKEY)||'';
  const local=get(LKEY);
  const canResume=validState(local) && local.phase!=='over';
  return `<div class="start">
    <div class="steps" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <h1 class="title" lang="he">עלייה</h1>
    <p class="sub">Aliyah</p>
    <p class="lede">A card game for two. Five roads lead up to five cities in Eretz Yisrael, and every card you play has to climb higher than the one before it.</p>
    <form id="hostForm" autocomplete="off">
      <label class="field"><span>Your name</span><input id="myName" maxlength="16" placeholder="Name" value="${esc(myName)}"></label>
      <button class="btn wide" type="submit">Start a game on two phones</button>
    </form>
    <button class="btn ghost wide" data-act="goJoin">Join with a code</button>
    <div class="alt">
      ${canResume?'<button class="link" data-act="continueLocal">Continue the game on this phone</button>':''}
      <button class="link" data-act="goLocal">Play on one phone instead</button>
      <button class="link" data-act="rules">How to play</button>
    </div>
  </div>`;
}
function joinHTML(){
  const myName=get(MKEY)||'';
  return `<div class="start">
    <h1 class="sub">Join a game</h1>
    <p class="lede">Enter the 4-letter code showing on the other phone.</p>
    <form id="joinForm" autocomplete="off">
      <label class="field"><span>Your name</span><input id="joinName" maxlength="16" placeholder="Name" value="${esc(myName)}"></label>
      <label class="field"><span>Game code</span><input id="joinCode" class="codeinput" maxlength="4" autocapitalize="characters" autocorrect="off" spellcheck="false" value="${esc(joinCode)}"></label>
      ${joinError?`<p class="err">${esc(joinError)}</p>`:''}
      <button class="btn wide" type="submit">Join game</button>
    </form>
    <div class="alt"><button class="link" data-act="back">Back</button></div>
  </div>`;
}
function localSetupHTML(){
  const names=get(NKEY)||['',''];
  return `<div class="start">
    <h1 class="sub">Play on one phone</h1>
    <p class="lede">Pass the phone back and forth. Your hand stays hidden until you tap to show it.</p>
    <form id="setup" autocomplete="off">
      <label class="field"><span>First player</span><input id="n0" maxlength="16" placeholder="Name" value="${esc(names[0])}"></label>
      <label class="field"><span>Second player</span><input id="n1" maxlength="16" placeholder="Name" value="${esc(names[1])}"></label>
      <button class="btn wide" type="submit">Start game</button>
    </form>
    <div class="alt"><button class="link" data-act="back">Back</button></div>
  </div>`;
}
function lobbyHTML(){
  const host=session.role==='host';
  return `<div class="start">
    <h1 class="sub">${host?'Your game code':'Joining game'}</h1>
    <p class="code" aria-label="Game code ${esc(session.code.split('').join(' '))}">${esc(session.code)}</p>
    ${host?'<p class="lede">On the other phone, open Aliyah, tap Join with a code, and enter these four letters.</p>':''}
    <div class="netstatus" id="netstatus" role="status">${statusHTML()}</div>
    ${host && navigator.share?'<button class="btn wide" data-act="share">Send the code</button>':''}
    <button class="btn ghost wide" data-act="cancelOnline">Cancel</button>
  </div>`;
}

function expTile(p,c,selK){
  const cards=S.exp[p][c], w=cards.filter(k=>!k.v).length, nums=cards.filter(k=>k.v);
  let cls='exp'+(cards.length?'':' empty');
  if(selK && p===S.turn && selK.c===c) cls+=canPlay(p,selK)?' target':' blocked';
  return `<div class="${cls}" style="--c:var(--c${c})" title="${esc(CITIES[c].en)}">
    <span class="exp-name" lang="he">${CITIES[c].he}</span>
    <span class="chips">${w?`<span class="mult" title="${w} Traveler’s Prayer${w>1?'s':''}">×${w+1}</span>`:''}${nums.map(k=>`<span class="chip">${k.v}</span>`).join('')}</span>
    <span class="exp-score">${cards.length?fmt(expScore(cards)):''}</span>
  </div>`;
}
function row(p,selK){ return `<div class="row5">${[0,1,2,3,4].map(c=>expTile(p,c,selK)).join('')}</div>`; }
function miniHTML(k){
  return `<span class="mini"><span class="mini-num">${k.v||'×'}</span><span class="mini-heb" lang="he">${k.v?HEB[k.v]:'תפילה'}</span></span>`;
}
function pileHTML(i,selK,drawing){
  const p=S.road[i], top=p[p.length-1];
  const can=drawing && !!top && i!==S.justDiscarded;
  const lock=drawing && i===S.justDiscarded;
  const aim=selK && selK.c===i;
  const label=top ? `${CITIES[i].en} road pile, top card ${cardName(top)}${can?'. Tap to take it.':''}` : `${CITIES[i].en} road pile, empty`;
  return `<button class="pile${top?' has':''}${can?' can':''}${lock?' lock':''}${aim?' aim':''}" style="--c:var(--c${i})" data-act="road" data-i="${i}" ${can?'':'disabled'} aria-label="${esc(label)}">
    ${top?miniHTML(top):`<span class="pile-empty" lang="he">${CITIES[i].he}</span>`}
    ${p.length>1?`<span class="count">${p.length}</span>`:''}
  </button>`;
}
function cardHTML(k,isSel,enabled){
  return `<button class="card${k.v?'':' wager'}${isSel?' sel':''}" style="--c:var(--c${k.c})" data-act="sel" data-id="${k.id}" aria-pressed="${isSel}" aria-label="${esc(cardName(k))}" ${enabled?'':'disabled'}>
    <span class="num">${k.v||'×'}</span>
    <span class="meta"><span class="heb" lang="he">${k.v?HEB[k.v]:'תפילת הדרך'}</span><span class="city" lang="he">${CITIES[k.c].he}</span></span>
  </button>`;
}
function actionsHTML(selK){
  if(S.phase==='over') return `<button class="btn" data-act="seeScores">See the scores</button>`;
  if(!myTurn()){
    const o=esc(S.names[S.turn]);
    return `<p class="hint">${S.phase==='draw'?`${o} is drawing a card.`:`Waiting for ${o} to play.`}</p>`;
  }
  if(S.phase==='draw') return `<p class="hint">Now draw one card: the deck, or the top card of any road pile${S.justDiscarded!==null?' except the one you just discarded':''}.</p><button class="btn ghost narrow" data-act="undo">Take back</button>`;
  if(S.phase!=='play') return '';
  if(!selK) return `<p class="hint">Tap a card to play it on a journey or discard it to the road.</p>`;
  const ok=canPlay(S.turn,selK), fresh=ok && S.exp[S.turn][selK.c].length===0;
  const note=!ok ? whyNot(S.turn,selK) : fresh ? `This starts your journey to ${CITIES[selK.c].en}, which costs 20 points.` : '';
  return `${note?`<p class="hint full">${note}</p>`:''}
    <button class="btn" data-act="play" ${ok?'':'disabled'}>Play on ${CITIES[selK.c].en}</button>
    <button class="btn ghost" data-act="discard">Discard</button>`;
}
function gameHTML(){
  const online=mode==='online';
  const v=viewer(), op=1-v, n=S.names;
  const live=online ? S.phase!=='over' : ((S.phase==='play'||S.phase==='draw') && !S.hidden);
  const mine=myTurn() && (S.phase==='play'||S.phase==='draw');
  const selK=mine && S.phase==='play' ? current() : null;
  const drawing=mine && S.phase==='draw';
  const bottomLabel=online ? 'Your journeys' : (live ? 'Your journeys, '+esc(n[v]) : esc(n[v])+'’s journeys');
  return `
  <header class="top">
    <span class="brand" lang="he">עלייה</span>
    <div class="tools">
      <button class="link" data-act="rules">Rules</button>
      ${online?'<button class="link" data-act="askLeave">Leave game</button>':'<button class="link" data-act="askNew">New game</button>'}
    </div>
  </header>
  <div class="tally">
    <span class="who"><span>${esc(n[0])} <b>${num(S.match[0])}</b></span><span>${esc(n[1])} <b>${num(S.match[1])}</b></span></span>
    <span>Round ${S.round}</span>
  </div>
  ${online?`<div class="netstatus" id="netstatus" role="status">${statusHTML()}</div>`:''}
  <div class="label"><span>${esc(n[op])}’s journeys</span><span class="tot">${fmt(total(op))}</span></div>
  ${row(op,null)}
  <section class="road" aria-label="The road">
    <div class="label"><span>The road</span></div>
    <div class="row5">${[0,1,2,3,4].map(i=>pileHTML(i,selK,drawing)).join('')}</div>
    <button class="deck${drawing?' can':''}" data-act="deck" ${drawing?'':'disabled'}>
      <span>${drawing?'Draw from the deck':'Deck'}</span><span class="left">${S.deck.length} left</span>
    </button>
  </section>
  ${S.last && live ? `<p class="last">${esc(S.last)}</p>` : ''}
  <div class="label"><span>${bottomLabel}</span><span class="tot">${fmt(total(v))}</span></div>
  ${row(v,selK)}
  ${live?`<div class="label"><span>Your hand</span></div><div class="hand${mine?'':' waiting'}">${S.hands[v].map(k=>cardHTML(k,!!selK&&selK.id===k.id,mine&&S.phase==='play')).join('')}</div>`:''}
  <div class="actions">${live||S.phase==='over'?actionsHTML(selK):''}</div>`;
}

function rulesHTML(){
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="rulesT"><div class="sheet">
    <h2 id="rulesT">How to play</h2>
    <p>Five roads lead up to Jerusalem, Tzfat, Tiberias, Hebron and Be’er Sheva. You each build your own journeys toward them, and every card you add to a journey has to be higher than the last one on it. The only way is up.</p>
    <h3>Each turn has two steps</h3>
    <ol>
      <li><b>Play or discard one card.</b> Play it on your journey to its city, or put it face up on that city’s pile on the road.</li>
      <li><b>Draw one card</b> from the deck, or take the top card of any road pile. You can’t take back a card you just discarded.</li>
    </ol>
    <h3>Traveler’s Prayer cards</h3>
    <p>Each city has three <span lang="he">תפילת הדרך</span> cards. Like the prayer itself, they come before you set out: they go on a journey before any numbers. One doubles that journey’s score, two triple it, three quadruple it. They multiply losses too.</p>
    <h3>Scoring</h3>
    <p>Every journey you start costs 20 points. Add up its numbers, subtract 20, then multiply for any prayers. A journey with 8 or more cards earns a 20 point bonus. Roads you never start cost nothing.</p>
    <p>The round ends the moment the last card is drawn from the deck. Play as many rounds as you like, and your scores add up across the match.</p>
    <h3>Two phones</h3>
    <p>One of you taps Start a game on two phones and reads out the code. The other taps Join with a code. Each phone shows only its own hand. If a phone locks or loses signal, open the app again and it reconnects on its own.</p>
    <button class="btn wide" data-act="close" data-autofocus>Close rules</button>
  </div></div>`;
}
function confirmNewHTML(){
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="newT"><div class="sheet">
    <h2 id="newT">Start a new game?</h2>
    <p>This ends the current match and clears the scores.</p>
    <button class="btn wide" data-act="confirmNew">Start new game</button>
    <button class="btn ghost wide" data-act="close" data-autofocus>Keep playing</button>
  </div></div>`;
}
function confirmLeaveHTML(){
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="leaveT"><div class="sheet">
    <h2 id="leaveT">Leave this game?</h2>
    <p>The game ends on both phones. To play again, one of you starts a new game and shares a new code.</p>
    <button class="btn wide" data-act="confirmLeave">Leave game</button>
    <button class="btn ghost wide" data-act="close" data-autofocus>Keep playing</button>
  </div></div>`;
}
function leftHTML(){
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="leftT"><div class="sheet">
    <h2 id="leftT">${esc(leftName)} left the game</h2>
    <p>Start a new game to play again.</p>
    <button class="btn wide" data-act="leftOk" data-autofocus>Back to the start</button>
  </div></div>`;
}
function passHTML(){
  const n=esc(S.names[S.turn]);
  const intro=!S.last;
  return `<div class="overlay opaque" role="dialog" aria-modal="true" aria-labelledby="passName"><div class="sheet pass">
    <p class="lastmove">${intro?`Round ${S.round}. Eight cards each.`:esc(S.last)}</p>
    <p class="passto">${intro?'First up':'Pass the phone to'}</p>
    <h2 class="passname" id="passName">${n}</h2>
    <button class="btn wide" data-act="reveal" data-autofocus>Show ${n}’s cards</button>
    <p class="fine">${S.deck.length} cards left in the deck</p>
  </div></div>`;
}
function overHTML(){
  const r=S.result, n=S.names, m=S.match, d=r.tot[0]-r.tot[1];
  const cell=(p,i)=>S.exp[p][i].length?fmt(r.per[p][i]):'<span class="dim">not started</span>';
  const verdict=d===0?`Round ${S.round} is a tie.`:`${esc(n[d>0?0:1])} wins round ${S.round} by ${Math.abs(d)}.`;
  const mv=m[0]===m[1]?`The match is tied at ${num(m[0])}.`:`${esc(n[m[0]>m[1]?0:1])} leads the match, ${num(Math.max(m[0],m[1]))} to ${num(Math.min(m[0],m[1]))}.`;
  const rows=CITIES.map((c,i)=>`<tr><th scope="row" style="color:var(--c${i})">${esc(c.en)}</th><td>${cell(0,i)}</td><td>${cell(1,i)}</td></tr>`).join('');
  return `<div class="overlay" role="dialog" aria-modal="true" aria-labelledby="overT"><div class="sheet">
    <h2 id="overT">The deck is empty</h2>
    <p class="verdict">${verdict}</p>
    <table class="scores">
      <thead><tr><th></th><th scope="col">${esc(n[0])}</th><th scope="col">${esc(n[1])}</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr><th scope="row">This round</th><td>${fmt(r.tot[0])}</td><td>${fmt(r.tot[1])}</td></tr>
        <tr><th scope="row">Match total</th><td>${num(m[0])}</td><td>${num(m[1])}</td></tr>
      </tfoot>
    </table>
    <p>${mv}</p>
    <button class="btn wide" data-act="next" data-autofocus>Play round ${S.round+1}</button>
    <button class="btn ghost wide" data-act="peek">View the board</button>
  </div></div>`;
}
function overlayHTML(){
  if(modal==='rules') return rulesHTML();
  if(modal==='confirmNew') return confirmNewHTML();
  if(modal==='confirmLeave') return confirmLeaveHTML();
  if(modal==='left') return leftHTML();
  if(screen!=='game' || !S) return '';
  if(mode==='local' && (S.phase==='pass' || S.hidden)) return passHTML();
  if(S.phase==='over' && !peek) return overHTML();
  return '';
}
function renderLayer(){
  layer.innerHTML=overlayHTML();
  const af=layer.querySelector('[data-autofocus]');
  if(af) af.focus({preventScroll:true});
}
function render(){
  if(screen==='game' && S) app.innerHTML=gameHTML();
  else if(screen==='lobby' && session) app.innerHTML=lobbyHTML();
  else if(screen==='join') app.innerHTML=joinHTML();
  else if(screen==='localSetup') app.innerHTML=localSetupHTML();
  else { screen='start'; app.innerHTML=startHTML(); }
  renderLayer();
  const yourTurn=mode==='online' && S && S.phase==='play' && S.turn===session.me;
  document.title=yourTurn?'Aliyah: your turn':'Aliyah';
  if(mode==='online' && screen==='game') requestWake();
}

/* ---------- Events ---------- */
document.addEventListener('submit',e=>{
  const id=e.target.id;
  if(id==='hostForm'){
    e.preventDefault();
    const name=document.getElementById('myName').value.trim().slice(0,16)||'Player 1';
    startOnline('host',name,genCode());
  }
  else if(id==='joinForm'){
    e.preventDefault();
    const name=document.getElementById('joinName').value.trim().slice(0,16)||'Player 2';
    const code=document.getElementById('joinCode').value.toUpperCase().replace(/[^A-Z]/g,'');
    joinCode=code;
    if(code.length!==4){ joinError='The code is four letters. Check it on the other phone.'; put(MKEY,name); render(); return; }
    joinError='';
    startOnline('guest',name,code);
  }
  else if(id==='setup'){
    e.preventDefault();
    const a=document.getElementById('n0').value.trim().slice(0,16)||'Player 1';
    const b=document.getElementById('n1').value.trim().slice(0,16)||'Player 2';
    put(NKEY,[a,b]);
    mode='local'; newMatch([a,b]);
  }
});
document.addEventListener('input',e=>{
  if(e.target.id==='joinCode'){
    const v=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
    if(v!==e.target.value) e.target.value=v;
  }
});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-act]');
  if(!t || t.disabled) return;
  switch(t.dataset.act){
    case 'rules': modal='rules'; renderLayer(); break;
    case 'close': modal=null; renderLayer(); break;
    case 'goJoin': joinError=''; screen='join'; render(); break;
    case 'goLocal': screen='localSetup'; render(); break;
    case 'back': joinError=''; screen='start'; render(); break;
    case 'continueLocal': {
      const s=get(LKEY);
      if(validState(s)){ mode='local'; S=s; if(S.phase==='play'||S.phase==='draw') S.hidden=true; sel=null; screen='game'; render(); }
      break;
    }
    case 'askNew': modal='confirmNew'; renderLayer(); break;
    case 'confirmNew': modal=null; S=null; mode=null; put(LKEY,null); screen='start'; render(); window.scrollTo(0,0); break;
    case 'askLeave': modal='confirmLeave'; renderLayer(); break;
    case 'confirmLeave': endOnline(true); break;
    case 'cancelOnline': endOnline(true); break;
    case 'leftOk': endOnline(false); break;
    case 'share': {
      const url=location.origin+location.pathname+'?join='+session.code;
      navigator.share({title:'Aliyah',text:`Join my game of Aliyah. The code is ${session.code}.`,url}).catch(()=>{});
      break;
    }
    case 'reveal': if(S.phase==='pass') S.phase='play'; S.hidden=false; put(LKEY,S); render(); window.scrollTo(0,0); break;
    case 'sel': {
      if(!myTurn() || S.phase!=='play') break;
      const id=+t.dataset.id; sel=(sel===id)?null:id; render();
      break;
    }
    case 'play': play(); break;
    case 'discard': discard(); break;
    case 'undo': undo(); break;
    case 'deck': drawDeck(); break;
    case 'road': drawRoad(+t.dataset.i); break;
    case 'next': nextRound(); break;
    case 'peek': peek=true; render(); break;
    case 'seeScores': peek=false; render(); break;
  }
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && (modal==='rules'||modal==='confirmNew'||modal==='confirmLeave')){ modal=null; renderLayer(); }
});
document.addEventListener('visibilitychange',()=>{
  if(document.visibilityState==='visible'){ resumeNet(); requestWake(); }
});
window.addEventListener('online',resumeNet);
window.addEventListener('pageshow',e=>{ if(e.persisted) resumeNet(); });

/* ---------- Start up ---------- */
function init(){
  let j='';
  try{
    const params=new URLSearchParams(location.search);
    j=(params.get('join')||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4);
    if(params.has('join')) history.replaceState(null,'',location.pathname);
  }catch(e){}
  const o=get(OKEY);
  if(o && typeof o.code==='string' && (o.role==='host'||o.role==='guest')){
    session=o; mode='online'; S=validState(o.S)?o.S:null;
    screen=S?'game':'lobby';
    render(); startNet(); return;
  }
  if(j){ joinCode=j; screen='join'; }
  render();
}
if('serviceWorker' in navigator && location.protocol==='https:'){
  window.addEventListener('load',()=>{ navigator.serviceWorker.register('sw.js').catch(()=>{}); });
}
init();
