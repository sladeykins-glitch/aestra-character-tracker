// Guard the authoritative Build library against startup/source-sync opens.
// The library must only appear because the player deliberately opened it.
(function(){
  if(window.__AESTRA_BUILD_LIBRARY_STARTUP_GUARD__)return;
  window.__AESTRA_BUILD_LIBRARY_STARTUP_GUARD__=true;

  let lastTrustedIntent=0;
  const modal=()=>document.getElementById('unifiedBuildPickerV3');
  const isVisible=()=>{const m=modal();return !!m&&!m.classList.contains('hidden')};
  const closeUnexpected=()=>{
    const m=modal();
    if(!m||m.classList.contains('hidden'))return;
    // A trusted Build-library interaction in the last moment owns the open state.
    if(performance.now()-lastTrustedIntent<1200)return;
    m.classList.add('hidden');
  };

  const openerFor=e=>e.target?.closest?.('[data-bh-add-skill],.ubp-main-add,[data-core-mode="classes"],[data-core-mode="skills"]');

  // Programmatic .click() calls from boot/render code must never open the player library.
  // Window capture runs before the library's document-capture listener.
  window.addEventListener('click',e=>{
    const opener=openerFor(e);if(!opener)return;
    if(e.isTrusted){lastTrustedIntent=performance.now();return}
    e.stopPropagation();
  },true);

  // Source settings load/reload during startup. The v3 picker previously treated a
  // missing modal as "not hidden" and opened it. Preserve a genuinely open picker,
  // but close any modal that was created only because of a source-settings refresh.
  document.addEventListener('aestra:source-settings-changed',()=>{
    const wasVisible=isVisible();
    requestAnimationFrame(()=>{
      if(!wasVisible)closeUnexpected();
    });
    setTimeout(()=>{if(!wasVisible)closeUnexpected()},60);
  },true);

  // If the first source-settings response raced ahead of this guard, clean up the
  // unwanted modal immediately after this module loads.
  requestAnimationFrame(closeUnexpected);
  setTimeout(closeUnexpected,80);
  setTimeout(closeUnexpected,350);
})();
