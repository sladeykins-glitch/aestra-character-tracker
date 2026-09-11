/* GM -> real Player preview bridge v1 */
(function(){
  const PREVIEW_KEY='aestra-gm-player-preview-snapshot-v1';
  let overlay=null;

  const style=document.createElement('style');
  style.textContent=`
  .gm-real-player-preview{
    position:fixed;inset:0;z-index:12000;background:#080c12;
    opacity:0;visibility:hidden;transition:opacity .22s ease,visibility .22s ease;
  }
  .gm-real-player-preview.open{opacity:1;visibility:visible}
  .gm-real-player-preview iframe{
    position:absolute;inset:0;width:100%;height:100%;border:0;background:#080c12;
  }
  .gm-real-player-preview-bar{
    position:fixed;z-index:12002;left:50%;bottom:max(14px,env(safe-area-inset-bottom));
    transform:translateX(-50%);display:flex;align-items:center;gap:9px;
    padding:7px 8px 7px 12px;border:1px solid rgba(216,193,124,.20);
    border-radius:999px;background:rgba(7,11,17,.86);backdrop-filter:blur(15px);
    box-shadow:0 12px 32px rgba(0,0,0,.35),0 0 24px rgba(216,193,124,.05);
    color:#d8c17c;font:600 10px/1 system-ui,sans-serif;letter-spacing:.08em;
    text-transform:uppercase;
  }
  .gm-real-player-preview-bar button{
    border:1px solid rgba(216,193,124,.18);border-radius:999px;background:rgba(216,193,124,.08);
    color:#eee6d1;padding:8px 11px;font:700 10px/1 system-ui,sans-serif;cursor:pointer;
  }
  .gm-real-player-preview-bar button:active{transform:scale(.97)}
  @media(max-width:650px){
    .gm-real-player-preview-bar{bottom:max(9px,env(safe-area-inset-bottom));padding:6px 6px 6px 10px}
    .gm-real-player-preview-bar span{display:none}
  }`;
  document.head.appendChild(style);

  function safeSnapshot(){
    if(typeof buildPlayerSafeSnapshot!=='function')throw new Error('Player-safe snapshot builder unavailable');
    const snap=buildPlayerSafeSnapshot();
    if(!snap||snap.kind!=='aestra-player-snapshot')throw new Error('Could not build player preview');
    return snap;
  }

  function ensureOverlay(){
    if(overlay&&overlay.isConnected)return overlay;
    overlay=document.createElement('div');
    overlay.className='gm-real-player-preview';
    overlay.id='gmRealPlayerPreview';
    overlay.setAttribute('aria-hidden','true');
    overlay.innerHTML='<iframe id="gmRealPlayerFrame" title="Aestran Player preview"></iframe><div class="gm-real-player-preview-bar"><span>Actual Player site · GM preview</span><button type="button" id="gmCloseRealPlayerPreview">Back to GM</button></div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#gmCloseRealPlayerPreview').onclick=closePreview;
    return overlay;
  }

  function openPreview(){
    try{
      const snap=safeSnapshot();
      localStorage.setItem(PREVIEW_KEY,JSON.stringify(snap));
      const host=ensureOverlay();
      const frame=host.querySelector('#gmRealPlayerFrame');
      host.classList.add('open');host.setAttribute('aria-hidden','false');
      document.documentElement.style.overflow='hidden';
      document.body.style.overflow='hidden';
      frame.src='player.html?preview=gm&v=20260912-real-player-v1&t='+Date.now();
    }catch(err){
      console.error(err);
      alert('The Player preview could not be opened. '+(err?.message||err));
    }
  }

  function closePreview(){
    if(!overlay)return;
    overlay.classList.remove('open');overlay.setAttribute('aria-hidden','true');
    document.documentElement.style.overflow='';
    document.body.style.overflow='';
    const frame=overlay.querySelector('#gmRealPlayerFrame');
    setTimeout(()=>{if(frame&&!overlay.classList.contains('open'))frame.src='about:blank'},230);
  }

  function bindEntryPoints(){
    const role=document.getElementById('roleToggle');
    if(role){
      if(appState?.role==='gm')role.textContent='See Player';
      role.onclick=()=>{
        if(appState?.role==='gm')openPreview();
        else{appState.role='gm';go('translator')}
      };
    }
    const jump=document.getElementById('jumpPlayer');
    if(jump){jump.textContent='See Player';jump.onclick=openPreview}
  }

  document.addEventListener('click',ev=>{
    const target=ev.target?.closest?.('#simplePlayerPreview,#previewInscriptionPlayer');
    if(!target)return;
    ev.preventDefault();ev.stopPropagation();ev.stopImmediatePropagation();
    openPreview();
  },true);

  document.addEventListener('keydown',ev=>{
    if(ev.key==='Escape'&&overlay?.classList.contains('open'))closePreview();
  });

  try{
    const prev=navRender;
    navRender=function(){const r=prev.apply(this,arguments);queueMicrotask(bindEntryPoints);return r};
  }catch(_){}
  try{
    const prev=renderAll;
    renderAll=function(){const r=prev.apply(this,arguments);queueMicrotask(bindEntryPoints);return r};
  }catch(_){}

  window.openAestranPlayerPreview=openPreview;
  window.closeAestranPlayerPreview=closePreview;
  bindEntryPoints();
})();