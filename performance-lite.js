// Performance-first layer for phones/tablets. Keeps mechanics and controls intact.
// Heavy decorative animation/filter work is disabled on smaller/touch devices.
(function(){
  const style=document.createElement('style');
  style.id='aestraPerformanceLite';
  style.textContent=`
  @media (max-width:900px), (pointer:coarse){
    .magic-backdrop,.aestra-atmosphere,.aestra-wisps,.magic-trail-dot{display:none!important}
    *,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:.08s!important}
    .grand-mobile-nav,.desktop-section-nav,.derived-edit-backdrop,.field-edit-backdrop,.attribute-modal-backdrop,.portrait-modal-backdrop,.build-detail-backdrop{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    .panel,.combat-dashboard,.resource-card,.attr-card,.stat-medallion,.save-orb-button,.rules-orb{filter:none!important}
    body::before{display:none!important}
  }
  `;
  document.head.appendChild(style);
  document.body.classList.add('performance-lite');
})();
