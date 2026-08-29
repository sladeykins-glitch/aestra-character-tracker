// Compact floating save control. Reuses the existing #saveBtn and #saveStatus so save logic is unchanged.
function installSaveOrb(){
  const btn=document.getElementById('saveBtn');
  const dock=btn?.closest('.save-dock');
  const status=document.getElementById('saveStatus');
  if(!btn||!dock||btn.dataset.saveOrb==='1')return;
  btn.dataset.saveOrb='1';
  dock.classList.add('save-dock-orb');
  btn.classList.add('save-orb-button');
  btn.setAttribute('aria-label','Save character');
  btn.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M11 7h35l7 7v43H11V7Zm7 6v15h27V13h-5v10H24V13h-6Zm3 25v13h22V38H21Z"/><path d="M27 13h10v8H27z"/></svg>';

  let toast=document.getElementById('saveToast');
  if(!toast){
    toast=document.createElement('div');
    toast.id='saveToast';
    toast.className='save-toast';
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.innerHTML='<span class="save-toast-check">✓</span><span class="save-toast-copy">Saved</span>';
    document.body.appendChild(toast);
  }
  let last=''; let timer=0;
  const show=(text,kind='ok')=>{
    toast.classList.remove('ok','error','show');
    toast.classList.add(kind);
    toast.querySelector('.save-toast-copy').textContent=text;
    toast.querySelector('.save-toast-check').textContent=kind==='error'?'!':'✓';
    void toast.offsetWidth;
    toast.classList.add('show');
    clearTimeout(timer); timer=setTimeout(()=>toast.classList.remove('show'),1500);
  };
  const sync=()=>{
    const t=(status?.textContent||'').trim();
    if(!t||t===last)return; last=t;
    btn.classList.toggle('save-is-dirty',/unsaved/i.test(t));
    btn.classList.toggle('save-is-saving',/saving/i.test(t));
    if(/^Saved(?: locally)?$/i.test(t)) show('Saved');
    else if(/^Save failed/i.test(t)) show('Save failed','error');
  };
  new MutationObserver(sync).observe(status,{childList:true,subtree:true,characterData:true});
  sync();
}
function installSaveOrbStyles(){
 if(document.getElementById('saveOrbStyles'))return;
 const s=document.createElement('style'); s.id='saveOrbStyles'; s.textContent=`
 .save-dock-orb{position:fixed!important;right:max(14px,env(safe-area-inset-right));bottom:max(14px,calc(env(safe-area-inset-bottom) + 10px));z-index:9990!important;width:auto!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;pointer-events:none!important}
 .save-dock-orb #saveStatus{display:none!important}
 .save-orb-button{pointer-events:auto!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;padding:0!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.16),rgba(169,123,54,.94) 42%,rgba(83,57,28,.98) 100%)!important;border:2px solid rgba(239,204,119,.82)!important;box-shadow:0 7px 22px rgba(0,0,0,.45),0 0 0 4px rgba(222,178,83,.08),inset 0 0 14px rgba(255,233,176,.08)!important;color:#fff0bd!important;transition:transform .16s ease,box-shadow .2s ease!important}
 .save-orb-button svg{width:26px;height:26px;fill:currentColor;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))}
 .save-orb-button:active{transform:scale(.93)}
 .save-orb-button.save-is-dirty{box-shadow:0 7px 22px rgba(0,0,0,.45),0 0 0 4px rgba(222,178,83,.12),0 0 18px rgba(222,178,83,.32)!important}
 .save-orb-button.save-is-saving svg{animation:savePulse .7s ease-in-out infinite alternate}
 .save-toast{position:fixed;z-index:10020;right:max(16px,env(safe-area-inset-right));bottom:max(78px,calc(env(safe-area-inset-bottom) + 76px));display:flex;align-items:center;gap:8px;min-width:112px;padding:9px 12px;border-radius:999px;background:rgba(13,16,19,.96);border:1px solid rgba(118,194,144,.6);box-shadow:0 8px 26px rgba(0,0,0,.42);color:#dff7e5;font-family:Georgia,serif;font-size:.82rem;font-weight:700;opacity:0;transform:translateY(8px) scale(.96);pointer-events:none;transition:opacity .18s ease,transform .18s ease}
 .save-toast.show{opacity:1;transform:none}.save-toast-check{width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:rgba(62,126,77,.38);border:1px solid rgba(118,194,144,.6)}.save-toast.error{color:#ffd8d2;border-color:rgba(220,101,86,.62)}.save-toast.error .save-toast-check{background:rgba(121,45,37,.4);border-color:rgba(220,101,86,.62)}
 @keyframes savePulse{from{opacity:.55;transform:scale(.9)}to{opacity:1;transform:scale(1.05)}}
 @media(max-width:520px){.save-orb-button{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important}.save-orb-button svg{width:24px;height:24px}.save-toast{bottom:max(72px,calc(env(safe-area-inset-bottom) + 70px))}}
 @media(prefers-reduced-motion:reduce){.save-orb-button,.save-toast,.save-orb-button.save-is-saving svg{transition:none!important;animation:none!important}}
 `; document.head.appendChild(s);
}
installSaveOrbStyles(); installSaveOrb();