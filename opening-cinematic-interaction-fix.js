// Build 131 hotfix: hidden opening cinematic must never block the tracker.
(function(){
  if(window.__AESTRA_OPENING_INTERACTION_FIX__)return;
  window.__AESTRA_OPENING_INTERACTION_FIX__=true;

  const style=document.createElement('style');
  style.id='aestraOpeningInteractionFixStyles';
  style.textContent=`
    #aestraOpeningCinematic.aestra-opening{pointer-events:none!important;visibility:hidden}
    #aestraOpeningCinematic.aestra-opening.show{pointer-events:auto!important;visibility:visible}
    #aestraOpeningCinematic.aestra-opening.closing{pointer-events:auto!important;visibility:visible}
  `;
  document.head.appendChild(style);

  let overlayObserver=null;

  function syncOverlay(overlay){
    if(!overlay)return;
    const active=overlay.classList.contains('show')||overlay.classList.contains('closing');
    overlay.inert=!active;
    if(active){
      overlay.removeAttribute('aria-hidden');
    }else{
      overlay.setAttribute('aria-hidden','true');
      if(overlay.contains(document.activeElement)){
        const replay=document.getElementById('aestraReplayOpening');
        if(replay&&!replay.classList.contains('hidden')) replay.focus({preventScroll:true});
        else document.activeElement?.blur?.();
      }
    }
  }

  function attach(){
    const overlay=document.getElementById('aestraOpeningCinematic');
    if(!overlay||overlay.dataset.interactionFix==='1')return false;
    overlay.dataset.interactionFix='1';
    syncOverlay(overlay);
    overlayObserver?.disconnect();
    overlayObserver=new MutationObserver(()=>syncOverlay(overlay));
    overlayObserver.observe(overlay,{attributes:true,attributeFilter:['class']});
    return true;
  }

  if(!attach()){
    const bodyObserver=new MutationObserver(()=>{
      if(attach())bodyObserver.disconnect();
    });
    bodyObserver.observe(document.body,{childList:true});
  }
})();
