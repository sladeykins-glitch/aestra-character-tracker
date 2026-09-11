/* Aestran standalone Player visual simplification v1 */
(function(){
  const style=document.createElement('style');
  style.textContent=`
  :root{--simple-line:rgba(210,220,232,.10);--simple-surface:rgba(255,255,255,.028)}
  body{background:#0a0e14!important}
  .app{display:block!important;min-height:100vh}
  .sidebar{
    position:sticky!important;
    top:0!important;
    z-index:30!important;
    height:auto!important;
    width:auto!important;
    display:flex!important;
    align-items:center!important;
    gap:20px!important;
    padding:10px max(18px,calc((100vw - 1120px)/2))!important;
    border-right:0!important;
    border-bottom:1px solid var(--simple-line)!important;
    background:rgba(10,14,20,.94)!important;
    backdrop-filter:blur(16px)!important;
  }
  .brand{font-size:13px!important;white-space:nowrap;margin:0!important}
  .sub,.sidecard{display:none!important}
  .nav{
    display:flex!important;
    gap:3px!important;
    margin:0!important;
    overflow:auto!important;
    scrollbar-width:none;
    flex:1;
  }
  .nav button{
    white-space:nowrap!important;
    border:0!important;
    border-radius:9px!important;
    padding:8px 11px!important;
    font-size:11px!important;
    background:transparent!important;
    color:#8e99a6!important;
  }
  .nav button.active{
    background:rgba(216,193,124,.08)!important;
    color:#eee6d1!important;
    box-shadow:inset 0 0 0 1px rgba(216,193,124,.13)!important;
  }
  .main{
    width:min(1120px,100%)!important;
    margin:0 auto!important;
    padding:30px 20px 60px!important;
  }
  .topbar{
    padding:0 0 22px!important;
    margin:0 0 24px!important;
    border-bottom:1px solid var(--simple-line)!important;
    align-items:flex-end!important;
  }
  .topbar h1{
    font-size:clamp(28px,4vw,38px)!important;
    letter-spacing:-.035em!important;
  }
  .topbar .muted{font-size:12px!important;max-width:560px;opacity:.72}
  .topbar .pill.good,.topbar #versionPill{display:none!important}
  .topbar #liveSyncPill{
    border:0!important;
    background:transparent!important;
    padding:0!important;
    color:#a99a71!important;
    font-size:10px!important;
  }
  .topbar #openLiveSync{
    border-color:var(--simple-line)!important;
    background:transparent!important;
    font-size:10px!important;
    padding:7px 10px!important;
  }

  .card{
    border-color:var(--simple-line)!important;
    background:rgba(15,21,29,.46)!important;
    box-shadow:none!important;
    border-radius:18px!important;
  }
  #archive>.grid2,
  #lexicon>.grid2{
    grid-template-columns:minmax(0,1fr) minmax(230px,310px)!important;
    gap:24px!important;
  }
  #archive>.grid2>.card,
  #lexicon>.grid2>.card{
    border:0!important;
    background:transparent!important;
    padding-left:0!important;
    padding-right:0!important;
  }
  #archive aside .card,
  #lexicon aside .card{
    border:1px solid var(--simple-line)!important;
    background:rgba(15,21,29,.34)!important;
  }
  .lexhead{align-items:flex-end!important;margin-bottom:13px}
  .lexhead h2{font-size:18px!important}
  .lexhead .muted{font-size:11px!important;opacity:.7}
  #lexCount{
    border:0!important;
    background:transparent!important;
    padding:0!important;
    color:#7d8793!important;
    font-size:10px!important;
  }
  .layout-tools{
    margin:0 0 10px!important;
    padding:0!important;
    gap:5px!important;
  }
  .layout-tools .btn{
    border-color:var(--simple-line)!important;
    background:transparent!important;
    padding:6px 9px!important;
    font-size:10px!important;
  }
  .bubble-stage{
    margin-top:0!important;
    border-color:rgba(216,193,124,.10)!important;
    background:radial-gradient(circle at 50% 44%,rgba(55,66,90,.13),transparent 38%),#0b1017!important;
    box-shadow:none!important;
  }
  .bubble-visual{
    border-color:rgba(216,193,124,.12)!important;
    background:rgba(13,19,27,.80)!important;
    box-shadow:0 8px 22px rgba(0,0,0,.23)!important;
  }
  .bubble.active .bubble-visual{
    border-color:rgba(216,193,124,.48)!important;
    box-shadow:0 10px 30px rgba(0,0,0,.30),0 0 0 1px rgba(216,193,124,.08)!important;
  }
  .lexdetail{min-height:0!important}
  .lexhero{padding-top:6px!important}
  .archive-item{
    border-color:var(--simple-line)!important;
    background:rgba(15,21,29,.38)!important;
    box-shadow:none!important;
    border-radius:16px!important;
  }
  .archive-item:after{display:none!important}
  .discovery{
    border-color:var(--simple-line)!important;
    background:rgba(15,21,29,.38)!important;
    box-shadow:none!important;
  }

  #draw>.grid2{grid-template-columns:minmax(0,1fr)!important;max-width:820px;margin:0 auto}
  #draw>.grid2>aside{display:none!important}
  #draw>.grid2>.stack>.card:first-child{
    border:0!important;
    background:transparent!important;
    padding-left:0!important;
    padding-right:0!important;
  }
  #draw .draw-quick-tips{display:none!important}
  #draw .draw-mode-strip{
    background:transparent!important;
    border-color:var(--simple-line)!important;
  }
  .draw-result-card{
    border-color:var(--simple-line)!important;
    background:rgba(15,21,29,.38)!important;
    box-shadow:none!important;
  }

  @media(max-width:980px){
    .sidebar{padding-left:12px!important;padding-right:12px!important;gap:8px!important}
    .brand{display:none!important}
    .main{padding:22px 14px 48px!important}
    #archive>.grid2,#lexicon>.grid2{grid-template-columns:1fr!important}
    #archive aside,#lexicon aside{margin-top:0}
  }
  @media(max-width:620px){
    .sidebar{padding-top:8px!important;padding-bottom:8px!important}
    .nav{justify-content:space-between!important;overflow:visible!important;gap:4px!important;width:100%!important}
    .nav button{flex:1 1 0!important;min-width:0!important;text-align:center!important;padding:8px 3px!important;font-size:10px!important}
    .bubble-stage[data-density=micro] .bubble-name{font-size:6.5px!important;letter-spacing:.025em!important;bottom:4%!important}
    .bubble-stage[data-density=micro] .bubble svg{width:58%!important;height:58%!important}
    .bubble-stage[data-density=micro] .bubble.active .bubble-visual{transform:scale(1.42)!important}
    .bubble-stage[data-density=micro] .bubble.pinned .bubble-visual:after{display:none!important}
    .topbar{display:block!important;margin-bottom:16px!important;padding-bottom:13px!important}
    .topbar h1{font-size:29px!important}
    .topbar .muted{display:none!important}
    .topbar>.row{margin-top:8px!important;gap:8px!important}
    .main{padding-top:20px!important}
    .card{border-radius:15px!important}
    #archive>.grid2>.card,#lexicon>.grid2>.card{padding-top:0!important}
    .lexhead .muted{display:none!important}
    .layout-tools{overflow:auto!important;flex-wrap:nowrap!important;scrollbar-width:none}
    .layout-tools .btn{flex:0 0 auto!important}
    #archive aside .card,#lexicon aside .card{border:0!important;background:transparent!important;padding:0!important}
  }`;
  document.head.appendChild(style);

  const fxStyle=document.createElement('style');
  fxStyle.textContent=`
  body{
    -webkit-font-smoothing:antialiased;
    text-rendering:optimizeLegibility;
  }
  body:before{
    content:'';
    position:fixed;
    inset:0;
    pointer-events:none;
    z-index:-1;
    background:
      radial-gradient(circle at 16% 7%,rgba(216,193,124,.035),transparent 26%),
      radial-gradient(circle at 86% 25%,rgba(81,98,140,.045),transparent 31%);
  }
  .muted{color:#909aa6!important;line-height:1.58}
  p,.reading,.archive-item,.discovery{line-height:1.62}
  .screen.active{animation:aestraStandalonePageIn .28s cubic-bezier(.2,.72,.25,1) both}
  .topbar h1{animation:aestraStandaloneTitleIn .34s cubic-bezier(.2,.72,.25,1) both}
  .nav button,.btn{
    transition:background-color .18s ease,border-color .18s ease,color .18s ease,transform .18s ease,box-shadow .18s ease!important;
  }
  .nav button:active,.btn:active{transform:translateY(1px) scale(.985)}
  .nav button.active{position:relative}
  .nav button.active:after{
    content:'';
    position:absolute;
    left:28%;
    right:28%;
    bottom:3px;
    height:1px;
    border-radius:999px;
    background:rgba(216,193,124,.48);
    animation:aestraNavLine .24s ease-out both;
  }
  .bubble-visual{
    transition:transform .22s cubic-bezier(.2,.8,.2,1),border-color .2s ease,box-shadow .22s ease,filter .2s ease!important;
  }
  .bubble:hover .bubble-visual{filter:brightness(1.07)}
  .bubble.active .bubble-visual{animation:aestraStandaloneGlyphFocus .38s cubic-bezier(.2,.8,.2,1) both}
  .lexdetail>*{animation:aestraStandaloneDetailIn .24s ease-out both}
  .archive-item{animation:aestraStandaloneListIn .3s ease-out both}
  .archive-item:nth-child(2){animation-delay:.035s}
  .archive-item:nth-child(3){animation-delay:.07s}
  .archive-item:nth-child(4){animation-delay:.105s}
  .discovery{animation:aestraStandaloneListIn .3s ease-out both}
  .discovery:nth-child(2){animation-delay:.04s}
  .discovery:nth-child(3){animation-delay:.08s}
  .meaning{line-height:1.25}
  textarea,input,select{line-height:1.5!important}
  @keyframes aestraStandalonePageIn{
    from{opacity:0;transform:translateY(7px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraStandaloneTitleIn{
    from{opacity:.35;transform:translateY(4px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraStandaloneGlyphFocus{
    0%{filter:brightness(1)}
    55%{filter:brightness(1.12);box-shadow:0 0 24px rgba(216,193,124,.11)}
    100%{filter:brightness(1.04)}
  }
  @keyframes aestraStandaloneDetailIn{
    from{opacity:0;transform:translateY(5px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraStandaloneListIn{
    from{opacity:0;transform:translateY(7px)}
    to{opacity:1;transform:none}
  }
  @keyframes aestraNavLine{
    from{opacity:0;transform:scaleX(.25)}
    to{opacity:1;transform:scaleX(1)}
  }
  @media(max-width:620px){
    .muted{line-height:1.5}
    .btn{min-height:38px}
    .archive-item{padding:15px!important}
    .reading{font-size:13px}
    .meaning{font-size:10px!important}
  }

  /* aestraFancyFieldGuide */
  body:after{
    content:'';
    position:fixed;
    inset:-18%;
    pointer-events:none;
    z-index:-1;
    opacity:.56;
    background:
      conic-gradient(from 175deg at 50% 50%,transparent 0 24%,rgba(216,193,124,.027) 31%,transparent 43% 69%,rgba(83,101,145,.038) 79%,transparent 91%),
      radial-gradient(circle at 50% 50%,rgba(216,193,124,.025),transparent 58%);
    filter:blur(26px);
    animation:aestraSAtmosphereDrift 18s ease-in-out infinite alternate;
  }
  .topbar{position:relative}
  .topbar h1{
    text-shadow:0 0 18px rgba(216,193,124,.06);
    animation:aestraStandaloneTitleIn .34s cubic-bezier(.2,.72,.25,1) both,aestraSTitleBreath 5.5s ease-in-out .5s infinite;
  }
  .topbar:after{
    content:'';
    position:absolute;
    left:0;
    bottom:-1px;
    width:clamp(70px,18vw,190px);
    height:1px;
    background:linear-gradient(90deg,transparent,rgba(216,193,124,.65),transparent);
    filter:drop-shadow(0 0 5px rgba(216,193,124,.24));
    animation:aestraSHeaderSweep 6s ease-in-out infinite;
  }

  .bubble-stage{
    position:relative;
    overflow:hidden;
    box-shadow:inset 0 0 42px rgba(35,48,72,.16),0 14px 45px rgba(0,0,0,.18)!important;
  }
  .bubble-stage:before{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    z-index:0;
    opacity:.34;
    background-image:
      radial-gradient(circle,rgba(244,221,151,.7) 0 1px,transparent 1.35px),
      radial-gradient(circle,rgba(145,167,220,.52) 0 .8px,transparent 1.2px);
    background-size:137px 137px,211px 211px;
    background-position:18px 28px,80px 120px;
    animation:aestraSStarsDrift 22s linear infinite;
  }
  .bubble-stage:after{
    content:'';
    position:absolute;
    inset:-30%;
    pointer-events:none;
    z-index:0;
    opacity:.42;
    background:radial-gradient(ellipse at center,rgba(216,193,124,.07),transparent 54%);
    animation:aestraSLexiconAura 7s ease-in-out infinite;
  }
  .bubble{z-index:2}
  .bubble:not(.active):not(.dragging) .bubble-visual{
    animation:aestraSRuneBreathe 4.8s ease-in-out infinite;
  }
  .bubble:nth-child(3n) .bubble-visual{animation-delay:-1.3s}
  .bubble:nth-child(4n) .bubble-visual{animation-delay:-2.4s}
  .bubble:nth-child(5n) .bubble-visual{animation-delay:-3.1s}
  .bubble svg{filter:drop-shadow(0 0 5px rgba(236,223,183,.08))}
  .bubble.active .bubble-visual{
    animation:aestraStandaloneGlyphFocus .38s cubic-bezier(.2,.8,.2,1) both,aestraSSelectedRunePulse 2.7s ease-in-out .38s infinite!important;
  }
  .bubble.active svg{animation:aestraSRuneInkPulse 2.7s ease-in-out infinite}

  .lexdetail{
    position:relative;
    overflow:hidden;
    animation:aestraSDetailBorder 4.5s ease-in-out infinite;
  }
  .lexdetail:before{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    background:linear-gradient(115deg,transparent 18%,rgba(216,193,124,.055) 47%,transparent 69%);
    transform:translateX(-120%);
    animation:aestraSCardSheen 7s ease-in-out 1.2s infinite;
  }

  .archive-item{
    position:relative;
    overflow:hidden;
    transition:transform .24s ease,border-color .24s ease,background .24s ease!important;
  }
  .archive-item:hover{
    transform:translateY(-2px);
    border-color:rgba(216,193,124,.22)!important;
    background:rgba(22,29,38,.62)!important;
  }
  .archive-item:before{
    content:'';
    position:absolute;
    inset:0;
    pointer-events:none;
    background:linear-gradient(110deg,transparent 28%,rgba(216,193,124,.035) 48%,transparent 68%);
    transform:translateX(-120%);
    animation:aestraSCardSheen 10s ease-in-out infinite;
  }

  .discovery:before{
    animation:aestraSDiscoveryPulse 2.8s ease-out infinite!important;
  }
  .draw-stage{
    animation:aestraSDrawChamber 4.8s ease-in-out infinite;
  }
  .btn:hover{
    border-color:rgba(216,193,124,.28)!important;
    box-shadow:0 0 16px rgba(216,193,124,.045)!important;
  }

  @keyframes aestraSAtmosphereDrift{
    0%{transform:translate3d(-2%,-1%,0) rotate(-2deg) scale(1)}
    100%{transform:translate3d(3%,2%,0) rotate(3deg) scale(1.08)}
  }
  @keyframes aestraSTitleBreath{
    0%,100%{text-shadow:0 0 16px rgba(216,193,124,.045)}
    50%{text-shadow:0 0 24px rgba(216,193,124,.13)}
  }
  @keyframes aestraSHeaderSweep{
    0%,100%{opacity:.35;transform:translateX(0) scaleX(.55);transform-origin:left}
    50%{opacity:1;transform:translateX(10px) scaleX(1);transform-origin:left}
  }
  @keyframes aestraSStarsDrift{
    from{background-position:18px 28px,80px 120px}
    to{background-position:155px 165px,-131px 331px}
  }
  @keyframes aestraSLexiconAura{
    0%,100%{transform:translate(-4%,-2%) scale(.92);opacity:.22}
    50%{transform:translate(5%,3%) scale(1.12);opacity:.48}
  }
  @keyframes aestraSRuneBreathe{
    0%,100%{filter:brightness(.96)}
    50%{filter:brightness(1.09)}
  }
  @keyframes aestraSSelectedRunePulse{
    0%,100%{filter:brightness(1.03);box-shadow:0 10px 30px rgba(0,0,0,.30),0 0 0 1px rgba(216,193,124,.08),0 0 12px rgba(216,193,124,.06)}
    50%{filter:brightness(1.15);box-shadow:0 10px 30px rgba(0,0,0,.30),0 0 0 1px rgba(216,193,124,.32),0 0 28px rgba(216,193,124,.20)}
  }
  @keyframes aestraSRuneInkPulse{
    0%,100%{filter:drop-shadow(0 0 4px rgba(238,224,183,.12))}
    50%{filter:drop-shadow(0 0 10px rgba(240,217,145,.34))}
  }
  @keyframes aestraSDetailBorder{
    0%,100%{border-color:rgba(210,220,232,.10)}
    50%{border-color:rgba(216,193,124,.22)}
  }
  @keyframes aestraSCardSheen{
    0%,72%{transform:translateX(-125%);opacity:0}
    82%{opacity:1}
    100%{transform:translateX(125%);opacity:0}
  }
  @keyframes aestraSDiscoveryPulse{
    0%{box-shadow:0 0 0 0 rgba(216,193,124,.30)}
    70%,100%{box-shadow:0 0 0 12px rgba(216,193,124,0)}
  }
  @keyframes aestraSDrawChamber{
    0%,100%{box-shadow:0 20px 48px rgba(0,0,0,.30),0 0 0 1px rgba(216,193,124,.08)}
    50%{box-shadow:0 22px 52px rgba(0,0,0,.34),0 0 0 1px rgba(216,193,124,.18),0 0 30px rgba(216,193,124,.06)}
  }
    @media(prefers-reduced-motion:reduce){
    *,*:before,*:after{
      animation-duration:.001ms!important;
      animation-iteration-count:1!important;
      transition-duration:.001ms!important;
      scroll-behavior:auto!important;
    }
  }`;
  document.head.appendChild(fxStyle);

  // Shorter labels and copy make the player build feel less like a dashboard.
  document.querySelectorAll('.nav button').forEach(btn=>{
    const t=(btn.textContent||'').trim().toLowerCase();
    if(t.includes('draw')&&t.includes('glyph'))btn.textContent='Draw';
  });
  const pageSub=document.getElementById('pageSub');
  const shortCopy={
    archive:'Recovered inscriptions and your notes.',
    discoveries:'What the party has learned.',
    lexicon:'What the party currently understands.',
    draw:'Draw a sign and compare it with the known lexicon.'
  };
  const prevShow=typeof showScreen==='function'?showScreen:null;
  if(prevShow){
    showScreen=function(id){
      const r=prevShow.apply(this,arguments);
      const s=document.getElementById('pageSub');if(s&&shortCopy[id])s.textContent=shortCopy[id];
      return r;
    };
  }
  const active=document.querySelector('.screen.active');
  if(pageSub&&active&&shortCopy[active.id])pageSub.textContent=shortCopy[active.id];
})();