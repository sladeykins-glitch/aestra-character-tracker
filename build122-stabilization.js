// Build 122 — stabilisation and player-first Hero Console polish.
// Loaded after the verified companion/session suite so it can improve presentation
// without replacing the underlying Fabula Ultima mechanics.
(function(){
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').trim().toLowerCase();
  const ATTRS=[['mig','MIG'],['dex','DEX'],['ins','INS'],['wlp','WLP']];
  const DERIVED=[['initiativeText','INIT'],['defenceText','DEF'],['magicDefenceText','MDEF'],['crisisText','CRISIS']];

  function installStyles(){
    if($('build122Styles'))return;
    const s=document.createElement('style');
    s.id='build122Styles';
    s.textContent=`
      #aestraHeroDashboard{position:relative;overflow:hidden}
      #aestraHeroDashboard:after{content:'PLAY';position:absolute;right:12px;top:10px;font-size:.46rem;letter-spacing:.24em;color:rgba(111,185,219,.55);pointer-events:none}
      .b122-attrs{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:7px}
      .b122-attr{position:relative;display:grid;justify-items:center;gap:1px;padding:8px 6px;border:1px solid rgba(211,171,91,.12);border-radius:11px;background:linear-gradient(145deg,rgba(6,10,15,.28),rgba(29,20,27,.28));transition:border-color .16s ease,background .16s ease,transform .16s ease}
      .b122-attr b{font-size:.48rem;letter-spacing:.14em;color:#9d8b67}
      .b122-attr strong{font:700 1.08rem/1 Georgia,serif;color:#e5d6b5}
      .b122-attr small{min-height:1.1em;font-size:.46rem;color:#746e65;text-align:center}
      .b122-attr.status-reduced{border-color:rgba(215,119,93,.38);background:linear-gradient(145deg,rgba(93,39,32,.16),rgba(31,19,24,.32));box-shadow:inset 0 0 18px rgba(176,72,56,.06)}
      .b122-attr.status-reduced b{color:#d89882}.b122-attr.status-reduced strong{color:#f1c1ad}.b122-attr.status-reduced small{color:#c98d7b}
      .b122-attr.flash{transform:scale(1.035)}
      .b122-derived{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:6px}
      .b122-derived span{display:flex;align-items:baseline;justify-content:space-between;gap:4px;padding:5px 7px;border-radius:8px;background:rgba(0,0,0,.12);border:1px solid rgba(104,175,207,.08)}
      .b122-derived b{font-size:.44rem;letter-spacing:.09em;color:#718b98}.b122-derived strong{font-size:.7rem;color:#c9dce3}
      #aestraHeroDashboard .asu-dash-status{min-height:19px}
      #aestraHeroDashboard .asu-dash-actions button,#grandMobileNav button{min-height:44px!important}
      #aestraHeroDashboard button:focus-visible,#grandMobileNav button:focus-visible,.asu-session button:focus-visible,.asu-modal button:focus-visible{outline:2px solid #86c9e8!important;outline-offset:2px!important}
      @media(max-width:430px){.b122-attrs{gap:4px}.b122-attr{padding:7px 3px}.b122-attr strong{font-size:1rem}.b122-derived{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(s);
  }

  function cleanRuntimeMarkup(){
    // The legacy HTML accidentally duplicated the player's insBase ID inside the GM editor.
    const gmInsCard=[...document.querySelectorAll('#gmEditor .attr-card')].find(card=>card.querySelector(':scope > span')?.textContent?.trim()==='INS');
    const gmBase=gmInsCard?.querySelector('label:first-of-type select');
    if(gmBase&&gmBase.id==='insBase')gmBase.id='gmInsBase';
    const gmClose=$('gmCloseEditor');if(gmClose&&!gmClose.getAttribute('aria-label'))gmClose.setAttribute('aria-label','Close GM character editor');
    document.querySelectorAll('.asu-x').forEach(b=>{if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','Close')});
    document.querySelectorAll('.asu-exit').forEach(b=>{if(!b.getAttribute('aria-label'))b.setAttribute('aria-label','Exit Adventure Mode')});
  }

  function installPlayLabels(){
    const sheetTab=document.querySelector('.tabs [data-view="sheet"]');
    if(sheetTab)sheetTab.textContent='Play';
    const nav=$('grandMobileNav');
    if(nav){
      nav.setAttribute('aria-label','Player sections');
      const play=nav.querySelector('[data-jump="sheet"]');
      if(play){const icon=play.querySelector('span')?.outerHTML||'<span>◇</span>';play.innerHTML=`${icon}Play`;}
    }
  }

  function ensureHeroAttributes(){
    const dash=$('aestraHeroDashboard');if(!dash)return null;
    let grid=$('b122HeroAttributes');if(grid)return grid;
    grid=document.createElement('div');grid.id='b122HeroAttributes';grid.className='b122-attrs';grid.setAttribute('aria-label','Current attributes');grid.setAttribute('aria-live','polite');
    grid.innerHTML=ATTRS.map(([key,label])=>`<span class="b122-attr" data-b122-attr="${key}"><b>${label}</b><strong>d6</strong><small>Base d6</small></span>`).join('');
    const resources=dash.querySelector('.asu-dash-resources');
    resources?.after(grid);
    return grid;
  }

  function ensureHeroDerived(){
    const attrs=ensureHeroAttributes();if(!attrs)return null;
    let grid=$('b122HeroDerived');if(grid)return grid;
    grid=document.createElement('div');grid.id='b122HeroDerived';grid.className='b122-derived';grid.setAttribute('aria-label','Combat values');grid.setAttribute('aria-live','polite');
    grid.innerHTML=DERIVED.map(([id,label])=>`<span data-b122-derived="${id}"><b>${label}</b><strong>0</strong></span>`).join('');
    attrs.after(grid);
    return grid;
  }

  function currentDie(key){return $(`${key}`)?.value||'d6'}
  function baseDie(key){return $(`${key}Base`)?.value||currentDie(key)}
  function syncHeroAttributes(flashKey=''){
    const grid=ensureHeroAttributes();if(!grid)return;
    for(const [key] of ATTRS){
      const card=grid.querySelector(`[data-b122-attr="${key}"]`);if(!card)continue;
      const current=currentDie(key),base=baseDie(key),steps=Number($(key)?.dataset?.statusSteps||0);
      const reduced=steps>0||current!==base;
      card.querySelector('strong').textContent=current;
      card.querySelector('small').textContent=reduced?`Base ${base} · ↓${Math.max(steps,1)} status`:`Base ${base}`;
      card.classList.toggle('status-reduced',reduced);
      if(key===flashKey){card.classList.remove('flash');void card.offsetWidth;card.classList.add('flash');setTimeout(()=>card.classList.remove('flash'),180)}
    }
    syncHeroDerived();
  }

  function syncHeroDerived(){
    const grid=ensureHeroDerived();if(!grid)return;
    for(const [id] of DERIVED){const out=grid.querySelector(`[data-b122-derived="${id}"] strong`);if(out)out.textContent=$(id)?.textContent?.trim()||'0'}
  }

  function statusName(btn){
    const fromData=String(btn?.dataset?.status||'').trim();if(fromData)return fromData;
    const strong=btn?.querySelector?.('strong')?.textContent?.trim();if(strong)return strong;
    return String(btn?.textContent||'').trim().split(/\s{2,}|\n/)[0].trim();
  }
  function syncHeroStatuses(){
    const host=$('asuDashStatuses');if(!host)return;
    const active=[...document.querySelectorAll('#statuses button.active,#statuses button[aria-pressed="true"]')].map(statusName).filter(Boolean);
    host.innerHTML=active.length?active.map(x=>`<span>${x.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}</span>`).join(''):'<small>No status effects</small>';
    host.setAttribute('aria-live','polite');
  }

  function migrateNameScopedLocalData(){
    const name=$('charName');if(!name)return;
    let previous=norm(name.value)||'character';
    const migrate=()=>{
      const next=norm(name.value)||'character';if(next===previous)return;
      for(const prefix of ['aestra-favs:','aestra-undo:']){
        try{const oldKey=prefix+previous,newKey=prefix+next,oldValue=localStorage.getItem(oldKey);if(oldValue!==null&&localStorage.getItem(newKey)===null)localStorage.setItem(newKey,oldValue)}catch{}
      }
      previous=next;
    };
    name.addEventListener('change',migrate);name.addEventListener('blur',migrate);
  }

  function wire(){
    for(const [key] of ATTRS){
      $(key)?.addEventListener('input',()=>syncHeroAttributes(key));
      $(key)?.addEventListener('change',()=>syncHeroAttributes(key));
      $(`${key}Base`)?.addEventListener('change',()=>requestAnimationFrame(()=>syncHeroAttributes(key)));
    }
    document.addEventListener('aestra:status-die',e=>{
      const key=e.target?.id;if(ATTRS.some(([k])=>k===key)){syncHeroAttributes(key);syncHeroStatuses()}
    });
    const statuses=$('statuses');
    if(statuses){
      statuses.addEventListener('click',()=>requestAnimationFrame(()=>{syncHeroAttributes();syncHeroStatuses()}));
      new MutationObserver(()=>requestAnimationFrame(()=>{syncHeroAttributes();syncHeroStatuses()})).observe(statuses,{subtree:true,childList:true,attributes:true,attributeFilter:['class','aria-pressed']});
    }
    for(const [id] of DERIVED){const el=$(id);if(el)new MutationObserver(()=>requestAnimationFrame(syncHeroDerived)).observe(el,{childList:true,subtree:true,characterData:true})}
    document.addEventListener('aestra:character-loaded',()=>setTimeout(()=>{syncHeroAttributes();syncHeroDerived();syncHeroStatuses();installPlayLabels();cleanRuntimeMarkup()},80));
  }

  function boot(){
    installStyles();
    cleanRuntimeMarkup();
    installPlayLabels();
    ensureHeroAttributes();
    ensureHeroDerived();
    syncHeroAttributes();
    syncHeroDerived();
    syncHeroStatuses();
    migrateNameScopedLocalData();
    wire();
    setTimeout(()=>{cleanRuntimeMarkup();installPlayLabels();syncHeroAttributes();syncHeroDerived();syncHeroStatuses()},350);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AESTRA_BUILD_122={syncHeroAttributes,syncHeroDerived,syncHeroStatuses};
})();
