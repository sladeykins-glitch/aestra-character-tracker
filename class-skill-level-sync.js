// Fabula Ultima progression sync: Skill Levels -> Class Levels -> Character Level.
(function(){
  if(window.__AESTRA_CLASS_SKILL_LEVEL_SYNC__)return;
  window.__AESTRA_CLASS_SKILL_LEVEL_SYNC__=true;

  const norm=v=>String(v||'').trim().toLowerCase();
  const rows=id=>[...(document.getElementById(id)?.querySelectorAll('.entry-row')||[])];
  const fields=row=>[...(row?.querySelectorAll('input,textarea,select')||[])];
  let queued=0,syncing=false;

  function skillTotals(){
    const totals=new Map();
    for(const row of rows('skillsEditor')){
      const f=fields(row),name=String(f[0]?.value||'').trim(),source=norm(f[2]?.value);
      if(!name||!source||source.startsWith('heroic skill'))continue;
      const rank=Math.max(0,Number(f[1]?.value)||0);
      if(!rank)continue;
      totals.set(source,(totals.get(source)||0)+rank);
    }
    return totals;
  }

  function syncCharacterLevel(classes){
    if(!classes.length)return;
    const level=document.getElementById('level');if(!level)return;
    const total=Math.max(1,Math.min(50,classes.reduce((sum,row)=>{
      const input=fields(row)[1];return sum+(Math.max(1,Number(input?.value)||1));
    },0)));
    const current=Math.max(1,Number(level.value)||1);
    if(current===total)return;
    level.value=String(total);
    level.dispatchEvent(new Event('input',{bubbles:true}));
    level.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function sync(){
    queued=0;
    if(syncing)return;
    const classes=rows('classesEditor');
    if(!classes.length)return;
    syncing=true;
    try{
      const totals=skillTotals();
      for(const row of classes){
        const f=fields(row),name=norm(f[0]?.value),levelInput=f[1];
        if(!name||!levelInput)continue;
        // A newly-added Class may briefly exist before its first Skill is chosen.
        // Once Skill Levels exist, their total is authoritative for Class Level.
        const invested=totals.get(name)||0;
        const target=Math.max(1,Math.min(10,invested||1));
        const current=Math.max(1,Number(levelInput.value)||1);
        if(current===target)continue;
        levelInput.value=String(target);
        levelInput.dispatchEvent(new Event('input',{bubbles:true}));
        levelInput.dispatchEvent(new Event('change',{bubbles:true}));
      }
      // Character Level is always the sum of the current Class Levels.
      syncCharacterLevel(classes);
      document.dispatchEvent(new CustomEvent('aestra:progression-synced',{detail:{level:Number(document.getElementById('level')?.value)||1}}));
    }finally{syncing=false}
  }

  function queue(delay=0){
    clearTimeout(queued);
    queued=setTimeout(()=>requestAnimationFrame(sync),delay);
  }

  function install(){
    const skills=document.getElementById('skillsEditor'),classes=document.getElementById('classesEditor');
    if(!skills||!classes){setTimeout(install,100);return}
    for(const root of [skills,classes]){
      root.addEventListener('input',()=>queue(),true);
      root.addEventListener('change',()=>queue(),true);
      new MutationObserver(()=>queue(15)).observe(root,{childList:true,subtree:true});
    }
    document.addEventListener('aestra:character-loaded',()=>queue(180));
    document.addEventListener('aestra:character-saved',()=>queue(30));
    // Repair older characters after their saved Class/Skill rows finish rendering.
    queue(350);
    setTimeout(()=>queue(),900);
  }

  window.AESTRA_CLASS_LEVEL_SYNC={sync:()=>queue(),now:sync};
  install();
})();
