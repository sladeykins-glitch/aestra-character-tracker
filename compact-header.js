// Build 125 — mobile-first compact header controls.
// Reuses the existing buttons so current handlers/auth behaviour remain intact.
(function(){
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const mobile=window.matchMedia('(max-width:700px)');
  const ICONS={rules:'▤',create:'＋',search:'⌕'};
  const LABELS={rules:'Rules',create:'Create Character',search:'Search'};
  let scheduled=false;

  function installStyles(){
    if($('compactHeaderStyles'))return;
    const s=document.createElement('style');s.id='compactHeaderStyles';s.textContent=`
      .compact-header-tools{position:relative;display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:nowrap}
      .cht-btn,.cht-more{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:40px!important;padding:8px 11px!important;border-radius:11px!important;white-space:nowrap!important}
      .cht-icon{font-size:1rem;line-height:1}.cht-label{font-size:.72rem;line-height:1}
      .cht-btn[data-compact-key="create"]{border-color:rgba(114,190,218,.34)!important;background:linear-gradient(135deg,rgba(40,111,139,.24),rgba(102,77,39,.28))!important;color:#ead9ad!important}
      .cht-more{width:40px!important;min-width:40px!important;padding:0!important;font-size:1.3rem!important;letter-spacing:.04em!important}
      .cht-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:26000;display:none;width:min(260px,calc(100vw - 24px));padding:9px;border:1px solid rgba(211,171,91,.26);border-radius:14px;background:linear-gradient(155deg,rgba(21,19,25,.99),rgba(8,12,17,.99));box-shadow:0 18px 50px rgba(0,0,0,.55)}
      .cht-menu.open{display:block}.cht-account{padding:7px 8px 10px;margin-bottom:7px;border-bottom:1px solid rgba(211,171,91,.12)}.cht-account b{display:block;font-size:.55rem;letter-spacing:.12em;color:#a99061}.cht-account span{display:block;margin-top:3px;font-size:.67rem;color:#a9a096;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cht-menu #logoutBtn,.cht-menu .cht-signout,.cht-menu .cht-btn{display:flex!important;width:100%!important;min-height:42px!important;justify-content:flex-start!important;padding:9px 10px!important;border-radius:10px!important;margin:2px 0!important}
      .cht-menu .cht-btn .cht-label{position:static!important;width:auto!important;height:auto!important;overflow:visible!important;clip-path:none!important;white-space:nowrap!important}
      @media(max-width:700px){
        body.grand-ui #aestraHero.aestra-hero-v2,#aestraHero.aestra-hero-v2{min-height:102px!important;padding-top:0!important;padding-bottom:0!important;margin-bottom:0!important}
        #aestraHero.aestra-hero-v2 .aestra-wordmark{font-size:clamp(2.35rem,12vw,3.25rem)!important;letter-spacing:.035em!important;line-height:.88!important}
        #aestraHero.aestra-hero-v2 .aestra-wordmark:after{letter-spacing:.035em!important}
        #aestraHero.aestra-hero-v2 .aestra-emblem{transform:scale(.58)!important;margin-bottom:-7px!important}
        #aestraHero.aestra-hero-v2 .aestra-subtitle,#aestraHero .aestra-crest-ring,#aestraHero .hero-crystals{display:none!important}
        #aestraHero.aestra-hero-v2 .hero-arc-a{width:68vw!important;height:92px!important;top:10px!important;opacity:.65!important}
        #aestraHero.aestra-hero-v2 .hero-arc-b{width:88vw!important;height:118px!important;top:-8px!important;opacity:.45!important}

        body.grand-ui .grand-topbar,.topbar.grand-topbar{display:flex!important;align-items:center!important;justify-content:flex-end!important;padding:0 0 8px!important;min-height:0!important;margin:0!important}
        body.grand-ui .grand-topbar>div:first-child,.topbar.grand-topbar>div:first-child{display:none!important}
        .top-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:4px!important;flex-wrap:nowrap!important;width:100%!important;min-width:0!important;margin:0!important}
        .top-actions>#connectionBadge,.top-actions>.badge,#aestraNetBadge{display:none!important}
        .compact-header-tools{gap:4px!important;flex-wrap:nowrap!important;padding:3px!important;border:1px solid rgba(211,171,91,.13)!important;border-radius:13px!important;background:rgba(7,10,15,.34)!important}
        .compact-header-tools>.cht-btn,.compact-header-tools>.cht-more{width:37px!important;min-width:37px!important;height:37px!important;min-height:37px!important;padding:0!important;border-radius:10px!important}
        .compact-header-tools>.cht-btn .cht-label{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}
        .cht-icon{font-size:1.03rem!important}.cht-more{font-size:1.15rem!important}

        #appView>.tabs,.tabs{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;margin:0 0 10px!important;padding:4px!important;border:1px solid rgba(211,171,91,.13)!important;border-radius:14px!important;background:rgba(7,9,13,.42)!important}
        #appView>.tabs button,.tabs button{min-height:42px!important;padding:7px 5px!important;border-radius:10px!important;font-size:.68rem!important;line-height:1.05!important;white-space:nowrap!important}
        #appView>.tabs button.active,.tabs button.active{box-shadow:none!important}

        #sheetView{margin-top:0!important}
      }
      @media(max-width:430px){
        body.grand-ui #aestraHero.aestra-hero-v2,#aestraHero.aestra-hero-v2{min-height:92px!important}
        #aestraHero.aestra-hero-v2 .aestra-wordmark{font-size:clamp(2.15rem,11.6vw,2.9rem)!important}
        .compact-header-tools>.cht-btn,.compact-header-tools>.cht-more{width:35px!important;min-width:35px!important;height:35px!important;min-height:35px!important}
        #appView>.tabs button,.tabs button{font-size:.64rem!important;padding-left:3px!important;padding-right:3px!important}
      }
    `;document.head.appendChild(s);
  }

  function headerCandidates(){
    const set=new Set();
    document.querySelectorAll('.top-actions button,#aestraHero button,.topbar button,.grand-topbar button').forEach(b=>{
      if(b.closest('.tabs,#grandMobileNav,.aestra-update-banner,#heroConsoleModal,.asu-modal,.asu-session'))return;
      set.add(b);
    });
    return [...set];
  }
  function keyFor(btn){
    const t=norm(`${btn.textContent||''} ${btn.getAttribute('aria-label')||''} ${btn.title||''}`);
    if(btn.id==='logoutBtn'||t.includes('sign out'))return 'logout';
    if(t.includes('create character'))return 'create';
    if(t==='rules'||t.includes(' rules'))return 'rules';
    if(t==='search'||t.includes(' search'))return 'search';
    if(t.includes('hero console'))return 'hero';
    return '';
  }
  function decorate(btn,key){
    if(!btn)return;
    btn.dataset.compactHeaderKey=key;btn.classList.add('cht-btn');btn.setAttribute('aria-label',LABELS[key]);btn.title=LABELS[key];
    if(!btn.querySelector('.cht-icon'))btn.innerHTML=`<span class="cht-icon" aria-hidden="true">${ICONS[key]}</span><span class="cht-label">${LABELS[key]}</span>`;
  }
  function setText(el,text){if(el&&el.textContent.trim()!==text)el.textContent=text}
  function syncNavLabels(){
    const isMobile=mobile.matches;
    const sheet=document.querySelector('.tabs [data-view="sheet"]');if(sheet)setText(sheet,'Play');
    const gm=document.querySelector('.tabs [data-view="gm"]');if(gm)setText(gm,isMobile?'GM':'GM Dashboard');
    const hero=[...document.querySelectorAll('.tabs button')].find(b=>b.dataset.openHeroConsole!==undefined||norm(b.textContent).includes('hero console')||norm(b.getAttribute('aria-label')).includes('hero console'));
    if(hero)setText(hero,isMobile?'Console':'Hero Console');
    const play=document.querySelector('#grandMobileNav [data-jump="sheet"]');
    if(play){const icon=play.querySelector('span')?.outerHTML||'<span>◇</span>';const wanted=`${icon}Play`;if(play.innerHTML!==wanted)play.innerHTML=wanted}
  }

  function install(){
    installStyles();syncNavLabels();
    const top=document.querySelector('.top-actions');if(!top)return;
    let tools=$('compactHeaderTools');
    if(!tools){tools=document.createElement('div');tools.id='compactHeaderTools';tools.className='compact-header-tools';tools.setAttribute('aria-label','Quick controls');top.appendChild(tools)}
    let more=$('compactHeaderMore');if(!more){more=document.createElement('button');more.id='compactHeaderMore';more.type='button';more.className='cht-more';more.setAttribute('aria-label','More account options');more.setAttribute('aria-expanded','false');more.textContent='⋯'}
    let menu=$('compactHeaderMenu');if(!menu){menu=document.createElement('div');menu.id='compactHeaderMenu';menu.className='cht-menu';menu.innerHTML='<div class="cht-account"><b>ACCOUNT</b><span id="chtAccountText">Signed in</span></div>'}
    if(!tools.contains(more))tools.appendChild(more);if(!tools.contains(menu))tools.appendChild(menu);

    const found={};for(const b of headerCandidates()){const k=keyFor(b);if(k&&!found[k])found[k]=b}
    for(const key of ['rules','create','search'])if(found[key])decorate(found[key],key);
    if(found.hero){found.hero.hidden=true;found.hero.setAttribute('aria-hidden','true');found.hero.dataset.compactHeaderRetired='true'}

    if(found.rules)tools.insertBefore(found.rules,more);
    if(found.search)tools.insertBefore(found.search,more);
    if(found.create){
      if(mobile.matches){const account=menu.querySelector('.cht-account');account?.after(found.create)}
      else tools.insertBefore(found.create,found.search||more);
    }
    const logout=found.logout||$('logoutBtn');if(logout&&logout.parentElement!==menu){logout.classList.add('cht-signout');menu.appendChild(logout)}

    const badge=$('connectionBadge');
    const syncAccount=()=>{const text=badge?.textContent?.trim()||'Signed in';const out=$('chtAccountText');if(out)out.textContent=text;more.title=text};syncAccount();
    if(badge&&!badge.dataset.compactHeaderObserved){badge.dataset.compactHeaderObserved='true';new MutationObserver(syncAccount).observe(badge,{childList:true,subtree:true,characterData:true})}

    if(!more.dataset.compactHeaderWired){
      more.dataset.compactHeaderWired='true';
      more.addEventListener('click',e=>{e.stopPropagation();const open=!menu.classList.contains('open');menu.classList.toggle('open',open);more.setAttribute('aria-expanded',String(open))});
      document.addEventListener('click',e=>{if(!tools.contains(e.target)){menu.classList.remove('open');more.setAttribute('aria-expanded','false')}});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');more.setAttribute('aria-expanded','false');more.focus()}});
    }
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;install()})}
  function boot(){install();const root=document.querySelector('.topbar')||document.body;new MutationObserver(schedule).observe(root,{childList:true,subtree:true});document.querySelector('.tabs')&&new MutationObserver(()=>requestAnimationFrame(syncNavLabels)).observe(document.querySelector('.tabs'),{childList:true,subtree:true});mobile.addEventListener?.('change',install);setTimeout(install,250);setTimeout(install,800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AESTRA_COMPACT_HEADER={refresh:install};
})();
