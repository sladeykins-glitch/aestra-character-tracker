// Rules-aware Core Rulebook calculations for the player sheet.
// This layer reads the structured rows already rendered by app-core and applies
// only automatic numeric effects that can be derived unambiguously from the sheet.

const dieSize=v=>Number(String(v||'d6').replace('d',''))||6;
const number=v=>Number(v)||0;
const norm=v=>String(v||'').trim().toLowerCase();

// Core 1.02 free benefits. These are gained once when a character acquires a Class.
const CLASS_BENEFITS={
  arcanist:{mp:5},
  chimerist:{mp:5},
  darkblade:{hp:5,martial:['melee','armor']},
  elementalist:{mp:5},
  entropist:{mp:5},
  fury:{hp:5,martial:['melee','armor']},
  guardian:{hp:5,martial:['armor','shield']},
  loremaster:{mp:5},
  orator:{mp:5},
  rogue:{ip:2},
  sharpshooter:{hp:5,martial:['ranged','shield']},
  spiritist:{mp:5},
  tinkerer:{ip:2},
  wayfarer:{ip:2},
  weaponmaster:{hp:5,martial:['melee','shield']}
};

function rowValues(rootId){
  return [...document.querySelectorAll(`#${rootId} .entry-row`)].map(row=>[...row.querySelectorAll('input,textarea')].map(x=>x.value));
}
function classes(){return rowValues('classesEditor').map(v=>({name:v[0]||'',level:number(v[1])}))}
function skills(){return rowValues('skillsEditor').map(v=>({name:v[0]||'',rank:Math.max(0,number(v[1])),source:v[2]||'',effect:v[3]||''}))}
function equipment(){return rowValues('equipmentEditor').map(v=>({slot:v[0]||'',name:v[1]||'',def:number(v[2]),mdef:number(v[3]),init:number(v[4]),notes:v[5]||''}))}
function hasClass(name){const n=norm(name);return classes().some(c=>norm(c.name)===n&&c.level>0)}
function skillRank(name){const n=norm(name);return skills().filter(s=>norm(s.name)===n).reduce((a,s)=>a+s.rank,0)}
function heroic(name){return skillRank(name)>0}

function automaticBonuses(){
  let hp=0,mp=0,ip=0;
  for(const c of classes()){
    if(c.level<=0)continue;
    const b=CLASS_BENEFITS[norm(c.name)];
    if(b){hp+=b.hp||0;mp+=b.mp||0;ip+=b.ip||0}
  }
  // Core skills whose permanent numeric effect is directly representable by this sheet.
  hp+=skillRank('Fortress')*3;
  mp+=skillRank('Focused')*3;
  // Core Heroic Skills.
  if(heroic('Extra HP'))hp+=number(document.getElementById('level')?.value)>=40?20:10;
  if(heroic('Extra MP'))mp+=number(document.getElementById('level')?.value)>=40?20:10;
  if(heroic('Extra IP'))ip+=4;
  return {hp,mp,ip};
}

function equipmentFlags(){
  const eq=equipment();
  const hasShield=eq.some(e=>norm(e.slot).includes('shield')||norm(e.notes).includes('shield'));
  const hasMartialArmor=eq.some(e=>(norm(e.slot).includes('armor')||norm(e.notes).includes('armor'))&&norm(e.notes).includes('martial'));
  return {hasShield,hasMartialArmor};
}
function martialPermissions(){
  const p=new Set();
  for(const c of classes())for(const x of CLASS_BENEFITS[norm(c.name)]?.martial||[])p.add(x);
  return p;
}
function equipmentWarnings(){
  const p=martialPermissions();const warnings=[];
  for(const e of equipment()){
    const notes=norm(e.notes),slot=norm(e.slot);
    if(!notes.includes('martial'))continue;
    let needed=null;
    if(slot.includes('armor')||notes.includes('armor'))needed='armor';
    else if(slot.includes('shield')||notes.includes('shield'))needed='shield';
    else if(notes.includes('ranged'))needed='ranged';
    else needed='melee';
    if(!p.has(needed))warnings.push(`${e.name||'Martial item'} requires martial ${needed} access.`);
  }
  return warnings;
}
function classWarnings(){
  const cs=classes().filter(c=>c.level>0);const warnings=[];const total=cs.reduce((a,c)=>a+c.level,0);const level=number(document.getElementById('level')?.value);
  if(total!==level)warnings.push(`Class levels total ${total}; character level is ${level}.`);
  if(cs.some(c=>c.level>10))warnings.push('A Class cannot exceed level 10.');
  const nonMastered=cs.filter(c=>c.level<10).length;if(nonMastered>3)warnings.push('You cannot have more than three non-mastered Classes.');
  return warnings;
}
function heroicWarnings(){
  const cs=classes();const mastered=n=>cs.some(c=>norm(c.name)===norm(n)&&c.level>=10);const names=new Set(skills().filter(s=>norm(s.source).includes('heroic')).map(s=>norm(s.name)));const w=[];
  const req={
    'adversity':['Darkblade'],'arcane echoes':['Arcanist'],'chimeric mastery':['Chimerist'],'comet':['Entropist'],'deep pockets':['Tinkerer'],'disarming rhetoric':['Orator'],'heartbreaker':['Darkblade'],'heroic companion':['Wayfarer'],'hope':['Spiritist'],'mathemagic':['Loremaster'],'monkey grip':['Fury'],'perfect aim':['Sharpshooter'],'pillage':['Rogue'],'powerful shot':['Sharpshooter'],'predictable!':['Loremaster'],'rampart':['Guardian'],'repetition':['Orator'],'revelation':['Arcanist'],'status immunity':['Wayfarer'],'tempest strike':['Weaponmaster'],'unbreakable':['Guardian'],'upgrade':['Tinkerer'],'vanish':['Rogue'],'volcano':['Elementalist']
  };
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
  p=document.createElement('article');p.id='rulesAwarePanel';p.className='panel';p.innerHTML='<div class="section-title"><div><p class="eyebrow">Core Rules</p><h3>Automatic Rules</h3></div><span id="rulesAwareStatus" class="muted"></span></div><div id="rulesAwareBonuses" class="muted"></div><div id="rulesAwareWarnings" class="rules-aware-warnings"></div>';
  derived.after(p);return p;
}
function recalc(){
  const p=ensurePanel();if(!p)return;
  const b=automaticBonuses();const level=number(document.getElementById('level')?.value);const mig=dieSize(document.getElementById('migBase')?.value);const wlp=dieSize(document.getElementById('wlpBase')?.value);
  const hpOther=document.getElementById('hpOther'),mpOther=document.getElementById('mpOther'),ipOther=document.getElementById('ipOther');
  // Keep user-entered Other values intact. The rules layer adjusts displayed maximums
  // after the core render, so removing a Class/Skill removes its benefit automatically.
  const hpMax=Math.max(1,mig*5+level+number(hpOther?.value)+b.hp);
  const mpMax=Math.max(0,wlp*5+level+number(mpOther?.value)+b.mp);
  const ipMax=Math.max(0,6+number(ipOther?.value)+b.ip);
  const setMax=(r,max)=>{const maxEl=document.getElementById(`${r}MaxText`),nowEl=document.getElementById(`${r}Now`),bar=document.getElementById(`${r}Bar`);if(maxEl)maxEl.textContent=max;const now=Math.min(number(nowEl?.textContent),max);if(nowEl&&number(nowEl.textContent)>max)nowEl.textContent=now;if(bar)bar.style.width=`${max?Math.min(100,now/max*100):0}%`;const slider=document.querySelector(`.resource-card[data-resource="${r}"] input[type="range"]`);if(slider){slider.max=max;if(number(slider.value)>max)slider.value=max}};
  setMax('hp',hpMax);setMax('mp',mpMax);setMax('ip',ipMax);
  const flags=equipmentFlags();let defBonus=0;if(skillRank('Dodge')>0&&!flags.hasShield&&!flags.hasMartialArmor)defBonus=skillRank('Dodge');
  const def=document.getElementById('defenceText');if(def&&defBonus){const base=dieSize(document.getElementById('dex')?.value)+number(document.getElementById('defenceOther')?.value)+equipment().reduce((a,e)=>a+e.def,0);def.textContent=base+defBonus}
  const crisis=document.getElementById('crisisText');if(crisis)crisis.textContent=Math.floor(hpMax/2);
  document.getElementById('rulesAwareBonuses').textContent=`Automatic Core bonuses: HP +${b.hp} · MP +${b.mp} · IP +${b.ip}${defBonus?` · DEF +${defBonus} (Dodge)`:''}`;
  const warnings=[...classWarnings(),...heroicWarnings(),...equipmentWarnings()];const wr=document.getElementById('rulesAwareWarnings');wr.innerHTML=warnings.map(x=>`<p>⚠ ${x}</p>`).join('');document.getElementById('rulesAwareStatus').textContent=warnings.length?`${warnings.length} rules check${warnings.length===1?'':'s'}`:'Rules check OK';
}
function install(){ensurePanel();const sheet=document.getElementById('sheetView');if(!sheet)return;sheet.addEventListener('input',()=>requestAnimationFrame(recalc));sheet.addEventListener('change',()=>requestAnimationFrame(recalc));sheet.addEventListener('click',()=>setTimeout(recalc,30));const observer=new MutationObserver(()=>requestAnimationFrame(recalc));['classesEditor','skillsEditor','equipmentEditor'].forEach(id=>{const x=document.getElementById(id);if(x)observer.observe(x,{childList:true,subtree:true})});const style=document.createElement('style');style.textContent='.rules-aware-warnings{margin-top:8px}.rules-aware-warnings p{margin:5px 0;color:#e7b96a;font-size:.92rem}';document.head.appendChild(style);recalc()}
install();
