// Shared compact counters for Inventory Points and Fabula Points.
// Reuses the existing + / - buttons and live counter spans so core state/save logic stays untouched.
function makeSvg(kind){
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 64 64');
  svg.setAttribute('aria-hidden','true');
  svg.classList.add('point-orb-art',`point-orb-art-${kind}`);
  if(kind==='bag'){
    svg.innerHTML=`<path class="orb-art-shadow" d="M22 15h20l5 9c7 7 10 15 8 24-2 8-10 12-23 12S11 56 9 48c-2-9 1-17 8-24l5-9Z"/><path class="orb-art-main" d="M23 10h18l3 8-5 5H25l-5-5 3-8Zm2 16h14c7 5 11 12 10 20-1 6-7 9-17 9s-16-3-17-9c-1-8 3-15 10-20Zm7 6c-4 0-7 2-7 5 0 2 2 4 5 5v5h4v-5c3-1 5-3 5-6 0-4-3-6-7-6-2 0-3 1-3 2 0 1 1 2 3 2 2 0 3 1 3 2s-1 2-3 2c-3 0-4-1-4-2h-4c0 3 2 5 6 6v5h4v-5c4-1 6-3 6-6 0-4-3-6-8-6Z"/>`;
  }else{
    svg.innerHTML=`<path class="orb-art-shadow" d="M32 4 52 18l-6 28-14 14-14-14-6-28L32 4Z"/><path class="orb-art-main" d="M32 7 49 19l-5 25-12 12-12-12-5-25L32 7Zm0 7-8 7 4 22 4 6 4-6 4-22-8-7Z"/><path class="orb-art-glint" d="M23 19 31 12l-3 12-8 7 3-12Z"/>`;
  }
  return svg;
}

function buildOrb({card,kind,label,valueEl,minusBtn,plusBtn}){
  if(!card||!valueEl||!minusBtn||!plusBtn||card.dataset.pointOrb==='1')return;
  card.dataset.pointOrb='1';
  card.classList.add('point-orb-card',`point-orb-${kind}`);

  const orb=document.createElement('div');
  orb.className='point-orb-control';
  orb.setAttribute('role','group');
  orb.setAttribute('aria-label',`${label} controls`);

  const art=document.createElement('div');
  art.className='point-orb-art-wrap';
  art.appendChild(makeSvg(kind));

  const title=document.createElement('span');
  title.className='point-orb-label';
  title.textContent=label;

  const controls=document.createElement('div');
  controls.className='point-orb-buttons';
  minusBtn.classList.add('point-orb-minus');
  plusBtn.classList.add('point-orb-plus');
  minusBtn.textContent='−';
  plusBtn.textContent='+';
  minusBtn.setAttribute('aria-label',`Decrease ${label}`);
  plusBtn.setAttribute('aria-label',`Increase ${label}`);
  controls.append(minusBtn,plusBtn);

  const bubble=document.createElement('div');
  bubble.className='point-orb-count';
  bubble.setAttribute('aria-label',`Current ${label}`);
  bubble.appendChild(valueEl);

  orb.append(art,title,controls,bubble);
  card.appendChild(orb);
}

function installPointOrbs(){
  const ipCard=document.querySelector('.resource-card[data-resource="ip"]');
  const ipMinus=ipCard?.querySelector('button[data-delta="-1"]');
  const ipPlus=ipCard?.querySelector('button[data-delta="1"]');
  const ipNow=document.getElementById('ipNow');
  if(ipCard){
    // Hide legacy compact-IP presentation; the existing buttons are moved into the orb below.
    ipCard.querySelector('.resource-head')?.classList.add('point-orb-legacy-hidden');
    ipCard.querySelector('.formula')?.classList.add('point-orb-legacy-hidden');
    ipCard.querySelector('.bar')?.classList.add('point-orb-legacy-hidden');
    ipCard.querySelector('.max-label')?.classList.add('point-orb-legacy-hidden');
    const adjust=ipCard.querySelector('.adjust-row');
    if(adjust)adjust.classList.add('point-orb-legacy-row');
    buildOrb({card:ipCard,kind:'bag',label:'IP',valueEl:ipNow,minusBtn:ipMinus,plusBtn:ipPlus});
  }

  const fpText=document.getElementById('fpText');
  const fpMinus=document.getElementById('fpMinus');
  const fpPlus=document.getElementById('fpPlus');
  const fpCard=fpText?.closest('article.panel');
  if(fpCard){
    fpCard.classList.add('fabula-point-orb-card');
    fpCard.querySelector('.section-title')?.classList.add('point-orb-legacy-hidden');
    fpCard.querySelector('.adjust-row')?.classList.add('point-orb-legacy-row');
    buildOrb({card:fpCard,kind:'crystal',label:'Fabula',valueEl:fpText,minusBtn:fpMinus,plusBtn:fpPlus});
  }
}

function installPointOrbStyles(){
  if(document.getElementById('pointOrbStyles'))return;
  const style=document.createElement('style');
  style.id='pointOrbStyles';
  style.textContent=`
    .point-orb-card{
      width:158px!important;height:158px!important;min-width:158px!important;min-height:158px!important;
      padding:0!important;margin:0 auto!important;border:0!important;background:transparent!important;
      box-shadow:none!important;overflow:visible!important;align-self:start!important;justify-self:center!important;
    }
    .point-orb-card:before,.point-orb-card:after{display:none!important}
    .point-orb-legacy-hidden,.point-orb-card>.compact-ip-controls{display:none!important}
    .point-orb-legacy-row{display:contents!important;margin:0!important;padding:0!important;max-height:none!important;opacity:1!important;overflow:visible!important}
    .point-orb-control{
      width:142px;height:142px;position:relative;margin:6px auto;display:grid;place-items:center;
      border-radius:50%;isolation:isolate;
      background:radial-gradient(circle at 48% 34%,rgba(255,255,255,.07),transparent 35%),radial-gradient(circle,rgba(15,17,24,.96) 54%,rgba(7,9,13,.98) 72%);
      border:2px solid rgba(213,181,104,.58);
      box-shadow:inset 0 0 0 5px rgba(255,255,255,.018),inset 0 0 28px rgba(70,100,130,.12),0 6px 20px rgba(0,0,0,.38),0 0 16px rgba(117,181,237,.08);
    }
    .point-orb-art-wrap{position:absolute;inset:18px 26px 34px;display:grid;place-items:center;pointer-events:none;z-index:1}
    .point-orb-art{width:72px;height:72px;overflow:visible;filter:drop-shadow(0 0 8px rgba(138,203,255,.26))}
    .orb-art-shadow{fill:rgba(0,0,0,.30)}
    .orb-art-main{fill:#b8d7e7;stroke:rgba(232,210,145,.72);stroke-width:1}
    .orb-art-glint{fill:rgba(255,255,255,.58)}
    .point-orb-bag .orb-art-main{fill:#bca474;stroke:#e0c77d}
    .point-orb-bag .point-orb-art{filter:drop-shadow(0 0 7px rgba(214,176,91,.24))}
    .point-orb-crystal .orb-art-main{fill:#8ecbf3;stroke:#ddc87d}
    .point-orb-crystal .point-orb-art{filter:drop-shadow(0 0 10px rgba(91,180,255,.45))}
    .point-orb-label{position:absolute;top:9px;left:0;right:0;text-align:center;font-family:Georgia,serif;font-size:.68rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#e2c77f;z-index:3;text-shadow:0 1px 3px #000}
    .point-orb-buttons{position:absolute;left:20px;right:20px;bottom:12px;display:flex;justify-content:space-between;align-items:center;z-index:4;pointer-events:none}
    .point-orb-buttons button{
      pointer-events:auto!important;width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;padding:0!important;
      display:grid!important;place-items:center!important;border-radius:50%!important;font-size:1.42rem!important;font-weight:500!important;line-height:1!important;
      color:#f2dfad!important;background:radial-gradient(circle at 40% 30%,rgba(255,255,255,.12),rgba(31,32,38,.96) 68%)!important;
      border:1px solid rgba(220,188,105,.65)!important;box-shadow:inset 0 0 9px rgba(255,255,255,.025),0 2px 7px rgba(0,0,0,.38)!important;
    }
    .point-orb-buttons button:hover{transform:translateY(-1px);border-color:rgba(243,213,133,.9)!important;box-shadow:0 0 11px rgba(221,185,93,.18)!important}
    .point-orb-buttons button:active{transform:translateY(1px)}
    .point-orb-count{
      position:absolute;right:-7px;top:18px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;z-index:6;
      background:radial-gradient(circle at 38% 30%,rgba(255,255,255,.13),rgba(18,20,28,.98) 66%);
      border:2px solid rgba(220,187,99,.72);box-shadow:0 4px 10px rgba(0,0,0,.42),0 0 12px rgba(105,180,245,.13);
      font-family:Georgia,serif;font-weight:800;color:#fff0bd;font-size:1rem;
    }
    .point-orb-count #ipNow,.point-orb-count #fpText{font-size:1rem!important;color:inherit!important;line-height:1!important}
    .point-orb-bag .point-orb-count{border-color:rgba(205,166,78,.78);box-shadow:0 4px 10px rgba(0,0,0,.42),0 0 10px rgba(202,153,56,.11)}
    .point-orb-crystal .point-orb-count{border-color:rgba(118,194,246,.82);box-shadow:0 4px 10px rgba(0,0,0,.42),0 0 14px rgba(83,173,239,.24)}

    /* Keep IP and Fabula counters visually identical in footprint despite living in different grids. */
    .details-grid>.fabula-point-orb-card{width:158px!important;height:158px!important;justify-self:center!important;align-self:start!important}
    @media(min-width:761px){.resource-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 174px!important}}
    @media(max-width:760px){
      .point-orb-card{width:150px!important;height:150px!important;min-width:150px!important;min-height:150px!important}
      .point-orb-control{width:136px;height:136px}
      .resource-grid .point-orb-card{grid-column:1/-1!important;width:150px!important}
      .details-grid>.fabula-point-orb-card{width:150px!important;height:150px!important}
    }
    @media(prefers-reduced-motion:reduce){.point-orb-buttons button{transition:none!important}}
  `;
  document.head.appendChild(style);
}

installPointOrbStyles();
installPointOrbs();
