const PICKER_NS='http://www.w3.org/2000/svg';

export const ICONS={
  book:'M5 3h11a3 3 0 0 1 3 3v14H8a3 3 0 0 1-3-3V3Zm3 3v10.5c.5-.3 1-.5 1.6-.5H16V6H8Zm3 2h3v2h-3V8Zm0 4h3v2h-3v-2Z',
  scroll:'M6 3h12a3 3 0 0 1 3 3v2h-3V6H9v13h8v-2h3v2a3 3 0 0 1-3 3H6V3Zm5 5h5v2h-5V8Zm0 4h7v2h-7v-2Z',
  flame:'M13 2c1 4-1 5 1 8 1-2 3-3 4-4 1 4 3 6 3 9a9 9 0 0 1-18 0c0-5 4-8 10-13Zm-1 10c-3 2-4 4-4 6a4 4 0 0 0 8 0c0-2-1-4-4-6Z',
  meteor:'M4 3l8 8-2 2-8-8 2-2Zm5 0 6 6-2 2-6-6 2-2Zm8 7a7 7 0 1 1-7 7 7 7 0 0 1 7-7Zm0 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  ice:'M11 2h2v4l3-2 1 2-4 2v3h3l2-4 2 1-2 3h4v2h-4l2 3-2 1-2-4h-3v3l4 2-1 2-3-2v4h-2v-4l-3 2-1-2 4-2v-3H8l-2 4-2-1 2-3H2v-2h4L4 8l2-1 2 4h3V8L7 6l1-2 3 2V2Z',
  crystal:'M12 2 18 8l-2 12H8L6 8l6-6Zm0 4-3 3 2 8h2l2-8-3-3Z',
  lightning:'M13 2 5 14h6l-1 8 9-13h-6V2Z',
  wind:'M3 8h10c2 0 2-3 0-3-1 0-2 .5-2 1H9c.5-2 2-3 4-3 5 0 5 7 0 7H3V8Zm0 5h14c5 0 5 7 0 7-2 0-4-1-4-3h2c.5 1 1 1 2 1 2 0 2-3 0-3H3v-2Z',
  wings:'M12 11c-3-5-7-7-10-7 1 6 4 10 9 11l1-4Zm0 0c3-5 7-7 10-7-1 6-4 10-9 11l-1-4Zm-1 5h2v6h-2v-6Z',
  feather:'M19 2C11 3 6 8 5 16l4-3-2 5-4 4 2 1 4-4 5-2-3 4c8-2 11-10 8-19Z',
  earth:'M4 18 10 4h4l6 14H4Zm6-2h4l-2-7-2 7Zm-5 4h14v2H5v-2Z',
  wave:'M2 15c3-4 6-4 9 0s6 4 11 0v4c-5 4-9 4-12 0s-5-4-8 0v-4Zm0-7c3-4 6-4 9 0s6 4 11 0v4c-5 4-9 4-12 0S5 8 2 12V8Z',
  shadow:'M19 4a8 8 0 1 0 1 15A9 9 0 1 1 19 4Z',
  moon:'M17 3a9 9 0 1 0 4 16A8 8 0 0 1 17 3Z',
  heart:'M12 21S4 17 4 10a5 5 0 0 1 8-4 5 5 0 0 1 8 4c0 7-8 11-8 11Z',
  heal:'M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3Z',
  aura:'M12 2a10 10 0 1 1-7.1 2.9l2.2 2.2A7 7 0 1 0 12 5V2Zm0 5 3 5-3 5-3-5 3-5Z',
  sun:'M11 1h2v4h-2V1Zm0 18h2v4h-2v-4ZM1 11h4v2H1v-2Zm18 0h4v2h-4v-2ZM4 4l3 3-1.4 1.4-3-3L4 4Zm13 13 3 3-1.4 1.4-3-3L17 17Zm0-10 3-3 1.4 1.4-3 3L17 7ZM4 20l3-3 1.4 1.4-3 3L4 20Zm8-12a4 4 0 1 1 0 8 4 4 0 0 1 0-8Z',
  clock:'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm-1 4v7l5 3 1-2-4-2V6h-2Z',
  hourglass:'M6 2h12v3c0 4-2 5-4 7 2 2 4 3 4 7v3H6v-3c0-4 2-5 4-7-2-2-4-3-4-7V2Zm3 3c0 2 1 3 3 5 2-2 3-3 3-5H9Zm3 9c-2 2-3 3-3 5h6c0-2-1-3-3-5Z',
  mirror:'M8 3h8l3 5-7 13L5 8l3-5Zm1 3-1 2 4 8 4-8-1-2H9Z',
  eye:'M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12Zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  mask:'M4 5c5-2 11-2 16 0l-1 10c-2 4-5 6-7 7-2-1-5-3-7-7L4 5Zm4 5c1 0 2 1 3 2-2 1-4 1-5-1 1-1 1-1 2-1Zm8 0c1 0 1 0 2 1-1 2-3 2-5 1 1-1 2-2 3-2Z',
  speech:'M3 4h18v12H9l-5 4v-4H3V4Zm4 4h10v2H7V8Zm0 4h7v2H7v-2Z',
  music:'M9 4v12a3 3 0 1 1-2-2.8V6l10-2v10a3 3 0 1 1-2-2.8V4.8L9 6v-2Z',
  star:'M12 2l2.3 6.5H21l-5.2 4 2 6.5-5.8-4-5.8 4 2-6.5-5.2-4h6.7L12 2Z',
  portal:'M12 2a10 10 0 1 1-7 17l2-2a7 7 0 1 0 0-10l-2-2a10 10 0 0 1 7-3Zm0 5 5 5-5 5-5-5 5-5Z',
  summon:'M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Zm0 6-2 4 2 4 2-4-2-4Z',
  shield:'M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4Zm0 4 4 2v4c0 3-1.7 5.1-4 6.2V6Z',
  armor:'M7 3 12 5l5-2 4 5-3 3v10H6V11L3 8l4-5Zm3 5v10h4V8l-2 1-2-1Z',
  sword:'M14 2h8v8l-8 8-2-2-5 5-3-3 5-5-2-2 8-8Zm3 3-7 7 2 2 7-7V5h-2Z',
  spiritblade:'M14 2h6v6l-8 8-2-2 7-7V5h-2l-7 7-2-2 8-8Zm-5 14 3 3-4 3-3-3 4-3Z',
  dagger:'M15 2h6v6L10 19l-2-2L19 6V4h-2L6 15l-2-2L15 2Zm-8 16 2 2-3 2-2-2 3-2Z',
  katana:'M18 2h3c-2 8-6 13-12 17l-2-2c5-4 9-9 11-15ZM6 17l3 3-3 2-4-4 4-1Z',
  rapier:'M13 2h2v14h3v2h-3v4h-2v-4H8v-2h5V2Zm-3 13a4 4 0 1 1 8 0h-2a2 2 0 1 0-4 0h-2Z',
  bow:'M5 3c5 2 8 6 9 9-1 3-4 7-9 9l-2-2c4-2 7-5 8-7-1-2-4-5-8-7l2-2Zm7 8h9v2h-9v-2Zm7-3 3 4-3 4V8Z',
  crossbow:'M3 8h18v2H13v4l5 4-2 2-4-4-4 4-2-2 5-4v-4H3V8Zm3-4 6 4 6-4 1 2-7 5-7-5 1-2Z',
  gun:'M3 9h12l3 3-3 3h-4l-2 5H5l2-5H3V9Zm10 2H6v2h7v-2Z',
  spear:'M18 2 22 6 9 19l-2-2L18 6l-2-2 2-2ZM6 16l2 2-4 4-2-2 4-4Z',
  axe:'M15 3c4 0 6 2 7 5l-6 6-3-3-6 11-3-2 6-11-3-3 4-4 4 1Zm1 3-3 3 2 2 4-4-3-1Z',
  hammer:'M4 3h11l3 3-5 5-2-2-8 12-3-2 8-12-2-2H4V3Zm8 2H8l4 4 3-3-3-1Z',
  whip:'M4 5c8 0 13 4 13 9 0 3-2 5-5 5-2 0-4-1-4-3h2c0 1 1 1 2 1 2 0 3-1 3-3 0-4-5-7-11-7V5Zm0 0H2v4h2V5Z',
  fist:'M7 5h3v6H8V7H6v7H4V8c0-2 1-3 3-3Zm4-2h3v8h-3V3Zm4 2h3v8h-3V5Zm4 3h2v6c0 5-3 8-8 8-5 0-8-3-8-8v-1h6v2H8c.5 3 2 4 5 4 4 0 6-2 6-5V8Z',
  shuriken:'M12 2l2 7 6-4-4 6 6 2-7 2 4 6-6-4-2 7-2-7-6 4 4-6-7-2 7-2-4-6 6 4 2-7Z',
  staff:'M13 2a5 5 0 0 1 5 5c0 2-1 4-3 5l-1 10h-3l1-10c-2-1-3-3-3-5a5 5 0 0 1 4-5Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  potion:'M9 2h6v3l-1 1v3l5 8c1 2-1 5-3 5H8c-3 0-4-3-3-5l5-8V6L9 5V2Zm2 10-3 6c0 1 0 1 1 1h6c1 0 1 0 1-1l-3-6h-2Z',
  poison:'M9 2h6v4l4 5v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8l4-5V2Zm1 9 2 2 2-2 2 2-2 2 2 2-2 2-2-2-2 2-2-2 2-2-2-2 2-2Z',
  bomb:'M9 7h6l3 4v7a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4v-7l3-4Zm4-5h2l1 3 4 1-1 2-5-1-1-5Z',
  gear:'M10 2h4l1 3 3 1 3-1 2 3-2 2 1 3 3 1v4l-3 1-1 3 2 2-2 3-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-3 2-2-1-3-3-1v-4l3-1 1-3-2-2 2-3 3 1 3-1 1-3Zm2 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  coin:'M12 3c5 0 9 2 9 5s-4 5-9 5-9-2-9-5 4-5 9-5Zm0 12c4 0 7-1 9-3v4c0 3-4 5-9 5s-9-2-9-5v-4c2 2 5 3 9 3Z',
  dice:'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm3 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  boot:'M7 3h5v9c2 2 5 3 8 3v5H5c-2 0-3-1-3-3 0-2 2-3 5-5V3Z',
  chain:'M8 14 5 17a3 3 0 0 1-4-4l4-4a3 3 0 0 1 4 0l2 2-2 2-2-2-4 4 2 2 3-3Zm8-4 3-3a3 3 0 0 1 4 4l-4 4a3 3 0 0 1-4 0l-2-2 2-2 2 2 4-4-2-2-3 3Zm-8 3 8-4 1 2-8 4-1-2Z',
  lock:'M7 10V7a5 5 0 0 1 10 0v3h3v12H4V10h3Zm3 0h4V7a2 2 0 0 0-4 0v3Zm2 4a2 2 0 0 0-1 3.7V20h2v-2.3A2 2 0 0 0 12 14Z',
  skull:'M12 2a8 8 0 0 0-8 8c0 3 1 5 3 6v4h3v-3h4v3h3v-4c2-1 3-3 3-6a8 8 0 0 0-8-8Zm-3 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4Zm6 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z',
  beast:'M4 3l5 3 3-2 3 2 5-3-1 7c2 2 3 4 3 7-3 3-6 5-10 5S5 20 2 17c0-3 1-5 3-7L4 3Zm5 9a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm6 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  target:'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12Zm0 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z',
  crown:'M3 7l5 4 4-7 4 7 5-4-2 12H5L3 7Zm4 8h10l.6-4-2.6 2-3-5-3 5-2.6-2L7 15Z',
  compass:'M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm4 5-6 3-3 7 7-3 2-7Zm-4 5 2-1-1 2-2 1 1-2Z',
  map:'M3 5l6-3 6 3 6-3v17l-6 3-6-3-6 3V5Zm6 0v11l6 3V8L9 5Z',
  bag:'M8 7h8l4 5v8H4v-8l4-5Zm1-5h6l1 3H8l1-3Zm1 10v3h4v-3h-4Z',
  leaf:'M20 3C10 3 4 8 4 16c4 0 7-1 10-4-2 4-5 7-9 9l2 2c5-3 8-7 10-12 1-3 2-5 3-8Z'
};

const exact={
  tome:'book',staff:'staff',crossbow:'crossbow',shortbow:'bow','iron knuckle':'fist','steel dagger':'dagger',pistol:'gun','chain whip':'whip','iron hammer':'hammer',broadaxe:'axe',waraxe:'axe','light spear':'spear','heavy spear':'spear','bronze sword':'sword',greatsword:'sword',katana:'katana',rapier:'rapier',shuriken:'shuriken','improvised melee':'hammer','improvised ranged':'bow',unarmed:'fist',
  'elemental shroud':'aura','elemental weapon':'spiritblade',flare:'meteor',fulgur:'lightning',glacies:'ice',iceberg:'crystal',ignis:'flame','soaring strike':'wings',terra:'earth',thunderbolt:'lightning',ventus:'feather',vortex:'wind',
  acceleration:'clock',anomaly:'portal','dark weapon':'spiritblade',dispel:'star',divination:'eye','drain spirit':'shadow','drain vigor':'heart',gamble:'dice',mirror:'mirror',omega:'meteor',stop:'hourglass',umbra:'moon',
  aura:'aura',awaken:'sun',barrier:'shield',cleanse:'heal',enrage:'flame',hallucination:'mask',heal:'heal',lux:'sun',mercy:'heart',reinforce:'armor','soul weapon':'spiritblade',torpor:'moon',
  'arcane circle':'portal','arcane regeneration':'crystal','bind and summon':'summon','emergency arcanum':'crystal','ritual arcanism':'scroll',
  consume:'beast','feral speech':'beast',pathogenesis:'poison','ritual chimerism':'beast','spell mimic':'mirror',
  agony:'skull','dark blood':'heart','heart of darkness':'moon','painful lesson':'skull','shadow strike':'dagger',
  cataclysm:'meteor','elemental magic':'crystal','magical artillery':'staff','ritual elementalism':'scroll',spellblade:'spiritblade',
  'absorb mp':'crystal','entropic magic':'portal','lucky seven':'dice','ritual entropism':'scroll','stolen time':'hourglass',
  adrenaline:'heart',frenzy:'flame','indomitable spirit':'shield',provoke:'speech',withstand:'armor',
  bodyguard:'shield','defensive mastery':'armor','dual shieldbearer':'shield',fortress:'earth',protect:'shield',
  'flash of insight':'eye',focused:'target','knowledge is power':'book','quick assessment':'target','trained memory':'scroll',
  condemn:'speech',encourage:'heart','my trust in you':'chain',persuasive:'speech','unexpected ally':'chain',
  'cheap shot':'dagger',dodge:'boot','high speed':'wings','see you later':'boot','soul steal':'skull',
  barrage:'crossbow',crossfire:'target',hawkeye:'target','ranged weapon mastery':'bow','warning shot':'gun',
  'healing power':'heal','ritual spiritism':'scroll','spiritual magic':'aura','support magic':'heart',vismagus:'eye',
  'emergency item':'bag',gadgets:'gear','potion rain':'potion','secret formula':'poison',visionary:'gear',
  'faithful companion':'beast',resourceful:'bag','tavern talk':'speech','treasure hunter':'compass','well-traveled':'map',
  bladestorm:'wings','bone crusher':'hammer',breach:'axe',counterattack:'sword','melee weapon mastery':'sword'
};

function norm(v){return String(v||'').trim().toLowerCase()}
export function semanticIcon(name,meta='',text='',mode=''){const n=norm(name),all=`${n} ${norm(meta)} ${norm(text)}`;if(exact[n])return exact[n];
  if(mode==='equipment'){
    if(/tome|book/.test(all))return'book';if(/staff|rod|wand/.test(all))return'staff';if(/crossbow/.test(all))return'crossbow';if(/dagger|knife/.test(all))return'dagger';if(/katana/.test(all))return'katana';if(/rapier/.test(all))return'rapier';if(/sword|blade/.test(all))return'sword';if(/bow/.test(all))return'bow';if(/pistol|gun/.test(all))return'gun';if(/spear|lance/.test(all))return'spear';if(/axe/.test(all))return'axe';if(/hammer|mace/.test(all))return'hammer';if(/whip/.test(all))return'whip';if(/knuckle|unarmed/.test(all))return'fist';if(/shuriken/.test(all))return'shuriken';if(/armor|mail|plate|garb/.test(all))return'armor';if(/shield/.test(all))return'shield';return'bag';
  }
  if(/summon|bind/.test(all))return'summon';if(/portal|gate|anomaly/.test(all))return'portal';if(/meteor|comet|omega|cataclysm/.test(all))return'meteor';if(/fire|flame|burn|ignis|flare|volcano/.test(all))return'flame';if(/ice|frost|glac|cold/.test(all))return'ice';if(/thunder|lightning|fulgur/.test(all))return'lightning';if(/wind|air|ventus|vortex/.test(all))return'wind';if(/wing|soar|speed/.test(all))return'wings';if(/earth|stone|terra|fortress/.test(all))return'earth';if(/shadow|dark|umbra|moon/.test(all))return'moon';if(/heal|mercy|cleanse|restore/.test(all))return'heal';if(/heart|spirit|soul|blood|vigor/.test(all))return'heart';if(/time|stop|accelerat/.test(all))return'hourglass';if(/mirror|reflect|mimic/.test(all))return'mirror';if(/eye|insight|vision|assess|knowledge|memory|hawkeye/.test(all))return'eye';if(/hallucin|mask/.test(all))return'mask';if(/speak|speech|talk|orator|persua|encourage|condemn|provoke/.test(all))return'speech';if(/shield|guard|protect|defen|barrier|withstand/.test(all))return'shield';if(/blade|strike|melee|counter/.test(all))return'sword';if(/shot|ranged|barrage|crossfire|aim/.test(all))return'target';if(/potion|formula|item/.test(all))return'potion';if(/poison|disease|pathogen/.test(all))return'poison';if(/gadget|tinker|device/.test(all))return'gear';if(/treasure|travel|route|journey/.test(all))return'compass';if(/gold|coin|gamble|lucky/.test(all))return'dice';if(/dodge|escape|resourceful/.test(all))return'boot';if(/ally|companion|beast|feral/.test(all))return'beast';if(/death|agony|skull|steal|consume/.test(all))return'skull';if(/ritual/.test(all))return'scroll';if(/magic|arcane|spell|arcan/.test(all))return'crystal';return mode==='skills'?'star':'book'}

export function makeUniqueIcon(name,meta='',text='',mode=''){
  const kind=semanticIcon(name,meta,text,mode),svg=document.createElementNS(PICKER_NS,'svg');
  svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');svg.classList.add('picker-unique-icon',`picker-icon-${kind}`);
  const frame=document.createElementNS(PICKER_NS,'path');frame.setAttribute('d','M16 1 29 8v16l-13 7L3 24V8L16 1Z');frame.classList.add('picker-icon-frame');svg.appendChild(frame);
  const g=document.createElementNS(PICKER_NS,'g');g.setAttribute('transform','translate(4 4)');const p=document.createElementNS(PICKER_NS,'path');p.setAttribute('d',ICONS[kind]||ICONS.star);p.classList.add('picker-icon-main');g.appendChild(p);svg.appendChild(g);
  return svg;
}

function decorateCard(card,mode){if(card.dataset.uniquePickerIcon==='1')return;const head=card.querySelector('.core-lib-head');const copy=head?.querySelector('div');const name=copy?.querySelector('strong')?.textContent||'';const meta=copy?.querySelector('small')?.textContent||'';const text=card.querySelector('p')?.textContent||'';if(!head||!copy||!name)return;const wrap=document.createElement('span');wrap.className='picker-icon-wrap';wrap.appendChild(makeUniqueIcon(name,meta,text,mode));head.insertBefore(wrap,copy);card.dataset.uniquePickerIcon='1'}
function decoratePicker(){const modal=document.getElementById('coreLibraryModal'),body=document.getElementById('coreLibraryBody');if(!modal||!body)return;const mode=modal.dataset.mode||'';body.querySelectorAll(':scope > .core-lib-card').forEach(card=>decorateCard(card,mode))}
function installPickerIcons(){if(document.getElementById('pickerUniqueIconStyles'))return;const style=document.createElement('style');style.id='pickerUniqueIconStyles';style.textContent=`
.core-lib-head{display:grid!important;grid-template-columns:54px minmax(0,1fr) auto;align-items:center!important}.picker-icon-wrap{width:46px;height:46px;display:grid;place-items:center;flex:none}.picker-unique-icon{width:44px;height:44px;overflow:visible;filter:drop-shadow(0 0 7px rgba(116,190,255,.22))}.picker-icon-frame{fill:rgba(10,18,28,.8);stroke:rgba(217,180,96,.46);stroke-width:1}.picker-icon-main{fill:#d9e9f4}.picker-icon-flame .picker-icon-main,.picker-icon-meteor .picker-icon-main{fill:#ff9d72}.picker-icon-ice .picker-icon-main,.picker-icon-crystal .picker-icon-main{fill:#9edfff}.picker-icon-lightning .picker-icon-main{fill:#e8d77d}.picker-icon-wind .picker-icon-main,.picker-icon-wings .picker-icon-main,.picker-icon-feather .picker-icon-main{fill:#a9e6da}.picker-icon-earth .picker-icon-main{fill:#c9a978}.picker-icon-shadow .picker-icon-main,.picker-icon-moon .picker-icon-main{fill:#b79ad9}.picker-icon-heal .picker-icon-main,.picker-icon-heart .picker-icon-main{fill:#e9a0b6}.picker-icon-book .picker-icon-main,.picker-icon-scroll .picker-icon-main,.picker-icon-staff .picker-icon-main,.picker-icon-portal .picker-icon-main,.picker-icon-summon .picker-icon-main{fill:#c7b1ef}.picker-icon-sword .picker-icon-main,.picker-icon-spiritblade .picker-icon-main,.picker-icon-dagger .picker-icon-main,.picker-icon-katana .picker-icon-main,.picker-icon-rapier .picker-icon-main,.picker-icon-axe .picker-icon-main,.picker-icon-hammer .picker-icon-main{fill:#d7c28d}.picker-icon-bow .picker-icon-main,.picker-icon-crossbow .picker-icon-main,.picker-icon-gun .picker-icon-main,.picker-icon-spear .picker-icon-main{fill:#a8d0c1}.picker-icon-shield .picker-icon-main,.picker-icon-armor .picker-icon-main{fill:#b9cfdf}.picker-icon-eye .picker-icon-main,.picker-icon-target .picker-icon-main{fill:#8fc9ff}.picker-icon-potion .picker-icon-main,.picker-icon-poison .picker-icon-main,.picker-icon-leaf .picker-icon-main{fill:#b6e18e}.picker-icon-coin .picker-icon-main,.picker-icon-dice .picker-icon-main,.picker-icon-crown .picker-icon-main{fill:#e2c46f}.picker-icon-skull .picker-icon-main{fill:#d5d1c7}.picker-icon-star .picker-icon-main,.picker-icon-mask .picker-icon-main{fill:#d1b8ff}.picker-icon-gear .picker-icon-main,.picker-icon-bomb .picker-icon-main,.picker-icon-bag .picker-icon-main{fill:#c7c5bd}.picker-icon-beast .picker-icon-main{fill:#c99f78}.picker-icon-aura .picker-icon-main,.picker-icon-sun .picker-icon-main{fill:#f1d89b}.core-lib-card[data-unique-picker-icon="1"]{position:relative;overflow:hidden}.core-lib-card[data-unique-picker-icon="1"]:before{content:'';position:absolute;left:0;top:0;bottom:0;width:2px;background:linear-gradient(transparent,rgba(128,198,255,.45),transparent)}@media(max-width:640px){.core-lib-head{grid-template-columns:46px minmax(0,1fr) auto}.picker-icon-wrap{width:40px;height:40px}.picker-unique-icon{width:38px;height:38px}}
`;document.head.appendChild(style);decoratePicker();const body=document.getElementById('coreLibraryBody');if(body)new MutationObserver(decoratePicker).observe(body,{childList:true,subtree:false})}
setTimeout(installPickerIcons,0);
