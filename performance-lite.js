// Performance-first layer for phones/tablets.
// Keeps the atmospheric identity, but trims the genuinely expensive effects.
(function(){
  const style=document.createElement('style');
  style.id='aestraPerformanceLite';
  style.textContent=`
  @media (max-width:900px), (pointer:coarse){
    .aestra-wisps,.magic-trail-dot{display:none!important}
    .magic-backdrop{display:block!important}
    .magic-backdrop:before,.magic-backdrop:after{display:none!important}
    .magic-backdrop i{display:block!important;animation:magicMote 28s linear infinite!important;opacity:.22!important}
    .magic-backdrop i:nth-child(n+11){display:none!important}
    .aestra-atmosphere{display:block!important;opacity:.3!important}
    .aestra-atmosphere i{display:block!important;animation:aestraDrift 24s linear infinite!important}
    .aestra-atmosphere i:nth-child(even){display:none!important}
    .grand-mobile-nav,.desktop-section-nav,.derived-edit-backdrop,.field-edit-backdrop,.attribute-modal-backdrop,.portrait-modal-backdrop,.build-detail-backdrop{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    .panel,.combat-dashboard,.resource-card,.attr-card,.stat-medallion,.save-orb-button,.rules-orb{filter:none!important}
  }
  @media(prefers-reduced-motion:reduce){
    .magic-backdrop i,.aestra-atmosphere i{animation:none!important;opacity:.16!important}
  }
  `;
  document.head.appendChild(style);
  document.body.classList.add('performance-lite');
})();