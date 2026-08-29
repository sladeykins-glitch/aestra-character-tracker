// Aestra visual/play-layout enhancement. Presentation only: rules remain in core/status layers.
const STATUS_INFO={
  slow:{icon:'⌛',label:'Slow',affects:['DEX'],tone:'slow'},
  dazed:{icon:'✦',label:'Dazed',affects:['INS'],tone:'dazed'},
  weak:{icon:'◇',label:'Weak',affects:['MIG'],tone:'weak'},
  shaken:{icon:'〰',label:'Shaken',affects:['WLP'],tone:'shaken'},
  enraged:{icon:'✹',label:'Enraged',affects:['DEX','INS'],tone:'enraged'},
  poisoned:{icon:'☠',label:'Poisoned',affects:['MIG','WLP'],tone:'poisoned'}
};
const norm=v=>String(v||'').trim().toLowerCase();
function statusKey(btn){return norm(btn.dataset.status||btn.textContent).split(/\s|↓/)[0]}
function installStatusLayout(){
  const attrs=document.querySelector('#sheetView .attribute-grid');
  const statuses=document.getElementById('statuses');
  if(!attrs||!statuses)return;
  const oldPanel=statuses.closest('article.panel');
  let panel=document.getElementById('combatStatusPanel');
  if(!panel){
    panel=document.createElement('article');panel.id='combatStatusPanel';panel.className='panel combat-status-panel';
    panel.innerHTML='<div class="section-title"><div><p class="eyebrow">Conditions</p><h3>Status Effects</h3></div><span class="muted">Tap a status to apply it</span></div><div id="statusHome"></div><div class="status-legend"><span>↓ reduces die one size</span><span>Minimum d6</span></div>';
    attrs.after(panel);
  }
  document.getElementById('statusHome').appendChild(statuses);
  if(oldPanel&&oldPanel!==panel){oldPanel.classList.add('status-placeholder-panel');const h=oldPanel.querySelector('h3');if(h)h.textContent='Status effects moved above';oldPanel.style.display='none'}
  decorateStatuses();
}
function decorateStatuses(){
  const statuses=document.getElementById('statuses');if(!statuses)return;
  [...statuses.querySelectorAll('button')].forEach(btn=>{
    const key=statusKey(btn),info=STATUS_INFO[key];if(!info)return;
    btn.classList.add('aestra-status',`status-${info.tone}`);btn.dataset.status=key;
    btn.innerHTML=`<span class="status-icon">${info.icon}</span><span class="status-copy"><strong>${info.label}</strong><small>${info.affects.join(' + ')} ↓</small></span>`;
  });
  updateAttributeEffects();
}
function dieValue(id){return document.getElementById(id)?.value||'d6'}
function updateAttributeEffects(){
  const active=[...document.querySelectorAll('#statuses button.active,#statuses button[aria-pressed="true"]')].map(statusKey);
  const affected={MIG:[],DEX:[],INS:[],WLP:[]};
  active.forEach(k=>STATUS_INFO[k]?.affects.forEach(a=>affected[a].push(STATUS_INFO[k].label)));
  const map={MIG:['migBase','mig'],DEX:['dexBase','dex'],INS:['insBase','ins'],WLP:['wlpBase','wlp']};
  document.querySelectorAll('#sheetView .attr-card').forEach(card=>card.classList.remove('status-affected','die-changed'));
  Object.entries(map).forEach(([attr,[baseId,currentId]])=>{
    const current=document.getElementById(currentId),base=document.getElementById(baseId),card=current?.closest('.attr-card');if(!card)return;
    let visual=card.querySelector('.die-visual');if(!visual){visual=document.createElement('div');visual.className='die-visual';card.insertBefore(visual,card.querySelector('label'))}
    visual.innerHTML=`<span class="die-current">${dieValue(currentId)}</span><small>base ${dieValue(baseId)}</small>`;
    let effect=card.querySelector('.attribute-effect');if(!effect){effect=document.createElement('div');effect.className='attribute-effect';card.appendChild(effect)}
    if(affected[attr].length){card.classList.add('status-affected');effect.textContent=`${affected[attr].join(' + ')} ↓`;effect.title=`Affected by ${affected[attr].join(', ')}`}
    else effect.textContent='';
    if(current?.dataset.lastVisual&&current.dataset.lastVisual!==current.value){card.classList.remove('die-changed');void card.offsetWidth;card.classList.add('die-changed')}
    if(current)current.dataset.lastVisual=current.value;
  });
}
function resourceEffects(){
  document.querySelectorAll('.resource-card').forEach(card=>{
    const type=card.dataset.resource;card.classList.add(`resource-${type}`);
    const now=document.getElementById(`${type}Now`),max=document.getElementById(`${type}MaxText`);if(!now||!max)return;
    const n=Number(now.textContent)||0,m=Number(max.textContent)||0;
    if(type==='hp')card.classList.toggle('in-crisis',m>0&&n<=Math.floor(m/2));
  });
}
function installAtmosphere(){
  if(document.getElementById('aestraAtmosphere'))return;const layer=document.createElement('div');layer.id='aestraAtmosphere';layer.className='aestra-atmosphere';layer.setAttribute('aria-hidden','true');layer.innerHTML='<i></i><i></i><i></i><i></i><i></i><i></i>';document.body.prepend(layer)
}
function installStyles(){
  if(document.getElementById('aestraVisualStyles'))return;const s=document.createElement('style');s.id='aestraVisualStyles';s.textContent=`
  body{position:relative}.app-shell{position:relative;z-index:1}.aestra-atmosphere{position:fixed;inset:0;pointer-events:none;overflow:hidden;z-index:0;opacity:.42}.aestra-atmosphere i{position:absolute;width:3px;height:3px;border-radius:50%;background:rgba(218,180,104,.42);box-shadow:0 0 10px rgba(218,180,104,.25);animation:aestraDrift 16s linear infinite}.aestra-atmosphere i:nth-child(1){left:8%;top:92%;animation-delay:-2s}.aestra-atmosphere i:nth-child(2){left:28%;top:70%;animation-delay:-9s;animation-duration:22s}.aestra-atmosphere i:nth-child(3){left:52%;top:96%;animation-delay:-5s;animation-duration:19s}.aestra-atmosphere i:nth-child(4){left:73%;top:80%;animation-delay:-12s;animation-duration:24s}.aestra-atmosphere i:nth-child(5){left:91%;top:90%;animation-delay:-7s}.aestra-atmosphere i:nth-child(6){left:61%;top:62%;animation-delay:-15s;animation-duration:26s}@keyframes aestraDrift{0%{transform:translate3d(0,0,0);opacity:0}15%{opacity:.65}100%{transform:translate3d(18px,-75vh,0);opacity:0}}
  .combat-status-panel{margin-top:12px;border-color:rgba(196,151,73,.34);background:linear-gradient(145deg,rgba(44,34,24,.96),rgba(24,20,16,.96));box-shadow:inset 0 1px rgba(255,255,255,.025),0 10px 32px rgba(0,0,0,.18)}#statuses.chips{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.aestra-status{min-height:58px!important;display:flex!important;align-items:center!important;justify-content:flex-start!important;gap:9px!important;text-align:left!important;padding:9px 11px!important;transition:transform .16s ease,box-shadow .2s ease,border-color .2s ease,background .2s ease!important}.aestra-status:active{transform:scale(.97)}.status-icon{font-size:1.35rem;line-height:1;width:25px;text-align:center;opacity:.72}.status-copy{display:grid;gap:2px}.status-copy strong{font-size:.92rem}.status-copy small{font-size:.72rem;opacity:.64}.aestra-status.active,.aestra-status[aria-pressed="true"]{border-color:rgba(231,184,99,.75)!important;background:linear-gradient(145deg,rgba(112,75,36,.5),rgba(46,33,23,.85))!important;box-shadow:0 0 0 1px rgba(218,164,76,.15),0 0 20px rgba(218,164,76,.12)!important}.aestra-status.active .status-icon,.aestra-status[aria-pressed="true"] .status-icon{opacity:1;filter:drop-shadow(0 0 5px rgba(240,196,108,.45))}.status-poisoned.active,.status-poisoned[aria-pressed="true"]{box-shadow:0 0 18px rgba(118,145,80,.16)!important}.status-enraged.active,.status-enraged[aria-pressed="true"]{box-shadow:0 0 18px rgba(181,76,55,.18)!important}.status-legend{display:flex;justify-content:space-between;gap:10px;margin-top:9px;font-size:.72rem;opacity:.58}
  .attr-card{position:relative;overflow:hidden;transition:border-color .25s ease,box-shadow .25s ease,transform .2s ease}.attr-card>span{position:relative;z-index:1}.die-visual{display:grid;place-items:center;margin:4px 0 9px;padding:8px 4px;border:1px solid rgba(197,155,83,.18);border-radius:12px;background:radial-gradient(circle at 50% 30%,rgba(195,148,73,.1),transparent 67%)}.die-current{font-family:Georgia,serif;font-weight:700;font-size:1.55rem;line-height:1;color:#e8c786;text-shadow:0 0 13px rgba(222,175,90,.15)}.die-visual small{font-size:.65rem;opacity:.5;margin-top:3px}.attribute-effect{height:15px;margin-top:5px;font-size:.66rem;color:#e2aa62;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.attr-card.status-affected{border-color:rgba(222,164,76,.62);box-shadow:inset 0 0 20px rgba(184,126,52,.08),0 0 17px rgba(185,126,52,.08)}.attr-card.status-affected:after{content:'';position:absolute;inset:-45%;background:linear-gradient(100deg,transparent 43%,rgba(233,190,112,.07) 50%,transparent 57%);animation:statusSweep 3.6s linear infinite;pointer-events:none}@keyframes statusSweep{from{transform:translateX(-25%)}to{transform:translateX(25%)}}.attr-card.die-changed .die-current{animation:dieSettle .38s ease}@keyframes dieSettle{0%{transform:translateY(-5px) scale(1.15);opacity:.2}60%{transform:translateY(2px) scale(.97)}100%{transform:none;opacity:1}}
  .resource-card{transition:border-color .25s ease,box-shadow .25s ease}.resource-hp .bar span{box-shadow:0 0 12px rgba(190,94,70,.18)}.resource-mp .bar span{box-shadow:0 0 12px rgba(113,138,196,.18)}.resource-ip .bar span{box-shadow:0 0 12px rgba(205,164,78,.18)}.resource-hp.in-crisis{border-color:rgba(177,67,51,.62);box-shadow:inset 0 0 24px rgba(148,45,35,.08),0 0 16px rgba(148,45,35,.08)}.resource-hp.in-crisis .resource-head strong{animation:crisisPulse 2s ease-in-out infinite;color:#e4a091}@keyframes crisisPulse{50%{text-shadow:0 0 12px rgba(203,77,57,.55)}}
  @media(max-width:640px){#statuses.chips{grid-template-columns:repeat(2,minmax(0,1fr))}.combat-status-panel{margin-top:8px}.die-current{font-size:1.35rem}.status-legend{font-size:.66rem}}
  @media(prefers-reduced-motion:reduce){.aestra-atmosphere,.attr-card.status-affected:after{display:none}.resource-hp.in-crisis .resource-head strong,.attr-card.die-changed .die-current{animation:none}}
  `;document.head.appendChild(s)
}
function observe(){
  const statuses=document.getElementById('statuses');if(statuses){const mo=new MutationObserver(()=>{decorateStatuses();resourceEffects()});mo.observe(statuses,{childList:true,subtree:true,attributes:true,attributeFilter:['class','aria-pressed']})}
  const sheet=document.getElementById('sheetView');sheet?.addEventListener('click',()=>setTimeout(()=>{decorateStatuses();resourceEffects()},25));sheet?.addEventListener('input',()=>requestAnimationFrame(()=>{updateAttributeEffects();resourceEffects()}));sheet?.addEventListener('change',()=>requestAnimationFrame(()=>{updateAttributeEffects();resourceEffects()}));
}
installStyles();installAtmosphere();installStatusLayout();observe();resourceEffects();
