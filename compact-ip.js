// Compact IP counter: keeps the existing IP state/buttons but presents it as a small tap-to-open control.
function installCompactIp(){
  const card=document.querySelector('.resource-card[data-resource="ip"]');
  if(!card||card.dataset.compactIp==='1') return;
  card.dataset.compactIp='1';
  card.classList.add('compact-ip-card');

  const head=card.querySelector('.resource-head');
  if(!head) return;
  head.classList.add('compact-ip-trigger');
  head.setAttribute('role','button');
  head.setAttribute('tabindex','0');
  head.setAttribute('aria-expanded','false');
  head.setAttribute('aria-label','IP. Tap to reveal plus and minus controls.');

  const hint=document.createElement('small');
  hint.className='compact-ip-hint';
  hint.textContent='tap to adjust';
  head.appendChild(hint);

  const adjust=card.querySelector('.adjust-row.two')||card.querySelector('.adjust-row');
  if(adjust){
    adjust.classList.add('compact-ip-controls');
    [...adjust.querySelectorAll('button')].forEach(btn=>{
      const delta=Number(btn.dataset.delta||0);
      if(delta!==-1&&delta!==1) btn.style.display='none';
      btn.addEventListener('click',e=>e.stopPropagation());
    });
  }

  const setOpen=open=>{
    card.classList.toggle('ip-open',open);
    head.setAttribute('aria-expanded',String(open));
    hint.textContent=open?'tap to close':'tap to adjust';
  };
  const toggle=()=>setOpen(!card.classList.contains('ip-open'));

  head.addEventListener('click',toggle);
  head.addEventListener('keydown',e=>{
    if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}
  });

  // Do not let interactions inside the revealed controls close the card.
  card.querySelectorAll('button,input,select,label').forEach(el=>{
    if(!head.contains(el)) el.addEventListener('click',e=>e.stopPropagation());
  });
}

function installCompactIpStyles(){
  if(document.getElementById('compactIpStyles')) return;
  const s=document.createElement('style');
  s.id='compactIpStyles';
  s.textContent=`
    @media (min-width:761px){
      .resource-grid{grid-template-columns:minmax(0,1fr) minmax(0,1fr) 168px;align-items:stretch}
    }
    .compact-ip-card{
      align-self:start;
      min-height:0;
      padding:0!important;
      overflow:hidden;
      border-color:rgba(190,139,46,.58)!important;
      background:radial-gradient(circle at 50% 18%,rgba(218,165,55,.14),transparent 55%),linear-gradient(145deg,rgba(36,29,16,.98),rgba(13,13,16,.98))!important;
      box-shadow:inset 0 1px rgba(255,255,255,.035),0 0 20px rgba(205,151,46,.08)!important;
    }
    .compact-ip-card:before{inset:5px!important;border-radius:11px!important}
    .compact-ip-trigger{
      min-height:92px;
      padding:15px 14px;
      margin:0;
      display:grid!important;
      grid-template-columns:1fr auto;
      grid-template-areas:'label value' 'hint hint';
      align-items:center!important;
      gap:5px 8px!important;
      cursor:pointer;
      user-select:none;
      position:relative;
      z-index:2;
      transition:background .18s ease,box-shadow .18s ease;
    }
    .compact-ip-trigger:hover{background:rgba(218,165,55,.045)}
    .compact-ip-trigger:focus-visible{outline:none;box-shadow:inset 0 0 0 2px rgba(224,180,82,.65),0 0 16px rgba(218,165,55,.14)}
    .compact-ip-trigger>span:first-child{grid-area:label;font-family:Georgia,serif;font-size:1.2rem!important;color:#e8bf67!important;letter-spacing:.08em;font-weight:700!important}
    .compact-ip-trigger>strong{grid-area:value;font-family:Georgia,serif;font-size:1.15rem;color:#f2d590;white-space:nowrap}
    .compact-ip-hint{grid-area:hint;text-align:center;color:#b99554;opacity:.62;font-size:.64rem;letter-spacing:.08em;text-transform:uppercase}
    .compact-ip-card .formula,
    .compact-ip-card .bar,
    .compact-ip-card .max-label,
    .compact-ip-card input[type="range"],
    .compact-ip-card .resource-slider,
    .compact-ip-card .resource-current-control{display:none!important}
    .compact-ip-controls{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      max-height:0;
      opacity:0;
      overflow:hidden;
      padding:0 12px;
      margin:0;
      transition:max-height .2s ease,opacity .16s ease,padding .2s ease;
    }
    .compact-ip-card.ip-open .compact-ip-controls{max-height:74px;opacity:1;padding:0 12px 12px}
    .compact-ip-controls button{
      min-height:44px!important;
      font-size:1.18rem;
      font-weight:800;
      color:#f0cf86!important;
      background:linear-gradient(180deg,rgba(117,83,25,.42),rgba(41,31,17,.88))!important;
      border-color:rgba(205,154,59,.54)!important;
      box-shadow:inset 0 1px rgba(255,255,255,.04),0 0 10px rgba(202,147,40,.06);
    }
    .compact-ip-card.ip-open{box-shadow:inset 0 1px rgba(255,255,255,.035),0 0 24px rgba(215,160,48,.14)!important}
    @media(max-width:760px){
      .resource-grid{grid-template-columns:1fr 1fr!important;align-items:start}
      .resource-hp,.resource-mp{grid-column:span 1}
      .compact-ip-card{grid-column:1/-1;width:min(170px,48%);justify-self:center}
      .compact-ip-trigger{min-height:78px;padding:11px 12px}
    }
    @media(max-width:520px){
      .resource-grid{grid-template-columns:1fr!important}
      .resource-hp,.resource-mp{grid-column:auto}
      .compact-ip-card{grid-column:auto;width:155px;justify-self:center}
    }
    @media(prefers-reduced-motion:reduce){.compact-ip-controls{transition:none}}
  `;
  document.head.appendChild(s);
}

installCompactIpStyles();
installCompactIp();
