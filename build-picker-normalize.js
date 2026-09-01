// Normalize Build pickers: one Add Class / Add Skill button, all sources inside the unified popup.
(function(){
  const $=id=>document.getElementById(id);
  let queued=false;

  function activeSection(){return document.querySelector('.build-tab.active')?.dataset.build||''}
  function openUnified(kind,className=''){
    const api=window.AESTRA_BUILD_PICKER;
    if(api){
      if(kind==='classes'&&api.openClass){api.openClass();return true}
      if(kind==='skills'&&api.openSkill){api.openSkill(className);return true}
    }
    return false;
  }

  function normalize(){
    queued=false;
    const body=$('buildMenuBody');if(!body)return;
    const section=activeSection();
    if(section!=='classes'&&section!=='skills')return;
    const actions=body.querySelector('.build-actions');if(!actions)return;

    // Remove legacy/source-specific add controls from the visible Build surface,
    // while preserving the authoritative Remove control and unified Add control.
    [...actions.querySelectorAll('button')].forEach(btn=>{
      if(btn.id==='buildSectionRemoveBtn')return;
      if(btn.classList.contains('build-section-remove-final'))return;
      if(btn.classList.contains('class-remove-before-picker'))return;
      if(btn.classList.contains('build-remove-class'))return;
      if(btn.classList.contains('ubp-main-add'))return;
      btn.remove();
    });

    let add=actions.querySelector('.ubp-main-add');
    if(!add){
      add=document.createElement('button');
      add.type='button';
      add.className='primary ubp-main-add';
      actions.appendChild(add);
    }
    add.textContent=section==='classes'?'+ Add Class':'+ Add Skill';
    add.onclick=e=>{
      if(!e.isTrusted)return;
      e.preventDefault();e.stopPropagation();
      if(!openUnified(section))setTimeout(()=>openUnified(section),80);
    };

    if(section==='classes'){
      const remove=actions.querySelector('#buildSectionRemoveBtn,.build-section-remove-final,.class-remove-before-picker,.build-remove-class');
      if(remove&&remove.nextSibling!==add)actions.insertBefore(add,remove.nextSibling);
    }
  }

  function queue(){if(queued)return;queued=true;requestAnimationFrame(normalize)}

  document.addEventListener('click',e=>{
    if(!e.isTrusted)return;
    const learn=e.target.closest?.('[data-bh-add-skill]');
    if(!learn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const className=learn.dataset.bhAddSkill||'';
    if(!openUnified('skills',className))setTimeout(()=>openUnified('skills',className),80);
  },true);

  function boot(){
    const body=$('buildMenuBody');
    if(!body){setTimeout(boot,80);return}
    normalize();
    new MutationObserver(queue).observe(body,{childList:true,subtree:false});
    document.addEventListener('click',e=>{if(e.target.closest?.('.build-tab,.build-cycle'))setTimeout(queue,0)},true);
    const style=document.createElement('style');
    style.id='buildPickerNormalizeStyles';
    style.textContent=`#buildMenuBody .build-actions .ubp-main-add{display:inline-flex!important;visibility:visible!important;opacity:1!important}.build-actions .build-hf-visible,.build-actions .build-core-add,.build-actions .build-custom,.build-actions .build-heroic{display:none!important}@media(max-width:640px){#buildMenuBody .build-actions .ubp-main-add{width:100%!important;grid-column:1/-1}}`;
    document.head.appendChild(style);
  }
  boot();
})();
