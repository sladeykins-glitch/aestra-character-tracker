const CONFIG=window.AESTRA_CONFIG||{};
let libClient=null, libraryLoaded=false, coreClasses=[], coreSkills=[];

async function getLibClient(){
  if(libClient)return libClient;
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  libClient=mod.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
  return libClient;
}

async function loadCoreLibrary(){
  if(libraryLoaded)return;
  const sb=await getLibClient();
  const {data:classes,error:ce}=await sb.from('rule_classes').select('*').eq('source_id','core-1.02').order('sort_order');
  if(ce)throw ce;
  const {data:skills,error:se}=await sb.from('rule_class_skills').select('*,rule_classes!inner(name,slug,source_id)').eq('rule_classes.source_id','core-1.02').order('sort_order');
  if(se)throw se;
  coreClasses=classes||[]; coreSkills=skills||[]; libraryLoaded=true;
}

function fire(el,type='input'){
  el.dispatchEvent(new Event(type,{bubbles:true}));
}
function latestRow(containerId){
  const rows=document.querySelectorAll(`#${containerId} .entry-row`);
  return rows[rows.length-1]||null;
}
function fillClass(c){
  document.getElementById('addClassBtn')?.click();
  requestAnimationFrame(()=>{
    const row=latestRow('classesEditor'); if(!row)return;
    const inputs=row.querySelectorAll('input,textarea');
    if(inputs[0]){inputs[0].value=c.name;fire(inputs[0])}
    if(inputs[1]){inputs[1].value='1';fire(inputs[1])}
    if(inputs[2]){inputs[2].value=(c.free_benefits||[]).join(' · ');fire(inputs[2])}
  });
}
function fillSkill(s){
  document.getElementById('addSkillBtn')?.click();
  requestAnimationFrame(()=>{
    const row=latestRow('skillsEditor'); if(!row)return;
    const inputs=row.querySelectorAll('input,textarea');
    if(inputs[0]){inputs[0].value=s.name;fire(inputs[0])}
    if(inputs[1]){inputs[1].value='1';inputs[1].max=String(s.max_rank||1);fire(inputs[1])}
    if(inputs[2]){inputs[2].value=s.rule_classes?.name||'Core Rulebook';fire(inputs[2])}
    if(inputs[3]){inputs[3].value=s.effect||'';fire(inputs[3])}
  });
}

function closeLibrary(){document.getElementById('coreLibraryModal')?.classList.add('hidden')}
function renderLibrary(mode='classes',query=''){
  const body=document.getElementById('coreLibraryBody'); if(!body)return;
  const q=query.trim().toLowerCase();
  const items=mode==='classes'?coreClasses:coreSkills;
  const filtered=items.filter(x=>{
    const hay=mode==='classes'?`${x.name} ${(x.aliases||[]).join(' ')} ${x.summary}`:`${x.name} ${x.rule_classes?.name||''} ${x.effect}`;
    return !q||hay.toLowerCase().includes(q);
  });
  body.innerHTML='';
  filtered.forEach(x=>{
    const card=document.createElement('article'); card.className='core-lib-card';
    if(mode==='classes'){
      card.innerHTML=`<div class="core-lib-head"><div><strong>${escapeHtml(x.name)}</strong><small>Core p. ${x.page||'—'}</small></div><button class="primary" type="button">Add class</button></div><p>${escapeHtml(x.summary||'')}</p><p class="muted"><b>Free benefits:</b> ${escapeHtml((x.free_benefits||[]).join(' · ')||'None')}</p><p class="muted">${escapeHtml((x.aliases||[]).join(' · '))}</p>`;
      card.querySelector('button').onclick=()=>{fillClass(x);closeLibrary()};
    }else{
      const rank=(x.max_rank||1)>1?`SL 1–${x.max_rank}`:'Single rank';
      card.innerHTML=`<div class="core-lib-head"><div><strong>${escapeHtml(x.name)}</strong><small>${escapeHtml(x.rule_classes?.name||'')} · ${rank} · Core p. ${x.page||'—'}</small></div><button class="primary" type="button">Add skill</button></div><p>${escapeHtml(x.effect||'')}</p>`;
      card.querySelector('button').onclick=()=>{fillSkill(x);closeLibrary()};
    }
    body.appendChild(card);
  });
  if(!filtered.length)body.innerHTML='<p class="muted">No matching Core Rulebook entries.</p>';
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}

async function openLibrary(mode){
  const modal=document.getElementById('coreLibraryModal');
  const body=document.getElementById('coreLibraryBody');
  modal.classList.remove('hidden'); body.innerHTML='<p class="muted">Loading Core Rulebook library…</p>';
  document.getElementById('coreLibraryTitle').textContent=mode==='classes'?'Add a Core Class':'Add a Core Class Skill';
  document.getElementById('coreLibrarySearch').value='';
  modal.dataset.mode=mode;
  try{await loadCoreLibrary();renderLibrary(mode)}catch(e){body.innerHTML=`<p>Could not load the Core library: ${escapeHtml(e.message||e)}</p>`}
}

function installLibraryUI(){
  if(document.getElementById('coreLibraryModal'))return;
  const classBtn=document.getElementById('addClassBtn');
  const skillBtn=document.getElementById('addSkillBtn');
  if(classBtn){const b=document.createElement('button');b.type='button';b.className='secondary core-library-btn';b.textContent='Core Library';b.onclick=()=>openLibrary('classes');classBtn.parentElement?.appendChild(b)}
  if(skillBtn){const b=document.createElement('button');b.type='button';b.className='secondary core-library-btn';b.textContent='Core Library';b.onclick=()=>openLibrary('skills');skillBtn.parentElement?.appendChild(b)}

  const modal=document.createElement('div'); modal.id='coreLibraryModal'; modal.className='core-library-modal hidden';
  modal.innerHTML=`<div class="core-library-dialog panel"><div class="split-heading"><div><p class="eyebrow">Fabula Ultima · Core Rulebook 1.02</p><h2 id="coreLibraryTitle">Core Library</h2></div><button id="coreLibraryClose" class="ghost" type="button">Close</button></div><input id="coreLibrarySearch" class="core-library-search" type="search" placeholder="Search classes or skills…"><div id="coreLibraryBody" class="core-library-body"></div></div>`;
  document.body.appendChild(modal);
  document.getElementById('coreLibraryClose').onclick=closeLibrary;
  modal.addEventListener('click',e=>{if(e.target===modal)closeLibrary()});
  document.getElementById('coreLibrarySearch').addEventListener('input',e=>renderLibrary(modal.dataset.mode||'classes',e.target.value));

  const style=document.createElement('style');style.textContent=`
    .core-library-btn{margin-left:8px}.core-library-modal{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;padding:18px;overflow:auto}.core-library-modal.hidden{display:none!important}.core-library-dialog{width:min(860px,100%);margin:4vh auto}.core-library-search{width:100%;margin:10px 0 14px}.core-library-body{display:grid;gap:10px;max-height:70vh;overflow:auto;padding-right:4px}.core-lib-card{border:1px solid var(--border,#514638);border-radius:14px;padding:13px;background:rgba(255,255,255,.025)}.core-lib-head{display:flex;gap:12px;align-items:center;justify-content:space-between}.core-lib-head div{display:grid;gap:3px}.core-lib-head small{opacity:.72}.core-lib-card p{margin:.55rem 0 0;line-height:1.45}@media(max-width:640px){.core-library-btn{margin-left:0;margin-top:8px}.core-lib-head{align-items:flex-start}.core-lib-head button{white-space:nowrap}}
  `;document.head.appendChild(style);
}

installLibraryUI();
