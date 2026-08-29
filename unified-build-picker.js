// Unified Build picker — one Add Class / Add Skill button across all sourcebooks.
(function(){
  const CONFIG=window.AESTRA_CONFIG||{};
  const norm=v=>String(v||'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fire=(el,type='input')=>el?.dispatchEvent(new Event(type,{bubbles:true}));
  const rows=id=>[...(document.getElementById(id)?.querySelectorAll('.entry-row')||[])];
  const latest=id=>rows(id).at(-1)||null;
  let sb=null,loaded=false,cache={coreClasses:[],hfClasses:[],coreSkills:[],hfSkills:[],heroics:[]};
  let mode='classes',tab='core',classFilter='';

  async function client(){
    if(sb)return sb;
    const m=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb=m.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
    return sb;
  }
  async function load(){
    if(loaded)return;
    const c=await client();
    const [cc,hc,cs,hs,hh]=await Promise.all([
      c.from('rule_classes').select('*').eq('source_id','core-1.02').order('sort_order'),
      c.from('rule_classes').select('*').eq('source_id','high-fantasy-1.03').order('sort_order'),
      c.from('rule_class_skills').select('*,rule_classes!inner(name,source_id)').eq('rule_classes.source_id','core-1.02').order('sort_order'),
      c.from('rule_class_skills').select('*,rule_classes!inner(name,source_id)').eq('rule_classes.source_id','high-fantasy-1.03').order('sort_order'),
      c.from('rule_heroic_skills').select('*').eq('source_id','core-1.02').order('sort_order')
    ]);
    const err=[cc,hc,cs,hs,hh].find(x=>x.error)?.error;if(err)throw err;
    cache={coreClasses:cc.data||[],hfClasses:hc.data||[],coreSkills:cs.data||[],hfSkills:hs.data||[],heroics:hh.data||[]};loaded=true;
  }
  function inputs(row){return row?.querySelectorAll('input,textarea,select')||[]}
  function fill(row,vals){const ins=inputs(row);vals.forEach((v,i)=>{if(ins[i]){ins[i].value=v??'';fire(ins[i]);fire(ins[i],'change')}})}
  function addClass(x){document.getElementById('addClassBtn')?.click();requestAnimationFrame(()=>fill(latest('classesEditor'),[x.name,1,(x.free_benefits||[]).join(' · ')]))}
  function addSkill(x){document.getElementById('addSkillBtn')?.click();requestAnimationFrame(()=>{const r=latest('skillsEditor'),source=x.rule_classes?.name||'Class Skill';fill(r,[x.name,1,source,x.effect]);const rank=inputs(r)[1];if(rank)rank.max=String(x.max_rank||1)})}
  function addHeroic(x){document.getElementById('addSkillBtn')?.click();requestAnimationFrame(()=>fill(latest('skillsEditor'),[x.name,1,'Heroic Skill',`${x.requirements&&x.requirements!=='None'?`Requirements: ${x.requirements}. `:''}${x.effect}`]))}
  function addCustom(kind){const id=kind==='classes'?'addClassBtn':'addSkillBtn';document.getElementById(id)?.click();close();setTimeout(()=>{const r=latest(kind==='classes'?'classesEditor':'skillsEditor');r?.querySelector('input,textarea,select')?.focus()},40)}
  function selectedClasses(){return new Set(rows('classesEditor').map(r=>norm(inputs(r)[0]?.value)).filter(Boolean))}
  function mastered(){return new Set(rows('classesEditor').filter(r=>(Number(inputs(r)[1]?.value)||0)>=10).map(r=>norm(inputs(r)[0]?.value)).filter(Boolean))}
  function heroicMatches(h){const req=norm(h.requirements);if(!req||req==='none')return true;return [...mastered()].some(c=>req.includes(c))}

  function modal(){
    let m=document.getElementById('unifiedBuildPicker');if(m)return m;
    m=document.createElement('div');m.id='unifiedBuildPicker';m.className='ubp-modal hidden';
    m.innerHTML=`<div class="ubp-dialog"><div class="ubp-head"><div><p class="eyebrow">Fabula Ultima · Aestra Library</p><h2 id="ubpTitle">Add Class</h2></div><button class="ghost ubp-close" type="button">Close</button></div><div id="ubpTabs" class="ubp-tabs"></div><input id="ubpSearch" class="ubp-search" type="search" placeholder="Search options…"><div id="ubpContext" class="ubp-context hidden"></div><div id="ubpBody" class="ubp-body"></div></div>`;
    document.body.appendChild(m);m.querySelector('.ubp-close').onclick=close;m.onclick=e=>{if(e.target===m)close()};m.querySelector('#ubpSearch').oninput=render;
    return m;
  }
  function close(){document.getElementById('unifiedBuildPicker')?.classList.add('hidden');classFilter=''}
  function availableTabs(){return mode==='classes'?[['core','Core'],['high','High Fantasy'],['custom','Custom / Homebrew']]:[['core','Core'],['high','High Fantasy'],['heroic','Heroic'],['custom','Custom / Homebrew']]}
  function items(){
    const chosen=selectedClasses();
    if(mode==='classes')return tab==='core'?cache.coreClasses:tab==='high'?cache.hfClasses:[];
    if(tab==='heroic')return cache.heroics.filter(heroicMatches);
    let list=tab==='core'?cache.coreSkills:tab==='high'?cache.hfSkills:[];
    if(classFilter)return list.filter(x=>norm(x.rule_classes?.name)===norm(classFilter));
    return list.filter(x=>chosen.has(norm(x.rule_classes?.name)));
  }
  function render(){
    const m=modal(),tabs=m.querySelector('#ubpTabs'),body=m.querySelector('#ubpBody'),q=norm(m.querySelector('#ubpSearch').value),ctx=m.querySelector('#ubpContext');
    tabs.innerHTML=availableTabs().map(([k,l])=>`<button type="button" data-ubp-tab="${k}" class="${tab===k?'active':''}">${l}</button>`).join('');
    tabs.querySelectorAll('[data-ubp-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.ubpTab;m.querySelector('#ubpSearch').value='';render()});
    if(classFilter&&mode==='skills'){ctx.textContent=`Showing skills for ${classFilter}`;ctx.classList.remove('hidden')}else ctx.classList.add('hidden');
    if(tab==='custom'){
      body.innerHTML=`<article class="ubp-custom"><h3>${mode==='classes'?'Custom / Homebrew Class':'Custom / Homebrew Skill'}</h3><p>Create a blank entry and fill in your own details.</p><button type="button" class="primary ubp-custom-add">+ Add ${mode==='classes'?'Custom Class':'Custom Skill'}</button></article>`;
      body.querySelector('.ubp-custom-add').onclick=()=>addCustom(mode);return;
    }
    let list=items().filter(x=>!q||norm(`${x.name} ${x.summary||''} ${x.effect||''} ${x.requirements||''} ${x.rule_classes?.name||''}`).includes(q));
    body.innerHTML='';
    for(const x of list){
      const card=document.createElement('article');card.className='ubp-card';
      const source=tab==='core'?'Core':tab==='high'?'High Fantasy':'Heroic';
      const meta=mode==='classes'?`${source}${x.page?` · p. ${x.page}`:''}`:tab==='heroic'?`${x.requirements||'No requirement'}${x.page?` · Core p. ${x.page}`:''}`:`${x.rule_classes?.name||''} · ${(x.max_rank||1)>1?`SL 1–${x.max_rank}`:'Single rank'} · ${source}${x.page?` p. ${x.page}`:''}`;
      const text=mode==='classes'?`${x.summary||''}${(x.free_benefits||[]).length?`\nFree benefits: ${(x.free_benefits||[]).join(' · ')}`:''}`:x.effect||'';
      card.innerHTML=`<div class="ubp-card-head"><div><strong>${esc(x.name)}</strong><small>${esc(meta)}</small></div><button class="primary" type="button">Add ${mode==='classes'?'class':'skill'}</button></div><p>${esc(text).replace(/\n/g,'<br>')}</p>`;
      card.querySelector('button').onclick=()=>{mode==='classes'?addClass(x):tab==='heroic'?addHeroic(x):addSkill(x);close()};body.appendChild(card);
    }
    if(!list.length){
      const msg=mode==='skills'&&classFilter?`No ${tab==='high'?'High Fantasy':'Core'} skills found for ${classFilter}.`:mode==='skills'?'No matching skills from your current classes.':'No matching options.';
      body.innerHTML=`<p class="muted ubp-empty">${esc(msg)}</p>`;
    }
  }
  async function open(kind,filter=''){
    mode=kind;classFilter=filter;const m=modal();m.classList.remove('hidden');m.querySelector('#ubpTitle').textContent=kind==='classes'?'Add Class':'Add Skill';m.querySelector('#ubpSearch').value='';
    m.querySelector('#ubpBody').innerHTML='<p class="muted">Loading library…</p>';
    if(filter){
      const n=norm(filter);const hfNames=new Set(cache.hfClasses.map(x=>norm(x.name)));tab=hfNames.has(n)?'high':'core';
    }else tab='core';
    try{await load();if(filter){const n=norm(filter);tab=cache.hfClasses.some(x=>norm(x.name)===n)?'high':'core'}render()}catch(e){m.querySelector('#ubpBody').innerHTML=`<p>Could not load library: ${esc(e.message||e)}</p>`}
  }

  function installBuildButton(){
    const body=document.getElementById('buildMenuBody');if(!body)return;
    const section=document.querySelector('.build-tab.active')?.dataset.build;
    if(section!=='classes'&&section!=='skills')return;
    const actions=body.querySelector('.build-actions');if(!actions)return;
    actions.querySelectorAll('.build-core-add,.build-custom,.build-heroic,.build-hf-visible').forEach(b=>b.classList.add('ubp-superseded'));
    let b=actions.querySelector('.ubp-main-add');if(!b){b=document.createElement('button');b.type='button';b.className='primary ubp-main-add';actions.appendChild(b)}
    b.textContent=section==='classes'?'+ Add Class':'+ Add Skill';b.onclick=()=>open(section==='classes'?'classes':'skills');
  }

  function interceptClassLearn(){
    document.addEventListener('click',e=>{
      const b=e.target.closest?.('[data-bh-add-skill]');if(!b)return;
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open('skills',b.dataset.bhAddSkill||'');
    },true);
  }

  const style=document.createElement('style');style.textContent=`
    .ubp-superseded{display:none!important}.ubp-main-add{order:1!important}.ubp-modal{position:fixed;inset:0;z-index:2300;display:flex;align-items:flex-start;justify-content:center;padding:18px;background:rgba(0,0,0,.76);overflow:auto}.ubp-modal.hidden{display:none!important}.ubp-dialog{width:min(920px,100%);margin:4vh auto;padding:18px;border:1px solid rgba(216,177,96,.38);border-radius:16px;background:linear-gradient(145deg,#11151d,#1a141d);box-shadow:0 28px 90px rgba(0,0,0,.62)}.ubp-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.ubp-head h2{margin:.15rem 0 0;color:#ead9ad}.ubp-tabs{display:flex;gap:6px;flex-wrap:wrap;margin:14px 0 10px;padding:5px;border:1px solid rgba(216,177,96,.18);border-radius:12px;background:rgba(0,0,0,.18)}.ubp-tabs button{min-height:36px;padding:7px 12px!important;border:0!important;border-radius:8px!important;background:transparent!important;color:inherit!important}.ubp-tabs button.active{background:linear-gradient(180deg,rgba(118,180,219,.16),rgba(211,171,91,.1))!important;box-shadow:inset 0 0 0 1px rgba(216,177,96,.3);color:#ead49b!important}.ubp-search{width:100%;margin:0 0 10px}.ubp-context{margin:0 0 10px;padding:8px 10px;border-radius:8px;background:rgba(124,86,162,.1);color:#d9bff0;font-size:.75rem}.ubp-context.hidden{display:none!important}.ubp-body{display:grid;gap:10px;max-height:68vh;overflow:auto;padding-right:3px}.ubp-card,.ubp-custom{padding:13px;border:1px solid rgba(216,177,96,.22);border-radius:13px;background:rgba(255,255,255,.025)}.ubp-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:start}.ubp-card-head>div{display:grid;gap:3px;min-width:0}.ubp-card-head strong{font-size:.95rem;color:#e7d6ad}.ubp-card-head small{font-size:.67rem;line-height:1.35;color:#aa9d88}.ubp-card p,.ubp-custom p{margin:9px 0 0;line-height:1.5;font-size:.79rem;color:#c2b9aa}.ubp-empty{padding:20px;text-align:center}.ubp-custom h3{margin:0 0 4px;color:#e5d3aa}.ubp-custom-add{margin-top:12px}@media(max-width:640px){.ubp-dialog{margin:1vh auto;padding:14px}.ubp-tabs{display:grid;grid-template-columns:repeat(2,1fr)}.ubp-card-head{grid-template-columns:1fr}.ubp-card-head button{width:100%}.ubp-main-add{width:100%}}
  `;document.head.appendChild(style);

  function boot(){
    const body=document.getElementById('buildMenuBody');if(!body){setTimeout(boot,80);return}
    installBuildButton();
    new MutationObserver(()=>requestAnimationFrame(installBuildButton)).observe(body,{childList:true,subtree:false});
    document.addEventListener('click',e=>{if(e.target.closest?.('.build-tab,.build-cycle'))setTimeout(installBuildButton,0)},true);
    interceptClassLearn();
    window.AESTRA_BUILD_PICKER={openClass:()=>open('classes'),openSkill:(name='')=>open('skills',name)};
  }
  boot();
})();