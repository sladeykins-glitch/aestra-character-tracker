// Shared round counters for Inventory Points and Fabula Points.
function makeSvg(kind){
  const ns='http://www.w3.org/2000/svg'; const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 64 64'); svg.setAttribute('aria-hidden','true'); svg.classList.add('point-orb-art',`point-orb-art-${kind}`);
  svg.innerHTML=kind==='bag'
    ? `<path class="orb-art-shadow" d="M22 15h20l5 9c7 7 10 15 8 24-2 8-10 12-23 12S11 56 9 48c-2-9 1-17 8-24l5-9Z"/><path class="orb-art-main" d="M23 10h18l3 8-5 5H25l-5-5 3-8Zm2 16h14c7 5 11 12 10 20-1 6-7 9-17 9s-16-3-17-9c-1-8 3-15 10-20Zm7 6c-4 0-7 2-7 5 0 2 2 4 5 5v5h4v-5c3-1 5-3 5-6 0-4-3-6-7-6-2 0-3 1-3 2 0 1 1 2 3 2 2 0 3 1 3 2s-1 2-3 2c-3 0-4-1-4-2h-4c0 3 2 5 6 6v5h4v-5c4-1 6-3 6-6 0-4-3-6-8-6Z"/>`
    : `<path class="orb-art-shadow" d="M32 4 52 18l-6 28-14 14-14-14-6-28L32 4Z"/><path class="orb-art-main" d="M32 7 49 19l-5 25-12 12-12-12-5-25L32 7Zm0 7-8 7 4 22 4 6 4-6 4-22-8-7Z"/><path class="orb-art-glint" d="M23 19 31 12l-3 12-8 7 3-12Z"/>`;
  return svg;
}
function buildOrb({card,kind,label,valueEl,minusBtn,plusBtn}){
  if(!card||!valueEl||!minusBtn||!plusBtn||card.dataset.pointOrb==='1')return;
  card.dataset.pointOrb='1'; card.classList.add('point-orb-card',`point-orb-${kind}`);
  const orb=document.createElement('div'); orb.className='point-orb-control'; orb.setAttribute('role','group'); orb.setAttribute('aria-label',`${label} controls`);
  const art=document.createElement('div'); art.className='point-orb-art-wrap'; art.appendChild(makeSvg(kind));
  const title=document.createElement('span'); title.className='point-orb-label'; title.textContent=label;
  const controls=document.createElement('div'); controls.className='point-orb-buttons';
  minusBtn.textContent='−'; plusBtn.textContent='+'; minusBtn.setAttribute('aria-label',`Decrease ${label}`); plusBtn.setAttribute('aria-label',`Increase ${label}`); controls.append(minusBtn,plusBtn);
  const bubble=document.createElement('div'); bubble.className='point-orb-count'; bubble.appendChild(valueEl);
  orb.append(art,title,controls,bubble); card.appendChild(orb);
}
function installPointOrbs(){
  const ipCard=document.querySelector('.resource-card[data-resource="ip"]');
  if(ipCard){
    // Hide every legacy IP display/control; only the orb remains visible.
    ipCard.querySelectorAll('.resource-head,.formula,.bar,.max-label,.direct-resource,.resource-current-control,.resource-slider,input[type="range"]').forEach(el=>el.classList.add('point-orb-legacy-hidden'));
    const adjust=ipCard.querySelector('.adjust-row'); if(adjust)adjust.classList.add('point-orb-legacy-row');
    buildOrb({card:ipCard,kind:'bag',label:'IP',valueEl:document.getElementById('ipNow'),minusBtn:ipCard.querySelector('button[data-delta="-1"]'),plusBtn:ipCard.querySelector('button[data-delta="1"]')});
  }
  const fpText=document.getElementById('fpText'), fpCard=fpText?.closest('article.panel');
  if(fpCard){
    fpCard.classList.add('fabula-point-orb-card'); fpCard.querySelector('.section-title')?.classList.add('point-orb-legacy-hidden'); fpCard.querySelector('.adjust-row')?.classList.add('point-orb-legacy-row');
    buildOrb({card:fpCard,kind:'crystal',label:'Fabula',valueEl:fpText,minusBtn:document.getElementById('fpMinus'),plusBtn:document.getElementById('fpPlus')});
  }
  if(ipCard&&fpCard){
    let row=document.getElementById('pointOrbPair');
    if(!row){
      row=document.createElement('section'); row.id='pointOrbPair'; row.className='point-orb-pair';
      const resourceGrid=document.querySelector('#sheetView .resource-grid'); resourceGrid?.insertAdjacentElement('afterend',row);
    }
    // Always enforce order and ownership so old grid styles cannot separate the pair.
    row.replaceChildren(ipCard,fpCard);
  }
}
function installPointOrbStyles(){
  if(document.getElementById('pointOrbStyles'))return; const s=document.createElement('style'); s.id='pointOrbStyles';
  s.textContent=`
  #pointOrbPair.point-orb-pair{display:grid!important;grid-template-columns:repeat(2,158px)!important;justify-content:center!important;align-items:start!important;column-gap:24px!important;row-gap:0!important;width:100%!important;min-height:172px!important;margin:12px 0 18px!important;padding:0!important;position:relative!important;overflow:visible!important}
  #pointOrbPair>.point-orb-card{position:relative!important;inset:auto!important;transform:none!important;float:none!important;grid-column:auto!important;grid-row:auto!important;align-self:start!important;justify-self:center!important;flex:none!important;width:158px!important;height:158px!important;min-width:158px!important;min-height:158px!important;max-width:158px!important;padding:0!important;margin:0!important;border:0!important;background:transparent!important;box-shadow:none!important;overflow:visible!important}
  .point-orb-card:before,.point-orb-card:after{display:none!important}.point-orb-legacy-hidden,.point-orb-card>.compact-ip-controls{display:none!important}.point-orb-legacy-row{display:contents!important;margin:0!important;padding:0!important;max-height:none!important;opacity:1!important}
  .point-orb-control{width:142px;height:142px;position:relative;margin:6px auto;display:grid;place-items:center;border-radius:50%;background:radial-gradient(circle at 48% 34%,rgba(255,255,255,.07),transparent 35%),radial-gradient(circle,rgba(15,17,24,.96) 54%,rgba(7,9,13,.98) 72%);border:2px solid rgba(213,181,104,.58);box-shadow:inset 0 0 0 5px rgba(255,255,255,.018),inset 0 0 28px rgba(70,100,130,.12),0 6px 20px rgba(0,0,0,.38)}
  .point-orb-art-wrap{position:absolute;inset:18px 26px 34px;display:grid;place-items:center;pointer-events:none}.point-orb-art{width:72px;height:72px;filter:drop-shadow(0 0 8px rgba(138,203,255,.26))}.orb-art-shadow{fill:rgba(0,0,0,.3)}.orb-art-main{fill:#b8d7e7;stroke:#e8d291;stroke-width:1}.orb-art-glint{fill:rgba(255,255,255,.58)}.point-orb-bag .orb-art-main{fill:#bca474;stroke:#e0c77d}.point-orb-crystal .orb-art-main{fill:#8ecbf3;stroke:#ddc87d}
  .point-orb-label{position:absolute;top:9px;left:0;right:0;text-align:center;font-family:Georgia,serif;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#e2c77f;z-index:3}
  .point-orb-buttons{position:absolute;left:20px;right:20px;bottom:12px;display:flex;justify-content:space-between;z-index:4;pointer-events:none}.point-orb-buttons button{pointer-events:auto!important;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;padding:0!important;display:grid!important;place-items:center!important;border-radius:50%!important;font-size:1.42rem!important;color:#f2dfad!important;background:rgba(25,27,34,.96)!important;border:1px solid rgba(220,188,105,.65)!important}
  .point-orb-count{position:absolute;right:-7px;top:18px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;z-index:6;background:rgba(18,20,28,.98);border:2px solid rgba(220,187,99,.72);font-family:Georgia,serif;font-weight:800;color:#fff0bd;font-size:1rem}.point-orb-crystal .point-orb-count{border-color:rgba(118,194,246,.82);box-shadow:0 0 14px rgba(83,173,239,.24)}
  .resource-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr)!important}
  @media(max-width:520px){#pointOrbPair.point-orb-pair{grid-template-columns:repeat(2,145px)!important;column-gap:8px!important;min-height:160px!important}#pointOrbPair>.point-orb-card{width:145px!important;height:145px!important;min-width:145px!important;min-height:145px!important;max-width:145px!important}.point-orb-control{width:132px;height:132px}.point-orb-buttons{left:16px;right:16px}.point-orb-count{width:42px;height:42px}}
  @media(max-width:340px){#pointOrbPair.point-orb-pair{grid-template-columns:repeat(2,136px)!important;column-gap:4px!important}#pointOrbPair>.point-orb-card{width:136px!important;min-width:136px!important;max-width:136px!important}.point-orb-control{width:124px;height:124px}.point-orb-art{width:62px;height:62px}}
  `; document.head.appendChild(s);
}
installPointOrbStyles();installPointOrbs();