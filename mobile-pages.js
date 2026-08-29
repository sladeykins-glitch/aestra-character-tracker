// Mobile page switcher for the character sheet. Uses existing DOM nodes and keeps all mechanics/listeners intact.
function installMobilePages(){
  if(document.getElementById('mobilePageShell'))return;
  const sheet=document.getElementById('sheetView');
  const nav=document.getElementById('grandMobileNav');
  if(!sheet||!nav)return;

  const shell=document.createElement('div');
  shell.id='mobilePageShell';
  shell.className='mobile-page-shell';

  const makePage=(key,label)=>{
    const page=document.createElement('section');
    page.className='mobile-page';
    page.dataset.mobilePage=key;
    page.setAttribute('aria-label',label);
    shell.appendChild(page);
    return page;
  };
  const pages={
    sheet:makePage('sheet','Character sheet'),
    build:makePage('build','Build and abilities'),
    inventory:makePage('inventory','Inventory'),
    notes:makePage('notes','Notes')
  };

  const identity=document.querySelector('#sheetView .identity-grid');
  const traits=document.getElementById('traitsEditor')?.closest('article.panel');
  const combat=document.getElementById('combatDashboard');
  const build=document.getElementById('buildMenu');
  const bonds=document.getElementById('bondsEditor')?.closest('article.panel');
  const inventory=document.getElementById('inventoryEditor')?.closest('article.panel');
  const notes=document.getElementById('notes')?.closest('article.panel');
  const anchor=identity||traits||combat||build||inventory||notes;
  if(!anchor){shell.remove();return}
  anchor.before(shell);

  [identity,traits,combat].filter(Boolean).forEach(x=>pages.sheet.appendChild(x));
  [build,bonds].filter(Boolean).forEach(x=>pages.build.appendChild(x));
  if(inventory)pages.inventory.appendChild(inventory);
  if(notes)pages.notes.appendChild(notes);

  let active='sheet';
  const setPage=(key,animate=true)=>{
    if(!pages[key])return;
    active=key;
    shell.dataset.activePage=key;
    Object.entries(pages).forEach(([k,p])=>{
      const on=k===key;
      p.classList.toggle('mobile-page-active',on);
      p.setAttribute('aria-hidden',String(!on));
    });
    nav.querySelectorAll('button[data-jump]').forEach(b=>{
      const on=b.dataset.jump===key;
      b.classList.toggle('active',on);
      b.setAttribute('aria-current',on?'page':'false');
    });
    if(matchMedia('(max-width:700px)').matches){
      if(animate){shell.classList.remove('page-swap');void shell.offsetWidth;shell.classList.add('page-swap')}
      window.scrollTo({top:Math.max(0,shell.getBoundingClientRect().top+window.scrollY-8),behavior:animate?'smooth':'auto'});
    }
  };

  // Replace the previous jump behavior before it can fire by stopping propagation in capture phase.
  nav.addEventListener('click',e=>{
    const b=e.target.closest('button[data-jump]');
    if(!b)return;
    e.preventDefault();
    e.stopImmediatePropagation();
    setPage(b.dataset.jump,true);
  },true);

  const syncMode=()=>{
    const mobile=matchMedia('(max-width:700px)').matches;
    document.body.classList.toggle('mobile-paged-sheet',mobile);
    if(mobile)setPage(active,false);
    else{
      Object.values(pages).forEach(p=>{p.classList.add('mobile-page-active');p.setAttribute('aria-hidden','false')});
      nav.querySelectorAll('button[data-jump]').forEach(b=>b.classList.remove('active'));
    }
  };
  const mq=matchMedia('(max-width:700px)');
  mq.addEventListener?.('change',syncMode);
  setPage('sheet',false);
  syncMode();
}

function installMobilePageStyles(){
  if(document.getElementById('mobilePageStyles'))return;
  const s=document.createElement('style');
  s.id='mobilePageStyles';
  s.textContent=`
  .mobile-page-shell{display:contents}
  .mobile-page{display:contents}
  @media(max-width:700px){
    body.mobile-paged-sheet #sheetView{padding-bottom:92px!important}
    body.mobile-paged-sheet .mobile-page-shell{display:block;position:relative;min-height:calc(100svh - 190px)}
    body.mobile-paged-sheet .mobile-page{display:none!important;min-width:0}
    body.mobile-paged-sheet .mobile-page.mobile-page-active{display:block!important}
    body.mobile-paged-sheet .mobile-page>*{margin-left:0!important;margin-right:0!important}
    body.mobile-paged-sheet .mobile-page[data-mobile-page="sheet"] .grand-character-header{margin-top:0!important}
    body.mobile-paged-sheet .mobile-page[data-mobile-page="build"] #buildMenu,
    body.mobile-paged-sheet .mobile-page[data-mobile-page="inventory"]>article,
    body.mobile-paged-sheet .mobile-page[data-mobile-page="notes"]>article{margin-top:0!important}
    body.mobile-paged-sheet .mobile-page-shell.page-swap .mobile-page-active{animation:mobilePageIn .2s ease both}
    body.mobile-paged-sheet #grandMobileNav button.active{color:#f0d08d!important;background:linear-gradient(180deg,rgba(94,137,180,.18),rgba(191,143,67,.14))!important;box-shadow:inset 0 0 0 1px rgba(216,177,96,.24)!important}
    body.mobile-paged-sheet #grandMobileNav button.active span{transform:translateY(-1px);filter:drop-shadow(0 0 6px rgba(117,189,255,.28))}
    body.mobile-paged-sheet #aestraHero.grand-hero{padding-top:8px!important;padding-bottom:2px!important}
    body.mobile-paged-sheet .grand-topbar{margin-bottom:4px!important}
  }
  @keyframes mobilePageIn{from{opacity:.35;transform:translateX(12px)}to{opacity:1;transform:none}}
  @media(prefers-reduced-motion:reduce){body.mobile-paged-sheet .mobile-page-shell.page-swap .mobile-page-active{animation:none!important}}
  `;
  document.head.appendChild(s);
}

installMobilePageStyles();
installMobilePages();