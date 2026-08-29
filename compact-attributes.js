// Compact tap-to-edit attribute cards. Keeps existing selects/rules intact.
function setupCompactAttributes(){
  const grid=document.querySelector('#sheetView .attribute-grid');
  if(!grid) return;
  grid.classList.add('compact-attributes');

  grid.querySelectorAll('.attr-card').forEach(card=>{
    if(card.dataset.compactReady==='1') return;
    card.dataset.compactReady='1';
    card.classList.add('attr-compact');
    card.tabIndex=0;
    card.setAttribute('role','button');
    card.setAttribute('aria-expanded','false');

    const labels=[...card.querySelectorAll('label')];
    if(labels.length){
      const editor=document.createElement('div');
      editor.className='attr-editor';
      labels.forEach(l=>editor.appendChild(l));
      card.appendChild(editor);
    }

    const toggle=()=>{
      const open=!card.classList.contains('attr-open');
      grid.querySelectorAll('.attr-card.attr-open').forEach(other=>{
        if(other!==card){other.classList.remove('attr-open');other.setAttribute('aria-expanded','false')}
      });
      card.classList.toggle('attr-open',open);
      card.setAttribute('aria-expanded',String(open));
    };

    card.addEventListener('click',e=>{
      if(e.target.closest('select,input,button,label')) return;
      toggle();
    });
    card.addEventListener('keydown',e=>{
      if((e.key==='Enter'||e.key===' ')&&!e.target.matches('select,input,button')){e.preventDefault();toggle()}
    });
  });
}

function installCompactAttributeStyles(){
  if(document.getElementById('compactAttributeStyles')) return;
  const style=document.createElement('style');
  style.id='compactAttributeStyles';
  style.textContent=`
  #sheetView .compact-attributes{gap:7px;grid-template-columns:repeat(4,minmax(0,1fr))}
  #sheetView .attr-card.attr-compact{padding:9px 8px 8px;gap:4px;cursor:pointer;min-height:86px;align-content:start;transition:min-height .22s ease,transform .16s ease,border-color .2s ease,box-shadow .2s ease}
  #sheetView .attr-card.attr-compact:hover{transform:translateY(-1px)}
  #sheetView .attr-card.attr-compact>span{font-size:.73rem;letter-spacing:.14em}
  #sheetView .attr-card.attr-compact .die-visual{margin:0;padding:5px 3px;min-height:42px;border-radius:9px}
  #sheetView .attr-card.attr-compact .die-current{font-size:1.18rem}
  #sheetView .attr-card.attr-compact .die-visual small{font-size:.56rem;margin-top:1px}
  #sheetView .attr-card.attr-compact .attribute-effect{height:12px;margin-top:1px;font-size:.58rem}
  #sheetView .attr-card.attr-compact .attr-editor{display:grid;grid-template-rows:0fr;opacity:0;transition:grid-template-rows .22s ease,opacity .18s ease;margin-top:0;pointer-events:none}
  #sheetView .attr-card.attr-compact .attr-editor>label{overflow:hidden;min-height:0}
  #sheetView .attr-card.attr-compact .attr-editor>label+label{margin-top:5px}
  #sheetView .attr-card.attr-compact.attr-open{min-height:178px;border-color:rgba(215,173,99,.72);box-shadow:0 0 20px rgba(130,89,173,.10),inset 0 0 18px rgba(215,173,99,.04)}
  #sheetView .attr-card.attr-compact.attr-open .attr-editor{grid-template-rows:1fr;opacity:1;margin-top:5px;pointer-events:auto}
  #sheetView .attr-card.attr-compact.attr-open .attr-editor>label{overflow:visible}
  #sheetView .attr-card.attr-compact .attr-editor label{font-size:.68rem;gap:3px}
  #sheetView .attr-card.attr-compact .attr-editor select{min-height:34px;padding:5px 7px;border-radius:8px;font-size:.82rem}
  #sheetView .attr-card.attr-compact:after{content:'tap';position:absolute;right:7px;top:7px;font-size:.48rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(215,173,99,.45)}
  #sheetView .attr-card.attr-compact.attr-open:after{content:'edit'}
  @media(max-width:760px){#sheetView .compact-attributes{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}#sheetView .attr-card.attr-compact{padding:8px 5px 7px;min-width:0}#sheetView .attr-card.attr-compact>span{font-size:.65rem}#sheetView .attr-card.attr-compact .die-current{font-size:1.08rem}#sheetView .attr-card.attr-compact:after{display:none}}
  @media(max-width:440px){#sheetView .compact-attributes{grid-template-columns:repeat(4,minmax(0,1fr))}#sheetView .attr-card.attr-compact{min-height:78px;padding:7px 4px}#sheetView .attr-card.attr-compact.attr-open{grid-column:span 2;min-height:166px}#sheetView .attr-card.attr-compact .die-visual{min-height:38px}#sheetView .attr-card.attr-compact .die-current{font-size:1rem}}
  @media(prefers-reduced-motion:reduce){#sheetView .attr-card.attr-compact,#sheetView .attr-card.attr-compact .attr-editor{transition:none}}
  `;
  document.head.appendChild(style);
}

installCompactAttributeStyles();
setupCompactAttributes();
