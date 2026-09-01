// Fabula Ultima progression sync: a Class Level equals the total Skill Levels invested in that Class.
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
      const f=fields(row),source=norm(f[2]?.value);
      if(!source||source.startsWith('heroic skill'))continue;
      const rank=Math.max(1,Number(f[1]?.value)||1);
      totals.set(source,(totals.get(source)||0)+rank);
    }
    return totals;
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
        // A newly-added Class begins at level 1. Once Class Skills exist, their
        // total SL becomes the single source of truth for that Class Level.
        const invested=totals.get(name)||0;
        const target=Math.max(1,Math.min(10,invested||1));
        const current=Math.max(1,Number(levelInput.value)||1);
        if(current===target)continue;
        levelInput.value=String(target);
        levelInput.dispatchEvent(new Event('input',{bubbles:true}));
        levelInput.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }finally{syncing=false}
  }

  function queue(delay=0){
    clearTimeout(queued);
    queued=setTimeout(()=>requestAnimationFrame(sync),delay);
  }

  function install(){
    const skills=document.getElementById('skillsEditor');
    if(!skills){setTimeout(install,100);return}
    skills.addEventListener('input',()=>queue(),true);
    skills.addEventListener('change',()=>queue(),true);
    new MutationObserver(()=>queue(15)).observe(skills,{childList:true,subtree:true});
    document.addEventListener('aestra:character-loaded',()=>queue(180));
    document.addEventListener('aestra:character-saved',()=>queue(30));
    // Repair older characters whose Class Levels were left behind by the
    // previous picker when their saved Skill rows finish rendering.
    queue(350);
    setTimeout(()=>queue(),900);
  }

  window.AESTRA_CLASS_LEVEL_SYNC={sync:()=>queue(),now:sync};
  install();
})();
