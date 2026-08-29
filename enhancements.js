const DIE_SIZES=[6,8,10,12];
const STATUS_REDUCTIONS={
  Slow:{dex:1},
  Dazed:{ins:1},
  Weak:{mig:1},
  Shaken:{wlp:1},
  Enraged:{dex:1,ins:1},
  Poisoned:{mig:1,wlp:1}
};

function dieNumber(v){return Number(String(v||'d6').replace('d',''))||6}
function reducedDie(base,steps){
  const idx=Math.max(0,DIE_SIZES.indexOf(dieNumber(base)));
  return `d${DIE_SIZES[Math.max(0,idx-steps)]}`;
}
function activeStatuses(){return [...document.querySelectorAll('#statuses .status-chip.active')].map(b=>b.textContent.trim())}
function applyStatusDice(){
  const reductions={mig:0,dex:0,ins:0,wlp:0};
  for(const status of activeStatuses()) for(const [attr,n] of Object.entries(STATUS_REDUCTIONS[status]||{})) reductions[attr]+=n;
  for(const attr of ['mig','dex','ins','wlp']){
    const base=document.getElementById(`${attr}Base`), current=document.getElementById(attr);
    if(base&&current) current.value=reducedDie(base.value,reductions[attr]);
  }
  // One change event is enough: the core sheet reads all four current dice together.
  document.getElementById('mig')?.dispatchEvent(new Event('change',{bubbles:true}));
  updateStatusNote(reductions);
}
function updateStatusNote(reductions){
  let note=document.getElementById('statusRulesNote');
  const host=document.getElementById('statuses')?.parentElement;
  if(!host)return;
  if(!note){note=document.createElement('p');note.id='statusRulesNote';note.className='muted status-rules-note';host.appendChild(note)}
  const affected=Object.entries(reductions).filter(([,n])=>n>0).map(([a,n])=>`${a.toUpperCase()} −${n} step${n>1?'s':''}`);
  note.textContent=affected.length?`${affected.join(' · ')} · minimum d6`:'Statuses automatically reduce current Attribute dice; minimum d6.';
}

function resourceCurrent(card){return Number(card.querySelector('[id$="Now"]')?.textContent)||0}
function resourceMax(card){return Number(card.querySelector('[id$="MaxText"]')?.textContent)||0}
function syncResourceControl(card){
  const box=card.querySelector('.direct-resource'); if(!box)return;
  const now=resourceCurrent(card), max=resourceMax(card);
  const number=box.querySelector('input[type="number"]'), range=box.querySelector('input[type="range"]');
  number.max=max; number.value=now; range.max=Math.max(1,max); range.value=now;
  if(card.dataset.resource==='hp'){
    const ratio=max?now/max:0;
    card.dataset.health=now===0?'zero':ratio<=.25?'critical':ratio<=.5?'low':'healthy';
    const warning=box.querySelector('.zero-warning');
    warning.textContent=now===0?'0 HP — resolve Surrender or Sacrifice per the Fabula Ultima rules.':'';
  }
}
function clickDelta(card,delta){
  const btn=[...card.querySelectorAll('[data-delta]')].find(b=>Number(b.dataset.delta)===delta);
  if(btn)btn.click();
}
function setResource(card,target){
  const max=resourceMax(card); target=Math.max(0,Math.min(max,Number(target)||0));
  let diff=target-resourceCurrent(card);
  const big=diff>0?5:-5, small=diff>0?1:-1;
  while(Math.abs(diff)>=5 && [...card.querySelectorAll('[data-delta]')].some(b=>Number(b.dataset.delta)===big)){clickDelta(card,big);diff-=big}
  while(diff!==0){clickDelta(card,small);diff-=small}
  syncResourceControl(card);
}
function installResourceControls(){
  document.querySelectorAll('.resource-card').forEach(card=>{
    if(card.querySelector('.direct-resource'))return;
    const box=document.createElement('div');box.className='direct-resource';
    box.innerHTML='<label>Current <input class="resource-number" type="number" min="0" inputmode="numeric"></label><input class="resource-slider" type="range" min="0" step="1" aria-label="Current resource value"><small class="zero-warning"></small>';
    const bar=card.querySelector('.bar'); (bar||card.querySelector('.adjust-row'))?.insertAdjacentElement('afterend',box);
    const number=box.querySelector('.resource-number'), range=box.querySelector('.resource-slider');
    number.addEventListener('change',()=>setResource(card,number.value));
    range.addEventListener('input',()=>setResource(card,range.value));
    syncResourceControl(card);
  });
}
function syncAllResources(){document.querySelectorAll('.resource-card').forEach(syncResourceControl)}

function installAdventureMode(){
  const tabs=document.querySelector('.tabs'); if(!tabs||document.getElementById('adventureModeBtn'))return;
  const b=document.createElement('button');b.id='adventureModeBtn';b.type='button';b.className='tab adventure-toggle';b.textContent='Adventure Mode';tabs.appendChild(b);
  document.querySelector('.identity-grid')?.classList.add('adventure-hide');
  document.querySelectorAll('#sheetView > article.panel').forEach(p=>{const h=p.querySelector('h3')?.textContent.trim();if(['Identity · Theme · Origin traits','Classes','Notes'].includes(h))p.classList.add('adventure-hide')});
  b.addEventListener('click',()=>{const on=document.body.classList.toggle('adventure-mode');b.classList.toggle('active',on);b.textContent=on?'Full Sheet':'Adventure Mode';window.scrollTo({top:0,behavior:'smooth'})});
}
function installStyles(){
  const s=document.createElement('style');s.textContent=`
.direct-resource{display:grid;grid-template-columns:minmax(92px,130px) 1fr;gap:10px;align-items:end;margin:12px 0}.direct-resource label{margin:0}.resource-number{font-size:1.15rem;font-weight:700;text-align:center}.resource-slider{width:100%;min-height:42px;accent-color:currentColor}.zero-warning{grid-column:1/-1;min-height:1em;font-weight:700}.status-rules-note{margin:.65rem 0 0}.resource-card[data-health="critical"] .resource-head strong,.resource-card[data-health="zero"] .resource-head strong{color:#e35d5d}.resource-card[data-health="low"] .resource-head strong{color:#d9a441}.adventure-mode .adventure-hide{display:none!important}.adventure-toggle{margin-left:auto}
@media(max-width:640px){.direct-resource{grid-template-columns:96px 1fr}.resource-slider{min-height:48px}.resource-card .adjust-row button,.status-chip{min-height:44px}.adventure-toggle{margin-left:0}}
  `;document.head.appendChild(s);
}

// Core status buttons rebuild themselves, so use delegated listeners.
document.addEventListener('click',e=>{
  if(e.target.closest('#statuses .status-chip')) setTimeout(applyStatusDice,0);
  if(e.target.closest('.resource-card [data-delta]')) setTimeout(syncAllResources,0);
});
for(const id of ['migBase','dexBase','insBase','wlpBase']) document.getElementById(id)?.addEventListener('change',()=>setTimeout(applyStatusDice,0));

installStyles();installResourceControls();installAdventureMode();
// Allow the core app to finish loading a saved character before calculating UI extras.
setTimeout(()=>{applyStatusDice();syncAllResources()},250);
setTimeout(()=>{applyStatusDice();syncAllResources()},1200);
