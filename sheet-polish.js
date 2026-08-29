// Readability-first visual pass for the player sheet. No observers: presentation only.
function iconSvg(kind){
 const paths={initiative:'<path d="M32 6 18 29h11l-5 29 22-33H35l7-19Z"/>',defence:'<path d="M32 5 51 12v16c0 14-8 24-19 31C21 52 13 42 13 28V12l19-7Zm0 9-11 4v10c0 9 4 16 11 21 7-5 11-12 11-21V18l-11-4Z"/>',magic:'<path d="M32 5 38 23l19 1-15 11 5 19-15-11-15 11 5-19L7 24l19-1 6-18Z"/>',crisis:'<path d="M32 5 57 51H7L32 5Zm-3 15v18h6V20h-6Zm0 23v6h6v-6h-6Z"/>'};
 return `<svg viewBox="0 0 64 64" aria-hidden="true">${paths[kind]}</svg>`;
}
function installDerived(){
 const grid=document.querySelector('#sheetView .derived-grid'); if(!grid)return; grid.classList.add('aestra-derived-medallions');
 const kinds=['initiative','defence','magic','crisis']; [...grid.querySelectorAll('.derived')].forEach((card,i)=>{
   card.classList.add('aestra-derived-stat');
   if(!card.querySelector('.derived-emblem')){const e=document.createElement('span');e.className='derived-emblem';e.innerHTML=iconSvg(kinds[i]||'magic');card.prepend(e)}
   const label=card.querySelector('label'); if(label){label.classList.add('derived-other-edit'); const input=label.querySelector('input'); if(input){input.setAttribute('title','Other modifier');input.setAttribute('aria-label',`${card.querySelector(':scope>span:not(.derived-emblem)')?.textContent||'Stat'} other modifier`)}}
 });
}
function installIdentity(){
 const card=document.querySelector('#sheetView .identity-card'); if(card)card.classList.add('aestra-identity-polish');
 ['identity','theme','origin'].forEach(id=>document.getElementById(id)?.closest('label')?.classList.add('identity-primary-field'));
}
function installStyles(){
 if(document.getElementById('sheetPolishStyles'))return; const s=document.createElement('style');s.id='sheetPolishStyles';s.textContent=`
 #sheetView{--readable-bg:rgba(10,12,18,.86);--readable-line:rgba(206,169,82,.28)}
 #sheetView>.panel,#sheetView .identity-card{background:linear-gradient(155deg,rgba(17,18,25,.94),rgba(10,11,16,.92))!important}
 #sheetView .section-title{border-bottom:1px solid var(--readable-line);padding-bottom:9px;margin-bottom:12px}
 #sheetView .section-title h3{letter-spacing:.025em}
 .aestra-identity-polish .title-input{font-family:Georgia,serif!important;font-size:clamp(1.8rem,5vw,2.65rem)!important;color:#f1d694!important;border:0!important;border-bottom:1px solid rgba(213,177,91,.3)!important;background:transparent!important;padding-left:0!important}
 .aestra-identity-polish .identity-primary-field{padding:8px 10px;border:1px solid rgba(201,161,75,.22);border-radius:10px;background:rgba(7,9,14,.38)}
 .aestra-identity-polish .identity-primary-field input{border:0!important;background:transparent!important;padding:4px 0!important;color:#eee2c4!important}
 .aestra-derived-medallions{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:10px!important}
 .aestra-derived-stat{position:relative!important;min-height:132px!important;padding:13px 9px 10px!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;gap:3px!important;text-align:center!important;border:1px solid rgba(198,159,73,.34)!important;border-radius:15px!important;background:radial-gradient(circle at 50% 20%,rgba(80,114,151,.13),transparent 45%),rgba(8,10,15,.64)!important;box-shadow:inset 0 0 20px rgba(0,0,0,.22)!important}
 .derived-emblem{width:34px;height:34px;display:grid;place-items:center;border-radius:50%;border:1px solid rgba(218,182,94,.46);background:rgba(12,15,23,.82);margin-bottom:2px}.derived-emblem svg{width:21px;height:21px;fill:#d9bc72;filter:drop-shadow(0 0 4px rgba(122,183,236,.18))}
 .aestra-derived-stat>span:not(.derived-emblem){order:2;font-size:.69rem!important;text-transform:uppercase;letter-spacing:.09em;color:#bcae91!important}.aestra-derived-stat>strong{order:1;font-family:Georgia,serif;font-size:2rem!important;line-height:1;color:#f4e4bb!important}.aestra-derived-stat>.derived-emblem{order:0}.aestra-derived-stat>small{order:3;font-size:.62rem;opacity:.55}
 .derived-other-edit{order:3!important;margin-top:3px!important;font-size:0!important;color:transparent!important}.derived-other-edit:before{content:'MOD';font-size:.56rem;color:#887b66;letter-spacing:.08em}.derived-other-edit input{width:42px!important;height:25px!important;margin-left:5px!important;padding:2px 3px!important;text-align:center!important;font-size:.72rem!important;border-radius:8px!important;background:rgba(0,0,0,.24)!important}
 #sheetView input,#sheetView select,#sheetView textarea{font-size:16px}
 @media(max-width:650px){.aestra-derived-medallions{grid-template-columns:repeat(2,minmax(0,1fr))!important}.aestra-derived-stat{min-height:118px!important}.aestra-derived-stat>strong{font-size:1.8rem!important}}
 `;document.head.appendChild(s)}
installStyles();installIdentity();installDerived();