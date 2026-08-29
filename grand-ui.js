// Final presentation layer: compact header, combat dashboard, stat medallions,
// condition feedback, build-card distinction, paired floating actions, and mobile nav.
// This module deliberately reuses all existing inputs/buttons so Fabula rules and saves remain intact.

const GRAND_STATUS_MAP={
  Slow:['dex'],Dazed:['ins'],Weak:['mig'],Shaken:['wlp'],Enraged:['dex','ins'],Poisoned:['mig','wlp']
};

function grandInstallHeader(){
  document.body.classList.add('grand-ui');
  document.getElementById('aestraHero')?.classList.add('grand-hero');
  document.querySelector('.topbar')?.classList.add('grand-topbar');
  document.querySelector('#sheetView .identity-grid')?.classList.add('grand-character-header');
}

function grandInstallCombatDashboard(){
  if(document.getElementById('combatDashboard'))return;
  const sheet=document.getElementById('sheetView');
  const attrs=sheet?.querySelector('.attribute-grid');
  const resources=sheet?.querySelector('.resource-grid');
  const conditions=document.getElementById('conditionsControl');
  const points=document.getElementById('pointOrbPair');
  const initiative=document.getElementById('initiativeText');
  const derived=initiative?.closest('article.panel');
  if(!sheet||!attrs||!resources||!conditions||!derived)return;

  const dash=document.createElement('section');
  dash.id='combatDashboard';
  dash.className='combat-dashboard';
  dash.innerHTML='<div class="combat-dashboard-head"><div><p class="eyebrow">Combat overview</p><h2>Battle Dashboard</h2></div><small>Tap attributes or defence stats to edit</small></div>';
  attrs.before(dash);
  dash.append(attrs,conditions,resources);
  if(points)dash.append(points);
  dash.append(derived);
  derived.classList.add('combat-derived-panel');
}

function grandInstallDerivedMedallions(){
  const panel=document.querySelector('#combatDashboard .combat-derived-panel');
  if(!panel||document.getElementById('derivedEditModal'))return;
  panel.querySelector('.section-title')?.classList.add('grand-derived-heading');
  const cards=[...panel.querySelectorAll('.derived')];
  const meta=[
    ['initiativeOther','Initiative','Turn order modifier','✦'],
    ['defenceOther','Defence','Physical defence modifier','⬟'],
    ['magicDefenceOther','Magic Defence','Magical defence modifier','✧'],
    [null,'Crisis','Half of maximum HP','◆']
  ];
  cards.forEach((card,i)=>{
    card.classList.add('stat-medallion');
    card.dataset.statIndex=String(i);
    if(meta[i]?.[0]){
      card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-label',`Edit ${meta[i][1]} modifier`);
    }
    const glyph=document.createElement('span');glyph.className='stat-medallion-glyph';glyph.textContent=meta[i]?.[3]||'◆';card.prepend(glyph);
  });

  const modal=document.createElement('div');modal.id='derivedEditModal';modal.className='derived-edit-modal';modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`<div class="derived-edit-backdrop" data-derived-close></div><section class="derived-edit-card" role="dialog" aria-modal="true" aria-labelledby="derivedEditTitle"><button type="button" class="derived-edit-close" data-derived-close aria-label="Close">×</button><div id="derivedEditGlyph" class="derived-edit-glyph">✦</div><p class="eyebrow">DERIVED STAT</p><h2 id="derivedEditTitle">Initiative</h2><p id="derivedEditHelp" class="derived-edit-help"></p><div id="derivedEditValue" class="derived-edit-value">0</div><label class="derived-edit-field">Other modifier<input id="derivedEditInput" type="number" inputmode="numeric"></label><button type="button" class="derived-edit-done" data-derived-close>Done</button></section>`;
  document.body.appendChild(modal);
  const proxy=modal.querySelector('#derivedEditInput'),value=modal.querySelector('#derivedEditValue'),title=modal.querySelector('#derivedEditTitle'),help=modal.querySelector('#derivedEditHelp'),glyph=modal.querySelector('#derivedEditGlyph');
  let source=null;
  const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('derived-modal-open');source=null};
  const open=i=>{
    const cfg=meta[i]; if(!cfg?.[0])return;
    source=document.getElementById(cfg[0]); if(!source)return;
    const card=cards[i]; title.textContent=cfg[1];help.textContent=cfg[2];glyph.textContent=cfg[3];value.textContent=card.querySelector('strong')?.textContent||'0';proxy.value=source.value||0;
    modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('derived-modal-open');requestAnimationFrame(()=>proxy.focus());
  };
  proxy.addEventListener('input',()=>{if(!source)return;source.value=proxy.value;source.dispatchEvent(new Event('input',{bubbles:true}));value.textContent=source.closest('.derived')?.querySelector('strong')?.textContent||value.textContent});
  proxy.addEventListener('change',()=>{if(!source)return;source.dispatchEvent(new Event('change',{bubbles:true}))});
  cards.forEach((card,i)=>{if(!meta[i]?.[0])return;card.addEventListener('click',e=>{if(e.target.closest('input,label'))return;open(i)});card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open(i)}})});
  modal.querySelectorAll('[data-derived-close]').forEach(x=>x.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
}

function grandInstallConditionFeedback(){
  const statuses=document.getElementById('statuses'),control=document.getElementById('conditionsControl'),attrs=document.querySelectorAll('#sheetView .attr-card[data-attr-key]');
  if(!statuses||!control||document.getElementById('activeConditionRibbon'))return;
  const ribbon=document.createElement('div');ribbon.id='activeConditionRibbon';ribbon.className='active-condition-ribbon';control.appendChild(ribbon);
  const update=()=>{
    const active=[...statuses.querySelectorAll('.status-chip.active')].map(b=>b.textContent.trim());
    ribbon.innerHTML=active.map(s=>`<span>${s}</span>`).join('');
    ribbon.classList.toggle('has-items',active.length>0);
    attrs.forEach(card=>card.classList.remove('status-affected'));
    for(const s of active)for(const key of GRAND_STATUS_MAP[s]||[])document.querySelector(`#sheetView .attr-card[data-attr-key="${key}"]`)?.classList.add('status-affected');
  };
  statuses.addEventListener('click',()=>requestAnimationFrame(update));statuses.addEventListener('change',()=>requestAnimationFrame(update));
  new MutationObserver(update).observe(statuses,{subtree:true,attributes:true,attributeFilter:['class','aria-pressed']});
  update();
}

function grandInstallBuildStyling(){
  document.getElementById('buildMenu')?.classList.add('grand-build-menu');
}

function grandInstallMobileNav(){
  if(document.getElementById('grandMobileNav'))return;
  const sheet=document.getElementById('sheetView');if(!sheet)return;
  const nav=document.createElement('nav');nav.id='grandMobileNav';nav.className='grand-mobile-nav';nav.setAttribute('aria-label','Character sheet sections');
  nav.innerHTML=`<button type="button" data-jump="sheet"><span>◇</span>Sheet</button><button type="button" data-jump="build"><span>✦</span>Build</button><button type="button" data-jump="inventory"><span>▣</span>Inventory</button><button type="button" data-jump="notes"><span>≡</span>Notes</button>`;
  document.body.appendChild(nav);
  const targetFor=key=>{
    if(key==='sheet')return document.getElementById('combatDashboard')||sheet;
    if(key==='build')return document.getElementById('buildMenu');
    if(key==='inventory')return document.getElementById('inventoryEditor')?.closest('article.panel');
    if(key==='notes')return document.getElementById('notes')?.closest('article.panel');
  };
  nav.addEventListener('click',e=>{const b=e.target.closest('button[data-jump]');if(!b)return;targetFor(b.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'})});
  const sync=()=>{const app=document.getElementById('appView'),sheetView=document.getElementById('sheetView'),auth=document.getElementById('authView');const show=app&&!app.classList.contains('hidden')&&sheetView&&!sheetView.classList.contains('hidden')&&(!auth||auth.classList.contains('hidden'));nav.classList.toggle('nav-hidden',!show)};
  const ob=new MutationObserver(sync);['appView','sheetView','authView','gmView'].forEach(id=>{const x=document.getElementById(id);if(x)ob.observe(x,{attributes:true,attributeFilter:['class']})});sync();
}

function grandInstallStyles(){
  if(document.getElementById('grandUiStyles'))return;
  const s=document.createElement('style');s.id='grandUiStyles';s.textContent=`
  /* tighter title/header area */
  body.grand-ui #aestraHero.grand-hero{padding-top:14px!important;padding-bottom:8px!important;min-height:auto!important}
  body.grand-ui #aestraHero .aestra-wordmark{font-size:clamp(3rem,10vw,5.5rem)!important;line-height:.9!important}
  body.grand-ui #aestraHero .aestra-emblem{transform:scale(.68)!important;margin-bottom:-4px!important}
  body.grand-ui .grand-topbar{padding-top:8px!important;padding-bottom:10px!important;min-height:0!important}
  body.grand-ui .grand-topbar h1{font-size:clamp(1.55rem,5vw,2.4rem)!important;margin:.05em 0!important}
  body.grand-ui .grand-character-header{gap:10px!important;margin-top:8px!important}
  body.grand-ui .grand-character-header .portrait-card,body.grand-ui .grand-character-header .identity-card{padding:14px!important}

  /* one intentional combat region */
  #combatDashboard{position:relative;margin:14px 0 18px;padding:14px;border:1px solid rgba(211,171,91,.32);border-radius:22px;background:linear-gradient(160deg,rgba(11,14,21,.82),rgba(13,10,17,.8));box-shadow:inset 0 0 0 1px rgba(255,255,255,.018),0 16px 36px rgba(0,0,0,.18)}
  #combatDashboard:before{content:'';position:absolute;inset:0;pointer-events:none;border-radius:inherit;background:radial-gradient(circle at 18% 0,rgba(78,156,213,.07),transparent 30%),radial-gradient(circle at 82% 0,rgba(145,85,196,.06),transparent 30%)}
  .combat-dashboard-head{position:relative;display:flex;justify-content:space-between;align-items:end;gap:12px;margin:0 2px 11px}.combat-dashboard-head h2{margin:1px 0 0;font-family:Georgia,serif;font-size:1.25rem;color:#ead8ad}.combat-dashboard-head small{color:#827b6e;font-size:.68rem}
  #combatDashboard .compact-attributes{position:relative;margin-bottom:8px}
  #combatDashboard .conditions-control{position:relative;margin:8px 0 12px}
  #combatDashboard .resource-grid{position:relative;margin-top:0!important;gap:10px!important}
  #combatDashboard .integrated-resource-card{min-height:0!important;padding:15px 14px 13px!important}
  #combatDashboard .integrated-resource-card .resource-head{margin-bottom:3px!important}
  #combatDashboard .integrated-resource-card .formula{font-size:.68rem;opacity:.56}
  #combatDashboard .integrated-resource-bar{height:34px!important;margin:12px 0 4px!important}
  #combatDashboard .integrated-range::-webkit-slider-runnable-track{height:34px!important}#combatDashboard .integrated-range::-moz-range-track{height:34px!important}
  #combatDashboard .resource-head strong{font-size:1.5rem!important}
  #combatDashboard .integrated-bar-hint{margin-bottom:4px!important}

  /* dice/crystal attribute treatment */
  #combatDashboard .attr-card.attr-compact .die-visual{position:relative!important;min-height:54px!important;border-radius:16px!important;clip-path:polygon(14% 0,86% 0,100% 25%,92% 82%,72% 100%,28% 100%,8% 82%,0 25%)!important;display:grid!important;place-items:center!important;padding:7px!important}
  #combatDashboard .attr-card.attr-compact .die-visual:after{content:'';position:absolute;inset:3px;clip-path:inherit;border:1px solid rgba(255,255,255,.08);pointer-events:none}
  #combatDashboard .attr-card.attr-compact .die-current{font-size:1.35rem!important;z-index:1}
  #combatDashboard .attr-card.status-affected{transform:translateY(-2px);filter:saturate(1.12)}
  #combatDashboard .attr-card.status-affected:after{content:'STATUS';display:block!important;position:absolute;left:50%;bottom:3px;right:auto!important;top:auto!important;transform:translateX(-50%);font:700 .43rem/1 system-ui,sans-serif;letter-spacing:.12em;color:#ffd18a;background:rgba(82,43,19,.72);border:1px solid rgba(226,145,68,.34);border-radius:999px;padding:2px 5px}

  /* condition ribbon */
  .active-condition-ribbon{display:none;gap:5px;flex-wrap:wrap;padding:0 10px 9px}.active-condition-ribbon.has-items{display:flex}.active-condition-ribbon span{font-size:.62rem;padding:4px 7px;border-radius:999px;border:1px solid rgba(220,141,61,.34);background:rgba(87,44,22,.35);color:#e8b779}

  /* derived stats as medallions */
  .combat-derived-panel{position:relative;margin-top:12px!important;padding:13px!important;background:rgba(6,8,13,.48)!important}
  .combat-derived-panel .grand-derived-heading{margin-bottom:8px!important}.combat-derived-panel .grand-derived-heading .muted{display:none!important}
  .combat-derived-panel .derived-grid{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:8px!important}
  .combat-derived-panel .stat-medallion{position:relative!important;min-height:106px!important;padding:10px 6px!important;border-radius:50% 50% 46% 46%/42% 42% 58% 58%!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;background:radial-gradient(circle at 50% 34%,rgba(255,255,255,.055),rgba(15,17,23,.92) 62%)!important;border:1px solid rgba(208,172,99,.32)!important;box-shadow:inset 0 0 18px rgba(215,173,99,.035),0 5px 14px rgba(0,0,0,.22)!important;cursor:pointer}
  .stat-medallion-glyph{font-size:.85rem;color:#c9a969;opacity:.8;margin-bottom:1px}.combat-derived-panel .stat-medallion>span:not(.stat-medallion-glyph){font-size:.62rem!important;letter-spacing:.04em}.combat-derived-panel .stat-medallion strong{font:700 1.45rem/1 Georgia,serif!important;color:#f1dfb7!important;margin:3px 0!important}.combat-derived-panel .stat-medallion label{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important}.combat-derived-panel .stat-medallion small{font-size:.5rem!important;opacity:.5}
  .derived-edit-modal{position:fixed;inset:0;z-index:12200;display:none;place-items:center;padding:16px}.derived-edit-modal.open{display:grid}.derived-edit-backdrop{position:absolute;inset:0;background:rgba(2,3,7,.78);backdrop-filter:blur(7px)}body.derived-modal-open{overflow:hidden}.derived-edit-card{position:relative;width:min(480px,94vw);padding:26px 20px 20px;text-align:center;border:1px solid rgba(213,169,91,.56);border-radius:20px;background:linear-gradient(160deg,rgba(23,21,28,.99),rgba(10,11,16,.99));box-shadow:0 22px 70px rgba(0,0,0,.6)}.derived-edit-close{position:absolute!important;right:11px;top:11px;width:40px;height:40px;padding:0!important;border-radius:50%!important}.derived-edit-glyph{font-size:2rem;color:#d7b66d}.derived-edit-card h2{font-family:Georgia,serif;color:#f0deb5}.derived-edit-help{font-size:.78rem;color:#8e8779}.derived-edit-value{font:700 2.5rem/1 Georgia,serif;color:#f0deb5;margin:14px}.derived-edit-field{display:grid;gap:6px;text-align:left;font-size:.76rem;color:#afa592}.derived-edit-field input{min-height:52px;font-size:1.1rem}.derived-edit-done{width:100%;margin-top:14px!important;min-height:46px;background:linear-gradient(180deg,#d6aa61,#a87333)!important;color:#191108!important;font-weight:800!important}

  /* build cards get different silhouettes/types */
  .grand-build-menu .build-entry-classes{border-left:4px solid rgba(215,173,99,.72)!important;background:linear-gradient(100deg,rgba(44,34,20,.56),rgba(19,21,28,.86))!important}
  .grand-build-menu .build-entry-skills{border-left:4px solid rgba(111,185,231,.65)!important;background:linear-gradient(100deg,rgba(21,43,59,.5),rgba(19,21,28,.86))!important}
  .grand-build-menu .build-entry-equipment{border-left:4px solid rgba(171,177,184,.58)!important;border-radius:8px 17px 8px 17px!important;background:linear-gradient(100deg,rgba(48,48,50,.48),rgba(19,21,28,.86))!important}
  .grand-build-menu .build-entry-magic{border-left:4px solid rgba(158,107,220,.68)!important;border-radius:17px 8px 17px 8px!important;background:linear-gradient(100deg,rgba(56,31,77,.5),rgba(19,21,28,.86))!important}
  .grand-build-menu .build-entry-glyph{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.06)}

  /* floating actions become a matched right-side pair */
  #rulesAwareAlert.rules-orb{left:auto!important;right:max(14px,env(safe-area-inset-right))!important;bottom:max(82px,calc(env(safe-area-inset-bottom) + 78px))!important}
  #rulesAwareAlert.rules-orb .rules-orb-popover{left:auto!important;right:0!important}

  /* mobile section navigation */
  .grand-mobile-nav{display:none;position:fixed;z-index:9980;left:50%;transform:translateX(-50%);bottom:max(10px,calc(env(safe-area-inset-bottom) + 6px));width:min(390px,calc(100vw - 116px));grid-template-columns:repeat(4,1fr);padding:5px;border:1px solid rgba(209,170,93,.34);border-radius:18px;background:rgba(10,11,15,.94);backdrop-filter:blur(12px);box-shadow:0 8px 28px rgba(0,0,0,.45)}.grand-mobile-nav.nav-hidden{display:none!important}.grand-mobile-nav button{min-width:0!important;min-height:47px!important;padding:5px 3px!important;border:0!important;background:transparent!important;color:#bcb3a2!important;border-radius:12px!important;display:flex!important;flex-direction:column!important;gap:1px!important;align-items:center!important;justify-content:center!important;font-size:.6rem!important}.grand-mobile-nav button span{font-size:.95rem;color:#d2ad65}
  @media(max-width:760px){.grand-mobile-nav{display:grid}.save-dock-orb{bottom:max(12px,calc(env(safe-area-inset-bottom) + 8px))!important}.combat-dashboard-head small{display:none}.combat-derived-panel .derived-grid{grid-template-columns:repeat(4,minmax(0,1fr))!important}.combat-derived-panel .stat-medallion{min-height:86px!important}.combat-derived-panel .stat-medallion strong{font-size:1.18rem!important}body.grand-ui #aestraHero .aestra-wordmark{font-size:3.25rem!important}body.grand-ui #aestraHero .aestra-subtitle{transform:scale(.84);margin-top:1px!important}body.grand-ui .grand-topbar{display:grid!important;grid-template-columns:1fr auto!important;gap:8px!important}.grand-character-header{grid-template-columns:96px minmax(0,1fr)!important}.grand-character-header .portrait-card{min-height:0!important}.grand-character-header .portrait-fallback,.grand-character-header .portrait{min-height:76px!important;height:76px!important}.grand-character-header .small-label{display:none!important}#combatDashboard{padding:10px;border-radius:18px}.grand-mobile-nav~*{}#sheetView{padding-bottom:90px!important}}
  @media(max-width:430px){.combat-derived-panel .stat-medallion{min-height:78px!important;padding:7px 3px!important}.combat-derived-panel .stat-medallion>span:not(.stat-medallion-glyph){font-size:.52rem!important}.combat-derived-panel .stat-medallion strong{font-size:1.05rem!important}.stat-medallion-glyph{font-size:.7rem}.grand-mobile-nav{width:calc(100vw - 112px)}#combatDashboard .resource-grid{grid-template-columns:1fr!important}.grand-character-header{grid-template-columns:82px minmax(0,1fr)!important}}
  @media(prefers-reduced-motion:reduce){.grand-mobile-nav button,.stat-medallion{transition:none!important}}
  `;document.head.appendChild(s);
}

function grandInstall(){
  grandInstallStyles();
  grandInstallHeader();
  grandInstallCombatDashboard();
  grandInstallDerivedMedallions();
  grandInstallConditionFeedback();
  grandInstallBuildStyling();
  grandInstallMobileNav();
}

grandInstall();
setTimeout(grandInstall,350);
