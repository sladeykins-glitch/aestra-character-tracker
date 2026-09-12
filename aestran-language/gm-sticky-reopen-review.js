/* Aestran GM sticky Reopen & Review control v3 */
(function(){
  if(window.__aestraStickyReopenReviewV3)return;
  window.__aestraStickyReopenReviewV3=true;

  const style=document.createElement('style');
  style.textContent=`
    #aestraStickyReopenReview{
      position:fixed;
      right:22px;
      bottom:22px;
      z-index:9000;
      display:none;
      align-items:center;
      gap:10px;
      padding:9px;
      border:1px solid rgba(216,193,124,.24);
      border-radius:16px;
      background:rgba(10,14,20,.94);
      box-shadow:0 16px 42px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.025) inset;
      backdrop-filter:blur(12px);
      -webkit-backdrop-filter:blur(12px);
    }
    #aestraStickyReopenReview.show{display:flex}
    #aestraStickyReopenReview .sticky-copy{padding:0 5px 0 4px;max-width:190px}
    #aestraStickyReopenReview .sticky-kicker{font-size:9px;letter-spacing:.18em;text-transform:uppercase;color:#7f8996;margin-bottom:2px}
    #aestraStickyReopenReview .sticky-name{font-size:11px;color:#e7e3d7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #aestraStickyReopenReview button{white-space:nowrap;min-height:38px}
    @media(max-width:650px){
      #aestraStickyReopenReview{left:10px;right:10px;bottom:10px;justify-content:space-between;border-radius:14px;padding:8px 9px}
      #aestraStickyReopenReview .sticky-copy{max-width:45vw}
      #aestraStickyReopenReview button{flex:0 0 auto}
    }
  `;
  document.head.appendChild(style);

  const old=document.getElementById('aestraStickyReopenReview');
  if(old)old.remove();

  const dock=document.createElement('div');
  dock.id='aestraStickyReopenReview';
  dock.innerHTML=
    '<div class="sticky-copy">'+
      '<div class="sticky-kicker">Glyph review</div>'+
      '<div class="sticky-name" id="aestraStickyReviewName">Glyph design</div>'+
    '</div>'+
    '<button type="button" class="btn primary" id="aestraStickyReviewButton">Reopen &amp; Review</button>';
  document.body.appendChild(dock);

  const proxy=dock.querySelector('#aestraStickyReviewButton');
  const nameEl=dock.querySelector('#aestraStickyReviewName');
  let target=null;

  function text(el){
    return String(el?.innerText||el?.textContent||el?.value||'').replace(/\s+/g,' ').trim();
  }

  function descriptor(el){
    const parts=[
      text(el),
      el?.getAttribute?.('aria-label'),
      el?.getAttribute?.('title'),
      el?.getAttribute?.('name'),
      el?.id,
      el?.className
    ];
    try{
      for(const a of [...(el?.attributes||[])]){
        if(/review|reopen/i.test(a.name)||/review|reopen/i.test(a.value))parts.push(a.name,a.value);
      }
    }catch(_){}
    return parts.filter(Boolean).join(' ').toLowerCase();
  }

  function matchesReview(el){
    if(!el||dock.contains(el))return false;
    const d=descriptor(el);
    return d.includes('review')&&d.includes('reopen');
  }

  function clickable(el){
    if(!el)return null;
    if(el.matches?.('button,a,[role="button"],summary,input[type="button"],input[type="submit"],[onclick],.btn'))return el;
    return el.closest?.('button,a,[role="button"],summary,[onclick],.btn')||el;
  }

  function findTarget(){
    // This is the actual Glyph design revision control created by renderAuditDetail().
    const exact=document.getElementById('toggleRuneReviewed');
    if(exact&&!dock.contains(exact))return exact;

    // Fallbacks for older/newer builds where the id may change.
    const likely=[...document.querySelectorAll(
      'button,a,[role="button"],summary,input[type="button"],input[type="submit"],[onclick],[data-action],[data-review],[class*="review"],[id*="review"],[class*="reopen"],[id*="reopen"]'
    )];

    for(const el of likely){
      if(dock.contains(el))continue;
      const t=text(el).toLowerCase();
      if(t==='mark looks good'||t.includes('re-open review')||t.includes('reopen review'))return clickable(el);
      if(matchesReview(el))return clickable(el);
    }
    return null;
  }

  function glyphDesignActive(){
    const active=[...document.querySelectorAll('.active,[aria-current="page"],[aria-selected="true"]')];
    if(active.some(el=>/glyph\s*design/i.test(text(el))))return true;
    try{
      if(appState?.screen&&/glyph/i.test(String(appState.screen)))return true;
    }catch(_){}
    return [...document.querySelectorAll('nav button,aside button,.nav button')].some(el=>
      /glyph\s*design/i.test(text(el))&&el.classList.contains('active')
    );
  }

  function targetOnScreen(el){
    if(!el||!el.isConnected)return false;
    const r=el.getBoundingClientRect();
    return r.bottom>=0&&r.top<=window.innerHeight&&r.right>=0&&r.left<=window.innerWidth&&r.width>0&&r.height>0;
  }

  function nearbyName(el){
    if(!el)return 'Glyph design';
    const scopes=[el.closest?.('.card'),el.closest?.('section'),el.parentElement?.parentElement].filter(Boolean);
    for(const scope of scopes){
      for(const n of [...scope.querySelectorAll('h1,h2,h3,h4,b,strong,.title')]){
        const s=text(n);
        if(s&&s.length<=80&&!/reopen|review/i.test(s))return s;
      }
    }
    try{
      if(typeof lexSelected!=='undefined'&&lexSelected)return String(lexSelected);
      if(appState?.selectedLex)return String(appState.selectedLex);
      if(appState?.selectedAudit)return String(appState.selectedAudit);
    }catch(_){}
    try{
      if(appState?.selectedAudit)return String(appState.selectedAudit);
    }catch(_){}
    return 'Glyph design';
  }

  function refresh(){
    // The floating review control belongs only to the Glyph Design screen.
    // The real review button can remain mounted in the DOM after navigating away,
    // so page state must be checked before looking for that button.
    if(!glyphDesignActive()){
      target=null;
      dock.classList.remove('show');
      return;
    }

    target=findTarget();

    if(!target){
      dock.classList.remove('show');
      return;
    }

    proxy.disabled=!!target.disabled||target.getAttribute?.('aria-disabled')==='true';
    proxy.textContent=text(target)||'Reopen & Review';
    nameEl.textContent=nearbyName(target);

    // Whenever the real review control exists but has scrolled away, keep a floating copy available.
    dock.classList.toggle('show',!targetOnScreen(target));
  }

  proxy.onclick=()=>{
    if(!target||!target.isConnected)target=findTarget();
    if(!target||target.disabled)return;
    try{target.click();}catch(_){target.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}
    setTimeout(refresh,0);
  };

  let queued=false;
  function schedule(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(()=>{queued=false;refresh()});
  }

  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',schedule,{passive:true});
  document.addEventListener('click',()=>setTimeout(refresh,0),true);

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true});

  try{
    if(typeof renderAll==='function'){
      const prev=renderAll;
      renderAll=function(){
        const result=prev.apply(this,arguments);
        queueMicrotask(refresh);
        return result;
      };
    }
  }catch(_){}

  refresh();
})();