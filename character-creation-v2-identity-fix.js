// Character Creation v2 identity-step validation hotfix.
// The creator updates its internal draft on input, but the Continue button was only
// revalidated during a full render. Keep the button/hint in sync while typing.
(function(){
  if(window.__AESTRA_CC2_IDENTITY_FIX__)return;
  window.__AESTRA_CC2_IDENTITY_FIX__=true;

  function syncIdentityValidation(){
    const modal=document.getElementById('characterCreatorV2');
    if(!modal||modal.classList.contains('hidden'))return;
    const active=modal.querySelector('.cc2-step.active b');
    if(active?.textContent?.trim()!=='Identity')return;

    const value=key=>modal.querySelector(`#cc2Body [data-draft="${key}"]`)?.value?.trim()||'';
    const valid=!!(value('name')&&value('identity')&&value('theme')&&value('origin'));
    const next=document.getElementById('cc2Next');
    const hint=document.getElementById('cc2Hint');

    if(next)next.disabled=!valid;
    if(hint){
      hint.textContent=valid?'':'Enter a name, Identity, Theme and Origin.';
      hint.classList.toggle('bad',!valid);
    }
  }

  const onEdit=e=>{
    if(!e.target?.closest?.('#characterCreatorV2 [data-draft]'))return;
    queueMicrotask(syncIdentityValidation);
  };
  document.addEventListener('input',onEdit,true);
  document.addEventListener('change',onEdit,true);
})();
