// Core-rule choice tools: Tinkerer Gadgets and spell-learning skills.
(function(){
  if(window.__AESTRA_CORE_CHOICE_TOOLS__)return;
  window.__AESTRA_CORE_CHOICE_TOOLS__=true;

  const CONFIG=window.AESTRA_CONFIG||{};
  const norm=v=>String(v||'').trim().toLowerCase();
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=id=>[...(document.getElementById(id)?.querySelectorAll('.entry-row')||[])];
  const fields=row=>[...(row?.querySelectorAll('input,textarea,select')||[])];
  const vals=row=>fields(row).map(x=>String(x.value||'').trim());
  const latest=id=>rows(id).at(-1)||null;
  const fire=(el,type='input')=>el?.dispatchEvent(new Event(type,{bubbles:true}));
  const TIERS=['None','Basic','Advanced','Superior'];

  const MAGIC_SKILLS={
    'elemental magic':{label:'Elemental Magic',className:'Elementalist'},
    'entropic magic':{label:'Entropic Magic',className:'Entropist'},
    'spiritual magic':{label:'Spiritual Magic',className:'Spiritist'}
  };

  const GADGETS={
    alchemy:{
      label:'Alchemy',
      tiers:[
        {name:'Basic',title:'Basic Mixes',desc:'Unlock Basic alchemy mixes. They cost 3 IP and roll 2d20; assign one result to the target table and one to the effect table.'},
        {name:'Advanced',title:'Advanced Mixes',desc:'Unlock Advanced mixes. They cost 4 IP and roll 3d20, giving you more control over the final potion.'},
        {name:'Superior',title:'Superior Mixes',desc:'Unlock Superior mixes. They cost 5 IP and roll 4d20, giving the widest choice of target and effect results.'}
      ]
    },
    infusions:{
      label:'Infusions',
      tiers:[
        {name:'Basic',title:'Basic Infusions',desc:'After an attack hits, spend 2 IP to apply one Basic infusion to every target hit by that attack.'},
        {name:'Advanced',title:'Advanced Infusions',desc:'Add the Advanced infusion options to the effects you can apply after a successful attack.'},
        {name:'Superior',title:'Superior Infusions',desc:'Add the Superior infusion options, including the strongest special infusion effects.'}
      ]
    },
    magitech:{
      label:'Magitech',
      tiers:[
        {name:'Basic',title:'Magitech Override',desc:'Unlock Magitech Override, the Basic Magitech benefit for interacting with eligible constructs.'},
        {name:'Advanced',title:'Magicannon',desc:'Unlock the Magicannon benefit, allowing you to create the temporary magitech firearm through your Inventory action.'},
        {name:'Superior',title:'Magispheres',desc:'Unlock Magispheres and choose spell prototypes from the Elementalist, Entropist and Spiritist lists. These prototypes are not learned spells.'}
      ]
    }
  };

  let sb=null,spellCache=null,renderQueued=false;

  function skillRow(name){
    const n=norm(name);
    return rows('skillsEditor').find(r=>norm(vals(r)[0])===n)||null;
  }
  function skillRank(name){const r=skillRow(name);return r?Math.max(0,Number(vals(r)[1])||0):0}
  function characterLevel(){return Math.max(0,Number(document.getElementById('level')?.value)||0)}
  function tierName(n){return TIERS[Math.max(0,Math.min(3,Number(n)||0))]}
  function tierNumber(name){const i=TIERS.findIndex(x=>norm(x)===norm(name));return i<0?0:i}

  async function client(){
    if(sb)return sb;
    const m=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb=m.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
    return sb;
  }
  async function spells(){
    if(spellCache)return spellCache;
    const c=await client();
    const {data,error}=await c.from('rule_spells').select('*').in('class_name',['Elementalist','Entropist','Spiritist']).order('class_name').order('sort_order');
    if(error)throw error;
    spellCache=data||[];
    return spellCache;
  }

  function parseGadget(row){
    const effect=vals(row)[3]||'';
    const state={alchemy:0,infusions:0,magitech:0};
    for(const [key,g] of Object.entries(GADGETS)){
      const m=effect.match(new RegExp(g.label+'\\s+(None|Basic|Advanced|Superior)','i'));
      if(m)state[key]=tierNumber(m[1]);
    }
    const pm=effect.match(/Magisphere Prototypes:\s*([^\n]+)/i);
    const prototypes=pm&&norm(pm[1])!=='none'?pm[1].split(';').map(x=>x.trim()).filter(Boolean):[];
    return{state,prototypes};
  }
  function gadgetBaseEffect(effect){
    return String(effect||'')
      .replace(/\n*Gadget Unlocks:[^\n]*/ig,'')
      .replace(/\n*Magisphere Prototypes:[^\n]*/ig,'')
      .trim();
  }
  function writeGadget(row,state,prototypes=[]){
    const f=fields(row)[3];if(!f)return;
    const base=gadgetBaseEffect(f.value);
    const summary='Gadget Unlocks: '+Object.entries(GADGETS).map(([k,g])=>`${g.label} ${tierName(state[k])}`).join('; ')+'.';
    const parts=[base,summary];
    if((state.magitech||0)>=3)parts.push(`Magisphere Prototypes: ${prototypes.length?prototypes.join('; '):'None'}`);
    f.value=parts.filter(Boolean).join('\n\n');
    fire(f);fire(f,'change');
    document.dispatchEvent(new CustomEvent('aestra:gadget-choices-changed',{detail:{state:{...state},prototypes:[...prototypes]}}));
    queueRender();
  }
  function gadgetTotal(state){return Object.values(state).reduce((a,b)=>a+(Number(b)||0),0)}
  function gadgetStatus(){
    const row=skillRow('Gadgets');if(!row)return null;
    const rank=Math.max(1,skillRank('Gadgets')),parsed=parseGadget(row);
    return{row,rank,...parsed,total:gadgetTotal(parsed.state)};
  }

  function spellNamesFor(className,list){return new Set(list.filter(x=>norm(x.class_name)===norm(className)).map(x=>norm(x.name)))}
  function learnedSpellRows(className,list){
    const names=spellNamesFor(className,list);
    return rows('spellsEditor').filter(r=>names.has(norm(vals(r)[0])));
  }
  function spellSkillStatus(skillName,list){
    const cfg=MAGIC_SKILLS[norm(skillName)],row=skillRow(skillName);if(!cfg||!row)return null;
    const rank=Math.max(1,skillRank(skillName)),learned=learnedSpellRows(cfg.className,list);
    return{cfg,row,rank,learned,remaining:Math.max(0,rank-learned.length),over:Math.max(0,learned.length-rank)};
  }

  function choiceModal(){
    let m=document.getElementById('coreChoiceModal');if(m)return m;
    m=document.createElement('div');m.id='coreChoiceModal';m.className='ccr-modal hidden';
    m.innerHTML='<div class="ccr-dialog"><button class="ccr-close" type="button" aria-label="Close">×</button><div id="coreChoiceBody"></div></div>';
    document.body.appendChild(m);
    m.querySelector('.ccr-close').onclick=()=>m.classList.add('hidden');
    m.onclick=e=>{if(e.target===m)m.classList.add('hidden')};
    return m;
  }
  function toast(text){
    let t=document.getElementById('coreChoiceToast');if(!t){t=document.createElement('div');t.id='coreChoiceToast';t.className='ccr-toast';document.body.appendChild(t)}
    t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),1800);
  }

  async function openSpellChooser(skillName){
    const key=norm(skillName),cfg=MAGIC_SKILLS[key];if(!cfg)return;
    const list=await spells().catch(e=>{toast('Could not load the spell list.');console.warn(e);return null});if(!list)return;
    const status=spellSkillStatus(skillName,list);if(!status)return;
    const m=choiceModal(),body=document.getElementById('coreChoiceBody');
    const classSpells=list.filter(x=>norm(x.class_name)===norm(cfg.className));
    const learnedNames=new Set(status.learned.map(r=>norm(vals(r)[0])));
    body.innerHTML=`
      <p class="eyebrow">Core Rulebook 1.02 · ${esc(cfg.className)}</p>
      <h2>${esc(cfg.label)} Spell Choices</h2>
      <p class="ccr-help">Each Skill Level learns one ${esc(cfg.className)} spell. You currently have <strong>${status.learned.length}/${status.rank}</strong> learned from this list.</p>
      ${status.over?'<div class="ccr-warning">You currently know more spells from this list than your Skill Level allows. Remove spell entries until the total matches the Skill Level.</div>':''}
      <input class="ccr-search" id="ccrSpellSearch" type="search" placeholder="Search spells…">
      <div class="ccr-spell-list" id="ccrSpellList"></div>`;
    const listHost=body.querySelector('#ccrSpellList'),search=body.querySelector('#ccrSpellSearch');
    const draw=()=>{
      const q=norm(search.value),fresh=spellSkillStatus(skillName,list),canAdd=(fresh?.remaining||0)>0;
      listHost.innerHTML='';
      classSpells.filter(s=>!q||norm(`${s.name} ${s.effect} ${s.target} ${s.duration}`).includes(q)).forEach(sp=>{
        const learned=learnedNames.has(norm(sp.name));
        const card=document.createElement('article');card.className='ccr-spell-card';
        card.innerHTML=`<div><strong>${esc(sp.name)}</strong><small>${esc(String(sp.mp||''))} MP · ${esc(sp.target||'')} · ${esc(sp.duration||'')}${sp.offensive?' · Offensive':''}</small></div><p>${esc(sp.effect||'')}</p><button type="button" class="${learned?'ghost':'primary'}" ${learned||!canAdd?'disabled':''}>${learned?'Learned':canAdd?'Learn spell':'No choices remaining'}</button>`;
        if(!learned&&canAdd)card.querySelector('button').onclick=()=>addLearnedSpell(sp,cfg,list,skillName,m);
        listHost.appendChild(card);
      });
    };
    search.oninput=draw;draw();m.classList.remove('hidden');
  }

  function addLearnedSpell(sp,cfg,list,skillName,m){
    const fresh=spellSkillStatus(skillName,list);if(!fresh||fresh.remaining<=0)return;
    if(learnedSpellRows(cfg.className,list).some(r=>norm(vals(r)[0])===norm(sp.name)))return;
    document.getElementById('addSpellBtn')?.click();
    requestAnimationFrame(()=>{
      const r=latest('spellsEditor'),f=fields(r);if(!r||f.length<5)return;
      const data=[sp.name,sp.mp,sp.target,sp.duration,`${cfg.className}${sp.offensive?' · Offensive':''} · Learned via ${cfg.label}. ${sp.effect||''}`];
      data.forEach((v,i)=>{if(f[i]){f[i].value=v??'';fire(f[i]);fire(f[i],'change')}});
      toast(`${sp.name} learned.`);
      document.dispatchEvent(new CustomEvent('aestra:spell-choice-added',{detail:{skill:cfg.label,spell:sp.name}}));
      queueRender();
      setTimeout(()=>openSpellChooser(skillName),60);
    });
  }

  function magisphereLimit(){
    const lvl=characterLevel();
    return 3+(lvl>=20?2:0)+(lvl>=40?2:0);
  }
  async function openPrototypeChooser(){
    const g=gadgetStatus();if(!g||g.state.magitech<3)return;
    const list=await spells().catch(e=>{toast('Could not load the spell list.');console.warn(e);return null});if(!list)return;
    const max=magisphereLimit(),selected=new Set(g.prototypes.map(norm));
    const m=choiceModal(),body=document.getElementById('coreChoiceBody');
    body.innerHTML=`
      <p class="eyebrow">Tinkerer · Superior Magitech</p>
      <h2>Magisphere Prototypes</h2>
      <p class="ccr-help">Choose up to <strong>${max}</strong> spell prototypes. These are stored as Magisphere options and do <strong>not</strong> count as learned spells.</p>
      <div class="ccr-counter" id="ccrProtoCount"></div>
      <input class="ccr-search" id="ccrProtoSearch" type="search" placeholder="Search Elementalist, Entropist or Spiritist spells…">
      <div class="ccr-spell-list" id="ccrProtoList"></div>`;
    const host=body.querySelector('#ccrProtoList'),search=body.querySelector('#ccrProtoSearch'),count=body.querySelector('#ccrProtoCount');
    const draw=()=>{
      const q=norm(search.value),fresh=gadgetStatus(),chosen=fresh?.prototypes||[];
      const chosenSet=new Set(chosen.map(norm));count.textContent=`${chosen.length} / ${max} prototypes chosen`;
      host.innerHTML='';
      list.filter(sp=>!q||norm(`${sp.name} ${sp.class_name} ${sp.effect}`).includes(q)).forEach(sp=>{
        const on=chosenSet.has(norm(sp.name)),full=!on&&chosen.length>=max;
        const card=document.createElement('article');card.className='ccr-spell-card';
        card.innerHTML=`<div><strong>${esc(sp.name)}</strong><small>${esc(sp.class_name||'')} · ${esc(String(sp.mp||''))} MP · ${esc(sp.target||'')}</small></div><p>${esc(sp.effect||'')}</p><button type="button" class="${on?'secondary':'primary'}" ${full?'disabled':''}>${on?'Remove prototype':full?'Prototype limit reached':'Add prototype'}</button>`;
        card.querySelector('button').onclick=()=>{const now=gadgetStatus();if(!now)return;let p=[...now.prototypes];if(p.some(x=>norm(x)===norm(sp.name)))p=p.filter(x=>norm(x)!==norm(sp.name));else if(p.length<max)p.push(sp.name);writeGadget(now.row,now.state,p);draw()};
        host.appendChild(card);
      });
    };
    search.oninput=draw;draw();m.classList.remove('hidden');
  }

  function openGadgets(){
    const g=gadgetStatus();if(!g)return;
    const m=choiceModal(),body=document.getElementById('coreChoiceBody');
    const draw=()=>{
      const fresh=gadgetStatus();if(!fresh)return;
      const extra=fresh.total>fresh.rank;
      body.innerHTML=`
        <p class="eyebrow">Core Rulebook 1.02 · Tinkerer</p>
        <h2>Gadgets</h2>
        <p class="ccr-help">Gadgets SL ${fresh.rank} gives exactly ${fresh.rank} unlock${fresh.rank===1?'':'s'}. Start a new gadget type at Basic, or advance a type you already know from Basic → Advanced → Superior.</p>
        <div class="ccr-counter ${extra?'bad':''}">${fresh.total} / ${fresh.rank} gadget unlocks chosen${extra?' · reduce your selections to match the current Skill Level':''}</div>
        <div class="ccr-gadget-grid">
          ${Object.entries(GADGETS).map(([key,gad])=>{
            const cur=fresh.state[key]||0,next=Math.min(3,cur+1),canUp=fresh.total<fresh.rank&&cur<3;
            const current=cur?gad.tiers[cur-1]:null,nextInfo=cur<3?gad.tiers[next-1]:null;
            return `<article class="ccr-gadget-card"><div><strong>${gad.label}</strong><span class="ccr-tier">${tierName(cur)}</span></div><p>${esc(current?.desc||'Not unlocked yet.')}</p><div class="ccr-gadget-actions"><button type="button" class="primary" data-gadget-up="${key}" ${canUp?'':'disabled'}>${cur===0?'Unlock Basic':cur<3?'Advance to '+tierName(next):'Fully unlocked'}</button>${cur>0?`<button type="button" class="ghost" data-gadget-down="${key}">Step back</button>`:''}</div>${nextInfo&&canUp?`<small>Next: ${esc(nextInfo.title)} — ${esc(nextInfo.desc)}</small>`:''}</article>`;
          }).join('')}
        </div>
        ${fresh.state.magitech>=3?`<section class="ccr-magisphere"><div><strong>Superior Magitech · Magispheres</strong><small>${fresh.prototypes.length}/${magisphereLimit()} prototypes configured</small></div><button type="button" class="secondary" id="ccrConfigurePrototypes">Choose Prototypes</button></section>`:''}`;
      body.querySelectorAll('[data-gadget-up]').forEach(b=>b.onclick=()=>{const now=gadgetStatus();if(!now||now.total>=now.rank)return;const k=b.dataset.gadgetUp;if(now.state[k]>=3)return;now.state[k]++;writeGadget(now.row,now.state,now.prototypes);draw()});
      body.querySelectorAll('[data-gadget-down]').forEach(b=>b.onclick=()=>{const now=gadgetStatus();if(!now)return;const k=b.dataset.gadgetDown;if(now.state[k]<=0)return;now.state[k]--;const p=k==='magitech'&&now.state.magitech<3?[]:now.prototypes;writeGadget(now.row,now.state,p);draw()});
      body.querySelector('#ccrConfigurePrototypes')?.addEventListener('click',openPrototypeChooser);
    };
    draw();m.classList.remove('hidden');
  }

  function specialStatuses(list=[]){
    const out=[];
    const g=gadgetStatus();if(g)out.push({kind:'gadget',label:'Gadgets',meta:`SL ${g.rank} · ${g.total}/${g.rank} unlocks configured`,warn:g.total!==g.rank,action:'Configure Gadgets'});
    for(const [key,cfg] of Object.entries(MAGIC_SKILLS)){
      const row=skillRow(cfg.label);if(!row)continue;
      const s=spellSkillStatus(cfg.label,list);
      out.push({kind:'spell',skill:cfg.label,label:cfg.label,meta:`SL ${s.rank} · ${s.learned.length}/${s.rank} ${cfg.className} spells learned`,warn:s.remaining>0||s.over>0,action:s.remaining>0?`Choose ${s.remaining} spell${s.remaining===1?'':'s'}`:'Review Spells'});
    }
    return out;
  }

  async function renderBuildTools(){
    renderQueued=false;
    const body=document.getElementById('buildMenuBody');if(!body)return;
    const section=document.querySelector('.build-tab.active')?.dataset.build;
    let box=body.querySelector('.core-rule-choice-tools');
    if(!['skills','magic'].includes(section)){box?.remove();return}
    const list=await spells().catch(()=>[]);
    const statuses=specialStatuses(list);
    if(!statuses.length){box?.remove();return}
    const key=JSON.stringify(statuses.map(x=>[x.kind,x.skill,x.meta,x.warn]));
    if(!box){box=document.createElement('section');box.className='core-rule-choice-tools';body.querySelector('.build-actions')?.insertAdjacentElement('afterend',box)}
    if(!box||box.dataset.stateKey===key)return;
    box.dataset.stateKey=key;
    box.innerHTML=`<div class="crct-head"><div><p class="eyebrow">Rule Choices</p><strong>Selections granted by your Skills</strong></div></div><div class="crct-list">${statuses.map((x,i)=>`<button type="button" data-crct="${i}" class="${x.warn?'needs-choice':''}"><span>${x.kind==='gadget'?'◇':'✧'}</span><div><strong>${esc(x.label)}</strong><small>${esc(x.meta)}</small></div><em>${esc(x.action)} ›</em></button>`).join('')}</div>`;
    box.querySelectorAll('[data-crct]').forEach(b=>{const x=statuses[Number(b.dataset.crct)];b.onclick=()=>x.kind==='gadget'?openGadgets():openSpellChooser(x.skill)});
  }
  function queueRender(){if(renderQueued)return;renderQueued=true;requestAnimationFrame(()=>renderBuildTools())}

  function autoOpenForSkill(name){
    const n=norm(name);
    if(n==='gadgets'){setTimeout(openGadgets,80);return}
    if(MAGIC_SKILLS[n])setTimeout(()=>openSpellChooser(MAGIC_SKILLS[n].label),80);
  }

  function styles(){
    if(document.getElementById('coreRuleChoiceStyles'))return;
    const s=document.createElement('style');s.id='coreRuleChoiceStyles';s.textContent=`
      .core-rule-choice-tools{margin:0 0 10px;padding:11px;border:1px solid rgba(100,181,221,.24);border-radius:12px;background:linear-gradient(120deg,rgba(55,112,149,.09),rgba(118,82,147,.06))}.crct-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}.crct-head .eyebrow{margin:0}.crct-head>div{display:grid;gap:2px}.crct-list{display:grid;gap:6px}.crct-list>button{display:grid!important;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;width:100%;padding:9px 10px!important;text-align:left!important;border:1px solid rgba(124,183,217,.16)!important;border-radius:9px!important;background:rgba(0,0,0,.13)!important;color:inherit!important}.crct-list>button.needs-choice{border-color:rgba(222,173,86,.4)!important;background:rgba(126,84,33,.08)!important}.crct-list>button>span{color:#9fd6f1;text-align:center}.crct-list>button>div{display:grid;gap:1px}.crct-list strong{font-size:.78rem;color:#e6d7af}.crct-list small{font-size:.62rem;color:#9f9789}.crct-list em{font-style:normal;font-size:.6rem;color:#d4b36c;white-space:nowrap}
      .ccr-modal{position:fixed;inset:0;z-index:2550;display:grid;place-items:center;padding:14px;background:rgba(2,4,8,.9)}.ccr-modal.hidden{display:none!important}.ccr-dialog{position:relative;width:min(980px,97vw);max-height:93vh;overflow:auto;padding:24px;border:1px solid rgba(117,194,233,.4);border-radius:18px;background:radial-gradient(circle at 15% 0,rgba(75,157,202,.12),transparent 28%),linear-gradient(145deg,#10161e,#19141c);box-shadow:0 30px 90px rgba(0,0,0,.62)}.ccr-close{position:absolute!important;right:11px;top:11px;width:36px!important;height:36px!important;min-height:0!important;padding:0!important;border-radius:50%!important}.ccr-dialog h2{margin:.2rem 42px .5rem 0;color:#ead9ad}.ccr-help{font-size:.78rem;line-height:1.5;color:#aaa18f}.ccr-warning,.ccr-counter{margin:9px 0;padding:8px 10px;border:1px solid rgba(211,171,91,.2);border-radius:9px;background:rgba(125,88,37,.07);font-size:.7rem;color:#ccb98b}.ccr-counter.bad,.ccr-warning{border-color:rgba(193,99,81,.35);background:rgba(122,55,45,.08);color:#d3a090}.ccr-search{width:100%;margin:8px 0 10px}.ccr-spell-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.ccr-spell-card{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;padding:11px;border:1px solid rgba(126,190,224,.16);border-radius:11px;background:rgba(255,255,255,.02)}.ccr-spell-card>div{display:grid;gap:2px}.ccr-spell-card strong{color:#e4d4ad}.ccr-spell-card small{font-size:.62rem;color:#a99d88}.ccr-spell-card p{grid-column:1/-1;margin:4px 0;font-size:.69rem;line-height:1.42;color:#b9b0a1}.ccr-spell-card button{grid-column:2;grid-row:1;min-height:31px!important;padding:4px 8px!important;font-size:.63rem!important}.ccr-gadget-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.ccr-gadget-card{padding:12px;border:1px solid rgba(211,171,91,.18);border-radius:11px;background:rgba(255,255,255,.02)}.ccr-gadget-card>div:first-child{display:flex;align-items:center;justify-content:space-between;gap:8px}.ccr-gadget-card>div>strong{color:#e5d3a6}.ccr-tier{padding:3px 7px;border:1px solid rgba(111,183,220,.22);border-radius:999px;font-size:.56rem;color:#9dcae0}.ccr-gadget-card p{min-height:64px;font-size:.7rem;line-height:1.45;color:#b5ac9d}.ccr-gadget-card small{display:block;margin-top:8px;font-size:.62rem;line-height:1.4;color:#938a7c}.ccr-gadget-actions{display:flex;gap:6px;flex-wrap:wrap}.ccr-gadget-actions button{min-height:31px!important;padding:4px 8px!important;font-size:.63rem!important}.ccr-magisphere{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:10px;padding:11px;border:1px solid rgba(118,164,211,.22);border-radius:10px;background:rgba(67,94,125,.08)}.ccr-magisphere>div{display:grid;gap:2px}.ccr-magisphere small{font-size:.62rem;color:#99918a}.ccr-toast{position:fixed;left:50%;bottom:80px;z-index:2700;transform:translate(-50%,8px);opacity:0;pointer-events:none;padding:8px 12px;border:1px solid rgba(116,188,225,.32);border-radius:999px;background:#10151c;color:#e5d6b3;font-size:.7rem;transition:.15s}.ccr-toast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:720px){.ccr-spell-list,.ccr-gadget-grid{grid-template-columns:1fr}.ccr-dialog{padding:20px 14px}.ccr-gadget-card p{min-height:0}.crct-list>button{grid-template-columns:24px 1fr}.crct-list em{grid-column:2}.ccr-magisphere{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function boot(){
    const skillsEl=document.getElementById('skillsEditor'),spellsEl=document.getElementById('spellsEditor'),body=document.getElementById('buildMenuBody');
    if(!skillsEl||!spellsEl||!body){setTimeout(boot,100);return}
    styles();choiceModal();
    const q=()=>queueRender();
    [skillsEl,spellsEl].forEach(el=>{el.addEventListener('input',q);el.addEventListener('change',q);new MutationObserver(q).observe(el,{childList:true})});
    new MutationObserver(q).observe(body,{childList:true,subtree:false});
    document.getElementById('level')?.addEventListener('input',q);
    document.getElementById('level')?.addEventListener('change',q);
    document.addEventListener('aestra:skill-added',e=>{queueRender();autoOpenForSkill(e.detail?.name||'')});
    document.addEventListener('aestra:skill-rank-changed',e=>{queueRender();if(Number(e.detail?.rank)>Number(e.detail?.oldRank))autoOpenForSkill(e.detail?.name||'')});
    document.addEventListener('aestra:character-loaded',()=>{spellCache=null;setTimeout(q,120)});
    setTimeout(q,250);
  }
  boot();
})();
