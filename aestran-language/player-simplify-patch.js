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
    .nav{justify-content:space-between!important}
    .nav button{flex:1 0 auto!important;text-align:center!important;padding:8px 8px!important}
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

  // Shorter labels and copy make the player build feel less like a dashboard.
  document.querySelectorAll('.nav button').forEach(btn=>{
    const t=(btn.textContent||'').trim().toLowerCase();
    if(t==='draw glyph')btn.textContent='Draw';
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