// The three freeform Trait inputs are retained in the underlying character data for compatibility,
// but are intentionally not shown on the player-facing sheet.
(function(){
  function hideTraits(){
    const editor=document.getElementById('traitsEditor');
    if(!editor)return;
    const inline=editor.closest('#inlineTraitsWrap');
    if(inline)inline.style.setProperty('display','none','important');
    const panel=editor.closest('article.panel');
    if(panel)panel.style.setProperty('display','none','important');
    editor.style.setProperty('display','none','important');
  }
  hideTraits();
  requestAnimationFrame(hideTraits);
  window.addEventListener('pageshow',hideTraits,{passive:true});
})();