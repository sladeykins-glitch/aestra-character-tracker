const PICKER_NS='http://www.w3.org/2000/svg';

const ICONS={
  book:'M5 3h11a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3V3Zm3 3v10.5c.5-.3 1-.5 1.6-.5H16V6H8Zm3 2h3v2h-3V8Zm0 4h3v2h-3v-2Z',
  flame:'M13 2c1 4-1 5 1 8 1-2 3-3 4-4 1 4 3 6 3 9a9 9 0 0 1-18 0c0-5 4-8 10-13Zm-1 10c-3 2-4 4-4 6a4 4 0 0 0 8 0c0-2-1-4-4-6Z',
  ice:'M11 2h2v4l3-2 1 2-4 2v3h3l2-4 2 1-2 3h4v2h-4l2 3-2 1-2-4h-3v3l4 2-1 2-3-2v4h-2v-4l-3 2-1-2 4-2v-3H8l-2 4-2-1 2-3H2v-2h4L4 8l2-1 2 4h3V8L7 6l1-2 3 2V2Z',
  lightning:'M13 2 5 14h6l-1 8 9-13h-6V2Z',
  wind:'M3 8h10c2 0 2-3 0-3-1 0-2 .5-2 1H9c.5-2 2-3 4-3 5 0 5 7 0 7H3V8Zm0 5h14c5 0 5 7 0 7-2 0-4-1-4-3h2c.5 1 1 1 2 1 2 0 2-3 0-3H3v-2Z',
  earth:'M4 18 10 4h4l6 14H4Zm6-2h4l-2-7-2 7Zm-5 4h14v2H5v-2Z',
  shadow:'M19 4a8 8 0 1 0 1 15A9 9 0 1 1 19 4Z',
  heart:'M12 21S4 17 4 10a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 7-8 11-8 11Z',
  heal:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  clock:'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 4v7l5 3 1-2-4-2V6h-2Z',
  mirror:'M8 3h8l3 5-7 13L5 8l3-5Zm1 3-1 2 4 8 4-8-1-2H9Z',
  eye:'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  speech:'M3 4h18v12H9l-5 4v-4H3V4Zm4 4h10v2H7V8Zm0 4h7v2H7v-2Z',
  star:'M12 2l2.3 6.5H21l-5.2 4 2 6.5-5.8-4-5.8 4 2-6.5-5.2-4h6.7L12 2Z',
  shield:'M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4Zm0 4 4 2v4c0 3-1.7 5.1-4 6.2V6Z',
  sword:'M14 2h8v8l-8 8-2-2-5 5-3-3 5-5-2-2 8-8Zm3 3-7 7 2 2 7-7V5h-2Z',
  dagger:'M15 2h6v6L10 19l-2-2L19 6V4h-2L6 15l-2-2L15 2Zm-8 16 2 2-3 2-2-2 3-2Z',
  bow:'M5 3c5 2 8 6 9 9-1 3-4 7-9 9l-2-2c4-2 7-5 8-7-1-2-4-5-8-7l2-2Zm7 8h9v2h-9v-2Zm7-3 3 4-3 4V8Z',
  gun:'M3 9h12l3 3-3 3h-4l-2 5H5l2-5H3V9Zm10 2H6v2h7v-2Z',
  spear:'M18 2 22 6 9 19l-2-2L18 6l-2-2 2-2ZM6 16l2 2-4 4-2-2 4-4Z',
  axe:'M15 3c4 0 6 2 7 5l-6 6-3-3-6 11-3-2 6-11-3-3 4-4 4 1Zm1 3-3 3 2 2 4-4-3-1Z',
  hammer:'M4 3h11l3 3-5 5-2-2-8 12-3-2 8-12-2-2H4V3Zm8 2H8l4 4 3-3-3-1Z',
  whip:'M4 5c8 0 13 4 13 9 0 3-2 5-5 5-2 0-4-1-4-3h2c0 1 1 1 2 1 2 0 3-1 3-3 0-4-5-7-11-7V5Zm0 0H2v4h2V5Z',
  fist:'M7 5h3v6H8V7H6v7H4V8c0-2 1-3 3-3Zm4-2h3v8h-3V3Zm4 2h3v8h-3V5Zm4 3h2v6c0 5-3 8-8 8-5 0-8-3-8-8v-1h6v2H8c.5 3 2 4 5 4 4 0 6-2 6-5V8Z',
  shuriken:'M12 2l2 7 6-4-4 6 6 2-7 2 4 6-6-4-2 7-2-7-6 4 4-6-7-2 7-2-4-6 6 4 2-7Z',
  armor:'M7 3 12 5l5-2 4 5-3 3v10H6V11L3 8l4-5Zm3 5v10h4V8l-2 1-2-1Z',
  staff:'M13 2a5 5 0 0 1 5 5c0 2-1 4-3 5l-1 10h-3l1-10c-2-1-3-3-3-5a5 5 0 0 1 4-5Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  potion:'M9 2h6v3l-1 1v3l5 8c1 2-1 5-3 5H8c-3 0-4-3-3-5l5-8V6L9 5V2Zm2 10-3 6c0 1 0 1 1 1h6c1 0 1 0 1-1l-3-6h-2Z',
  coin:'M12 3c5 0 9 2 9 5s-4 5-9 5-9-2-9-5 4-5 9-5Zm0 12c4 0 7-1 9-3v4c0 3-4 5-9 5s-9-2-9-5v-4c2 2 5 3 9 3Z',
  boot:'M7 3h5v9c2 2 5 3 8 3v5H5c-2 0-3-1-3-3 0-2 2-3 5-5V3Z',
  chain:'M8 14 5 17a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0l2 2-2 2-2-2-4 4 2 2 3-3Zm8-4 3-3a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0l-2-2 2-2 2 2 4-4-2-2-3 3Zm-8 3 8-4 1 2-8 4-1-2Z',
  skull:'M12 2a8 8 0 0 0-8 8c0 3 1 5 3 6v4h3v-3h4v3h3v-4c2-1 3-3 3-6a8 8 0 0 0-8-8Zm-3 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z'
};

const exact={
  tome:'book',staff:'staff',crossbow:'bow',shortbow:'bow','iron knuckle':'fist','steel dagger':'dagger',pistol:'gun','chain whip':'whip','iron hammer':'hammer',broadaxe:'axe',waraxe:'axe','light spear':'spear','heavy spear':'spear','bronze sword':'sword',greatsword:'sword',katana:'sword',rapier:'sword',shuriken:'shuriken','improvised melee':'hammer','improvised ranged':'bow',unarmed:'fist',
  ignis:'flame',flare:'flame',glacies:'ice',iceberg:'ice',fulgur:'lightning',thunderbolt:'lightning',ventus:'wind',vortex:'wind',terra:'earth','soaring strike':'wind','elemental weapon':'sword','elemental shroud':'shield',umbra:'shadow','dark weapon':'shadow',stop:'clock',acceleration:'clock',mirror:'mirror',divination:'eye','drain spirit':'shadow','drain vigor':'heart',omega:'star',anomaly:'star',dispel:'star',gamble:'coin',heal:'heal',mercy:'heal',lux:'star',aura:'shield',barrier:'shield',cleanse:'heal',awaken:'star',enrage:'flame',hallucination:'eye',reinforce:'shield','soul weapon':'sword',torpor:'clock',
  'flash of insight':'eye','knowledge is power':'book','trained memory':'book','quick assessment':'eye',focused:'eye',provoke:'speech',persuasive:'speech',encourage:'speech',condemn:'speech','my trust in you':'heart','unexpected ally':'chain','cheap shot':'dagger',dodge:'boot','high speed':'boot','see you later':'boot','soul steal':'skull',barrage:'bow',crossfire:'bow',hawkeye:'eye','warning shot':'gun','ranged weapon mastery':'bow',bladestorm:'sword','bone crusher':'hammer',breach:'axe',counterattack:'sword','melee weapon mastery':'sword',adrenaline:'heart',frenzy:'flame','indomitable spirit':'shield',withstand:'shield',bodyguard:'shield','defensive mastery':'shield','dual shieldbearer':'shield',fortress:'armor',protect:'shield',consume:'skull','feral speech':'speech',pathogenesis:'potion','ritual chimerism':'star','spell mimic':'book',agony:'skull','dark blood':'heart','heart of darkness':'shadow','painful lesson':'skull','shadow strike':'dagger',cataclysm:'earth','elemental magic':'flame','magical artillery':'staff','ritual elementalism':'star',spellblade:'sword','absorb mp':'star','entropic magic':'star','lucky seven':'coin','ritual entropism':'star','stolen time':'clock','healing power':'heal','ritual spiritism':'star','spiritual magic':'star','support magic':'shield',vismagus:'eye','emergency item':'potion',gadgets:'hammer','potion rain':'potion','secret formula':'potion',visionary:'eye','faithful companion':'heart',resourceful:'boot','tavern talk':'speech','treasure hunter':'coin','well-traveled':'boot','arcane circle':'star','arcane regeneration':'star','bind and summon':'chain','emergency arcanum':'star','ritual arcanism':'book'
};

function norm(v){return String(v||'').trim().toLowerCase()}
function hashName(name){let h=2166136261;for(const ch of name){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function semanticIcon(name,meta,text,mode){const n=norm(name),all=`${n} ${norm(meta)} ${norm(text)}`;if(exact[n])return exact[n];
  if(mode==='equipment'){
    if(/tome|book/.test(all))return'book';if(/staff|rod|wand/.test(all))return'staff';if(/dagger|knife/.test(all))return'dagger';if(/sword|blade|katana|rapier/.test(all))return'sword';if(/bow|crossbow/.test(all))return'bow';if(/pistol|gun/.test(all))return'gun';if(/spear|lance/.test(all))return'spear';if(/axe/.test(all))return'axe';if(/hammer|mace/.test(all))return'hammer';if(/whip/.test(all))return'whip';if(/knuckle|unarmed/.test(all))return'fist';if(/shuriken/.test(all))return'shuriken';if(/armor|mail|plate|garb/.test(all))return'armor';if(/shield/.test(all))return'shield';return'hammer';
  }
  if(/fire|flame|burn|ignis|flare|volcano|cataclysm/.test(all))return'flame';if(/ice|frost|glac|cold/.test(all))return'ice';if(/thunder|lightning|fulgur/.test(all))return'lightning';if(/wind|air|ventus|vortex|speed|soar/.test(all))return'wind';if(/earth|stone|terra|fortress/.test(all))return'earth';if(/shadow|dark|umbra/.test(all))return'shadow';if(/heal|mercy|cleanse|restore/.test(all))return'heal';if(/heart|spirit|soul|blood|vigor/.test(all))return'heart';if(/time|stop|accelerat/.test(all))return'clock';if(/mirror|reflect/.test(all))return'mirror';if(/eye|insight|vision|assess|knowledge|memory|hawkeye/.test(all))return'eye';if(/speak|speech|talk|orator|persua|encourage|condemn|provoke/.test(all))return'speech';if(/shield|guard|protect|defen|barrier|withstand/.test(all))return'shield';if(/blade|strike|melee|counter/.test(all))return'sword';if(/shot|ranged|barrage|crossfire/.test(all))return'bow';if(/potion|formula|item/.test(all))return'potion';if(/treasure|gold|coin|gamble|lucky/.test(all))return'coin';if(/travel|speed|dodge|resourceful/.test(all))return'boot';if(/bind|ally|companion|trust/.test(all))return'chain';if(/death|agony|skull|steal|consume/.test(all))return'skull';if(/ritual|magic|arcane|spell|arcan/.test(all))return'book';return mode==='skills'?'star':'book'}

function makeIcon(name,meta,text,mode){const kind=semanticIcon(name,meta,text,mode);const svg=document.createElementNS(PICKER_NS,'svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');svg.classList.add('picker-unique-icon',`picker-icon-${kind}`);
  const frame=document.createElementNS(PICKER_NS,'path');frame.setAttribute('d','M16 1 29 8v16l-13 7L3 24V8L16 1Z');frame.classList.add('picker-icon-frame');svg.appendChild(frame);
  const g=document.createElementNS(PICKER_NS,'g');g.setAttribute('transform','translate(4 4)');const p=document.createElementNS(PICKER_NS,'path');p.setAttribute('d',ICONS[kind]||ICONS.star);p.classList.add('picker-icon-main');g.appendChild(p);svg.appendChild(g);
  const h=hashName(norm(name));const rune=document.createElementNS(PICKER_NS,'path');const x1=6+(h%5),y1=25-((h>>3)%4),x2=11+((h>>6)%6),y2=27-((h>>9)%5);rune.setAttribute('d',`M${x1} ${y1}  ${x2} ${y2}m${2+(h%3)} -${2+((h>>4)%3)} 2 3`);rune.classList.add('picker-icon-rune');svg.appendChild(rune);return svg}

function decorateCard(card,mode){if(card.dataset.uniquePickerIcon==='1')return;const head=card.querySelector('.core-lib-head');const copy=head?.querySelector('div');const name=copy?.querySelector('strong')?.textContent||'';const meta=copy?.querySelector('small')?.textContent||'';const text=card.querySelector('p')?.textContent||'';if(!head||!copy||!name)return;const wrap=document.createElement('span');wrap.className='picker-icon-wrap';wrap.appendChild(makeIcon(name,meta,text,mode));head.insertBefore(wrap,copy);card.dataset.uniquePickerIcon='1'}
function decoratePicker(){const modal=document.getElementById('coreLibraryModal'),body=document.getElementById('coreLibraryBody');if(!modal||!body)return;const mode=modal.dataset.mode||'';body.querySelectorAll(':scope > .core-lib-card').forEach(card=>decorateCard(card,mode))}
function installPickerIcons(){if(document.getElementById('pickerUniqueIconStyles'))return;const style=document.createElement('style');style.id='pickerUniqueIconStyles';style.textContent=`
.core-lib-head{display:grid!important;grid-template-columns:54px minmax(0,1fr) auto;align-items:center!important}.picker-icon-wrap{width:46px;height:46px;display:grid;place-items:center;flex:none}.picker-unique-icon{width:44px;height:44px;overflow:visible;filter:drop-shadow(0 0 7px rgba(116,190,255,.22))}.picker-icon-frame{fill:rgba(10,18,28,.8);stroke:rgba(217,180,96,.46);stroke-width:1}.picker-icon-main{fill:#d9e9f4}.picker-icon-rune{fill:none;stroke:#d9b862;stroke-width:1.4;stroke-linecap:round;opacity:.82}.picker-icon-flame .picker-icon-main{fill:#ff9d72}.picker-icon-ice .picker-icon-main{fill:#9edfff}.picker-icon-lightning .picker-icon-main{fill:#e8d77d}.picker-icon-wind .picker-icon-main{fill:#a9e6da}.picker-icon-earth .picker-icon-main{fill:#c9a978}.picker-icon-shadow .picker-icon-main{fill:#b79ad9}.picker-icon-heal .picker-icon-main,.picker-icon-heart .picker-icon-main{fill:#e9a0b6}.picker-icon-book .picker-icon-main,.picker-icon-staff .picker-icon-main{fill:#c7b1ef}.picker-icon-sword .picker-icon-main,.picker-icon-dagger .picker-icon-main,.picker-icon-axe .picker-icon-main,.picker-icon-hammer .picker-icon-main{fill:#d7c28d}.picker-icon-bow .picker-icon-main,.picker-icon-gun .picker-icon-main,.picker-icon-spear .picker-icon-main{fill:#a8d0c1}.picker-icon-shield .picker-icon-main,.picker-icon-armor .picker-icon-main{fill:#b9cfdf}.picker-icon-eye .picker-icon-main{fill:#8fc9ff}.picker-icon-potion .picker-icon-main{fill:#b6e18e}.picker-icon-coin .picker-icon-main{fill:#e2c46f}.picker-icon-skull .picker-icon-main{fill:#d5d1c7}.picker-icon-star .picker-icon-main{fill:#d1b8ff}.core-lib-card[data-unique-picker-icon="1"]{position:relative;overflow:hidden}.core-lib-card[data-unique-picker-icon="1"]:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(transparent,rgba(128,198,255,.45),transparent)}@media(max-width:640px){.core-lib-head{grid-template-columns:46px minmax(0,1fr) auto}.picker-icon-wrap{width:40px;height:40px}.picker-unique-icon{width:38px;height:38px}}
`;document.head.appendChild(style);decoratePicker();const body=document.getElementById('coreLibraryBody');if(body)new MutationObserver(decoratePicker).observe(body,{childList:true,subtree:false})}
setTimeout(installPickerIcons,0);
