// Character Creator UX fix — keep Continue clickable while draft fields update, and make launcher stand out.
(function(){
  const $=id=>document.getElementById(id);

  function styleLauncher(){
    const b=$('characterCreatorBtn');
    if(!b)return;
    b.classList.add('character-creator-callout');
  }

  function currentStep(){
    return document.querySelector('#ccSteps .cc-step.active b')?.textContent?.trim()||'';
  }

  function missingIdentity(){
    const required=['name','identity','theme','origin'];
    return required.filter(k=>!String(document.querySelector(`[data-draft="${k}"]`)?.value||'').trim());
  }

  function nudge(){
    const hint=$('ccHint'),step=currentStep();
    let message=hint?.textContent?.trim()||'';
    if(step==='Identity'){
      const missing=missingIdentity();
      if(missing.length)message=`Complete ${missing.map(x=>x[0].toUpperCase()+x.slice(1)).join(', ')} to continue.`;
    }
    if(!message) return;
    if(hint){hint.textContent=message;hint.classList.add('bad','cc-hint-nudge');setTimeout(()=>hint.classList.remove('cc-hint-nudge'),420)}
  }

  function unlockNext(){
    const next=$('ccNext');
    if(!next)return;
    // The creator originally disabled Continue only when the step rendered. Draft inputs
    // update afterwards, so the disabled state never cleared. Keep it clickable and let
    // the creator's own next() validation decide whether the step is ready.
    if(next.disabled)next.disabled=false;
    next.classList.add('cc-next-live');
  }

  function wireModal(){
    const modal=$('characterCreator');
    if(!modal||modal.dataset.ccFixWired==='1')return;
    modal.dataset.ccFixWired='1';
    modal.addEventListener('input',unlockNext,true);
    modal.addEventListener('change',unlockNext,true);
    modal.addEventListener('click',e=>{
      if(!e.target.closest('#ccNext'))return;
      const step=currentStep();
      if(step==='Identity'&&missingIdentity().length)nudge();
    },true);
    new MutationObserver(unlockNext).observe(modal,{subtree:true,childList:true,attributes:true,attributeFilter:['disabled']});
    unlockNext();
  }

  if(!$('characterCreationFixStyles')){
    const s=document.createElement('style');
    s.id='characterCreationFixStyles';
    s.textContent=`
      #characterCreatorBtn.character-creator-callout{
        position:relative!important;
        color:#f6e7bd!important;
        border-color:rgba(109,196,226,.58)!important;
        background:linear-gradient(135deg,rgba(47,116,150,.34),rgba(156,112,48,.24))!important;
        box-shadow:inset 0 0 0 1px rgba(224,185,100,.13),0 0 18px rgba(82,174,215,.11)!important;
        font-weight:750!important;
      }
      #characterCreatorBtn.character-creator-callout:before{
        content:'✦';margin-right:6px;color:#7fc9e8;text-shadow:0 0 9px rgba(113,202,239,.55)
      }
      #characterCreatorBtn.character-creator-callout:hover{
        border-color:rgba(224,184,96,.75)!important;
        background:linear-gradient(135deg,rgba(55,132,169,.42),rgba(177,127,55,.31))!important;
      }
      #ccNext.cc-next-live{opacity:1!important;cursor:pointer!important}
      #ccHint.cc-hint-nudge{animation:ccHintNudge .38s ease}
      @keyframes ccHintNudge{0%,100%{transform:translateX(0)}25%{transform:translateX(-5px)}55%{transform:translateX(5px)}80%{transform:translateX(-2px)}}
    `;
    document.head.appendChild(s);
  }

  function install(){styleLauncher();wireModal()}
  install();
  setTimeout(install,250);
  setTimeout(install,900);
  new MutationObserver(()=>requestAnimationFrame(install)).observe(document.body,{childList:true,subtree:true});
})();