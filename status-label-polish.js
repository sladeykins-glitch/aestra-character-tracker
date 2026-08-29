// Keeps attribute status information readable without overlapping the effect text.
(function(){
  if(document.getElementById('statusLabelPolishStyles')) return;
  const s=document.createElement('style');
  s.id='statusLabelPolishStyles';
  s.textContent=`
  /* The previous STATUS pill sat over the effect text at the bottom of each attribute card. */
  #combatDashboard .attr-card.status-affected:after{
    content:'STATUS'!important;
    display:block!important;
    position:absolute!important;
    top:7px!important;
    right:7px!important;
    bottom:auto!important;
    left:auto!important;
    transform:none!important;
    z-index:4!important;
    padding:2px 5px!important;
    border-radius:999px!important;
    font:700 .40rem/1 system-ui,sans-serif!important;
    letter-spacing:.10em!important;
    color:#ffd18a!important;
    background:rgba(82,43,19,.74)!important;
    border:1px solid rgba(226,145,68,.36)!important;
    box-shadow:0 0 7px rgba(222,119,48,.08)!important;
    pointer-events:none!important;
  }
  #combatDashboard .attr-card .attribute-effect{
    position:relative!important;
    z-index:3!important;
    min-height:16px!important;
    height:auto!important;
    margin:3px 2px 0!important;
    padding:0 2px!important;
    font-size:.60rem!important;
    line-height:1.2!important;
    color:#e9b975!important;
    text-align:center!important;
    white-space:normal!important;
    overflow:visible!important;
    text-overflow:clip!important;
  }
  #combatDashboard .attr-card:not(.status-affected) .attribute-effect:empty{display:none!important}
  @media(max-width:520px){
    #combatDashboard .attr-card.status-affected:after{top:5px!important;right:5px!important;font-size:.36rem!important;padding:2px 4px!important}
    #combatDashboard .attr-card .attribute-effect{font-size:.54rem!important;line-height:1.15!important;margin-top:2px!important}
  }
  `;
  document.head.appendChild(s);
})();
