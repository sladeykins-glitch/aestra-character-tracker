import {ICONS,semanticIcon} from './picker-icons.js?v=2';

const NS='http://www.w3.org/2000/svg';
const norm=v=>String(v||'').trim().toLowerCase();
const normalizeMode=m=>m==='heroics'?'skills':m==='arcana'?'spells':m;

const CATALOG=`
Arcanist|Chimerist|Darkblade|Elementalist|Entropist|Fury|Guardian|Loremaster|Orator|Rogue|Sharpshooter|Spiritist|Tinkerer|Wayfarer|Weaponmaster|
Arcane Circle|Arcane Regeneration|Bind and Summon|Emergency Arcanum|Ritual Arcanism|Consume|Feral Speech|Pathogenesis|Ritual Chimerism|Spell Mimic|Agony|Dark Blood|Heart of Darkness|Painful Lesson|Shadow Strike|Cataclysm|Elemental Magic|Magical Artillery|Ritual Elementalism|Spellblade|Absorb MP|Entropic Magic|Lucky Seven|Ritual Entropism|Stolen Time|Adrenaline|Frenzy|Indomitable Spirit|Provoke|Withstand|Bodyguard|Defensive Mastery|Dual Shieldbearer|Fortress|Protect|Flash of Insight|Focused|Knowledge is Power|Quick Assessment|Trained Memory|Condemn|Encourage|My Trust in You|Persuasive|Unexpected Ally|Cheap Shot|Dodge|High Speed|See You Later|Soul Steal|Barrage|Crossfire|Hawkeye|Ranged Weapon Mastery|Warning Shot|Healing Power|Ritual Spiritism|Spiritual Magic|Support Magic|Vismagus|Emergency Item|Gadgets|Potion Rain|Secret Formula|Visionary|Faithful Companion|Resourceful|Tavern Talk|Treasure Hunter|Well-Traveled|Bladestorm|Bone Crusher|Breach|Counterattack|Melee Weapon Mastery|
Elemental Shroud|Elemental Weapon|Flare|Fulgur|Glacies|Iceberg|Ignis|Soaring Strike|Terra|Thunderbolt|Ventus|Vortex|Acceleration|Anomaly|Dark Weapon|Dispel|Divination|Drain Spirit|Drain Vigor|Gamble|Mirror|Omega|Stop|Umbra|Aura|Awaken|Barrier|Cleanse|Enrage|Hallucination|Heal|Lux|Mercy|Reinforce|Soul Weapon|Torpor|
Forge|Frost|Gate|Grimoire|Oak|Sky|Sword|Tower|Wheel|
Staff|Tome|Crossbow|Shortbow|Unarmed|Improvised Melee|Iron Knuckle|Steel Dagger|Pistol|Chain Whip|Iron Hammer|Broadaxe|Waraxe|Light Spear|Heavy Spear|Bronze Sword|Greatsword|Katana|Rapier|Improvised Ranged|Shuriken|
Ambidextrous|Extra HP|Extra IP|Extra MP|Extra Spells|Adversity|Arcane Echoes|Chimeric Mastery|Comet|Deep Pockets|Disarming Rhetoric|Heartbreaker|Heroic Companion|Hope|Mathemagic|Monkey Grip|Perfect Aim|Pillage|Powerful Shot|Powerful Spell|Powerful Strike|Predictable!|Rampart|Repetition|Revelation|Status Immunity|Unbreakable|Upgrade|Tempest Strike|Vanish|Volcano
`.split('|').map(norm).filter(Boolean);

const ACCENTS=['sun','moon','star','crystal','portal','summon','aura','heart','heal','eye','mask','clock','hourglass','mirror','scroll','book','wings','feather','flame','meteor','ice','lightning','wind','earth','wave','shield','armor','sword','spiritblade','dagger','katana','rapier','bow','crossbow','gun','spear','axe','hammer','whip','fist','shuriken','staff','potion','poison','bomb','gear','dice','coin'];
const FRAMES=[
'M16 1 29 8v16l-13 7L3 24V8L16 1Z',
'M16 1 30 16 16 31 2 16 16 1Z',
'M8 2h16l6 6v16l-6 6H8l-6-6V8l6-6Z',
'M16 1 27 5l4 11-4 11-11 4-11-4-4-11L5 5l11-4Z'
];

function hash(s){let h=2166136261;for(const ch of s){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}
function variantFor(name){const n=norm(name),idx=CATALOG.indexOf(n);if(idx>=0)return {accent:ACCENTS[idx%ACCENTS.length],frame:Math.floor(idx/ACCENTS.length)%FRAMES.length};const h=hash(n);return {accent:ACCENTS[h%ACCENTS.length],frame:(h>>>8)%FRAMES.length}}
function createPath(d,cls){const p=document.createElementNS(NS,'path');p.setAttribute('d',d);p.classList.add(cls);return p}

function uniqueIcon(name,mode=''){
  const m=normalizeMode(mode),kind=semanticIcon(name,'','',m),v=variantFor(name);
  const svg=document.createElementNS(NS,'svg');svg.setAttribute('viewBox','0 0 32 32');svg.setAttribute('aria-hidden','true');svg.classList.add('picker-unique-icon',`picker-icon-${kind}`,'fully-unique-icon');
  svg.appendChild(createPath(FRAMES[v.frame],'picker-icon-frame'));
  const main=document.createElementNS(NS,'g');main.setAttribute('transform','translate(5 4) scale(.92)');main.appendChild(createPath(ICONS[kind]||ICONS.star,'picker-icon-main'));svg.appendChild(main);
  const badge=document.createElementNS(NS,'circle');badge.setAttribute('cx','24.2');badge.setAttribute('cy','23.8');badge.setAttribute('r','5.1');badge.classList.add('unique-icon-badge');svg.appendChild(badge);
  const accent=document.createElementNS(NS,'g');accent.setAttribute('transform','translate(20.1 19.7) scale(.34)');accent.appendChild(createPath(ICONS[v.accent]||ICONS.star,'unique-icon-accent'));svg.appendChild(accent);
  return svg;
}

function replaceIcon(target,name,mode){if(!target||!name)return;const sig=`${normalizeMode(mode)}|${norm(name)}`;if(target.dataset.fullUniqueSig===sig)return;target.textContent='';target.appendChild(uniqueIcon(name,mode));target.dataset.fullUniqueSig=sig}
function decoratePicker(){const modal=document.getElementById('coreLibraryModal'),body=document.getElementById('coreLibraryBody');if(!modal||!body)return;const mode=modal.dataset.mode||'';body.querySelectorAll(':scope > .core-lib-card').forEach(card=>{const name=card.querySelector('.core-lib-head strong')?.textContent||'',wrap=card.querySelector('.picker-icon-wrap');replaceIcon(wrap,name,mode)})}
function cardMode(card){return card.classList.contains('build-entry-skills')?'skills':card.classList.contains('build-entry-equipment')?'equipment':card.classList.contains('build-entry-magic')?'spells':''}
function decorateBuild(){document.querySelectorAll('#buildMenuBody .build-entry-skills,#buildMenuBody .build-entry-equipment,#buildMenuBody .build-entry-magic').forEach(card=>{const name=card.querySelector('.build-entry-copy strong')?.textContent||'',glyph=card.querySelector('.build-entry-glyph');replaceIcon(glyph,name,cardMode(card));glyph?.classList.add('build-unique-glyph')})}
function decorateDetail(card){const modal=document.getElementById('buildDetailModal');if(!modal||modal.classList.contains('hidden'))return;const name=card.querySelector('.build-entry-copy strong')?.textContent||'',target=modal.querySelector('.build-detail-icon');replaceIcon(target,name,cardMode(card));target?.classList.add('build-detail-unique-icon')}

let queued=false;function queue(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;decoratePicker();decorateBuild()})}
function install(){const s=document.createElement('style');s.id='fullUniqueIconStyles';s.textContent=`.unique-icon-badge{fill:rgba(8,13,20,.96);stroke:rgba(226,190,105,.75);stroke-width:.8}.unique-icon-accent{fill:#f1d48d}.fully-unique-icon .picker-icon-main{transform-origin:center}.build-detail-icon .fully-unique-icon{width:64px;height:64px}.build-entry-glyph .fully-unique-icon{width:31px;height:31px}`;document.head.appendChild(s);queue();const picker=document.getElementById('coreLibraryBody');if(picker)new MutationObserver(queue).observe(picker,{childList:true,subtree:false});const build=document.getElementById('buildMenuBody');if(build)new MutationObserver(queue).observe(build,{childList:true,subtree:true});document.addEventListener('click',e=>{const card=e.target.closest?.('#buildMenuBody .build-entry-skills,#buildMenuBody .build-entry-equipment,#buildMenuBody .build-entry-magic');if(card)setTimeout(()=>decorateDetail(card),35)},true)}
setTimeout(install,0);
