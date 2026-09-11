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