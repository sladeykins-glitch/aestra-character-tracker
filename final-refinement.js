// Stable final presentation pass. Event-driven only: no self-mutating subtree observers.
const AESTRA_PAGES=['sheet','build','inventory','notes'];
const shell=()=>document.getElementById('mobilePageShell');
const page=key=>shell()?.querySelector(`.mobile-page[data-mobile-page="${key}"]`);
const sheetVisible=()=>{
  const app=document.getElementById('appView'),sheet=document.getElementById('sheetView'),auth=document.getElementById('authView');
  return !!app&&!app.classList.contains('hidden')&&!!sheet&&!sheet.classList.contains('hidden')&&(!auth||auth.classList.contains('hidden'));
};

function installUnifiedHeader(){
  const h=document.querySelector('#sheetView .grand-character-header, #sheetView .identity-grid');if(!h)return;
  h.classList.add('aestra-unified-header');
  document.querySelector('#sheetView .portrait-card')?.classList.add('aestra-header-portrait');
  document.querySelector('#sheetView .identity-card')?.classList.add('aestra-header-main');
}

function setDesktopPage(key,scroll=true){
  const s=shell();if(!s||!AESTRA_PAGES.includes(key))return;
  s.dataset.desktopPage=key;
  s.querySelectorAll('.mobile-page').forEach(p=>p.classList.toggle('desktop-page-active',p.dataset.mobilePage===key));
  document.querySelectorAll('#desktopSectionNav [data-desktop-page]').forEach(b=>{
    const on=b.dataset.desktopPage===key;b.classList.toggle('active',on);b.setAttribute('aria-current',on?'page':'false');
  });
  if(scroll&&matchMedia('(min-width:701px)').matches)s.scrollIntoView({behavior:'smooth',block:'start'});
}
function installDesktopPages(){
  const s=shell();if(!s||document.getElementById('desktopSectionNav'))return;
  const nav=document.createElement('nav');nav.id='desktopSectionNav';nav.className='desktop-section-nav';nav.innerHTML=`
  <button type="button" data-desktop-page="sheet"><span>◇</span>Sheet</button>
  <button type="button" data-desktop-page="build"><span>✦</span>Build</button>
  <button type="button" data-desktop-page="inventory"><span>▣</span>Inventory</button>
  <button type="button" data-desktop-page="notes"><span>≡</span>Notes</button>`;
  s.before(nav);
  nav.addEventListener('click',e=>{const b=e.target.closest('[data-desktop-page]');if(b)setDesktopPage(b.dataset.desktopPage)});
  const sync=()=>{
    const desktop=matchMedia('(min-width:701px)').matches;
    document.body.classList.toggle('desktop-paged-sheet',desktop);
    nav.classList.toggle('desktop-nav-hidden',!desktop||!sheetVisible()||document.body.classList.contains('adventure-mode'));
    if(desktop&&!s.dataset.desktopPage)setDesktopPage('sheet',false);
  };
  matchMedia('(min-width:701px)').addEventListener?.('change',sync);
  ['appView','sheetView','gmView','authView'].forEach(id=>{const el=document.getElementById(id);if(el)new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']})});
  setDesktopPage('sheet',false);sync();
}

function equipmentData(){return [...document.querySelectorAll('#equipmentEditor .entry-row')].map(row=>{const v=[...row.querySelectorAll('input,select,textarea')].map(x=>String(x.value||'').trim());return{slot:v[0]||'Equipment',name:v[1]||''}}).filter(x=>x.name)}
function slotType(slot,name){const t=`${slot} ${name}`.toLowerCase();if(/shield/.test(t))return'shield';if(/armor|armour|robe|garb|mail|plate/.test(t))return'armor';if(/accessor|amulet|ring|charm|talisman/.test(t))return'accessory';if(/weapon|sword|dagger|spear|axe|bow|gun|pistol|staff|tome|hammer|whip|knuckle|shuriken/.test(t))return'weapon';return'other'}
function installInventoryLoadout(){
  const p=page('inventory'),eq=document.getElementById('equipmentEditor');if(!p||!eq||document.getElementById('inventoryLoadout'))return;
  const panel=document.createElement('section');panel.id='inventoryLoadout';panel.className='inventory-loadout';panel.innerHTML='<div class="inventory-loadout-head"><div><p class="eyebrow">LOADOUT</p><h2>Equipped Gear</h2></div><small>Tap a slot to manage equipment</small></div><div class="loadout-slots"></div>';p.prepend(panel);
  const slots=[['weapon','⚔','Weapon'],['armor','⬟','Armor'],['shield','◈','Shield'],['accessory','✦','Accessory']];
  const render=()=>{const d=equipmentData();panel.querySelector('.loadout-slots').innerHTML=slots.map(([k,i,l])=>{const x=d.find(v=>slotType(v.slot,v.name)===k);return `<button type="button" class="loadout-slot ${x?'filled':''}" data-loadout-slot="${k}"><i>${i}</i><small>${l}</small><strong>${x?.name||'Empty'}</strong><span>${x?.slot||'Tap to equip'}</span></button>`}).join('')};
  panel.addEventListener('click',e=>{if(!e.target.closest('[data-loadout-slot]'))return;if(matchMedia('(max-width:700px)').matches)document.querySelector('#grandMobileNav [data-jump="build"]')?.click();else setDesktopPage('build',false);setTimeout(()=>document.querySelector('#buildMenu .build-tab[data-build="equipment"]')?.click(),50)});
  eq.addEventListener('input',render);eq.addEventListener('change',render);new MutationObserver(render).observe(eq,{childList:true});render();
}

function skillMap(){const m=new Map();document.querySelectorAll('#skillsEditor .entry-row').forEach(r=>{const v=[...r.querySelectorAll('input,select,textarea')].map(x=>String(x.value||'').trim());if(!v[0]||!v[2])return;const k=v[2].toLowerCase(),a=m.get(k)||[];a.push(v[0]);m.set(k,a)});return m}
function decorateClassSkills(){
  if(!document.querySelector('#buildMenu .build-tab[data-build="classes"]')?.classList.contains('active'))return;
  const m=skillMap();document.querySelectorAll('#buildMenuBody .build-entry-classes').forEach(card=>{
    const strong=card.querySelector('.build-entry-copy strong'),name=(strong?.childNodes?.[0]?.textContent||strong?.textContent||'').replace(/MASTERED/g,'').trim(),list=m.get(name.toLowerCase())||[];
    let p=card.querySelector('.class-skill-preview');
    const html=list.length?`<b>${list.length} skill${list.length===1?'':'s'}</b>${list.slice(0,3).map(x=>`<em>${x}</em>`).join('')}${list.length>3?`<em>+${list.length-3}</em>`:''}`:'';
    if(!html){p?.remove();return}if(!p){p=document.createElement('span');p.className='class-skill-preview';card.querySelector('.build-entry-copy')?.appendChild(p)}if(p.innerHTML!==html)p.innerHTML=html;
  });
}
function installClassSkillHierarchy(){
  const body=document.getElementById('buildMenuBody'),skills=document.getElementById('skillsEditor');if(!body||!skills)return;
  skills.addEventListener('input',()=>requestAnimationFrame(decorateClassSkills));skills.addEventListener('change',()=>requestAnimationFrame(decorateClassSkills));
  document.querySelector('#buildMenu .build-tabs')?.addEventListener('click',()=>setTimeout(decorateClassSkills,30));
  new MutationObserver(()=>requestAnimationFrame(decorateClassSkills)).observe(body,{childList:true});
  new MutationObserver(()=>requestAnimationFrame(decorateClassSkills)).observe(skills,{childList:true});
  setTimeout(decorateClassSkills,500);
}

function installNotesToolbar(){
  const notes=document.getElementById('notes'),panel=notes?.closest('article.panel');if(!notes||!panel||document.getElementById('notesQuickToolbar'))return;
  panel.classList.add('aestra-journal-panel');const bar=document.createElement('div');bar.id='notesQuickToolbar';bar.className='notes-quick-toolbar';bar.innerHTML='<span>Quick heading</span><button type="button" data-note-heading="Session">Session</button><button type="button" data-note-heading="Quest">Quest</button><button type="button" data-note-heading="NPC">NPC</button><button type="button" data-note-heading="Clue">Clue</button>';notes.before(bar);
  bar.addEventListener('click',e=>{const b=e.target.closest('[data-note-heading]');if(!b)return;const prefix=notes.value&&!notes.value.endsWith('\n')?'\n\n':'',text=`${prefix}◆ ${b.dataset.noteHeading.toUpperCase()}\n`,pos=notes.selectionStart??notes.value.length;notes.setRangeText(text,pos,pos,'end');notes.dispatchEvent(new Event('input',{bubbles:true}));notes.focus()});
}

function syncConditionState(){const statuses=document.getElementById('statuses'),c=document.getElementById('conditionsControl');if(!statuses||!c)return;const n=statuses.querySelectorAll('.status-chip.active').length;c.classList.toggle('conditions-idle',!n);c.classList.toggle('conditions-active',!!n)}
function installConditionState(){const s=document.getElementById('statuses');if(!s)return;s.addEventListener('click',()=>requestAnimationFrame(syncConditionState));s.addEventListener('change',()=>requestAnimationFrame(syncConditionState));syncConditionState()}
function syncAdventure(){const on=document.body.classList.contains('adventure-mode');document.body.classList.toggle('adventure-refined',on);document.getElementById('desktopSectionNav')?.classList.toggle('desktop-nav-hidden',on||!matchMedia('(min-width:701px)').matches||!sheetVisible());const n=document.getElementById('grandMobileNav');n?.querySelector('[data-jump="build"]')?.classList.toggle('adventure-nav-hidden',on);n?.querySelector('[data-jump="inventory"]')?.classList.toggle('adventure-nav-hidden',on);if(on&&matchMedia('(min-width:701px)').matches)setDesktopPage('sheet',false)}
function installAdventure(){document.getElementById('adventureModeBtn')?.addEventListener('click',()=>requestAnimationFrame(syncAdventure));syncAdventure()}
function installDerivedTones(){[...document.querySelectorAll('#combatDashboard .stat-medallion')].forEach((x,i)=>x.dataset.statTone=['initiative','defence','magic','crisis'][i]||'neutral')}

function installStyles(){if(document.getElementById('aestraFinalRefinementStyles'))return;const s=document.createElement('style');s.id='aestraFinalRefinementStyles';s.textContent=`
#sheetView .aestra-unified-header,#combatDashboard,#buildMenu,#inventoryLoadout,.aestra-journal-panel{border:1px solid rgba(211,171,91,.26)!important;box-shadow:0 12px 28px rgba(0,0,0,.14)!important}
#sheetView .aestra-unified-header{display:grid!important;background:linear-gradient(145deg,rgba(13,14,19,.82),rgba(10,11,16,.66))!important;border-radius:22px!important;padding:9px!important;gap:8px!important}#sheetView .aestra-unified-header>.panel{border:0!important;background:transparent!important;box-shadow:none!important;margin:0!important}
#combatDashboard .resource-card,#combatDashboard .combat-derived-panel{border-color:rgba(255,255,255,.045)!important;background:rgba(4,7,12,.34)!important;box-shadow:none!important}#combatDashboard .stat-medallion{border-color:rgba(255,255,255,.07)!important}#combatDashboard .stat-medallion[data-stat-tone="defence"] .stat-medallion-glyph{color:#7fd9b3!important}#combatDashboard .stat-medallion[data-stat-tone="magic"] .stat-medallion-glyph{color:#83c5f0!important}#combatDashboard .attr-card .die-base{opacity:.38!important;font-size:.48rem!important}
#conditionsControl.conditions-idle{opacity:.62!important}#conditionsControl.conditions-active{opacity:1!important;box-shadow:0 0 18px rgba(209,132,54,.08)!important}#rulesAwareAlert.rules-orb:not(.has-conflicts):not(.expanded){display:none!important}.save-orb-button:not(.save-is-dirty):not(.save-is-saving){opacity:.3!important}
.desktop-section-nav{display:none;position:sticky;top:8px;z-index:550;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;width:min(610px,calc(100% - 24px));margin:8px auto 14px;padding:5px;border:1px solid rgba(211,171,91,.2);border-radius:17px;background:rgba(8,10,15,.9);backdrop-filter:blur(8px)}.desktop-section-nav button{border:0!important;background:transparent!important;min-height:44px!important;padding:7px 10px!important;color:#9c9484!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:7px!important}.desktop-section-nav button.active{color:#edd8a8!important;background:rgba(175,132,65,.08)!important}.desktop-section-nav.desktop-nav-hidden{display:none!important}@media(min-width:701px){body.desktop-paged-sheet .desktop-section-nav{display:grid}body.desktop-paged-sheet #mobilePageShell{display:block!important}body.desktop-paged-sheet #mobilePageShell>.mobile-page{display:none!important}body.desktop-paged-sheet #mobilePageShell>.mobile-page.desktop-page-active{display:block!important}}
.inventory-loadout{padding:15px;margin-bottom:12px;border-radius:20px;background:linear-gradient(145deg,rgba(15,14,18,.84),rgba(10,12,16,.72))}.inventory-loadout-head{display:flex;justify-content:space-between;align-items:end;gap:12px;margin-bottom:10px}.inventory-loadout-head h2{margin:2px 0 0;font:700 1.35rem/1.1 Georgia,serif;color:#ead8ae}.loadout-slots{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.loadout-slot{min-width:0;min-height:105px!important;padding:9px!important;display:grid!important;place-items:center!important;align-content:center!important;gap:3px!important;text-align:center!important;border:1px dashed rgba(211,171,91,.14)!important;border-radius:15px!important;background:rgba(3,5,9,.26)!important;color:#888174!important}.loadout-slot.filled{border-style:solid!important;color:#d9caa9!important}.loadout-slot i{font-style:normal;font-size:1.25rem;color:#c6a45f}.loadout-slot small{font-size:.48rem;letter-spacing:.12em}.loadout-slot strong,.loadout-slot span{max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.loadout-slot strong{font:700 .84rem Georgia,serif}.loadout-slot span{font-size:.54rem;opacity:.55}
.class-skill-preview{display:flex!important;gap:4px!important;flex-wrap:wrap!important;margin-top:5px!important}.class-skill-preview b,.class-skill-preview em{font:600 .52rem/1 system-ui,sans-serif!important;padding:3px 6px;border-radius:999px;border:1px solid rgba(105,169,215,.13);background:rgba(65,126,169,.07);color:#99bcd4!important}.class-skill-preview b{color:#d6b66e!important}
.aestra-journal-panel{padding:16px!important;border-radius:20px!important}.notes-quick-toolbar{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 10px}.notes-quick-toolbar>span{font-size:.53rem;letter-spacing:.12em;color:#857c6c}.notes-quick-toolbar button{min-height:30px!important;padding:5px 8px!important;border-radius:999px!important;font-size:.58rem!important}
body.adventure-refined #aestraHero,body.adventure-refined .grand-topbar{display:none!important}body.adventure-refined .mobile-page[data-mobile-page="sheet"]>*:not(#adventureQuickHeader):not(#combatDashboard){display:none!important}body.adventure-refined #combatDashboard{margin:5px 0!important;padding:7px!important}body.adventure-refined #combatDashboard .combat-dashboard-head{display:none!important}body.adventure-refined #combatDashboard .attr-card{min-height:68px!important;padding:5px!important}body.adventure-refined #combatDashboard .integrated-resource-card{padding:7px 8px!important}body.adventure-refined #combatDashboard .integrated-resource-card .formula,body.adventure-refined #combatDashboard .integrated-bar-hint,body.adventure-refined #combatDashboard .integrated-current-number,body.adventure-refined #combatDashboard .integrated-resource-card .adjust-row,body.adventure-refined #combatDashboard .integrated-resource-card .max-label{display:none!important}body.adventure-refined #combatDashboard .stat-medallion{min-height:58px!important;padding:3px!important;border-radius:12px!important}body.adventure-refined #grandMobileNav .adventure-nav-hidden{display:none!important}body.adventure-refined #grandMobileNav{grid-template-columns:repeat(2,minmax(0,1fr))!important}
@media(max-width:700px){#sheetView .aestra-unified-header{grid-template-columns:64px minmax(0,1fr)!important;padding:6px!important;border-radius:18px!important}.aestra-header-portrait{width:64px!important;height:64px!important;min-width:64px!important;min-height:64px!important;position:static!important}.loadout-slots{grid-template-columns:repeat(2,minmax(0,1fr))}.inventory-loadout{padding:10px}.aestra-journal-panel{padding:11px!important}}
`;document.head.appendChild(s)}

installStyles();installUnifiedHeader();installDesktopPages();installInventoryLoadout();installClassSkillHierarchy();installNotesToolbar();installConditionState();installAdventure();installDerivedTones();
setTimeout(()=>{syncConditionState();syncAdventure();installDerivedTones();decorateClassSkills()},700);
