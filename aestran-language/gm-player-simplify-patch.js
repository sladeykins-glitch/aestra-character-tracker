/* Aestran Player-side visual simplification v1 — GM preview */
(function(){
  const style=document.createElement('style');
  style.textContent=`
  body.player-minimal{
    --player-soft:rgba(255,255,255,.035);
    --player-line:rgba(210,220,232,.10);
  }
  body.player-minimal .topbar{
    padding-bottom:18px!important;
    margin-bottom:22px!important;
    border-bottom:1px solid var(--player-line)!important;
  }
  body.player-minimal .topbar h1{
    font-size:clamp(28px,4vw,38px)!important;
    letter-spacing:-.035em!important;
  }
  body.player-minimal #pageSub{
    max-width:580px;
    font-size:13px!important;
    line-height:1.45!important;
    opacity:.76;
  }
  body.player-minimal .topbar .pill.player-role-pill,
  body.player-minimal .topbar .pill.player-version-pill,
  body.player-minimal .player-minimal-hide{
    display:none!important;
  }
  body.player-minimal .player-minimal-live{
    border:0!important;
    background:transparent!important;
    padding:4px 0!important;
    font-size:10px!important;
    color:#b8aa7f!important;
  }

  body.player-minimal #playerArchive>.grid2,
  body.player-minimal #playerLexicon>.grid2,
  body.player-minimal #draw>.grid2{
    gap:24px!important;
  }
  body.player-minimal #playerArchive>.grid2>.card,
  body.player-minimal #playerLexicon>.grid2>.stack>.card{
    background:transparent!important;
    border:0!important;
    box-shadow:none!important;
    padding:0!important;
  }
  body.player-minimal #playerArchive .optional-rail,
  body.player-minimal #playerLexicon .optional-rail,
  body.player-minimal #draw .optional-rail{
    display:none!important;
  }
  body.player-minimal #playerArchive>.grid2,
  body.player-minimal #playerLexicon>.grid2{
    grid-template-columns:minmax(0,1fr) minmax(240px,320px)!important;
  }
  body.player-minimal .player-section-head{
    margin-bottom:14px!important;
    align-items:flex-end!important;
  }
  body.player-minimal .player-section-head h2{
    font-size:18px!important;
    letter-spacing:-.02em;
  }
  body.player-minimal .player-section-head>.pill{
    display:none!important;
  }
  body.player-minimal .player-section-head .muted{
    font-size:11px!important;
    max-width:520px;
    opacity:.72;
  }
  body.player-minimal .lexicon-helper{
    display:none!important;
  }

  body.player-minimal .player-stat-strip{
    display:flex!important;
    gap:16px!important;
    margin:0 0 15px!important;
    padding:0 0 12px!important;
    border-bottom:1px solid var(--player-line);
  }
  body.player-minimal .player-stat{
    border:0!important;
    background:transparent!important;
    border-radius:0!important;
    padding:0!important;
    font-size:10px!important;
    color:#778391!important;
  }
  body.player-minimal .player-stat b{
    font-size:12px!important;
    color:#e7e5dc!important;
  }

  body.player-minimal #playerLexicon .lexicon-layout-tools{
    background:transparent!important;
    border:0!important;
    padding:0!important;
    margin:0 0 10px!important;
  }
  body.player-minimal #playerLexicon .lexicon-layout-tools .btn{
    border-color:var(--player-line)!important;
    background:transparent!important;
    box-shadow:none!important;
  }
  body.player-minimal #playerLexicon .lexicon-layout-status{
    color:#717b87!important;
  }
  body.player-minimal #playerLexicon .player-bubble-stage{
    border:1px solid rgba(216,193,124,.10)!important;
    background:
      radial-gradient(circle at 50% 42%,rgba(58,68,94,.12),transparent 38%),
      #0b1017!important;
    box-shadow:none!important;
  }
  body.player-minimal #playerLexicon .glyph-bubble{
    background:rgba(14,20,28,.76)!important;
    border-color:rgba(216,193,124,.12)!important;
  }
  body.player-minimal #playerLexicon .glyph-bubble.active{
    border-color:rgba(216,193,124,.52)!important;
    box-shadow:0 0 0 1px rgba(216,193,124,.12),0 12px 34px rgba(0,0,0,.32)!important;
  }
  body.player-minimal #playerGlyphDetail{
    position:sticky;
    top:88px;
  }
  body.player-minimal #playerGlyphDetail .card,
  body.player-minimal #playerGlyphDetail>.card{
    border:1px solid var(--player-line)!important;
    background:rgba(17,23,31,.56)!important;
    box-shadow:none!important;
    border-radius:18px!important;
  }

  body.player-minimal #playerArchiveList .archive-card,
  body.player-minimal #playerArchiveList>.card{
    border-color:var(--player-line)!important;
    background:rgba(16,22,29,.52)!important;
    box-shadow:none!important;
  }
  body.player-minimal #playerDiscoveries .discovery-stage{
    border:0!important;
    background:transparent!important;
    box-shadow:none!important;
    padding-left:0!important;
    padding-right:0!important;
  }
  body.player-minimal #playerDiscoveries .discovery-count{
    border:0!important;
    background:transparent!important;
    padding-right:0!important;
    color:#78828d!important;
  }

  body.player-minimal #draw>.grid2{
    grid-template-columns:minmax(0,1fr)!important;
    max-width:860px;
    margin:0 auto;
  }
  body.player-minimal #draw>.grid2>aside{
    display:none!important;
  }
  body.player-minimal #draw>.grid2>.stack>.card{
    border:0!important;
    background:transparent!important;
    box-shadow:none!important;
    padding-left:0!important;
    padding-right:0!important;
  }
  body.player-minimal #draw .draw-mode-strip{
    border-color:var(--player-line)!important;
    background:transparent!important;
  }
  body.player-minimal #draw .draw-quick-tips{
    display:none!important;
  }

  @media(max-width:980px){
    body.player-minimal #playerArchive>.grid2,
    body.player-minimal #playerLexicon>.grid2{
      grid-template-columns:1fr!important;
    }
    body.player-minimal #playerGlyphDetail{
      position:static;
    }
  }
  @media(max-width:650px){
    body.player-minimal .main{
      padding-left:14px!important;
      padding-right:14px!important;
    }
    body.player-minimal .topbar{
      margin-bottom:15px!important;
      padding-bottom:13px!important;
    }
    body.player-minimal .topbar h1{
      font-size:30px!important;
    }
    body.player-minimal #pageSub{
      font-size:12px!important;
      margin-top:4px!important;
    }
    body.player-minimal .topbar>.row{
      gap:6px!important;
      margin-top:8px;
    }
    body.player-minimal .player-section-head .muted{
      display:none!important;
    }
    body.player-minimal .player-stat-strip{
      gap:12px!important;
      overflow:auto;
      scrollbar-width:none;
    }
    body.player-minimal #playerLexicon .lexicon-layout-tools{
      margin-bottom:8px!important;
    }
    body.player-minimal #playerLexicon .player-bubble-stage{
      border-radius:15px!important;
    }
    body.player-minimal #playerGlyphDetail{
      margin-top:8px!important;
    }
    body.player-minimal #playerGlyphDetail .card,
    body.player-minimal #playerGlyphDetail>.card{
      border-radius:15px!important;
    }
  }`;
  document.head.appendChild(style);

  const fxStyle=document.createElement('style');
  fxStyle.textContent=`
  body.player-minimal{
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }
  body.player-minimal:before{
    content:'';
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:-1;
    background:
      radial-gradient(circle at 18% 8%,rgba(216,193,124,.035),transparent 26%),
      radial-gradient(circle at 84% 24%,rgba(83,101,145,.045),transparent 31%);
  }
  body.player-minimal .muted{
    color:#909aa6!important;
    line-height:1.58;
  }
  body.player-minimal p,
  body.player-minimal .reading,
  body.player-minimal .archive-reading,
  body.player-minimal .discovery-copy{
    line-height:1.65!important;
  }
  body.player-minimal .screen.active{
    animation:aestraPlayerPageIn .28s cubic-bezier(.2,.72,.25,1) both;
  }
  body.player-minimal .topbar h1{
    animation:aestraPlayerTitleIn .34s cubic-bezier(.2,.72,.25,1) both;
  }
  body.player-minimal .btn,
  body.player-minimal .nav button{
    transition:background-color .18s ease,border-color .18s ease,color .18s ease,transform .18s ease,box-shadow .18s ease!important;
  }
  body.player-minimal .btn:active,
  body.player-minimal .nav button:active{
    transform:translateY(1px) scale(.985);
  }
  body.player-minimal #playerLexicon .glyph-bubble{
    transition:border-color .2s ease,box-shadow .22s ease,filter .2s ease!important;
  }
  body.player-minimal #playerLexicon .glyph-bubble:hover{
    filter:brightness(1.07);
  }
  body.player-minimal #playerLexicon .glyph-bubble.active{
    animation:aestraGlyphFocus .38s cubic-bezier(.2,.8,.2,1) both;
  }
  body.player-minimal #playerGlyphDetail>*{
    animation:aestraDetailIn .24s ease-out both;
  }
  body.player-minimal #playerArchiveList>*{
    animation:aestraListIn .3s ease-out both;
  }
  body.player-minimal #playerArchiveList>*:nth-child(2){animation-delay:.035s}
  body.player-minimal #playerArchiveList>*:nth-child(3){animation-delay:.07s}
  body.player-minimal #playerArchiveList>*:nth-child(4){animation-delay:.105s}
  body.player-minimal #playerDiscoveryTimeline>*{
    animation:aestraListIn .3s ease-out both;
  }
  body.player-minimal #playerDiscoveryTimeline>*:nth-child(2){animation-delay:.04s}
  body.player-minimal #playerDiscoveryTimeline>*:nth-child(3){animation-delay:.08s}
  body.player-minimal .discovery-reveal-rune{
    filter:drop-shadow(0 0 14px rgba(216,193,124,.18));
  }
  body.player-minimal input,
  body.player-minimal textarea,
  body.player-minimal select{
    line-height:1.5!important;
  }
  body.player-minimal .meaning,
  body.player-minimal .pill{
    letter-spacing:.01em;
  }
  @keyframes aestraPlayerPageIn{
    from{opacity:0;transform:translateY(7px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraPlayerTitleIn{
    from{opacity:.35;transform:translateY(4px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraGlyphFocus{
    0%{filter:brightness(1);box-shadow:0 0 0 rgba(216,193,124,0)}
    55%{filter:brightness(1.11);box-shadow:0 0 24px rgba(216,193,124,.11)}
    100%{filter:brightness(1.04)}
  }
  @keyframes aestraDetailIn{
    from{opacity:0;transform:translateY(5px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraListIn{
    from{opacity:0;transform:translateY(7px)}
    to{opacity:1;transform:none}
  }
  @media(max-width:650px){
    body.player-minimal .muted{line-height:1.5}
    body.player-minimal .btn{min-height:38px}
    body.player-minimal #playerLexicon .lexicon-layout-status{display:none!important}
    body.player-minimal #playerGlyphDetail{font-size:14px}
  }
  @media(prefers-reduced-motion:reduce){
    body.player-minimal *,
    body.player-minimal *:before,
    body.player-minimal *:after{
      animation-duration:.001ms!important;
      animation-iteration-count:1!important;
      transition-duration:.001ms!important;
      scroll-behavior:auto!important;
    }
  }`;
  document.head.appendChild(fxStyle);

  const pageCopy={
    playerArchive:['Archive','Recovered inscriptions and your notes.'],
    playerDiscoveries:['Discoveries','What the party has learned.'],
    playerLexicon:['Lexicon','What the party currently understands.'],
    draw:['Draw glyph','Draw a sign and compare it with the known lexicon.']
  };

  function cleanHeader(){
    const player=appState&&appState.role==='player';
    document.body.classList.toggle('player-minimal',!!player);
    if(!player)return;

    const copy=pageCopy[appState.screen];
    const title=document.getElementById('pageTitle');
    const sub=document.getElementById('pageSub');
    if(copy){
      if(title)title.textContent=copy[0];
      if(sub)sub.textContent=copy[1];
    }

    const top=document.querySelector('.topbar');
    if(top){
      top.querySelectorAll('button').forEach(btn=>{
        const t=(btn.textContent||'').trim().toLowerCase();
        if(t.includes('advanced tools'))btn.classList.add('player-minimal-hide');
      });
      top.querySelectorAll('.pill').forEach(p=>{
        const t=(p.textContent||'').trim();
        if(/^player$/i.test(t))p.classList.add('player-role-pill');
        else if(/^v?\d+\.\d+/i.test(t))p.classList.add('player-version-pill');
        else if(/live sync/i.test(t))p.classList.add('player-minimal-live');
      });
    }

    const archiveRail=document.querySelector('#playerArchive .optional-rail');
    const lexRail=document.querySelector('#playerLexicon .optional-rail');
    if(archiveRail)archiveRail.setAttribute('aria-hidden','true');
    if(lexRail)lexRail.setAttribute('aria-hidden','true');
  }

  try{
    if(typeof navRender==='function'){
      const prev=navRender;
      navRender=function(){const r=prev.apply(this,arguments);queueMicrotask(cleanHeader);return r};
    }
  }catch(_){}
  try{
    if(typeof renderAll==='function'){
      const prev=renderAll;
      renderAll=function(){const r=prev.apply(this,arguments);queueMicrotask(cleanHeader);return r};
    }
  }catch(_){}

  document.addEventListener('click',()=>setTimeout(cleanHeader,0),true);
  cleanHeader();
})();