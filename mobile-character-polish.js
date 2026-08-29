// Mobile-first character identity polish. Presentation only; existing inputs/listeners remain intact.
function installMobileCharacterPolish(){
  const header=document.querySelector('#sheetView .grand-character-header, #sheetView .identity-grid');
  const identity=document.querySelector('#sheetView .identity-card');
  const portrait=document.querySelector('#sheetView .compact-portrait-card, #sheetView .portrait-card');
  const fields=identity?.querySelector('.two-col');
  if(!header||!identity||!portrait||!fields)return;
  header.classList.add('character-summary-header');
  identity.classList.add('character-summary-card');
  portrait.classList.add('character-summary-portrait');
  fields.classList.add('character-summary-fields');
  [...fields.querySelectorAll(':scope > label')].forEach((label,i)=>{
    label.classList.add('character-summary-field',`character-summary-field-${i+1}`);
  });
}

function installMobileCharacterStyles(){
  if(document.getElementById('mobileCharacterPolishStyles'))return;
  const s=document.createElement('style');
  s.id='mobileCharacterPolishStyles';
  s.textContent=`
  @media(max-width:700px){
    /* Make the app-level view tabs fit the phone instead of clipping off-screen. */
    #appView>.tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;width:100%!important;overflow:visible!important;padding:0 0 8px!important}
    #appView>.tabs .tab{min-width:0!important;width:100%!important;padding:10px 5px!important;font-size:.72rem!important;white-space:normal!important;line-height:1.05!important;min-height:48px!important;border-radius:12px!important}

    /* Compact character summary: portrait is an accent, not a full-height column. */
    body.mobile-paged-sheet #sheetView .character-summary-header{display:grid!important;grid-template-columns:72px minmax(0,1fr)!important;gap:9px!important;align-items:start!important;margin:6px 0 10px!important}
    body.mobile-paged-sheet #sheetView .character-summary-portrait{width:72px!important;min-width:72px!important;height:72px!important;min-height:72px!important;padding:4px!important;border-radius:17px!important;align-self:start!important;position:sticky!important;top:8px!important}
    body.mobile-paged-sheet #sheetView .character-summary-portrait .portrait,
    body.mobile-paged-sheet #sheetView .character-summary-portrait .portrait-fallback{width:100%!important;height:100%!important;min-height:0!important;aspect-ratio:1/1!important;border-radius:13px!important;object-fit:cover!important}
    body.mobile-paged-sheet #sheetView .character-summary-portrait .portrait-fallback{font-size:1.6rem!important}
    body.mobile-paged-sheet #sheetView .character-summary-portrait:after{content:'VIEW';right:4px!important;bottom:4px!important;padding:2px 4px!important;font-size:.36rem!important;letter-spacing:.08em!important}

    body.mobile-paged-sheet #sheetView .character-summary-card{min-width:0!important;padding:11px!important;border-radius:18px!important;overflow:hidden!important}
    body.mobile-paged-sheet #sheetView .character-summary-card .split-heading{display:grid!important;grid-template-columns:minmax(0,1fr) 54px!important;gap:8px!important;align-items:start!important;margin-bottom:9px!important}
    body.mobile-paged-sheet #sheetView .character-summary-card .eyebrow{font-size:.62rem!important;letter-spacing:.16em!important;margin-bottom:1px!important}
    body.mobile-paged-sheet #sheetView .character-summary-card .title-input{height:auto!important;min-height:42px!important;padding:2px 4px 4px!important;font-size:2rem!important;line-height:1!important;border-radius:0!important;border-width:0 0 1px!important;background:transparent!important;box-shadow:none!important}
    body.mobile-paged-sheet #sheetView .character-summary-card .level-box{font-size:.62rem!important;gap:3px!important;text-align:center!important}
    body.mobile-paged-sheet #sheetView .character-summary-card .level-box input{height:48px!important;min-height:48px!important;padding:5px!important;text-align:center!important;font-size:1rem!important;border-radius:12px!important}

    /* Turn the huge form fields into a readable character-summary stack. */
    body.mobile-paged-sheet #sheetView .character-summary-fields{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
    body.mobile-paged-sheet #sheetView .character-summary-field{display:grid!important;gap:3px!important;min-width:0!important;font-size:.62rem!important;color:#a99f8c!important;letter-spacing:.02em!important}
    body.mobile-paged-sheet #sheetView .character-summary-field-1,
    body.mobile-paged-sheet #sheetView .character-summary-field-2,
    body.mobile-paged-sheet #sheetView .character-summary-field-3{grid-column:1/-1!important}
    body.mobile-paged-sheet #sheetView .character-summary-field input{width:100%!important;height:43px!important;min-height:43px!important;max-height:43px!important;padding:8px 10px!important;font-size:.9rem!important;line-height:1.1!important;border-radius:11px!important;background:rgba(5,7,11,.72)!important;overflow:hidden!important}
    body.mobile-paged-sheet #sheetView .character-summary-field-4 input,
    body.mobile-paged-sheet #sheetView .character-summary-field-5 input,
    body.mobile-paged-sheet #sheetView .character-summary-field-6 input{padding-left:7px!important;padding-right:7px!important;text-align:center!important;font-size:.82rem!important}
    body.mobile-paged-sheet #sheetView .character-summary-field-4,
    body.mobile-paged-sheet #sheetView .character-summary-field-5,
    body.mobile-paged-sheet #sheetView .character-summary-field-6{text-align:center!important}

    /* Give the traits card breathing room without letting it collide with the bottom tray. */
    body.mobile-paged-sheet .mobile-page[data-mobile-page="sheet"]>article.panel{margin-top:9px!important}
    body.mobile-paged-sheet #traitsEditor{gap:7px!important}
    body.mobile-paged-sheet #traitsEditor input{min-height:43px!important;height:43px!important;font-size:.9rem!important}
  }
  @media(max-width:370px){
    body.mobile-paged-sheet #sheetView .character-summary-header{grid-template-columns:62px minmax(0,1fr)!important;gap:7px!important}
    body.mobile-paged-sheet #sheetView .character-summary-portrait{width:62px!important;min-width:62px!important;height:62px!important;min-height:62px!important}
    body.mobile-paged-sheet #sheetView .character-summary-card{padding:9px!important}
    body.mobile-paged-sheet #sheetView .character-summary-card .title-input{font-size:1.7rem!important}
    body.mobile-paged-sheet #sheetView .character-summary-fields{gap:6px!important}
    body.mobile-paged-sheet #sheetView .character-summary-field input{height:40px!important;min-height:40px!important;max-height:40px!important;padding:7px 8px!important}
  }
  `;
  document.head.appendChild(s);
}

installMobileCharacterStyles();
installMobileCharacterPolish();