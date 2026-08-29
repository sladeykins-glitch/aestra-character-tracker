// Readability fix for Core library cards: keep action buttons out of text flow.
(function(){
  if(document.getElementById('coreLibraryReadabilityStyles'))return;
  const s=document.createElement('style');
  s.id='coreLibraryReadabilityStyles';
  s.textContent=`
  #coreLibraryModal .core-lib-card{position:relative;padding:15px 16px!important;display:grid!important;gap:9px!important;overflow:hidden}
  #coreLibraryModal .core-lib-head{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:16px!important;align-items:start!important}
  #coreLibraryModal .core-lib-head>div{min-width:0!important;padding-right:4px!important;display:grid!important;gap:2px!important}
  #coreLibraryModal .core-lib-head strong{display:block!important;font-size:1rem!important;line-height:1.2!important;color:#f1e2bd!important}
  #coreLibraryModal .core-lib-head small{display:block!important;font-size:.68rem!important;line-height:1.35!important;color:#b6a98e!important;white-space:normal!important}
  #coreLibraryModal .core-lib-head>button{position:static!important;float:none!important;transform:none!important;width:auto!important;min-width:118px!important;max-width:150px!important;height:auto!important;min-height:36px!important;margin:0!important;padding:8px 14px!important;align-self:start!important;white-space:nowrap!important;z-index:1!important}
  #coreLibraryModal .core-lib-card>p{margin:0!important;padding:0!important;max-width:none!important;font-size:.82rem!important;line-height:1.48!important;color:#d9d0c1!important;white-space:normal!important;overflow-wrap:anywhere!important}
  #coreLibraryModal .core-lib-card>p br{display:block!important;content:''!important;margin-top:3px!important}
  @media(max-width:640px){
    #coreLibraryModal{padding:8px!important}
    #coreLibraryModal .core-library-dialog{margin:1vh auto!important}
    #coreLibraryModal .core-lib-card{padding:13px!important}
    #coreLibraryModal .core-lib-head{grid-template-columns:1fr!important;gap:9px!important}
    #coreLibraryModal .core-lib-head>button{width:100%!important;max-width:none!important;min-width:0!important;justify-content:center!important}
    #coreLibraryModal .core-lib-card>p{font-size:.78rem!important;line-height:1.5!important}
  }
  `;
  document.head.appendChild(s);
})();