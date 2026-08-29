// Fold the three mechanical Traits into the character summary instead of a separate large panel.
function installInlineTraits(){
  const traits=document.getElementById('traitsEditor');
  const identity=document.querySelector('#sheetView .identity-card');
  if(!traits||!identity||document.getElementById('inlineTraitsWrap'))return;
  const oldPanel=traits.closest('article.panel');
  const wrap=document.createElement('section');
  wrap.id='inlineTraitsWrap';
  wrap.className='inline-traits-wrap';
  wrap.innerHTML='<div class="inline-traits-head"><span>TRAITS</span><small>Tap a trait to edit</small></div>';
  wrap.appendChild(traits);
  identity.appendChild(wrap);
  oldPanel?.classList.add('traits-panel-retired');
}

function installInlineTraitStyles(){
  if(document.getElementById('inlineTraitStyles'))return;
  const s=document.createElement('style');
  s.id='inlineTraitStyles';
  s.textContent=`
  #sheetView .traits-panel-retired{display:none!important}
  #sheetView .inline-traits-wrap{margin-top:9px;padding-top:9px;border-top:1px solid rgba(215,173,99,.14)}
  #sheetView .inline-traits-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 2px 6px}
  #sheetView .inline-traits-head>span{font-size:.55rem;letter-spacing:.17em;color:#c7a45e;font-weight:700}
  #sheetView .inline-traits-head>small{font-size:.5rem;color:#7f786c;letter-spacing:.04em}
  #sheetView #traitsEditor{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:0!important}
  #sheetView #traitsEditor label{display:grid!important;gap:3px!important;min-width:0!important;font-size:.48rem!important;letter-spacing:.08em!important;text-transform:uppercase!important;color:#81796d!important;margin:0!important}
  #sheetView #traitsEditor input{width:100%!important;min-width:0!important;height:37px!important;min-height:37px!important;padding:7px 9px!important;border-radius:10px!important;background:rgba(5,7,11,.42)!important;border:1px solid rgba(215,173,99,.11)!important;color:#ded2bc!important;font:italic .78rem/1.1 Georgia,serif!important;box-shadow:none!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  #sheetView #traitsEditor input:focus{border-color:rgba(215,173,99,.4)!important;background:rgba(8,10,14,.72)!important;box-shadow:0 0 0 2px rgba(215,173,99,.06)!important}
  body.adventure-mode #inlineTraitsWrap{display:none!important}
  @media(max-width:520px){
    #sheetView #traitsEditor{grid-template-columns:1fr!important;gap:5px!important}
    #sheetView #traitsEditor label{grid-template-columns:50px minmax(0,1fr)!important;align-items:center!important;gap:6px!important}
    #sheetView #traitsEditor input{height:35px!important;min-height:35px!important;font-size:.76rem!important}
    #sheetView .inline-traits-head>small{display:none}
  }
  `;
  document.head.appendChild(s);
}

installInlineTraitStyles();
installInlineTraits();
