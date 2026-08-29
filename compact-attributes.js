// Compact attribute cards with a larger popup editor. Keeps the original selects/rules/state intact.
function setupCompactAttributes(){
  const grid=document.querySelector('#sheetView .attribute-grid');
  if(!grid) return;
  grid.classList.add('compact-attributes');

  let modal=document.getElementById('attributeEditModal');
  if(!modal){
    modal=document.createElement('div');
    modal.id='attributeEditModal';
    modal.className='attribute-modal';
    modal.setAttribute('aria-hidden','true');
    modal.innerHTML=`
      <div class="attribute-modal-backdrop" data-attr-close></div>
      <section class="attribute-modal-card" role="dialog" aria-modal="true" aria-labelledby="attributeModalTitle">
        <button class="attribute-modal-close" type="button" aria-label="Close attribute editor" data-attr-close>×</button>
        <div class="attribute-modal-icon" id="attributeModalIcon"></div>
        <p class="attribute-modal-kicker">ATTRIBUTE</p>
        <h2 id="attributeModalTitle">MIG</h2>
        <p class="attribute-modal-subtitle" id="attributeModalSubtitle">Might</p>
        <div class="attribute-modal-current" id="attributeModalCurrent">d8</div>
        <div class="attribute-modal-fields">
          <label>Base die
            <select id="attributeModalBase"><option>d6</option><option>d8</option><option>d10</option><option>d12</option></select>
          </label>
          <label>Current die
            <select id="attributeModalCurrentSelect"><option>d6</option><option>d8</option><option>d10</option><option>d12</option></select>
          </label>
        </div>
        <p class="attribute-modal-help">Base is your normal die. Current is the die you roll right now after Conditions or other effects.</p>
        <button class="attribute-modal-done" type="button" data-attr-close>Done</button>
      </section>`;
    document.body.appendChild(modal);
  }

  const names={mig:['MIG','Might','✦'],dex:['DEX','Dexterity','◆'],ins:['INS','Insight','◉'],wlp:['WLP','Willpower','✧']};
  let activeCard=null;
  const baseSelect=modal.querySelector('#attributeModalBase');
  const currentSelect=modal.querySelector('#attributeModalCurrentSelect');
  const currentDisplay=modal.querySelector('#attributeModalCurrent');
  const title=modal.querySelector('#attributeModalTitle');
  const subtitle=modal.querySelector('#attributeModalSubtitle');
  const icon=modal.querySelector('#attributeModalIcon');

  const syncModalDisplay=()=>{ currentDisplay.textContent=currentSelect.value||'d6'; };
  const closeModal=()=>{
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.classList.remove('attribute-modal-open');
    activeCard?.focus?.();
    activeCard=null;
  };
  const openModal=card=>{
    activeCard=card;
    const key=card.dataset.attrKey;
    const [short,long,symbol]=names[key]||[key?.toUpperCase()||'ATTRIBUTE','Attribute','✦'];
    const originalBase=card.querySelector('.attr-editor label:first-child select');
    const originalCurrent=card.querySelector('.attr-editor label:last-child select');
    if(!originalBase||!originalCurrent)return;
    title.textContent=short;
    subtitle.textContent=long;
    icon.textContent=symbol;
    modal.dataset.attrTone=key;
    baseSelect.value=originalBase.value;
    currentSelect.value=originalCurrent.value;
    syncModalDisplay();
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.classList.add('attribute-modal-open');
    requestAnimationFrame(()=>baseSelect.focus());
  };

  const pushValue=(which,value)=>{
    if(!activeCard)return;
    const original=which==='base'?activeCard.querySelector('.attr-editor label:first-child select'):activeCard.querySelector('.attr-editor label:last-child select');
    if(!original)return;
    original.value=value;
    original.dispatchEvent(new Event('change',{bubbles:true}));
    original.dispatchEvent(new Event('input',{bubbles:true}));
    syncModalDisplay();
  };
  baseSelect.addEventListener('change',()=>pushValue('base',baseSelect.value));
  currentSelect.addEventListener('change',()=>pushValue('current',currentSelect.value));
  modal.querySelectorAll('[data-attr-close]').forEach(x=>x.addEventListener('click',closeModal));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))closeModal()});

  grid.querySelectorAll('.attr-card').forEach((card,i)=>{
    if(card.dataset.compactReady==='1') return;
    const key=['mig','dex','ins','wlp'][i]||'mig';
    card.dataset.compactReady='1';
    card.dataset.attrKey=key;
    card.classList.add('attr-compact');
    card.tabIndex=0;
    card.setAttribute('role','button');
    card.setAttribute('aria-label',`Edit ${names[key][0]} attribute`);

    const labels=[...card.querySelectorAll('label')];
    if(labels.length){
      const editor=document.createElement('div');
      editor.className='attr-editor';
      labels.forEach(l=>editor.appendChild(l));
      card.appendChild(editor);
    }
    card.addEventListener('click',e=>{if(e.target.closest('select,input,button,label'))return;openModal(card)});
    card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.matches('select,input,button')){e.preventDefault();openModal(card)}});
  });
}

function installCompactAttributeStyles(){
  if(document.getElementById('compactAttributeStyles')) return;
  const style=document.createElement('style');
  style.id='compactAttributeStyles';
  style.textContent=`
  #sheetView .compact-attributes{gap:7px;grid-template-columns:repeat(4,minmax(0,1fr))}
  #sheetView .attr-card.attr-compact{padding:9px 8px 8px;gap:4px;cursor:pointer;min-height:86px;align-content:start;transition:transform .16s ease,border-color .2s ease,box-shadow .2s ease}
  #sheetView .attr-card.attr-compact:hover{transform:translateY(-1px)}
  #sheetView .attr-card.attr-compact>span{font-size:.73rem;letter-spacing:.14em}
  #sheetView .attr-card.attr-compact .die-visual{margin:0;padding:5px 3px;min-height:42px;border-radius:9px}
  #sheetView .attr-card.attr-compact .die-current{font-size:1.18rem}
  #sheetView .attr-card.attr-compact .die-visual small{font-size:.56rem;margin-top:1px}
  #sheetView .attr-card.attr-compact .attribute-effect{height:12px;margin-top:1px;font-size:.58rem}
  #sheetView .attr-card.attr-compact .attr-editor{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip:rect(0 0 0 0)!important;clip-path:inset(50%)!important;white-space:nowrap!important}
  #sheetView .attr-card.attr-compact:after{content:'edit';position:absolute;right:7px;top:7px;font-size:.48rem;letter-spacing:.08em;text-transform:uppercase;color:rgba(215,173,99,.45)}
  body.attribute-modal-open{overflow:hidden}
  .attribute-modal{position:fixed;inset:0;z-index:12000;display:none;place-items:center;padding:18px}
  .attribute-modal.open{display:grid}
  .attribute-modal-backdrop{position:absolute;inset:0;background:rgba(2,3,7,.76);backdrop-filter:blur(7px)}
  .attribute-modal-card{position:relative;width:min(560px,94vw);padding:28px 24px 22px;border:1px solid rgba(213,169,91,.62);border-radius:22px;background:linear-gradient(165deg,rgba(24,22,28,.99),rgba(10,11,16,.99));box-shadow:0 24px 80px rgba(0,0,0,.62),0 0 35px rgba(139,91,180,.08);overflow:hidden;text-align:center}
  .attribute-modal-card:before{content:'';position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle at 50% 0%,rgba(255,255,255,.07),transparent 35%)}
  .attribute-modal-close{position:absolute;right:12px;top:12px;width:42px;height:42px;border-radius:50%!important;padding:0!important;font-size:1.6rem!important;line-height:1!important;background:rgba(255,255,255,.035)!important;border:1px solid rgba(215,173,99,.22)!important;color:#d9c79d!important;z-index:2}
  .attribute-modal-icon{width:76px;height:76px;margin:2px auto 12px;border-radius:50%;display:grid;place-items:center;font-size:2rem;border:1px solid rgba(215,173,99,.32);background:rgba(255,255,255,.025);box-shadow:inset 0 0 20px rgba(255,255,255,.03)}
  .attribute-modal-kicker{margin:0;color:#a99570;font-size:.68rem;letter-spacing:.22em}
  .attribute-modal-card h2{margin:4px 0 1px;font-family:Georgia,serif;font-size:2rem;color:#f1deb4}
  .attribute-modal-subtitle{margin:0 0 15px;color:#918a7d;font-size:.85rem}
  .attribute-modal-current{width:120px;height:78px;margin:0 auto 20px;display:grid;place-items:center;border-radius:16px;font:700 2.1rem/1 Georgia,serif;color:#f1deb4;background:rgba(4,6,10,.52);border:1px solid rgba(215,173,99,.28);box-shadow:inset 0 0 24px rgba(215,173,99,.04)}
  .attribute-modal-fields{display:grid;grid-template-columns:1fr 1fr;gap:12px;text-align:left}
  .attribute-modal-fields label{font-size:.78rem;color:#b4aa98;gap:6px}
  .attribute-modal-fields select{width:100%;min-height:54px;border-radius:12px;font-size:1.05rem;padding:9px 12px;background:#0b0d12;color:#eee0bd;border:1px solid rgba(215,173,99,.3)}
  .attribute-modal-help{margin:14px auto 16px;max-width:430px;font-size:.72rem;line-height:1.45;color:#817a6d}
  .attribute-modal-done{width:100%;min-height:48px;border-radius:12px!important;background:linear-gradient(180deg,#d6aa61,#a87333)!important;border-color:#e8c47f!important;color:#1a1208!important;font-weight:800!important}
  .attribute-modal[data-attr-tone="mig"] .attribute-modal-icon,.attribute-modal[data-attr-tone="mig"] .attribute-modal-current{color:#f0a06b;border-color:rgba(214,126,72,.55);box-shadow:0 0 24px rgba(193,74,38,.12),inset 0 0 22px rgba(193,74,38,.08)}
  .attribute-modal[data-attr-tone="dex"] .attribute-modal-icon,.attribute-modal[data-attr-tone="dex"] .attribute-modal-current{color:#83e0bb;border-color:rgba(92,199,153,.52);box-shadow:0 0 24px rgba(53,150,111,.12),inset 0 0 22px rgba(53,150,111,.08)}
  .attribute-modal[data-attr-tone="ins"] .attribute-modal-icon,.attribute-modal[data-attr-tone="ins"] .attribute-modal-current{color:#8cc9f2;border-color:rgba(88,159,219,.56);box-shadow:0 0 24px rgba(44,111,173,.13),inset 0 0 22px rgba(44,111,173,.08)}
  .attribute-modal[data-attr-tone="wlp"] .attribute-modal-icon,.attribute-modal[data-attr-tone="wlp"] .attribute-modal-current{color:#c495ec;border-color:rgba(165,102,218,.56);box-shadow:0 0 24px rgba(112,61,165,.14),inset 0 0 22px rgba(112,61,165,.08)}
  @media(max-width:760px){#sheetView .compact-attributes{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}#sheetView .attr-card.attr-compact{padding:8px 5px 7px;min-width:0}#sheetView .attr-card.attr-compact>span{font-size:.65rem}#sheetView .attr-card.attr-compact .die-current{font-size:1.08rem}#sheetView .attr-card.attr-compact:after{display:none}}
  @media(max-width:440px){#sheetView .compact-attributes{grid-template-columns:repeat(4,minmax(0,1fr))}#sheetView .attr-card.attr-compact{min-height:78px;padding:7px 4px}#sheetView .attr-card.attr-compact .die-visual{min-height:38px}#sheetView .attr-card.attr-compact .die-current{font-size:1rem}.attribute-modal{padding:12px}.attribute-modal-card{width:96vw;padding:25px 16px 18px}.attribute-modal-fields{grid-template-columns:1fr}.attribute-modal-current{height:68px;margin-bottom:16px}}
  @media(prefers-reduced-motion:reduce){#sheetView .attr-card.attr-compact{transition:none}}
  `;
  document.head.appendChild(style);
}

installCompactAttributeStyles();
setupCompactAttributes();