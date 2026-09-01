// Authoritative Build library v3.
// Uses a separate modal from the legacy/source-extension picker so async extension renderers cannot overwrite it.
(function(){
  if(window.__AESTRA_BUILD_LIBRARY_V3__)return;
  window.__AESTRA_BUILD_LIBRARY_V3__=true;

  const CONFIG=window.AESTRA_CONFIG||{};
  const SOURCES={
    'core-1.02':{label:'Core',order:0},
    'high-fantasy-1.03':{label:'High Fantasy',order:1},
    'natural-fantasy-1.0':{label:'Natural Fantasy',order:2},
    'techno-fantasy-1.0':{label:'Techno Fantasy',order:3}
  };
  const norm=v=>String(v||'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=id=>[...(document.getElementById(id)?.querySelectorAll('.entry-row')||[])];
  const inputs=row=>[...(row?.querySelectorAll('input,textarea,select')||[])];
  const latest=id=>rows(id).at(-1)||null;
  const fire=(el,type='input')=>el?.dispatchEvent(new Event(type,{bubbles:true}));

  let sb=null,loaded=false,loading=null;
  let data={classes:[],skills:[],heroics:[]};
  let mode='classes',tab='core-1.02',classFilter='';

  async function client(){
    if(sb)return sb;
    const m=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb=m.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
    return sb;
  }
  function enabled(sourceId){
    const api=window.AESTRA_SOURCE_SETTINGS;
    return api?.enabled?api.enabled(sourceId):true;
  }
  function enabledSources(){return Object.keys(SOURCES).filter(enabled)}
  async function load(force=false){
    if(loaded&&!force)return data;
    if(loading&&!force)return loading;
    loading=(async()=>{
      await window.AESTRA_SOURCE_SETTINGS?.load?.().catch?.(()=>{});
      const c=await client();
      const [cc,ss,hh]=await Promise.all([
        c.from('rule_classes').select('*').order('sort_order'),
        c.from('rule_class_skills').select('*,rule_classes!inner(name,source_id)').order('sort_order'),
        c.from('rule_heroic_skills').select('*').order('sort_order')
      ]);
      const err=cc.error||ss.error||hh.error;if(err)throw err;
      data={classes:cc.data||[],skills:ss.data||[],heroics:hh.data||[]};loaded=true;return data;
    })().finally(()=>loading=null);
    return loading;
  }

  function selectedClasses(){return new Set(rows('classesEditor').map(r=>norm(inputs(r)[0]?.value)).filter(Boolean))}
  function masteredClasses(){return new Set(rows('classesEditor').filter(r=>(Number(inputs(r)[1]?.value)||0)>=10).map(r=>norm(inputs(r)[0]?.value)).filter(Boolean))}
  function learnedSkills(){return new Set(rows('skillsEditor').map(r=>norm(inputs(r)[0]?.value)).filter(Boolean))}
  function characterLevel(){return Number(document.getElementById('level')?.value)||0}
  function allClassNames(){return data.classes.map(x=>x.name).filter(Boolean)}
  function allSkillNames(){return data.skills.map(x=>x.name).filter(Boolean)}

  function setRow(row,vals){
    const ins=inputs(row);
    vals.forEach((v,i)=>{if(!ins[i])return;ins[i].value=v??'';fire(ins[i]);fire(ins[i],'change')});
  }
  function addClass(x){
    document.getElementById('addClassBtn')?.click();
    requestAnimationFrame(()=>setRow(latest('classesEditor'),[x.name,1,(x.free_benefits||[]).join(' · ')]));
    close();
  }
  function addClassSkill(x){
    document.getElementById('addSkillBtn')?.click();
    requestAnimationFrame(()=>{
      const r=latest('skillsEditor');setRow(r,[x.name,1,x.rule_classes?.name||'Class Skill',x.effect||'']);
      const rank=inputs(r)[1];if(rank)rank.max=String(x.max_rank||1);
    });
    close();
  }
  function addHeroic(x){
    document.getElementById('addSkillBtn')?.click();
    requestAnimationFrame(()=>setRow(latest('skillsEditor'),[x.name,1,`Heroic Skill · ${SOURCES[x.source_id]?.label||x.source_id}`,`${x.requirements&&norm(x.requirements)!=='none'?`Requirements: ${x.requirements}. `:''}${x.effect||''}`]));
    close();
  }
  function addCustom(){
    document.getElementById(mode==='classes'?'addClassBtn':'addSkillBtn')?.click();close();
    setTimeout(()=>latest(mode==='classes'?'classesEditor':'skillsEditor')?.querySelector('input,textarea,select')?.focus(),40);
  }

  function requirementStatus(h){
    const raw=String(h.requirements||'').trim(),req=norm(raw);
    if(!req||req==='none'||req==='no requirement')return{met:true,manual:false,reason:'No prerequisite'};
    const mastered=masteredClasses(),learned=learnedSkills();
    const classMentions=allClassNames().filter(n=>req.includes(norm(n)));
    const skillMentions=allSkillNames().filter(n=>req.includes(norm(n)));

    const lvl=req.match(/character level\s+(\d+)\s+or higher/i);
    if(lvl&&characterLevel()<Number(lvl[1]))return{met:false,manual:false,reason:`Requires character level ${lvl[1]}+`};

    if(/master\s+two or more classes among/i.test(raw)){
      if(classMentions.filter(n=>mastered.has(norm(n))).length<2)return{met:false,manual:false,reason:raw};
    }else if(/master\s+one or more classes among/i.test(raw)){
      if(!classMentions.some(n=>mastered.has(norm(n))))return{met:false,manual:false,reason:raw};
    }else if(/\bmaster(?:ed)?\b/i.test(raw)&&classMentions.length){
      if(!classMentions.some(n=>mastered.has(norm(n))))return{met:false,manual:false,reason:raw};
    }

    const afterSemi=raw.includes(';')?raw.split(';').slice(1).join(';'):raw;
    const skillSegment=norm(afterSemi);
    const segmentSkills=skillMentions.filter(n=>skillSegment.includes(norm(n)));
    if(segmentSkills.length){
      const any=/and\/or|\bor\b/i.test(afterSemi);
      const okay=any?segmentSkills.some(n=>learned.has(norm(n))):segmentSkills.every(n=>learned.has(norm(n)));
      if(!okay)return{met:false,manual:false,reason:raw};
    }

    // A few Heroics depend on choices that are not represented as ordinary skill rows.
    if(/offensive spells|advanced\s+alchemy\s+from\s+gadget|advanced\s+magitech\s+from\s+gadget/i.test(raw)){
      return{met:false,manual:true,reason:raw};
    }
    return{met:true,manual:false,reason:raw};
  }

  function modal(){
    let m=document.getElementById('unifiedBuildPickerV3');if(m)return m;
    m=document.createElement('div');m.id='unifiedBuildPickerV3';m.className='ubp-modal hidden';
    m.innerHTML=`<div class="ubp-dialog ubp3-dialog"><div class="ubp-head"><div><p class="eyebrow">Fabula Ultima · Aestra Library</p><h2 id="ubp3Title">Add Class</h2></div><button class="ghost ubp3-close" type="button">Close</button></div><div id="ubp3Tabs" class="ubp-tabs"></div><input id="ubp3Search" class="ubp-search" type="search" placeholder="Search options…"><div id="ubp3Context" class="ubp-context hidden"></div><div id="ubp3Body" class="ubp-body"></div></div>`;
    document.body.appendChild(m);
    m.querySelector('.ubp3-close').onclick=close;
    m.onclick=e=>{if(e.target===m)close()};
    m.querySelector('#ubp3Search').oninput=render;
    return m;
  }
  function close(){document.getElementById('unifiedBuildPickerV3')?.classList.add('hidden');classFilter=''}

  function tabsForMode(){
    const out=[];
    for(const id of enabledSources()){
      if(id==='natural-fantasy-1.0'&&mode==='skills'){} // ordering handled below
    }
    if(enabled('core-1.02'))out.push(['core-1.02','Core']);
    if(enabled('high-fantasy-1.03'))out.push(['high-fantasy-1.03','High Fantasy']);
    if(mode==='skills')out.push(['heroic','Heroic']);
    if(enabled('natural-fantasy-1.0'))out.push(['natural-fantasy-1.0','Natural Fantasy']);
    if(enabled('techno-fantasy-1.0'))out.push(['techno-fantasy-1.0','Techno Fantasy']);
    out.push(['custom','Custom / Homebrew']);
    return out;
  }
  function ensureValidTab(){
    const tabs=tabsForMode();if(!tabs.some(([k])=>k===tab))tab=tabs[0]?.[0]||'custom';
  }
  function sourceItems(){
    if(mode==='classes'){
      const have=selectedClasses();
      return data.classes.filter(x=>x.source_id===tab&&!have.has(norm(x.name)));
    }
    const haveClasses=selectedClasses();
    return data.skills.filter(x=>x.rule_classes?.source_id===tab)
      .filter(x=>classFilter?norm(x.rule_classes?.name)===norm(classFilter):haveClasses.has(norm(x.rule_classes?.name)));
  }

  function renderHeroicCard(h){
    const state=requirementStatus(h),source=SOURCES[h.source_id]?.label||h.source_id;
    const card=document.createElement('article');card.className=`ubp-card ubp3-heroic ${state.met?'requirements-met':'requirements-locked'}`;
    const req=String(h.requirements||'None');
    card.innerHTML=`<div class="ubp-card-head"><div><strong>${esc(h.name)}</strong><small>${esc(source)} Heroic${h.page?` · p. ${esc(h.page)}`:''}</small></div><button class="primary" type="button" ${state.met?'':'disabled'}>${state.met?'Add skill':state.manual?'Check requirement':'Locked'}</button></div><div class="ubp3-requirement ${state.met?'met':state.manual?'manual':'locked'}"><span>${state.met?'✓':state.manual?'◇':'🔒'}</span><div><strong>${state.met?'Requirements met':state.manual?'Manual requirement check':'Requirement not met'}</strong><small>${esc(req)}</small></div></div><p>${esc(h.effect||'')}</p>`;
    if(state.met)card.querySelector('button').onclick=()=>addHeroic(h);
    return card;
  }

  function render(){
    const m=modal();ensureValidTab();
    const tabs=m.querySelector('#ubp3Tabs'),body=m.querySelector('#ubp3Body'),ctx=m.querySelector('#ubp3Context'),q=norm(m.querySelector('#ubp3Search').value);
    tabs.innerHTML=tabsForMode().map(([k,l])=>`<button type="button" data-ubp3-tab="${k}" class="${tab===k?'active':''}" aria-selected="${tab===k}">${l}</button>`).join('');
    tabs.querySelectorAll('[data-ubp3-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.ubp3Tab;m.querySelector('#ubp3Search').value='';render()});
    if(classFilter&&mode==='skills'&&tab!=='heroic'){ctx.textContent=`Showing all ${classFilter} class skills`;ctx.classList.remove('hidden')}else ctx.classList.add('hidden');

    if(tab==='custom'){
      body.innerHTML=`<article class="ubp-custom"><h3>${mode==='classes'?'Custom / Homebrew Class':'Custom / Homebrew Skill'}</h3><p>Create a blank entry and fill in your own details.</p><button type="button" class="primary ubp3-custom-add">+ Add ${mode==='classes'?'Custom Class':'Custom Skill'}</button></article>`;
      body.querySelector('.ubp3-custom-add').onclick=addCustom;return;
    }
    body.innerHTML='';
    if(tab==='heroic'){
      const learned=learnedSkills();
      const list=data.heroics.filter(h=>enabled(h.source_id)).filter(h=>!learned.has(norm(h.name)))
        .filter(h=>!q||norm(`${h.name} ${h.requirements||''} ${h.effect||''} ${SOURCES[h.source_id]?.label||''}`).includes(q))
        .sort((a,b)=>(SOURCES[a.source_id]?.order??9)-(SOURCES[b.source_id]?.order??9)||(a.sort_order||0)-(b.sort_order||0));
      list.forEach(h=>body.appendChild(renderHeroicCard(h)));
      if(!list.length)body.innerHTML='<p class="muted ubp-empty">No matching Heroic Skills.</p>';
      return;
    }

    const list=sourceItems().filter(x=>!q||norm(`${x.name} ${x.summary||''} ${x.effect||''} ${x.rule_classes?.name||''}`).includes(q));
    for(const x of list){
      const card=document.createElement('article');card.className='ubp-card';
      const source=SOURCES[tab]?.label||tab;
      const meta=mode==='classes'?`${source}${x.page?` · p. ${x.page}`:''}`:`${x.rule_classes?.name||'Class Skill'} · ${(x.max_rank||1)>1?`SL 1–${x.max_rank}`:'Single rank'} · ${source}${x.page?` · p. ${x.page}`:''}`;
      const detail=mode==='classes'?`${x.summary||''}${(x.free_benefits||[]).length?`\nFree benefits: ${(x.free_benefits||[]).join(' · ')}`:''}`:x.effect||'';
      card.innerHTML=`<div class="ubp-card-head"><div><strong>${esc(x.name)}</strong><small>${esc(meta)}</small></div><button class="primary" type="button">Add ${mode==='classes'?'class':'skill'}</button></div><p>${esc(detail).replace(/\n/g,'<br>')}</p>`;
      card.querySelector('button').onclick=()=>mode==='classes'?addClass(x):addClassSkill(x);body.appendChild(card);
    }
    if(!list.length){
      const msg=mode==='skills'&&classFilter?`No ${SOURCES[tab]?.label||''} skills found for ${classFilter}.`:mode==='skills'?'No matching class skills from your current Classes.':'No matching Classes.';
      body.innerHTML=`<p class="muted ubp-empty">${esc(msg)}</p>`;
    }
  }

  async function open(kind,filter=''){
    mode=kind;classFilter=filter||'';
    document.getElementById('unifiedBuildPicker')?.classList.add('hidden');
    const m=modal();m.classList.remove('hidden');m.querySelector('#ubp3Title').textContent=kind==='classes'?'Add Class':'Add Skill';m.querySelector('#ubp3Search').value='';m.querySelector('#ubp3Body').innerHTML='<p class="muted">Loading complete Aestra library…</p>';
    try{
      await load();
      if(classFilter){const cls=data.classes.find(x=>norm(x.name)===norm(classFilter));tab=cls?.source_id||'core-1.02'}
      else tab=enabled('core-1.02')?'core-1.02':enabledSources()[0]||'custom';
      render();
    }catch(e){m.querySelector('#ubp3Body').innerHTML=`<p>Could not load library: ${esc(e.message||e)}</p>`}
  }

  function installStyles(){
    if(document.getElementById('ubp3Styles'))return;const s=document.createElement('style');s.id='ubp3Styles';s.textContent=`
      #unifiedBuildPickerV3{z-index:2450}.ubp3-dialog{width:min(980px,100%)}
      #ubp3Tabs button.active{background:linear-gradient(180deg,rgba(118,180,219,.18),rgba(211,171,91,.12))!important;box-shadow:inset 0 0 0 1px rgba(216,177,96,.42),0 0 18px rgba(92,177,222,.08)!important;color:#f0d79c!important}
      .ubp3-requirement{display:flex;align-items:flex-start;gap:8px;margin:9px 0 0;padding:8px 9px;border-radius:9px;border:1px solid rgba(211,171,91,.12);background:rgba(0,0,0,.13)}.ubp3-requirement>span{width:19px;text-align:center}.ubp3-requirement>div{display:grid;gap:2px}.ubp3-requirement strong{font-size:.65rem}.ubp3-requirement small{font-size:.61rem;line-height:1.35;color:#9b9180}.ubp3-requirement.met{border-color:rgba(96,174,117,.2);background:rgba(71,126,83,.07)}.ubp3-requirement.met strong{color:#95c9a1}.ubp3-requirement.locked{border-color:rgba(184,103,82,.18);background:rgba(117,57,45,.06)}.ubp3-requirement.locked strong{color:#c8998c}.ubp3-requirement.manual{border-color:rgba(108,155,189,.2);background:rgba(62,99,126,.07)}.ubp3-requirement.manual strong{color:#9dc3dc}.ubp3-heroic.requirements-locked .ubp-card-head>button:disabled{opacity:.42!important;cursor:not-allowed!important}.ubp3-heroic.requirements-locked{opacity:.88}
      @media(max-width:640px){#ubp3Tabs{grid-template-columns:repeat(2,1fr)}.ubp3-dialog{margin:1vh auto}}
    `;document.head.appendChild(s);
  }

  // Final capture route: all real Build Class/Skill entry points go to v3. Synthetic startup/render clicks are ignored.
  document.addEventListener('click',e=>{
    if(!e.isTrusted)return;
    const learn=e.target.closest?.('[data-bh-add-skill]');
    if(learn){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open('skills',learn.dataset.bhAddSkill||'');return}
    const main=e.target.closest?.('.ubp-main-add');
    if(main){const section=document.querySelector('.build-tab.active')?.dataset.build;if(section==='classes'||section==='skills'){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(section);return}}
    const legacy=e.target.closest?.('[data-core-mode="classes"],[data-core-mode="skills"]');
    if(legacy){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();open(legacy.dataset.coreMode);}
  },true);

  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!document.getElementById('unifiedBuildPickerV3')?.classList.contains('hidden'))close()});
  document.addEventListener('aestra:source-settings-changed',()=>{
    loaded=false;
    const m=document.getElementById('unifiedBuildPickerV3');
    if(m&&!m.classList.contains('hidden'))open(mode,classFilter);
  });
  window.AESTRA_BUILD_PICKER={openClass:()=>open('classes'),openSkill:(name='')=>open('skills',name),reload:()=>load(true)};
  installStyles();
})();
