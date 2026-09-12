/* Aestran GM sticky Reopen & Review control v1 */
(function(){
  if(window.__aestraStickyReopenReview)return;
  window.__aestraStickyReopenReview=true;

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
      background:rgba(10,14,20,.92);
      box-shadow:0 16px 42px rgba(0,0,0,.38),0 0 0 1px rgba(255,255,255,.025) inset;
      backdrop-filter:blur(12px);
      -webkit-backdrop-filter:blur(12px);
    }
    #aestraStickyReopenReview.show{display:flex}
    #aestraStickyReopenReview .sticky-copy{
      padding:0 5px 0 4px;
      max-width:180px;
    }
    #aestraStickyReopenReview .sticky-kicker{
      font-size:9px;
      letter-spacing:.18em;
      text-transform:uppercase;
      color:#7f8996;
      margin-bottom:2px;
    }
    #aestraStickyReopenReview .sticky-name{
      font-size:11px;
      color:#e7e3d7;
      overflow:hidden;
      text-overflow:ellipsis;
      white-space:nowrap;
    }
    #aestraStickyReopenReview button{
      white-space:nowrap;
      min-height:38px;
    }
    @media(max-width:650px){
      #aestraStickyReopenReview{
        left:10px;
        right:10px;
        bottom:10px;
        justify-content:space-between;
        border-radius:14px;
        padding:8px 9px;
      }
      #aestraStickyReopenReview .sticky-copy{max-width:45vw}
      #aestraStickyReopenReview button{flex:0 0 auto}
    }
  `;
  document.head.appendChild(style);

  const dock=document.createElement('div');
  dock.id='aestraStickyReopenReview';
  dock.innerHTML=
    '<div class="sticky-copy">'+
      '<div class="sticky-kicker">Glyph review</div>'+
      '<div class="sticky-name" id="aestraStickyReviewName">Current glyph</div>'+
    '</div>'+
    '<button type="button" class="btn primary" id="aestraStickyReviewButton">Reopen &amp; Review</button>';
  document.body.appendChild(dock);

  const proxy=dock.querySelector('#aestraStickyReviewButton');
  const nameEl=dock.querySelector('#aestraStickyReviewName');
  let target=null;

  function cleanText(el){return String(el?.textContent||'').replace(/\s+/g,' ').trim()}

  function isTargetButton(btn){
    if(!btn||btn===proxy||dock.contains(btn))return false;
    const text=cleanText(btn).toLowerCase();
    return /reopen/.test(text)&&/review/.test(text);
  }

  function findTarget(){
    const buttons=[...document.querySelectorAll('button,a.btn,[role="button"]')];
    const visible=buttons.filter(isTargetButton);
    if(!visible.length)return null;
    return visible.find(el=>{
      const r=el.getBoundingClientRect();
      return r.width>0&&r.height>0;
    })||visible[0];
  }

  function nearbyGlyphName(btn){
    if(!btn)return 'Current glyph';
    const scopes=[
      btn.closest('.card'),
      btn.closest('section'),
      btn.closest('[class*="review"]'),
      btn.parentElement?.parentElement
    ].filter(Boolean);
    for(const scope of scopes){
      const candidates=[...scope.querySelectorAll('h1,h2,h3,h4,b,strong,.title,.glyph-name')];
      for(const el of candidates){
        const text=cleanText(el);
        if(!text)continue;
        if(/reopen|review/i.test(text))continue;
        if(text.length<=80)return text;
      }
    }
    try{
      if(typeof lexSelected!=='undefined'&&lexSelected)return String(lexSelected);
      if(appState?.selectedLex)return String(appState.selectedLex);
      if(appState?.selectedAudit)return String(appState.selectedAudit);
    }catch(_){}
    return 'Current glyph';
  }

  function targetOnScreen(btn){
    if(!btn||!btn.isConnected)return false;
    const r=btn.getBoundingClientRect();
    return r.bottom>=0&&r.top<=window.innerHeight&&r.width>0&&r.height>0;
  }

  function refresh(){
    target=findTarget();
    if(!target){
      dock.classList.remove('show');
      return;
    }

    const disabled=!!target.disabled||target.getAttribute('aria-disabled')==='true';
    proxy.disabled=disabled;
    proxy.textContent=cleanText(target)||'Reopen & Review';
    nameEl.textContent=nearbyGlyphName(target);

    // Only float the action after the original has scrolled off-screen.
    dock.classList.toggle('show',!targetOnScreen(target));
  }

  proxy.addEventListener('click',()=>{
    if(!target||!target.isConnected)target=findTarget();
    if(!target||target.disabled)return;
    target.click();
    setTimeout(refresh,0);
  });

  let scheduled=false;
  function schedule(){
    if(scheduled)return;
    scheduled=true;
    requestAnimationFrame(()=>{scheduled=false;refresh()});
  }

  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('click',()=>setTimeout(refresh,0),true);

  const observer=new MutationObserver(schedule);
  observer.observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['class','disabled','aria-disabled']});

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