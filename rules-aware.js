// Rules-aware Core Rulebook calculations for the player sheet.
const number=v=>Number(v)||0;
const norm=v=>String(v||'').trim().toLowerCase();

const CLASS_BENEFITS={
  arcanist:{mp:5},chimerist:{mp:5},darkblade:{hp:5,martial:['melee','armor']},
  elementalist:{mp:5},entropist:{mp:5},fury:{hp:5,martial:['melee','armor']},
  guardian:{hp:5,martial:['armor','shield']},loremaster:{mp:5},orator:{mp:5},
  rogue:{ip:2},sharpshooter:{hp:5,martial:['ranged','shield']},spiritist:{mp:5},
  tinkerer:{ip:2},wayfarer:{ip:2},weaponmaster:{hp:5,martial:['melee','shield']}
};

const rowValues=id=>[...document.querySelectorAll(`#${id} .entry-row`)].map(r=>[...r.querySelectorAll('input,textarea')].map(x=>x.value));
const classes=()=>rowValues('classesEditor').map(v=>({name:v[0]||'',level:number(v[1])}));
const skills=()=>rowValues('skillsEditor').map(v=>({name:v[0]||'',rank:Math.max(0,number(v[1])),source:v[2]||''}));
const equipment=()=>rowValues('equipmentEditor').map(v=>({slot:v[0]||'',name:v[1]||'',def:number(v[2]),mdef:number(v[3]),init:number(v[4]),notes:v[5]||''}));
const skillRank=name=>skills().filter(s=>norm(s.name)===norm(name)).reduce((a,s)=>a+s.rank,0);
const heroic=name=>skillRank(name)>0;

function automaticBonuses(){
  let hp=0,mp=0,ip=0;
  for(const c of classes()){
    if(c.level<=0)continue;
    const b=CLASS_BENEFITS[norm(c.name)];
    if(b){hp+=b.hp||0;mp+=b.mp||0;ip+=b.ip||0}
  }
  hp+=skillRank('Fortress')*3;
  mp+=skillRank('Focused')*3;
  const level=number(document.getElementById('level')?.value);
  if(heroic('Extra HP'))hp+=level>=40?20:10;
  if(heroic('Extra MP'))mp+=level>=40?20:10;
  if(heroic('Extra IP'))ip+=4;
  return {hp,mp,ip};
}

let lastAuto=null;
let applying=false;
function applyAutomaticResourceDeltas(){
  const next=automaticBonuses();
  if(lastAuto===null){lastAuto=next;return next}
  if(applying)return next;
  const ids={hp:'hpOther',mp:'mpOther',ip:'ipOther'};
  const changed=[];
  for(const k of ['hp','mp','ip']){
    const delta=next[k]-lastAuto[k];
    const el=document.getElementById(ids[k]);
    if(delta&&el){el.value=number(el.value)+delta;changed.push(el)}
  }
  lastAuto=next;
  if(changed.length){
    applying=true;
    for(const el of changed)el.dispatchEvent(new Event('change',{bubbles:true}));
    applying=false;
  }
  return next;
}

function equipmentFlags(){
  const eq=equipment();
  return {
    hasShield:eq.some(e=>norm(e.slot).includes('shield')||norm(e.notes).includes('shield')),
    hasMartialArmor:eq.some(e=>(norm(e.slot).includes('armor')||norm(e.notes).includes('armor'))&&norm(e.notes).includes('martial'))
  };
}
function martialPermissions(){const p=new Set();for(const c of classes())for(const x of CLASS_BENEFITS[norm(c.name)]?.martial||[])p.add(x);return p}
function equipmentWarnings(){
  const p=martialPermissions(),warnings=[];
  for(const e of equipment()){
    const notes=norm(e.notes),slot=norm(e.slot);if(!notes.includes('martial'))continue;
    let needed=slot.includes('armor')||notes.includes('armor')?'armor':slot.includes('shield')||notes.includes('shield')?'shield':notes.includes('ranged')?'ranged':'melee';
    if(!p.has(needed))warnings.push(`${e.name||'Martial item'} requires martial ${needed} access.`)
  }
  return warnings;
}
function classWarnings(){
  const cs=classes().filter(c=>c.level>0),warnings=[],total=cs.reduce((a,c)=>a+c.level,0),level=number(document.getElementById('level')?.value);
  if(total!==level)warnings.push(`Class levels total ${total}; character level is ${level}.`);
  if(cs.some(c=>c.level>10))warnings.push('A Class cannot exceed level 10.');
  if(cs.filter(c=>c.level<10).length>3)warnings.push('You cannot have more than three non-mastered Classes.');
  return warnings;
}
function heroicWarnings(){
  const cs=classes(),mastered=n=>cs.some(c=>norm(c.name)===norm(n)&&c.level>=10),names=new Set(skills().filter(s=>norm(s.source).includes('heroic')).map(s=>norm(s.name))),w=[];
  const req={'adversity':['Darkblade'],'arcane echoes':['Arcanist'],'chimeric mastery':['Chimerist'],'comet':['Entropist'],'deep pockets':['Tinkerer'],'disarming rhetoric':['Orator'],'heartbreaker':['Darkblade'],'heroic companion':['Wayfarer'],'hope':['Spiritist'],'mathemagic':['Loremaster'],'monkey grip':['Fury'],'perfect aim':['Sharpshooter'],'pillage':['Rogue'],'powerful shot':['Sharpshooter'],'predictable!':['Loremaster'],'rampart':['Guardian'],'repetition':['Orator'],'revelation':['Arcanist'],'status immunity':['Wayfarer'],'tempest strike':['Weaponmaster'],'unbreakable':['Guardian'],'upgrade':['Tinkerer'],'vanish':['Rogue'],'volcano':['Elementalist']};
  for(const [h,rs] of Object.entries(req))if(names.has(h)&&!rs.some(mastered))w.push(`${h.replace(/\b\w/g,x=>x.toUpperCase())} requires the relevant mastered Class.`);
  if(names.has('powerful spell')&&!['Chimerist','Elementalist','Entropist','Spiritist'].some(mastered))w.push('Powerful Spell requires Chimerist, Elementalist, Entropist, or Spiritist mastered.');
  if(names.has('powerful strike')&&!['Fury','Weaponmaster'].some(mastered))w.push('Powerful Strike requires Fury or Weaponmaster mastered.');
  if(names.has('perfect aim')&&skillRank('Warning Shot')<1)w.push('Perfect Aim also requires Warning Shot.');
  if(names.has('pillage')&&skillRank('Soul Steal')<1)w.push('Pillage also requires Soul Steal.');
  if(names.has('heroic companion')&&skillRank('Faithful Companion')<1)w.push('Heroic Companion also requires Faithful Companion.');
  return w;
}

function ensurePanel(){
  let p=document.getElementById('rulesAwarePanel');if(p)return p;
  const derived=document.querySelector('#sheetView .derived-grid')?.closest('.panel');if(!derived)return null;
  p=document.createElement('article');p.id='rulesAwarePanel';p.className='panel';
  p.innerHTML='<div class="section-title"><div><p class="eyebrow">Core Rules</p><h3>Automatic Rules</h3></div><span id="rulesAwareStatus" class="muted"></span></div><div id="rulesAwareBonuses" class="muted"></div><div id="rulesAwareWarnings" class="rules-aware-warnings"></div>';
  derived.after(p);return p;
}
function recalc(){
  const p=ensurePanel();if(!p)return;
  const b=applyAutomaticResourceDeltas();
  const flags=equipmentFlags();let defBonus=0;if(skillRank('Dodge')>0&&!flags.hasShield&&!flags.hasMartialArmor)defBonus=skillRank('Dodge');
  const def=document.getElementById('defenceText');if(def&&defBonus){const base=number(document.getElementById('dex')?.value?.replace?.('d',''))+number(document.getElementById('defenceOther')?.value)+equipment().reduce((a,e)=>a+e.def,0);def.textContent=base+defBonus}
  document.getElementById('rulesAwareBonuses').textContent=`Automatic Core bonuses included in Other: HP +${b.hp} · MP +${b.mp} · IP +${b.ip}${defBonus?` · DEF +${defBonus} (Dodge)`:''}`;
  const warnings=[...classWarnings(),...heroicWarnings(),...equipmentWarnings()];
  document.getElementById('rulesAwareWarnings').innerHTML=warnings.map(x=>`<p>⚠ ${x}</p>`).join('');
  document.getElementById('rulesAwareStatus').textContent=warnings.length?`${warnings.length} rules check${warnings.length===1?'':'s'}`:'Rules check OK';
}
function install(){
  ensurePanel();const sheet=document.getElementById('sheetView');if(!sheet)return;
  sheet.addEventListener('input',()=>requestAnimationFrame(recalc));sheet.addEventListener('change',()=>requestAnimationFrame(recalc));sheet.addEventListener('click',()=>setTimeout(recalc,30));
  const observer=new MutationObserver(()=>requestAnimationFrame(recalc));['classesEditor','skillsEditor','equipmentEditor'].forEach(id=>{const x=document.getElementById(id);if(x)observer.observe(x,{childList:true,subtree:true})});
  const style=document.createElement('style');style.textContent='.rules-aware-warnings{margin-top:8px}.rules-aware-warnings p{margin:5px 0;color:#e7b96a;font-size:.92rem}';document.head.appendChild(style);
  recalc();
}
install();
