const CONFIG = window.AESTRA_CONFIG || {};
const STATUS_OPTIONS = ['Slow','Dazed','Weak','Shaken','Enraged','Poisoned'];
const $ = id => document.getElementById(id);
let client = null;
let editing = null;
let statuses = [];

const die = v => Number(String(v || 'd6').replace('d','')) || 6;
const clamp = (n,min,max) => Math.min(max,Math.max(min,Number(n)||0));
const n = id => Number($(id)?.value) || 0;
const t = id => $(id)?.value?.trim?.() || '';

async function supabaseClient(){
  if(client) return client;
  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  client = mod.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
  return client;
}

function arrays(c){
  for(const key of ['traits','classes_struct','skills_struct','equipment_struct','spells_struct','bonds_struct','inventory_struct','statuses']) {
    if(!Array.isArray(c[key])) c[key] = [];
  }
  while(c.traits.length < 3) c.traits.push('');
  return c;
}

function input(value, placeholder='', type='text'){
  const el=document.createElement('input'); el.type=type; el.value=value ?? ''; el.placeholder=placeholder; return el;
}
function area(value, placeholder=''){
  const el=document.createElement('textarea'); el.rows=2; el.value=value ?? ''; el.placeholder=placeholder; return el;
}
function removeButton(fn){
  const b=document.createElement('button'); b.type='button'; b.className='ghost remove-entry'; b.textContent='Remove'; b.onclick=fn; return b;
}
function gmEditor(container,key,fields){
  const root=$(container); if(!root || !editing) return; root.innerHTML='';
  editing[key].forEach((item,i)=>{
    const row=document.createElement('div'); row.className='entry-row';
    fields.forEach(f=>{
      const label=document.createElement('label'); label.textContent=f.label;
      const el=f.long ? area(item[f.k],f.placeholder) : input(item[f.k],f.placeholder,f.type);
      el.oninput=()=>{ item[f.k]=f.type==='number' ? Number(el.value)||0 : el.value; renderDerived(); renderClassSummary(); };
      label.appendChild(el); row.appendChild(label);
    });
    row.appendChild(removeButton(()=>{ editing[key].splice(i,1); renderStructured(); renderDerived(); }));
    root.appendChild(row);
  });
}
function renderTraits(){
  const root=$('gmTraitsEditor'); if(!root || !editing) return; root.innerHTML='';
  for(let i=0;i<3;i++){
    const label=document.createElement('label'); label.textContent=`Trait ${i+1}`;
    const el=input(editing.traits[i],'e.g. Stubborn heir'); el.oninput=()=>editing.traits[i]=el.value;
    label.appendChild(el); root.appendChild(label);
  }
}
function renderClassSummary(){
  if(!editing || !$('gmClassLevelSummary')) return;
  const total=(editing.classes_struct||[]).reduce((s,x)=>s+(Number(x.level)||0),0);
  $('gmClassLevelSummary').textContent=`Class levels: ${total} / Character level ${n('gmLevel')||editing.level}${total!==(n('gmLevel')||Number(editing.level))?' · check totals':''}`;
}
function renderStructured(){
  if(!editing) return;
  renderTraits();
  gmEditor('gmClassesEditor','classes_struct',[{k:'name',label:'Class',placeholder:'Class name'},{k:'level',label:'Level',type:'number'},{k:'benefits',label:'Free Benefits / Notes',long:true}]);
  gmEditor('gmSkillsEditor','skills_struct',[{k:'name',label:'Skill',placeholder:'Skill name'},{k:'rank',label:'SL',type:'number'},{k:'source',label:'Class / Source'},{k:'effect',label:'Effect',long:true}]);
  gmEditor('gmEquipmentEditor','equipment_struct',[{k:'slot',label:'Slot',placeholder:'Main hand / Armor / Accessory'},{k:'name',label:'Item'},{k:'defence',label:'DEF +',type:'number'},{k:'magic_defence',label:'MDEF +',type:'number'},{k:'initiative',label:'INIT +',type:'number'},{k:'notes',label:'Rules / Description',long:true}]);
  gmEditor('gmSpellsEditor','spells_struct',[{k:'name',label:'Spell / Arcana'},{k:'mp',label:'MP',type:'number'},{k:'targets',label:'Targets'},{k:'duration',label:'Duration'},{k:'effect',label:'Effect',long:true}]);
  gmEditor('gmBondsEditor','bonds_struct',[{k:'subject',label:'Person / Faction / Ideal'},{k:'strength',label:'Strength',type:'number'},{k:'feelings',label:'Feelings'},{k:'notes',label:'Notes',long:true}]);
  gmEditor('gmInventoryEditor','inventory_struct',[{k:'name',label:'Item'},{k:'qty',label:'Qty',type:'number'},{k:'notes',label:'Notes',long:true}]);
  renderClassSummary();
}
function renderStatuses(){
  const root=$('gmStatuses'); if(!root) return; root.innerHTML='';
  STATUS_OPTIONS.forEach(s=>{
    const b=document.createElement('button'); b.type='button'; b.className='status-chip'; b.textContent=s; b.classList.toggle('active',statuses.includes(s));
    b.onclick=()=>{ statuses.includes(s) ? statuses=statuses.filter(x=>x!==s) : statuses.push(s); renderStatuses(); };
    root.appendChild(b);
  });
}
function renderDerived(){
  if(!editing) return;
  const level=n('gmLevel') || Number(editing.level) || 1;
  const migBase=t('gmMigBase') || editing.mig_base || 'd6';
  const wlpBase=t('gmWlpBase') || editing.wlp_base || 'd6';
  const dex=t('gmDex') || editing.dex || 'd6';
  const ins=t('gmIns') || editing.ins || 'd6';
  const hpMax=Math.max(1,die(migBase)*5+level+n('gmHpOther'));
  const mpMax=Math.max(0,die(wlpBase)*5+level+n('gmMpOther'));
  const ipMax=Math.max(0,6+n('gmIpOther'));
  const eq=(editing.equipment_struct||[]).reduce((a,x)=>({init:a.init+(Number(x.initiative)||0),def:a.def+(Number(x.defence)||0),mdef:a.mdef+(Number(x.magic_defence)||0)}),{init:0,def:0,mdef:0});
  const initiative=n('gmInitiativeOther')+eq.init;
  const defence=die(dex)+n('gmDefenceOther')+eq.def;
  const magicDefence=die(ins)+n('gmMagicDefenceOther')+eq.mdef;
  if($('gmHpMax')) $('gmHpMax').value=hpMax;
  if($('gmMpMax')) $('gmMpMax').value=mpMax;
  if($('gmIpMax')) $('gmIpMax').value=ipMax;
  $('gmInitiativeText').textContent=initiative; $('gmDefenceText').textContent=defence; $('gmMagicDefenceText').textContent=magicDefence; $('gmCrisisText').textContent=Math.floor(hpMax/2);
}

async function openCharacter(id){
  const sb=await supabaseClient();
  const {data,error}=await sb.from('characters').select('*').eq('id',id).single();
  if(error){ $('gmSaveStatus').textContent=`Could not load: ${error.message}`; return; }
  editing=arrays(structuredClone(data)); statuses=[...(editing.statuses||[])];
  const map={gmName:'name',gmLevel:'level',gmIdentity:'identity',gmTheme:'theme',gmOrigin:'origin',gmPlayerName:'player_name',gmXp:'xp',gmZenit:'zenit',gmMig:'mig',gmDex:'dex',gmIns:'ins',gmWlp:'wlp',gmMigBase:'mig_base',gmDexBase:'dex_base',gmInsBase:'ins_base',gmWlpBase:'wlp_base',gmHpCurrent:'hp_current',gmMpCurrent:'mp_current',gmIpCurrent:'ip_current',gmFabulaPoints:'fabula_points',gmHpOther:'hp_other',gmMpOther:'mp_other',gmIpOther:'ip_other',gmInitiativeOther:'initiative_other',gmDefenceOther:'defence_other',gmMagicDefenceOther:'magic_defence_other',gmClasses:'classes',gmSkills:'skills',gmEquipment:'equipment',gmSpells:'spells',gmBonds:'bonds',gmNotes:'notes'};
  for(const [id,key] of Object.entries(map)) if($(id)) $(id).value=editing[key] ?? '';
  renderStatuses(); renderStructured(); renderDerived();
}

function pullPatch(){
  const patch={
    name:t('gmName'),level:n('gmLevel'),identity:t('gmIdentity'),theme:t('gmTheme'),origin:t('gmOrigin'),player_name:t('gmPlayerName'),xp:n('gmXp'),zenit:n('gmZenit'),
    mig:t('gmMig'),dex:t('gmDex'),ins:t('gmIns'),wlp:t('gmWlp'),mig_base:t('gmMigBase'),dex_base:t('gmDexBase'),ins_base:t('gmInsBase'),wlp_base:t('gmWlpBase'),
    hp_other:n('gmHpOther'),mp_other:n('gmMpOther'),ip_other:n('gmIpOther'),initiative_other:n('gmInitiativeOther'),defence_other:n('gmDefenceOther'),magic_defence_other:n('gmMagicDefenceOther'),
    fabula_points:n('gmFabulaPoints'),statuses:[...statuses],traits:editing.traits,classes_struct:editing.classes_struct,skills_struct:editing.skills_struct,equipment_struct:editing.equipment_struct,spells_struct:editing.spells_struct,bonds_struct:editing.bonds_struct,inventory_struct:editing.inventory_struct,
    classes:t('gmClasses'),skills:t('gmSkills'),equipment:t('gmEquipment'),spells:t('gmSpells'),bonds:t('gmBonds'),notes:t('gmNotes'),updated_at:new Date().toISOString()
  };
  const eq=(patch.equipment_struct||[]).reduce((a,x)=>({init:a.init+(Number(x.initiative)||0),def:a.def+(Number(x.defence)||0),mdef:a.mdef+(Number(x.magic_defence)||0)}),{init:0,def:0,mdef:0});
  patch.hp_max=Math.max(1,die(patch.mig_base)*5+patch.level+patch.hp_other); patch.mp_max=Math.max(0,die(patch.wlp_base)*5+patch.level+patch.mp_other); patch.ip_max=Math.max(0,6+patch.ip_other);
  patch.hp_current=clamp(n('gmHpCurrent'),0,patch.hp_max); patch.mp_current=clamp(n('gmMpCurrent'),0,patch.mp_max); patch.ip_current=clamp(n('gmIpCurrent'),0,patch.ip_max);
  patch.initiative=patch.initiative_other+eq.init; patch.defence=die(patch.dex)+patch.defence_other+eq.def; patch.magic_defence=die(patch.ins)+patch.magic_defence_other+eq.mdef; patch.crisis=Math.floor(patch.hp_max/2);
  return patch;
}

async function saveFull(){
  if(!editing) return;
  $('gmSaveStatus').textContent='Saving full character…';
  const sb=await supabaseClient(); const patch=pullPatch();
  const {data,error}=await sb.from('characters').update(patch).eq('id',editing.id).select().single();
  if(error){ $('gmSaveStatus').textContent=`Save failed: ${error.message}`; return; }
  editing=arrays(structuredClone(data)); $('gmSaveStatus').textContent='Full character saved'; renderDerived();
  $('refreshGmBtn')?.click();
}

function add(key,obj){ if(!editing) return; editing[key].push(obj); renderStructured(); renderDerived(); }

$('gmAddClassBtn')?.addEventListener('click',()=>add('classes_struct',{name:'',level:1,benefits:''}));
$('gmAddSkillBtn')?.addEventListener('click',()=>add('skills_struct',{name:'',rank:1,source:'',effect:''}));
$('gmAddEquipmentBtn')?.addEventListener('click',()=>add('equipment_struct',{slot:'',name:'',defence:0,magic_defence:0,initiative:0,notes:''}));
$('gmAddSpellBtn')?.addEventListener('click',()=>add('spells_struct',{name:'',mp:0,targets:'',duration:'',effect:''}));
$('gmAddBondBtn')?.addEventListener('click',()=>add('bonds_struct',{subject:'',strength:1,feelings:'',notes:''}));
$('gmAddInventoryBtn')?.addEventListener('click',()=>add('inventory_struct',{name:'',qty:1,notes:''}));
$('gmStructuredSaveBtn')?.addEventListener('click',saveFull);

for(const id of ['gmLevel','gmMigBase','gmDexBase','gmInsBase','gmWlpBase','gmMig','gmDex','gmIns','gmWlp','gmHpOther','gmMpOther','gmIpOther','gmInitiativeOther','gmDefenceOther','gmMagicDefenceOther']) $(id)?.addEventListener('change',()=>{renderDerived();renderClassSummary();});

document.addEventListener('click',e=>{
  const btn=e.target.closest('.gm-open'); if(!btn) return;
  const card=btn.closest('.gm-card'); if(card?.dataset.charId) setTimeout(()=>openCharacter(card.dataset.charId),0);
});
