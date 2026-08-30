// Fix Character Creator grid after the live progress strip was inserted as an extra row.
(function(){
  if(document.getElementById('ccProgressLayoutFix'))return;
  const s=document.createElement('style');
  s.id='ccProgressLayoutFix';
  s.textContent=`
    #characterCreator .cc-shell{
      grid-template-rows:auto auto auto minmax(0,1fr) auto!important;
    }
    #characterCreator .cc-progress-strip{
      min-height:0!important;
      height:auto!important;
      flex:0 0 auto!important;
      padding:7px 16px!important;
      line-height:1.25!important;
    }
    @media(max-width:700px){
      #characterCreator .cc-progress-strip{
        padding:6px 12px!important;
      }
    }
  `;
  document.head.appendChild(s);
})();