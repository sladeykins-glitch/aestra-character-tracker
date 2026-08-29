// Final experience pass. Keeps all existing form controls/listeners intact and layers display UI over them.
const FX_FIELDS=[
  {id:'charName',label:'Name',icon:'✦',type:'text'},
  {id:'level',label:'Level',icon:'◆',type:'number'},
  {id:'identity',label:'Identity',icon:'◈',type:'text'},
  {id:'theme',label:'Theme',icon:'✧',type:'text'},
  {id:'origin',label:'Origin',icon:'◇',type:'text'},
  {id:'playerName',label:'Player',icon:'♙',type:'text'},
  {id:'xp',label:'XP',icon:'✦',type:'number'},
  {id:'zenit',label:'Zenit',icon:'◉',type:'number'}
];

function fxValue(id){return document.getElementById(id)?.value ?? ''}
function fxDispatch(el){el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}))}

function installDisplayMode(){
  const card=document.querySelector('#sheetView .identity-card');
  if(!card||document.getElementById('characterDisplaySummary'))return;
  card.classList.add('display-mode-card');
  const source=[...card.children];
  source.forEach(x=>x.classList.add('display-mode-source'));

  const display=document.createElement('section');
  display.id='characterDisplaySummary';
  display.className='character-display-summary';
  display.innerHTML=`
    <button type="button" class="character-name-display" data-edit-field="charName">
      <span class="character-display-kicker">CHARACTER</span>
      <strong id="displayCharName">—</strong>
    </button>
    <button type="button" class="character-level-display" data-edit-field="level"><small>LEVEL</small><strong id="displayLevel">1</strong></button>
    <div class="character-lore-grid">
      <button type="button" data-edit-field="identity"><small>IDENTITY</small><span id="displayIdentity">—</span></button>
      <button type="button" data-edit-field="theme"><small>THEME</small><span id="displayTheme">—</span></button>
      <button type="button" data-edit-field="origin"><small>ORIGIN</small><span id="displayOrigin">—</span></button>
    </div>
    <div class="character-meta-strip">
      <button type="button" data-edit-field="playerName"><i>♙</i><small>PLAYER</small><strong id="displayPlayerName">—</strong></button>
      <button type="button" data-edit-field="xp"><i>✦</i><small>XP</small><strong id="displayXp">0</strong></button>
      <button type="button" data-edit-field="zenit"><i>◉</i><small>ZENIT</small><strong id="displayZenit">0</strong></button>
    </div>
    <div id="characterClassAura" class="character-class-aura"></div>`;
  card.prepend(display);

  const modal=document.createElement('div');
  modal.id='fieldEditModal';modal.className='field-edit-modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="field-edit-backdrop" data-field-close></div><section class="field-edit-card" role="dialog" aria-modal="true" aria-labelledby="fieldEditTitle"><button type="button" class="field-edit-close" data-field-close aria-label="Close">×</button><div id="fieldEditIcon" class="field-edit-icon">✦</div><p class="eyebrow">CHARACTER DETAIL</p><h2 id="fieldEditTitle">Edit</h2><label class="field-edit-label"><span id="fieldEditLabel">Value</span><input id="fieldEditInput" autocomplete="off"></label><button type="button" class="primary field-edit-done" data-field-close>Done</button></section>`;
  document.body.appendChild(modal);
  const input=modal.querySelector('#fieldEditInput');
  let sourceEl=null;
  const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('field-edit-open');sourceEl=null};
  const open=id=>{
    const cfg=FX_FIELDS.find(f=>f.id===id), src=document.getElementById(id);if(!cfg||!src)return;
    sourceEl=src;modal.querySelector('#fieldEditTitle').textContent=`Edit ${cfg.label}`;modal.querySelector('#fieldEditLabel').textContent=cfg.label;modal.querySelector('#fieldEditIcon').textContent=cfg.icon;
    input.type=cfg.type; input.value=src.value||'';
    if(cfg.type==='number'){input.min=src.min||'';input.max=src.max||'';input.inputMode='numeric'}else input.removeAttribute('inputmode');
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('field-edit-open');requestAnimationFrame(()=>input.focus());
  };
  input.addEventListener('input',()=>{if(!sourceEl)return;sourceEl.value=input.value;sourceEl.dispatchEvent(new Event('input',{bubbles:true}));syncDisplayMode()});
  input.addEventListener('change',()=>{if(!sourceEl)return;sourceEl.value=input.value;sourceEl.dispatchEvent(new Event('change',{bubbles:true}));syncDisplayMode()});
  display.addEventListener('click',e=>{const b=e.target.closest('[data-edit-field]');if(b)open(b.dataset.editField)});
  modal.querySelectorAll('[data-field-close]').forEach(x=>x.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
  FX_FIELDS.forEach(f=>{const el=document.getElementById(f.id);el?.addEventListener('input',syncDisplayMode);el?.addEventListener('change',syncDisplayMode)});
  syncDisplayMode();
}

function getClassNames(){
  return [...document.querySelectorAll('#classesEditor .entry-row')].map(r=>r.querySelector('input')?.value?.trim()).filter(Boolean).slice(0,3);
}
function syncDisplayMode(){
  const map={displayCharName:'charName',displayLevel:'level',displayIdentity:'identity',displayTheme:'theme',displayOrigin:'origin',displayPlayerName:'playerName',displayXp:'xp',displayZenit:'zenit'};
  for(const [out,id] of Object.entries(map)){const el=document.getElementById(out);if(!el)continue;const v=String(fxValue(id)).trim();el.textContent=v||((id==='xp'||id==='zenit')?'0':'—')}
  const aura=document.getElementById('characterClassAura');if(aura){const names=getClassNames();aura.innerHTML=names.map(n=>`<span>${n}</span>`).join('');aura.classList.toggle('has-classes',names.length>0)}
}

function installAdventureHeader(){
  const combat=document.getElementById('combatDashboard');if(!combat||document.getElementById('adventureQuickHeader'))return;
  const q=document.createElement('section');q.id='adventureQuickHeader';q.className='adventure-quick-header';q.innerHTML=`<button type="button" id="adventurePortraitMini" aria-label="Open portrait"><span id="adventurePortraitFallback">?</span><img id="adventurePortraitImage" alt="" /></button><div><p>ADVENTURE</p><h2 id="adventureName">Character</h2><div id="adventureClasses"></div></div><span id="adventureLevel">LV 1</span>`;
  combat.before(q);
  const sync=()=>{
    q.querySelector('#adventureName').textContent=fxValue('charName')||'Character';q.querySelector('#adventureLevel').textContent=`LV ${fxValue('level')||1}`;q.querySelector('#adventureClasses').textContent=getClassNames().join(' · ');
    const src=document.getElementById('portraitImg'),img=q.querySelector('#adventurePortraitImage'),fb=q.querySelector('#adventurePortraitFallback');const has=src?.getAttribute('src')&&!src.classList.contains('hidden');
    if(has){img.src=src.src;img.style.display='block';fb.style.display='none'}else{img.removeAttribute('src');img.style.display='none';fb.style.display='grid';fb.textContent=(fxValue('charName')||'?')[0].toUpperCase()}
  };
  q.querySelector('#adventurePortraitMini').addEventListener('click',()=>document.querySelector('#sheetView .portrait-card')?.click());
  ['charName','level'].forEach(id=>document.getElementById(id)?.addEventListener('input',sync));document.getElementById('portraitImg')?.addEventListener('load',sync);
  new MutationObserver(sync).observe(document.getElementById('classesEditor'),{childList:true,subtree:true});sync();

  // Notes were previously marked as adventure-hidden before the mobile page re-parenting. Keep them available.
  document.getElementById('notes')?.closest('article.panel')?.classList.remove('adventure-hide');
  document.getElementById('traitsEditor')?.closest('article.panel')?.classList.add('adventure-secondary');
}

function syncResourceSlider(type){
  const card=document.querySelector(`#sheetView .resource-card[data-resource="${type}"]`),range=card?.querySelector('.integrated-range');if(!card||!range)return;
  const now=Number(document.getElementById(`${type}Now`)?.textContent)||0,max=Number(document.getElementById(`${type}MaxText`)?.textContent)||0;
  range.min='0';range.max=String(Math.max(1,max));range.value=String(Math.max(0,Math.min(max,now)));range.setAttribute('aria-valuenow',String(now));
  card.style.setProperty('--resource-ratio',`${max?Math.max(0,Math.min(100,now/max*100)):0}%`);
}
function installResourcePersistence(){
  ['hp','mp'].forEach(type=>{
    const now=document.getElementById(`${type}Now`),max=document.getElementById(`${type}MaxText`);if(!now||!max)return;
    const sync=()=>requestAnimationFrame(()=>syncResourceSlider(type));
    new MutationObserver(sync).observe(now,{childList:true,subtree:true,characterData:true});new MutationObserver(sync).observe(max,{childList:true,subtree:true,characterData:true});
    document.querySelector(`#sheetView .resource-card[data-resource="${type}"]`)?.addEventListener('input',sync);sync();setTimeout(sync,400);setTimeout(sync,1400);
  });
  window.addEventListener('pageshow',()=>{syncResourceSlider('hp');syncResourceSlider('mp')});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){syncResourceSlider('hp');syncResourceSlider('mp')}});
  document.getElementById('grandMobileNav')?.addEventListener('pointerup',()=>setTimeout(()=>{syncResourceSlider('hp');syncResourceSlider('mp')},60));
}

function installPageIdentity(){
  const shell=document.getElementById('mobilePageShell');if(!shell)return;
  const sync=()=>{const key=shell.dataset.activePage||'sheet';document.body.dataset.aestraPage=key};
  new MutationObserver(sync).observe(shell,{attributes:true,attributeFilter:['data-active-page']});sync();
}

function decorateBuildCards(){
  document.querySelectorAll('.build-entry-classes').forEach(card=>{
    const m=card.querySelector('small')?.textContent?.match(/Level\s+(\d+)/i),level=Math.max(1,Math.min(10,Number(m?.[1])||1));card.style.setProperty('--class-progress',`${level*10}%`);card.classList.toggle('class-mastered-card',level>=10);
    let badge=card.querySelector('.class-level-ring');if(!badge){badge=document.createElement('span');badge.className='class-level-ring';card.querySelector('.build-entry-glyph')?.appendChild(badge)}badge.textContent=String(level);
  });
  document.querySelectorAll('.build-entry-equipment').forEach(card=>{const slot=card.querySelector('small')?.textContent?.trim()||'Equipment';card.dataset.slot=slot.toLowerCase().replace(/[^a-z0-9]+/g,'-')});
}
function installBuildEnhancement(){
  const body=document.getElementById('buildMenuBody');if(!body)return;const run=()=>requestAnimationFrame(decorateBuildCards);new MutationObserver(run).observe(body,{childList:true,subtree:true});run();
}

function installMicroFeedback(){
  const pulse=(el,cls)=>{if(!el)return;el.classList.remove(cls);void el.offsetWidth;el.classList.add(cls);setTimeout(()=>el.classList.remove(cls),420)};
  ['hp','mp'].forEach(type=>{const text=document.getElementById(`${type}Now`),card=document.querySelector(`.resource-card[data-resource="${type}"]`);let last=Number(text?.textContent)||0;if(text)new MutationObserver(()=>{const next=Number(text.textContent)||0;if(next!==last){pulse(card,next<last?'resource-spent':'resource-gained');last=next}}).observe(text,{childList:true,subtree:true,characterData:true})});
  const fp=document.getElementById('fpText');let lastFp=Number(fp?.textContent)||0;if(fp)new MutationObserver(()=>{const n=Number(fp.textContent)||0;if(n>lastFp)pulse(document.querySelector('.fp-orb,.fabula-orb,[data-point-orb="fp"]'),'point-gained');lastFp=n}).observe(fp,{childList:true,subtree:true,characterData:true});
  document.addEventListener('aestra:status-die',e=>pulse(e.target.closest('.attr-card'),'status-die-pulse'));
}

function installFinalStyles(){
  if(document.getElementById('finalExperienceStyles'))return;const s=document.createElement('style');s.id='finalExperienceStyles';s.textContent=`
  /* Display mode removes form-field chrome from the character overview. */
  .display-mode-card .display-mode-source{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;opacity:0!important;pointer-events:none!important}
  .character-display-summary{position:relative;display:grid;grid-template-columns:minmax(0,1fr) 68px;gap:9px}.character-name-display,.character-level-display,.character-lore-grid button,.character-meta-strip button{appearance:none;border:0!important;color:inherit!important;text-align:left!important;cursor:pointer!important;background:transparent!important;box-shadow:none!important}
  .character-name-display{padding:4px 7px 9px!important;border-bottom:1px solid rgba(215,173,99,.22)!important}.character-display-kicker{display:block;font-size:.61rem;letter-spacing:.19em;color:#c8a45e}.character-name-display strong{display:block;margin-top:2px;font:700 clamp(1.9rem,5vw,2.7rem)/1 Georgia,serif;color:#f0ddb2;text-shadow:0 0 18px rgba(217,174,93,.08)}
  .character-level-display{display:grid!important;place-items:center!important;align-content:center!important;padding:7px!important;border:1px solid rgba(215,173,99,.22)!important;border-radius:16px!important;background:radial-gradient(circle at 50% 25%,rgba(215,173,99,.08),rgba(5,7,11,.52))!important}.character-level-display small{font-size:.53rem;letter-spacing:.12em;color:#aaa08d}.character-level-display strong{font:700 1.25rem/1 Georgia,serif;color:#efddb2;margin-top:4px}
  .character-lore-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}.character-lore-grid button{min-width:0;padding:9px 10px!important;border-radius:12px!important;background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(0,0,0,.12))!important;border:1px solid rgba(215,173,99,.12)!important}.character-lore-grid small,.character-meta-strip small{display:block;font-size:.49rem;letter-spacing:.12em;color:#8f8778}.character-lore-grid span{display:block;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd2bd;font:italic .86rem Georgia,serif}
  .character-meta-strip{grid-column:1/-1;display:grid;grid-template-columns:1.5fr .8fr .8fr;gap:7px}.character-meta-strip button{display:grid!important;grid-template-columns:22px 1fr;column-gap:4px;padding:8px 9px!important;border-radius:12px!important;background:rgba(4,6,10,.36)!important;border:1px solid rgba(215,173,99,.1)!important}.character-meta-strip i{grid-row:1/3;display:grid;place-items:center;color:#d7b566;font-style:normal}.character-meta-strip strong{font-size:.82rem;color:#ddd2bd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.character-class-aura{grid-column:1/-1;display:none;gap:5px;flex-wrap:wrap}.character-class-aura.has-classes{display:flex}.character-class-aura span{padding:3px 7px;border-radius:999px;font-size:.55rem;letter-spacing:.06em;color:#a9cce6;border:1px solid rgba(97,166,215,.18);background:rgba(55,108,149,.08)}
  .field-edit-modal{position:fixed;inset:0;z-index:15100;display:none;place-items:center;padding:14px}.field-edit-modal.open{display:grid}.field-edit-backdrop{position:absolute;inset:0;background:rgba(2,3,7,.82);backdrop-filter:blur(8px)}body.field-edit-open{overflow:hidden}.field-edit-card{position:relative;width:min(470px,94vw);padding:27px 18px 18px;text-align:center;border:1px solid rgba(215,173,99,.5);border-radius:21px;background:linear-gradient(160deg,rgba(22,20,27,.99),rgba(9,10,15,.99));box-shadow:0 26px 80px rgba(0,0,0,.62)}.field-edit-icon{width:54px;height:54px;margin:0 auto 5px;display:grid;place-items:center;transform:rotate(45deg);border:1px solid rgba(111,183,231,.35);color:#d6b66c}.field-edit-icon+*{margin-top:12px}.field-edit-card h2{margin:3px 0 15px;font-family:Georgia,serif;color:#f0ddb2}.field-edit-close{position:absolute!important;right:10px;top:10px;width:42px;height:42px;padding:0!important;border-radius:50%!important}.field-edit-label{display:grid!important;text-align:left!important;gap:5px!important;color:#a8a090!important}.field-edit-label input{min-height:52px!important;font-size:1rem!important}.field-edit-done{width:100%;margin-top:12px;min-height:48px}

  /* Page identity and cleaner nav. */
  @media(max-width:700px){
    body.mobile-paged-sheet #grandMobileNav{padding:5px 7px!important;gap:2px!important;border-radius:19px!important;background:rgba(8,10,15,.95)!important;backdrop-filter:blur(14px)!important}
    body.mobile-paged-sheet #grandMobileNav button{position:relative!important;min-height:52px!important;padding:5px 3px!important;border-radius:12px!important;background:transparent!important;box-shadow:none!important;font-size:.64rem!important;opacity:.64}
    body.mobile-paged-sheet #grandMobileNav button.active{opacity:1!important;background:transparent!important;box-shadow:none!important;color:#e9d5a3!important}
    body.mobile-paged-sheet #grandMobileNav button.active:before{content:'';position:absolute;top:0;left:25%;right:25%;height:2px;border-radius:999px;background:#d8b160;box-shadow:0 0 8px rgba(119,190,240,.5)}
    body.mobile-paged-sheet #grandMobileNav button.active span{filter:drop-shadow(0 0 7px rgba(112,189,244,.45));transform:translateY(-1px)}
    body.mobile-paged-sheet[data-aestra-page="build"] #grandMobileNav{border-color:rgba(137,103,197,.28)!important}
    body.mobile-paged-sheet[data-aestra-page="inventory"] #grandMobileNav{border-color:rgba(206,157,75,.28)!important}
    body.mobile-paged-sheet[data-aestra-page="notes"] #grandMobileNav{border-color:rgba(164,139,99,.28)!important}
    .save-dock-orb{right:max(12px,env(safe-area-inset-right))!important;bottom:max(76px,calc(env(safe-area-inset-bottom) + 72px))!important}.save-orb-button{width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important;opacity:.48!important}.save-orb-button.save-is-dirty,.save-orb-button.save-is-saving{opacity:1!important}.save-orb-button svg{width:20px!important;height:20px!important}
    #rulesAwareAlert.rules-orb{right:max(12px,env(safe-area-inset-right))!important;left:auto!important;bottom:max(126px,calc(env(safe-area-inset-bottom) + 122px))!important;width:44px!important;height:44px!important;min-width:44px!important;min-height:44px!important}
    #rulesAwareAlert.rules-orb:not(.has-conflicts):not(.expanded){display:none!important}
  }

  /* Slider thumb merges into the resource meter while retaining a generous invisible hit area. */
  #sheetView .integrated-range{inset:-12px -3px!important;height:54px!important;min-height:54px!important}
  #sheetView .integrated-range::-webkit-slider-thumb{-webkit-appearance:none!important;width:16px!important;height:16px!important;margin-top:6px!important;border-radius:50%!important;border:2px solid rgba(255,255,255,.56)!important;background:rgba(255,255,255,.18)!important;backdrop-filter:blur(2px);box-shadow:0 0 0 4px rgba(255,255,255,.04)!important}
  #sheetView .integrated-range::-moz-range-thumb{width:13px!important;height:13px!important;border-radius:50%!important;border:2px solid rgba(255,255,255,.56)!important;background:rgba(255,255,255,.18)!important;box-shadow:0 0 0 4px rgba(255,255,255,.04)!important}
  #sheetView .resource-hp .integrated-range::-webkit-slider-thumb{border-color:rgba(255,133,118,.82)!important;background:rgba(209,67,55,.56)!important;box-shadow:0 0 10px rgba(247,69,56,.34)!important}#sheetView .resource-mp .integrated-range::-webkit-slider-thumb{border-color:rgba(126,210,255,.82)!important;background:rgba(49,139,204,.58)!important;box-shadow:0 0 10px rgba(65,164,235,.36)!important}
  #sheetView .resource-hp .integrated-range::-moz-range-thumb{border-color:rgba(255,133,118,.82)!important;background:rgba(209,67,55,.56)!important}#sheetView .resource-mp .integrated-range::-moz-range-thumb{border-color:rgba(126,210,255,.82)!important;background:rgba(49,139,204,.58)!important}

  /* Build identity, mastery and loadout hierarchy. */
  .build-entry-classes .build-entry-glyph{position:relative;width:40px;height:40px;display:grid;place-items:center;border-radius:50%;background:conic-gradient(rgba(114,190,240,.7) var(--class-progress,10%),rgba(255,255,255,.06) 0);box-shadow:inset 0 0 0 4px rgba(8,11,17,.96)}.class-level-ring{position:absolute;inset:5px;display:grid;place-items:center;border-radius:50%;font:700 .57rem/1 system-ui,sans-serif;color:#f2ddb0;background:#0b0d12}.class-mastered-card{border-color:rgba(230,191,101,.58)!important;background:linear-gradient(100deg,rgba(33,28,18,.9),rgba(26,20,31,.86))!important}.class-mastered-card .build-entry-copy strong:after{content:'  MASTERED';font-size:.54rem;letter-spacing:.11em;color:#e5bd67}.build-entry-equipment{border-left:3px solid rgba(208,167,90,.55)!important}.build-entry-skills{border-left:3px solid rgba(105,169,215,.46)!important}.build-entry-magic{border-left:3px solid rgba(142,103,211,.5)!important}

  /* Notes feel like a journal rather than another form panel. */
  #notes{min-height:260px!important;line-height:1.55!important;font-family:Georgia,serif!important;background:linear-gradient(rgba(11,9,8,.7),rgba(9,8,8,.74)),repeating-linear-gradient(0deg,transparent 0 29px,rgba(210,177,116,.055) 29px 30px)!important;border-color:rgba(188,150,88,.22)!important;color:#ddd0b7!important}

  /* Adventure mode: combat-first, low-chrome, still recognisably Aestra. */
  .adventure-quick-header{display:none}
  body.adventure-mode .adventure-quick-header{display:grid;grid-template-columns:52px minmax(0,1fr) auto;gap:10px;align-items:center;margin:6px 0 9px;padding:9px 11px;border:1px solid rgba(103,171,218,.2);border-radius:16px;background:linear-gradient(100deg,rgba(10,16,23,.82),rgba(22,15,25,.76))}
  .adventure-quick-header button{width:48px;height:48px;padding:0!important;border-radius:13px!important;overflow:hidden!important}.adventure-quick-header img,.adventure-quick-header button span{width:100%;height:100%;object-fit:cover;place-items:center}.adventure-quick-header p{margin:0;font-size:.49rem;letter-spacing:.16em;color:#9ab7ca}.adventure-quick-header h2{margin:1px 0;font:700 1.25rem/1 Georgia,serif;color:#edd8a7}.adventure-quick-header #adventureClasses{font-size:.57rem;color:#8e9dad;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.adventure-quick-header>span{font:700 .72rem/1 system-ui,sans-serif;color:#e6c77f;border:1px solid rgba(215,173,99,.2);border-radius:999px;padding:6px 8px}
  body.adventure-mode .character-summary-header,body.adventure-mode .adventure-secondary{display:none!important}
  body.adventure-mode #combatDashboard{padding:9px!important;margin-top:5px!important;border-radius:17px!important}body.adventure-mode #combatDashboard .combat-dashboard-head{display:none!important}
  body.adventure-mode #combatDashboard .compact-attributes{margin-bottom:5px!important}body.adventure-mode #combatDashboard .attr-card{min-height:78px!important;padding:7px!important}body.adventure-mode #combatDashboard .attr-card .die-visual{min-height:38px!important;margin:1px 0!important}body.adventure-mode #combatDashboard .attr-card .attribute-effect{font-size:.52rem!important;height:12px!important}
  body.adventure-mode #combatDashboard .conditions-control{margin:5px 0 7px!important}body.adventure-mode #combatDashboard .resource-grid{gap:7px!important}body.adventure-mode #combatDashboard .integrated-resource-card{min-height:0!important;padding:10px!important}body.adventure-mode #combatDashboard .integrated-resource-card .formula,body.adventure-mode #combatDashboard .integrated-bar-hint,body.adventure-mode #combatDashboard .integrated-current-number,body.adventure-mode #combatDashboard .integrated-resource-card .adjust-row,body.adventure-mode #combatDashboard .integrated-resource-card .max-label{display:none!important}body.adventure-mode #combatDashboard .integrated-resource-bar{height:26px!important;margin:8px 0 2px!important}
  body.adventure-mode .combat-derived-panel{padding:8px!important;margin-top:7px!important}body.adventure-mode .combat-derived-panel .section-title{display:none!important}body.adventure-mode .combat-derived-panel .stat-medallion{min-height:72px!important;padding:5px!important}body.adventure-mode .combat-derived-panel .stat-medallion strong{font-size:1.05rem!important}body.adventure-mode .combat-derived-panel .stat-medallion>span:not(.stat-medallion-glyph){font-size:.49rem!important}
  body.adventure-mode #pointOrbPair{margin:5px 0!important}body.adventure-mode .mobile-page[data-mobile-page="notes"] article.panel.adventure-hide{display:block!important}
  body.adventure-mode #grandMobileNav button[data-jump="notes"]{display:flex!important}

  /* Brief feedback only, no continuous animation. */
  .resource-spent{animation:resourceSpend .34s ease}.resource-gained{animation:resourceGain .34s ease}.point-gained{animation:pointGain .38s ease}.status-die-pulse{animation:statusPulse .38s ease}
  @keyframes resourceSpend{50%{filter:brightness(1.2) saturate(1.2)}}@keyframes resourceGain{50%{filter:brightness(1.26)}}@keyframes pointGain{50%{transform:scale(1.08);filter:brightness(1.35)}}@keyframes statusPulse{50%{box-shadow:0 0 24px rgba(222,157,70,.35)!important}}
  @media(max-width:420px){.character-lore-grid{grid-template-columns:1fr!important}.character-meta-strip{grid-template-columns:1.25fr .75fr .75fr}.character-display-summary{grid-template-columns:minmax(0,1fr) 60px}.character-name-display strong{font-size:1.8rem}}
  @media(prefers-reduced-motion:reduce){.resource-spent,.resource-gained,.point-gained,.status-die-pulse{animation:none!important}}
  `;document.head.appendChild(s)
}

installFinalStyles();
installDisplayMode();
installAdventureHeader();
installResourcePersistence();
installPageIdentity();
installBuildEnhancement();
installMicroFeedback();
setTimeout(()=>{syncDisplayMode();syncResourceSlider('hp');syncResourceSlider('mp');decorateBuildCards()},350);
setTimeout(()=>{syncDisplayMode();syncResourceSlider('hp');syncResourceSlider('mp');decorateBuildCards()},1500);
