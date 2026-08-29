// Consolidated final presentation pass for the Aestra tracker.
// This intentionally leaves the original controls in place so save/rules mechanics keep using them.

const AESTRA_PAGES=['sheet','build','inventory','notes'];

function rrPageShell(){return document.getElementById('mobilePageShell')}
function rrPage(key){return rrPageShell()?.querySelector(`.mobile-page[data-mobile-page="${key}"]`)}
function rrIsSheetVisible(){
  const app=document.getElementById('appView'),sheet=document.getElementById('sheetView'),auth=document.getElementById('authView');
  return !!app&&!app.classList.contains('hidden')&&!!sheet&&!sheet.classList.contains('hidden')&&(!auth||auth.classList.contains('hidden'));
}

function installUnifiedHeader(){
  const header=document.querySelector('#sheetView .grand-character-header, #sheetView .identity-grid');
  if(!header)return;
  header.classList.add('aestra-unified-header');
  document.querySelector('#sheetView .portrait-card')?.classList.add('aestra-header-portrait');
  document.querySelector('#sheetView .identity-card')?.classList.add('aestra-header-main');
}

function setDesktopPage(key,scroll=true){
  const shell=rrPageShell();if(!shell||!AESTRA_PAGES.includes(key))return;
  shell.dataset.desktopPage=key;
  shell.querySelectorAll('.mobile-page').forEach(p=>p.classList.toggle('desktop-page-active',p.dataset.mobilePage===key));
  document.querySelectorAll('#desktopSectionNav [data-desktop-page]').forEach(b=>{
    const on=b.dataset.desktopPage===key;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');
  });
  if(scroll&&matchMedia('(min-width:701px)').matches) shell.scrollIntoView({behavior:'smooth',block:'start'});
}

function installDesktopPages(){
  const shell=rrPageShell(),sheet=document.getElementById('sheetView');if(!shell||!sheet||document.getElementById('desktopSectionNav'))return;
  const nav=document.createElement('nav');nav.id='desktopSectionNav';nav.className='desktop-section-nav';nav.setAttribute('aria-label','Character sections');
  nav.innerHTML=`
    <button type="button" data-desktop-page="sheet"><span>◇</span>Sheet</button>
    <button type="button" data-desktop-page="build"><span>✦</span>Build</button>
    <button type="button" data-desktop-page="inventory"><span>▣</span>Inventory</button>
    <button type="button" data-desktop-page="notes"><span>≡</span>Notes</button>`;
  shell.before(nav);
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-desktop-page]');if(b)setDesktopPage(b.dataset.desktopPage)});
  const syncViewport=()=>{
    const desktop=matchMedia('(min-width:701px)').matches;
    document.body.classList.toggle('desktop-paged-sheet',desktop);
    nav.classList.toggle('desktop-nav-hidden',!desktop||!rrIsSheetVisible()||document.body.classList.contains('adventure-mode'));
    if(desktop&&!shell.dataset.desktopPage)setDesktopPage('sheet',false);
  };
  const mq=matchMedia('(min-width:701px)');mq.addEventListener?.('change',syncViewport);
  const obs=new MutationObserver(syncViewport);['appView','sheetView','gmView','authView'].forEach(id=>{const el=document.getElementById(id);if(el)obs.observe(el,{attributes:true,attributeFilter:['class']})});
  setDesktopPage('sheet',false);syncViewport();
}

function equipmentRows(){return [...(document.querySelectorAll('#equipmentEditor .entry-row')||[])]}
function equipmentData(){
  return equipmentRows().map(row=>{const vals=[...row.querySelectorAll('input,select,textarea')].map(x=>String(x.value||'').trim());return {slot:vals[0]||'Equipment',name:vals[1]||'',detail:vals[5]||''}}).filter(x=>x.name);
}
function classifySlot(slot,name){
  const text=`${slot} ${name}`.toLowerCase();
  if(/shield/.test(text))return 'shield';
  if(/armor|armour|robe|garb|mail|plate/.test(text))return 'armor';
  if(/accessor|amulet|ring|charm|talisman/.test(text))return 'accessory';
  if(/weapon|sword|dagger|spear|axe|bow|gun|pistol|staff|tome|hammer|whip|knuckle|shuriken/.test(text))return 'weapon';
  return 'other';
}

function installInventoryLoadout(){
  const page=rrPage('inventory'),editor=document.getElementById('inventoryEditor');if(!page||!editor||document.getElementById('inventoryLoadout'))return;
  const panel=document.createElement('section');panel.id='inventoryLoadout';panel.className='inventory-loadout';
  panel.innerHTML=`<div class="inventory-loadout-head"><div><p class="eyebrow">LOADOUT</p><h2>Equipped Gear</h2></div><small>Tap a slot to manage equipment</small></div><div class="loadout-slots"></div>`;
  page.prepend(panel);
  const slots=[['weapon','⚔','Weapon'],['armor','⬟','Armor'],['shield','◈','Shield'],['accessory','✦','Accessory']];
  const render=()=>{
    const data=equipmentData();
    panel.querySelector('.loadout-slots').innerHTML=slots.map(([key,icon,label])=>{
      const item=data.find(x=>classifySlot(x.slot,x.name)===key);
      return `<button type="button" class="loadout-slot ${item?'filled':''}" data-loadout-slot="${key}"><i>${icon}</i><small>${label}</small><strong>${item?.name||'Empty'}</strong><span>${item?.slot||'Tap to equip'}</span></button>`;
    }).join('');
  };
  panel.addEventListener('click',e=>{
    const b=e.target.closest('[data-loadout-slot]');if(!b)return;
    if(matchMedia('(max-width:700px)').matches)document.querySelector('#grandMobileNav [data-jump="build"]')?.click();
    else setDesktopPage('build',false);
    setTimeout(()=>document.querySelector('#buildMenu .build-tab[data-build="equipment"]')?.click(),40);
  });
  const eq=document.getElementById('equipmentEditor');if(eq)new MutationObserver(render).observe(eq,{childList:true,subtree:true,attributes:true,attributeFilter:['value']});
  eq?.addEventListener('input',render);eq?.addEventListener('change',render);render();setTimeout(render,900);
}

function installClassSkillHierarchy(){
  const body=document.getElementById('buildMenuBody'),skills=document.getElementById('skillsEditor');if(!body||!skills)return;
  const skillsBySource=()=>{
    const map=new Map();
    [...skills.querySelectorAll('.entry-row')].forEach(r=>{const v=[...r.querySelectorAll('input,select,textarea')].map(x=>String(x.value||'').trim()),name=v[0],source=v[2];if(!name||!source)return;const arr=map.get(source.toLowerCase())||[];arr.push(name);map.set(source.toLowerCase(),arr)});return map;
  };
  const decorate=()=>{
    if(!document.querySelector('#buildMenu .build-tab[data-build="classes"]')?.classList.contains('active'))return;
    const map=skillsBySource();
    body.querySelectorAll('.build-entry-classes').forEach(card=>{
      card.querySelector('.class-skill-preview')?.remove();
      const name=card.querySelector('.build-entry-copy strong')?.childNodes?.[0]?.textContent?.trim()||card.querySelector('.build-entry-copy strong')?.textContent?.replace(/MASTERED/g,'').trim();
      const list=map.get(String(name||'').toLowerCase())||[];
      if(!list.length)return;
      const p=document.createElement('span');p.className='class-skill-preview';p.innerHTML=`<b>${list.length} skill${list.length===1?'':'s'}</b>${list.slice(0,3).map(x=>`<em>${x}</em>`).join('')}${list.length>3?`<em>+${list.length-3}</em>`:''}`;
      card.querySelector('.build-entry-copy')?.appendChild(p);
    });
  };
  new MutationObserver(()=>requestAnimationFrame(decorate)).observe(body,{childList:true,subtree:true});
  new MutationObserver(()=>requestAnimationFrame(decorate)).observe(skills,{childList:true,subtree:true});
  skills.addEventListener('input',decorate);skills.addEventListener('change',decorate);setTimeout(decorate,500);
}

function installNotesToolbar(){
  const notes=document.getElementById('notes'),panel=notes?.closest('article.panel');if(!notes||!panel||document.getElementById('notesQuickToolbar'))return;
  panel.classList.add('aestra-journal-panel');
  const bar=document.createElement('div');bar.id='notesQuickToolbar';bar.className='notes-quick-toolbar';
  bar.innerHTML='<span>Quick heading</span><button type="button" data-note-heading="Session">Session</button><button type="button" data-note-heading="Quest">Quest</button><button type="button" data-note-heading="NPC">NPC</button><button type="button" data-note-heading="Clue">Clue</button>';
  notes.before(bar);
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-note-heading]');if(!b)return;const h=b.dataset.noteHeading;const prefix=notes.value&& !notes.value.endsWith('\n')?'\n\n':'';const text=`${prefix}◆ ${h.toUpperCase()}\n`;const start=notes.selectionStart??notes.value.length;notes.setRangeText(text,start,start,'end');notes.dispatchEvent(new Event('input',{bubbles:true}));notes.focus()});
}

function syncConditionQuietState(){
  const statuses=document.getElementById('statuses'),control=document.getElementById('conditionsControl');if(!statuses||!control)return;
  const n=statuses.querySelectorAll('.status-chip.active').length;
  control.classList.toggle('conditions-idle',n===0);control.classList.toggle('conditions-active',n>0);control.dataset.activeCount=String(n);
}
function installConditionQuietState(){
  const statuses=document.getElementById('statuses');if(!statuses)return;
  new MutationObserver(syncConditionQuietState).observe(statuses,{subtree:true,attributes:true,attributeFilter:['class','aria-pressed']});
  statuses.addEventListener('click',()=>requestAnimationFrame(syncConditionQuietState));syncConditionQuietState();
}

function syncAdventureRefinement(){
  const on=document.body.classList.contains('adventure-mode');
  document.body.classList.toggle('adventure-refined',on);
  document.getElementById('desktopSectionNav')?.classList.toggle('desktop-nav-hidden',on||!matchMedia('(min-width:701px)').matches||!rrIsSheetVisible());
  const nav=document.getElementById('grandMobileNav');
  nav?.querySelector('[data-jump="build"]')?.classList.toggle('adventure-nav-hidden',on);
  nav?.querySelector('[data-jump="inventory"]')?.classList.toggle('adventure-nav-hidden',on);
  if(on&&matchMedia('(min-width:701px)').matches)setDesktopPage('sheet',false);
}
function installAdventureRefinement(){
  const btn=document.getElementById('adventureModeBtn');if(!btn)return;
  btn.addEventListener('click',()=>requestAnimationFrame(syncAdventureRefinement));
  new MutationObserver(syncAdventureRefinement).observe(document.body,{attributes:true,attributeFilter:['class']});syncAdventureRefinement();
}

function installDerivedColourLogic(){
  const stats=[...document.querySelectorAll('#combatDashboard .stat-medallion')];
  stats.forEach((x,i)=>x.dataset.statTone=['initiative','defence','magic','crisis'][i]||'neutral');
}

function installRefinementStyles(){
  if(document.getElementById('aestraFinalRefinementStyles'))return;
  const s=document.createElement('style');s.id='aestraFinalRefinementStyles';s.textContent=`
  /* Fewer nested boxes: reserve strong borders for major surfaces. */
  #sheetView .aestra-unified-header,#combatDashboard,#buildMenu,#inventoryLoadout,.aestra-journal-panel{border:1px solid rgba(211,171,91,.28)!important;box-shadow:0 14px 34px rgba(0,0,0,.16),inset 0 0 0 1px rgba(255,255,255,.012)!important}
  #sheetView .aestra-unified-header{display:grid!important;background:linear-gradient(145deg,rgba(13,14,19,.82),rgba(10,11,16,.66))!important;border-radius:22px!important;padding:9px!important;gap:8px!important}
  #sheetView .aestra-unified-header>.panel{border:0!important;background:transparent!important;box-shadow:none!important;margin:0!important}
  #sheetView .aestra-header-main{padding:9px!important}.aestra-header-portrait{box-shadow:none!important}
  #sheetView .character-lore-grid button,#sheetView .character-meta-strip button,#sheetView #traitsEditor input{border-color:rgba(211,171,91,.07)!important;background:rgba(3,5,9,.24)!important}
  #combatDashboard .resource-card,#combatDashboard .combat-derived-panel{border-color:rgba(255,255,255,.045)!important;background:rgba(4,7,12,.34)!important;box-shadow:none!important}
  #combatDashboard .stat-medallion{border-color:rgba(255,255,255,.07)!important}
  #combatDashboard .stat-medallion[data-stat-tone="defence"]{box-shadow:inset 0 0 22px rgba(77,190,145,.06)!important}.stat-medallion[data-stat-tone="defence"] .stat-medallion-glyph{color:#7fd9b3!important}
  #combatDashboard .stat-medallion[data-stat-tone="magic"]{box-shadow:inset 0 0 22px rgba(77,154,222,.07)!important}.stat-medallion[data-stat-tone="magic"] .stat-medallion-glyph{color:#83c5f0!important}
  #combatDashboard .stat-medallion[data-stat-tone="initiative"] .stat-medallion-glyph{color:#dfbd70!important}.stat-medallion[data-stat-tone="crisis"] .stat-medallion-glyph{color:#e28d83!important}

  /* Current die is primary; base remains available in the existing attribute popup. */
  #combatDashboard .attr-card .die-base{opacity:.38!important;font-size:.48rem!important}.attribute-effect:empty{display:none!important}

  /* Quiet UI stays quiet until it matters. */
  #conditionsControl.conditions-idle{opacity:.64!important;border-color:rgba(255,255,255,.055)!important;background:rgba(4,6,10,.24)!important}#conditionsControl.conditions-active{opacity:1!important;box-shadow:0 0 20px rgba(209,132,54,.08)!important}
  #conditionsControl.conditions-idle .active-condition-ribbon{display:none!important}
  #rulesAwareAlert.rules-orb:not(.has-conflicts):not(.expanded){display:none!important}
  .save-orb-button:not(.save-is-dirty):not(.save-is-saving){opacity:.28!important;filter:saturate(.6)!important}.save-orb-button.save-is-dirty,.save-orb-button.save-is-saving{opacity:1!important;filter:none!important}

  /* Desktop uses the same clear page model as mobile. */
  .desktop-section-nav{display:none;position:sticky;top:8px;z-index:550;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;width:min(610px,calc(100% - 24px));margin:8px auto 14px;padding:5px;border:1px solid rgba(211,171,91,.2);border-radius:17px;background:rgba(8,10,15,.9);backdrop-filter:blur(12px);box-shadow:0 9px 26px rgba(0,0,0,.25)}
  .desktop-section-nav button{border:0!important;background:transparent!important;min-height:44px!important;padding:7px 10px!important;border-radius:11px!important;color:#9c9484!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important}.desktop-section-nav button span{color:#caa85e}.desktop-section-nav button.active{color:#edd8a8!important;background:linear-gradient(180deg,rgba(91,145,181,.11),rgba(189,142,67,.08))!important;box-shadow:inset 0 0 0 1px rgba(211,171,91,.16)!important}.desktop-section-nav.desktop-nav-hidden{display:none!important}
  @media(min-width:701px){body.desktop-paged-sheet .desktop-section-nav{display:grid}body.desktop-paged-sheet #mobilePageShell{display:block!important}body.desktop-paged-sheet #mobilePageShell>.mobile-page{display:none!important}body.desktop-paged-sheet #mobilePageShell>.mobile-page.desktop-page-active{display:block!important}body.desktop-paged-sheet #mobilePageShell>.mobile-page>*{margin-left:0!important;margin-right:0!important}}

  /* Inventory reads like equipment + backpack, not another generic list. */
  .inventory-loadout{position:relative;padding:15px;margin-bottom:12px;border-radius:20px;background:linear-gradient(145deg,rgba(15,14,18,.84),rgba(10,12,16,.72))}.inventory-loadout-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px}.inventory-loadout-head h2{margin:2px 0 0;font:700 1.35rem/1.1 Georgia,serif;color:#ead8ae}.inventory-loadout-head small{font-size:.64rem;color:#81796d}.loadout-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.loadout-slot{min-width:0;min-height:118px!important;padding:10px!important;display:grid!important;place-items:center!important;align-content:center!important;gap:3px!important;text-align:center!important;border:1px dashed rgba(211,171,91,.14)!important;border-radius:15px!important;background:rgba(3,5,9,.26)!important;color:#888174!important}.loadout-slot.filled{border-style:solid!important;border-color:rgba(211,171,91,.22)!important;color:#d9caa9!important;background:radial-gradient(circle at 50% 15%,rgba(211,171,91,.07),rgba(3,5,9,.25) 60%)!important}.loadout-slot i{font-style:normal;font-size:1.35rem;color:#c6a45f}.loadout-slot small{font-size:.48rem;letter-spacing:.13em;color:#857d6e}.loadout-slot strong{max-width:100%;font:700 .86rem/1.15 Georgia,serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.loadout-slot span{font-size:.54rem;opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}

  /* Classes become parent cards by showing their owned skills when viewing Classes. */
  .class-skill-preview{display:flex!important;gap:4px!important;flex-wrap:wrap!important;margin-top:5px!important;white-space:normal!important;overflow:visible!important}.class-skill-preview b,.class-skill-preview em{font:600 .52rem/1 system-ui,sans-serif!important;padding:3px 6px;border-radius:999px;border:1px solid rgba(105,169,215,.13);background:rgba(65,126,169,.07);color:#99bcd4!important}.class-skill-preview b{color:#d6b66e!important;border-color:rgba(211,171,91,.13);background:rgba(156,117,51,.06)}

  /* Journal remains one saved field, but gains useful lightweight structure. */
  .aestra-journal-panel{padding:16px!important;border-radius:20px!important;background:linear-gradient(160deg,rgba(18,14,11,.82),rgba(10,9,10,.78))!important}.aestra-journal-panel>h3{font:700 1.45rem/1 Georgia,serif;color:#e5cf9e}.notes-quick-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin:8px 0 10px}.notes-quick-toolbar>span{font-size:.53rem;letter-spacing:.12em;color:#857c6c;margin-right:2px}.notes-quick-toolbar button{min-height:30px!important;padding:5px 8px!important;border-radius:999px!important;font-size:.58rem!important;background:rgba(107,78,39,.12)!important;border-color:rgba(211,171,91,.14)!important;color:#cbb58b!important}

  /* Adventure Mode is deliberately a compact combat HUD. */
  body.adventure-refined #aestraHero,body.adventure-refined .grand-topbar{display:none!important}body.adventure-refined #appView>.tabs{margin-top:4px!important}body.adventure-refined .mobile-page[data-mobile-page="sheet"]>*:not(#adventureQuickHeader):not(#combatDashboard){display:none!important}
  body.adventure-refined #combatDashboard{margin:5px 0!important;padding:7px!important;border-color:rgba(95,160,205,.16)!important;background:rgba(6,9,14,.72)!important}body.adventure-refined #combatDashboard .combat-dashboard-head{display:none!important}
  body.adventure-refined #combatDashboard .compact-attributes{gap:4px!important}body.adventure-refined #combatDashboard .attr-card{min-height:68px!important;padding:5px!important;border-radius:12px!important}body.adventure-refined #combatDashboard .attr-card .die-visual{min-height:32px!important;padding:3px!important}body.adventure-refined #combatDashboard .attr-card .die-current{font-size:1.03rem!important}body.adventure-refined #combatDashboard .attr-card>span{font-size:.55rem!important}
  body.adventure-refined #combatDashboard .conditions-control{margin:4px 0 5px!important;min-height:36px!important}body.adventure-refined #combatDashboard .resource-grid{gap:5px!important}body.adventure-refined #combatDashboard .integrated-resource-card{padding:7px 8px!important}body.adventure-refined #combatDashboard .resource-head>span{font-size:.72rem!important}body.adventure-refined #combatDashboard .resource-head strong{font-size:1rem!important}body.adventure-refined #combatDashboard .integrated-resource-bar{height:22px!important;margin:5px 0!important}
  body.adventure-refined #combatDashboard .combat-derived-panel{margin-top:5px!important;padding:5px!important;border:0!important;background:transparent!important}body.adventure-refined #combatDashboard .derived-grid{gap:4px!important}body.adventure-refined #combatDashboard .stat-medallion{min-height:58px!important;padding:3px!important;border-radius:12px!important}body.adventure-refined #combatDashboard .stat-medallion-glyph{font-size:.62rem!important}body.adventure-refined #combatDashboard .stat-medallion strong{font-size:.95rem!important}body.adventure-refined #combatDashboard .stat-medallion>span:not(.stat-medallion-glyph){font-size:.43rem!important}
  body.adventure-refined #grandMobileNav .adventure-nav-hidden{display:none!important}body.adventure-refined #grandMobileNav{grid-template-columns:repeat(2,minmax(0,1fr))!important;width:min(300px,calc(100vw - 90px))!important}body.adventure-refined #grandMobileNav [data-jump="sheet"],body.adventure-refined #grandMobileNav [data-jump="notes"]{display:flex!important}

  @media(max-width:700px){
    #sheetView .aestra-unified-header{grid-template-columns:64px minmax(0,1fr)!important;padding:6px!important;border-radius:18px!important}.aestra-header-portrait{width:64px!important;height:64px!important;min-width:64px!important;min-height:64px!important;position:static!important}.aestra-header-main{padding:5px!important}.character-display-summary{gap:6px!important}.character-lore-grid{gap:4px!important}.character-meta-strip{gap:4px!important}.inline-traits-wrap{margin-top:6px!important;padding-top:6px!important}
    #combatDashboard{padding:8px!important;margin:8px 0 10px!important;border-radius:18px!important}.combat-dashboard-head{margin-bottom:7px!important}.combat-dashboard-head small{display:none}.combat-dashboard-head h2{font-size:1rem!important}
    .loadout-slots{grid-template-columns:repeat(2,minmax(0,1fr))}.loadout-slot{min-height:88px!important;padding:8px!important}.inventory-loadout{padding:10px;border-radius:17px}.inventory-loadout-head small{display:none}
    .aestra-journal-panel{padding:11px!important}.notes-quick-toolbar{gap:4px}.notes-quick-toolbar>span{width:100%}
  }
  @media(prefers-reduced-motion:reduce){.desktop-section-nav,.loadout-slot{scroll-behavior:auto!important}}
  `;document.head.appendChild(s);
}

function finalRefinementCheck(){
  const checks={
    save:!!document.getElementById('saveBtn'),statuses:!!document.getElementById('statuses'),attributes:['mig','dex','ins','wlp'].every(id=>!!document.getElementById(id)),
    resources:['hpNow','hpMaxText','mpNow','mpMaxText'].every(id=>!!document.getElementById(id)),pages:AESTRA_PAGES.every(k=>!!rrPage(k)),notes:!!document.getElementById('notes'),build:!!document.getElementById('buildMenu'),inventory:!!document.getElementById('inventoryEditor')
  };
  const failed=Object.entries(checks).filter(([,v])=>!v).map(([k])=>k);
  if(failed.length)console.warn('Aestra refinement check failed:',failed);else console.info('Aestra refinement check passed');
  // Re-run only visual synchronisation. Do not mutate character rules state here.
  syncConditionQuietState();syncAdventureRefinement();installDerivedColourLogic();
}

installRefinementStyles();
installUnifiedHeader();
installDesktopPages();
installInventoryLoadout();
installClassSkillHierarchy();
installNotesToolbar();
installConditionQuietState();
installAdventureRefinement();
installDerivedColourLogic();
setTimeout(finalRefinementCheck,600);
setTimeout(finalRefinementCheck,1800);
