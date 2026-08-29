// Distinct attribute styling + integrated HP/MP bar sliders. Presentation only; existing state logic remains intact.
function installAttributeIdentity(){
  const grid=document.querySelector('#sheetView .attribute-grid'); if(!grid)return;
  const keys=['mig','dex','ins','wlp'];
  [...grid.querySelectorAll('.attr-card')].forEach((card,i)=>{card.dataset.attrTone=keys[i]||'mig'});
}
function installIntegratedResourceBars(){
  ['hp','mp'].forEach(type=>{
    const card=document.querySelector(`.resource-card[data-resource="${type}"]`); if(!card||card.dataset.integratedBar==='1')return;
    const bar=card.querySelector('.bar'), direct=card.querySelector('.direct-resource'), range=direct?.querySelector('.resource-slider'), number=direct?.querySelector('.resource-number');
    if(!bar||!range)return;
    card.dataset.integratedBar='1'; card.classList.add('integrated-resource-card');
    bar.classList.add('integrated-resource-bar');
    range.classList.add('integrated-range'); bar.appendChild(range);
    if(number){number.closest('label')?.classList.add('integrated-current-number')}
    const label=document.createElement('div'); label.className='integrated-bar-hint'; label.textContent='Drag bar to adjust'; bar.insertAdjacentElement('afterend',label);
  });
}
function installStyles(){
  if(document.getElementById('combatUiPolishStyles'))return;
  const s=document.createElement('style'); s.id='combatUiPolishStyles'; s.textContent=`
  /* Attribute identities: same structure, unmistakably different personalities. */
  #sheetView .attr-card.attr-compact{position:relative;isolation:isolate;border-width:1px!important;overflow:hidden!important}
  #sheetView .attr-card.attr-compact:before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.72}
  #sheetView .attr-card[data-attr-tone="mig"]{border-color:rgba(214,126,72,.56)!important;box-shadow:inset 0 0 24px rgba(178,72,42,.08),0 5px 16px rgba(0,0,0,.18)!important}
  #sheetView .attr-card[data-attr-tone="mig"]:before{background:radial-gradient(circle at 50% 12%,rgba(201,86,47,.22),transparent 50%),linear-gradient(180deg,rgba(78,31,22,.18),transparent 70%)}
  #sheetView .attr-card[data-attr-tone="mig"]>span,#sheetView .attr-card[data-attr-tone="mig"] .die-current{color:#efa46f!important;text-shadow:0 0 8px rgba(219,91,50,.25)}
  #sheetView .attr-card[data-attr-tone="mig"] .die-visual{border-color:rgba(216,118,65,.28)!important;background:radial-gradient(circle,rgba(156,59,35,.14),rgba(10,12,17,.38) 72%)!important}

  #sheetView .attr-card[data-attr-tone="dex"]{border-color:rgba(92,199,153,.54)!important;box-shadow:inset 0 0 24px rgba(53,150,111,.07),0 5px 16px rgba(0,0,0,.18)!important}
  #sheetView .attr-card[data-attr-tone="dex"]:before{background:radial-gradient(circle at 50% 12%,rgba(71,185,139,.20),transparent 50%),linear-gradient(180deg,rgba(22,73,58,.16),transparent 70%)}
  #sheetView .attr-card[data-attr-tone="dex"]>span,#sheetView .attr-card[data-attr-tone="dex"] .die-current{color:#83e0bb!important;text-shadow:0 0 8px rgba(78,202,153,.24)}
  #sheetView .attr-card[data-attr-tone="dex"] .die-visual{border-color:rgba(92,204,158,.26)!important;background:radial-gradient(circle,rgba(45,139,103,.13),rgba(10,12,17,.38) 72%)!important}

  #sheetView .attr-card[data-attr-tone="ins"]{border-color:rgba(88,159,219,.58)!important;box-shadow:inset 0 0 24px rgba(44,111,173,.08),0 5px 16px rgba(0,0,0,.18)!important}
  #sheetView .attr-card[data-attr-tone="ins"]:before{background:radial-gradient(circle at 50% 12%,rgba(62,137,203,.22),transparent 50%),linear-gradient(180deg,rgba(23,56,91,.17),transparent 70%)}
  #sheetView .attr-card[data-attr-tone="ins"]>span,#sheetView .attr-card[data-attr-tone="ins"] .die-current{color:#8cc9f2!important;text-shadow:0 0 8px rgba(78,161,225,.28)}
  #sheetView .attr-card[data-attr-tone="ins"] .die-visual{border-color:rgba(87,163,221,.28)!important;background:radial-gradient(circle,rgba(42,104,160,.14),rgba(10,12,17,.38) 72%)!important}

  #sheetView .attr-card[data-attr-tone="wlp"]{border-color:rgba(165,102,218,.58)!important;box-shadow:inset 0 0 24px rgba(112,61,165,.09),0 5px 16px rgba(0,0,0,.18)!important}
  #sheetView .attr-card[data-attr-tone="wlp"]:before{background:radial-gradient(circle at 50% 12%,rgba(143,74,199,.22),transparent 50%),linear-gradient(180deg,rgba(63,30,91,.18),transparent 70%)}
  #sheetView .attr-card[data-attr-tone="wlp"]>span,#sheetView .attr-card[data-attr-tone="wlp"] .die-current{color:#c495ec!important;text-shadow:0 0 8px rgba(151,86,213,.28)}
  #sheetView .attr-card[data-attr-tone="wlp"] .die-visual{border-color:rgba(167,103,219,.28)!important;background:radial-gradient(circle,rgba(103,54,151,.14),rgba(10,12,17,.38) 72%)!important}
  #sheetView .attr-card.attr-open{transform:translateY(-2px) scale(1.015)}

  /* HP / MP are now substantial interactive meters. */
  #sheetView .integrated-resource-card{padding:18px 16px 15px!important;min-height:310px}
  #sheetView .integrated-resource-card .resource-head{margin-bottom:7px}
  #sheetView .integrated-resource-card .resource-head>span{font-size:1.28rem!important;letter-spacing:.08em}
  #sheetView .integrated-resource-card .resource-head strong{font-size:1.35rem!important}
  #sheetView .integrated-resource-bar{height:28px!important;margin:18px 0 4px!important;border-radius:999px!important;position:relative!important;overflow:visible!important;border:1px solid rgba(255,255,255,.12)!important;background:rgba(3,5,10,.88)!important;box-shadow:inset 0 3px 8px rgba(0,0,0,.62),0 0 0 1px rgba(255,255,255,.025)!important}
  #sheetView .integrated-resource-bar>span{height:100%!important;top:0!important;display:block!important}
  #sheetView .integrated-range{position:absolute!important;inset:-10px -2px!important;width:calc(100% + 4px)!important;height:48px!important;min-height:48px!important;margin:0!important;padding:0!important;opacity:1!important;background:transparent!important;appearance:none!important;-webkit-appearance:none!important;z-index:7!important;cursor:ew-resize!important;accent-color:transparent!important}
  #sheetView .integrated-range::-webkit-slider-runnable-track{height:28px;background:transparent;border:0}
  #sheetView .integrated-range::-moz-range-track{height:28px;background:transparent;border:0}
  #sheetView .integrated-range::-webkit-slider-thumb{-webkit-appearance:none;width:24px;height:34px;margin-top:-3px;border-radius:10px;background:rgba(255,255,255,.92);border:3px solid rgba(20,23,30,.95);box-shadow:0 0 0 2px rgba(255,255,255,.28),0 0 14px rgba(255,255,255,.34);cursor:grab}
  #sheetView .integrated-range::-moz-range-thumb{width:19px;height:29px;border-radius:9px;background:rgba(255,255,255,.92);border:3px solid rgba(20,23,30,.95);box-shadow:0 0 0 2px rgba(255,255,255,.28),0 0 14px rgba(255,255,255,.34);cursor:grab}
  #sheetView .resource-hp .integrated-range::-webkit-slider-thumb{box-shadow:0 0 0 2px rgba(255,105,91,.65),0 0 16px rgba(255,62,52,.75)}
  #sheetView .resource-mp .integrated-range::-webkit-slider-thumb{box-shadow:0 0 0 2px rgba(102,205,255,.65),0 0 16px rgba(45,157,255,.8)}
  #sheetView .resource-hp .integrated-range::-moz-range-thumb{box-shadow:0 0 0 2px rgba(255,105,91,.65),0 0 16px rgba(255,62,52,.75)}
  #sheetView .resource-mp .integrated-range::-moz-range-thumb{box-shadow:0 0 0 2px rgba(102,205,255,.65),0 0 16px rgba(45,157,255,.8)}
  #sheetView .integrated-bar-hint{text-align:center;margin:0 0 10px;font-size:.62rem;letter-spacing:.08em;text-transform:uppercase;color:#807969}
  #sheetView .integrated-resource-card .direct-resource{grid-template-columns:1fr!important;margin:5px 0 10px!important}
  #sheetView .integrated-resource-card .direct-resource>.resource-slider{display:none!important}
  #sheetView .integrated-resource-card .integrated-current-number{max-width:138px;justify-self:start}
  #sheetView .integrated-resource-card .integrated-current-number input{font-size:1.15rem!important}
  #sheetView .resource-hp .integrated-resource-bar{box-shadow:inset 0 3px 8px rgba(0,0,0,.62),0 0 18px rgba(240,53,47,.14)!important}
  #sheetView .resource-mp .integrated-resource-bar{box-shadow:inset 0 3px 8px rgba(0,0,0,.62),0 0 18px rgba(48,147,239,.16)!important}
  @media(max-width:640px){#sheetView .integrated-resource-card{min-height:294px;padding:15px 12px!important}#sheetView .integrated-resource-bar{height:30px!important;margin-top:16px!important}#sheetView .integrated-range::-webkit-slider-runnable-track{height:30px}#sheetView .integrated-range::-moz-range-track{height:30px}}
  @media(prefers-reduced-motion:reduce){#sheetView .attr-card.attr-open{transform:none}}
  `; document.head.appendChild(s);
}
installStyles(); installAttributeIdentity(); installIntegratedResourceBars();