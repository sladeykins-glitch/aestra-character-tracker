// Build 124 — compact responsive header controls.
// Reuses the existing buttons so all current handlers/auth behaviour remain intact.
(function(){
  const $=id=>document.getElementById(id);
  const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
  const ICONS={rules:'▤',create:'＋',search:'⌕'};
  const LABELS={rules:'Rules',create:'Create Character',search:'Search'};
  let scheduled=false;

  function installStyles(){
    if($('compactHeaderStyles'))return;
    const s=document.createElement('style');s.id='compactHeaderStyles';s.textContent=`
      .compact-header-tools{position:relative;display:flex;align-items:center;justify-content:flex-end;gap:6px;flex-wrap:nowrap}
      .cht-role{display:none;align-items:center;justify-content:center;min-width:36px;height:36px;padding:0 8px;border:1px solid rgba(211,171,91,.18);border-radius:999px;background:rgba(12,14,19,.46);font:700 .55rem/1 system-ui,sans-serif;letter-spacing:.08em;color:#c9ae78;white-space:nowrap}
      .cht-btn,.cht-more{display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:7px!important;min-height:40px!important;padding:8px 11px!important;border-radius:11px!important;white-space:nowrap!important}
      .cht-icon{font-size:1rem;line-height:1}.cht-label{font-size:.72rem;line-height:1}
      .cht-btn[data-compact-key="create"]{border-color:rgba(114,190,218,.34)!important;background:linear-gradient(135deg,rgba(40,111,139,.24),rgba(102,77,39,.28))!important;color:#ead9ad!important}
      .cht-more{width:40px!important;min-width:40px!important;padding:0!important;font-size:1.3rem!important;letter-spacing:.04em!important}
      .cht-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:26000;display:none;width:min(250px,calc(100vw - 28px));padding:9px;border:1px solid rgba(211,171,91,.26);border-radius:14px;background:linear-gradient(155deg,rgba(21,19,25,.99),rgba(8,12,17,.99));box-shadow:0 18px 50px rgba(0,0,0,.55)}
      .cht-menu.open{display:block}.cht-account{padding:7px 8px 10px;margin-bottom:7px;border-bottom:1px solid rgba(211,171,91,.12)}.cht-account b{display:block;font-size:.55rem;letter-spacing:.12em;color:#a99061}.cht-account span{display:block;margin-top:3px;font-size:.67rem;color:#a9a096;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .cht-menu #logoutBtn,.cht-menu .cht-signout{display:flex!important;width:100%!important;min-height:42px!important;justify-content:flex-start!important;padding:9px 10px!important;border-radius:10px!important}
      @media(min-width:701px){.compact-header-tools{flex-wrap:wrap}.cht-role{display:none}}
      @media(max-width:700px){
        body.grand-ui .grand-topbar,.topbar.grand-topbar{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:end!important;column-gap:10px!important;row-gap:5px!important;padding-top:5px!important;padding-bottom:7px!important}
        body.grand-ui .grand-topbar>div:first-child,.topbar.grand-topbar>div:first-child{min-width:0}
        body.grand-ui .grand-topbar h1,.topbar.grand-topbar h1{font-size:clamp(1.45rem,7vw,2rem)!important;line-height:.98!important;margin:0!important}
        body.grand-ui .grand-topbar .eyebrow,.topbar.grand-topbar .eyebrow{font-size:.53rem!important;letter-spacing:.15em!important;margin-bottom:4px!important}
        .top-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:5px!important;flex-wrap:nowrap!important;width:auto!important;min-width:0!important}
        .top-actions>#connectionBadge,.top-actions>.badge:not(.aestra-net-badge){display:none!important}
        .compact-header-tools{gap:5px!important;flex-wrap:nowrap!important}
        .cht-role{display:inline-flex!important;min-width:34px!important;width:34px!important;height:34px!important;padding:0!important;font-size:.5rem!important}
        .cht-btn,.cht-more{width:40px!important;min-width:40px!important;height:40px!important;min-height:40px!important;padding:0!important;border-radius:11px!important}
        .cht-label{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important;white-space:nowrap!important}
        .cht-icon{font-size:1.08rem!important}
        .cht-btn[data-compact-key="create"] .cht-icon{font-size:1.35rem!important}
        #aestraNetBadge{display:none!important}
      }
      @media(max-width:430px){
        body.grand-ui .grand-topbar,.topbar.grand-topbar{grid-template-columns:minmax(0,1fr) auto!important;column-gap:6px!important}
        .compact-header-tools{gap:4px!important}.cht-btn,.cht-more{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important}.cht-role{width:31px!important;min-width:31px!important;height:31px!important}
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
    if(!btn||btn.dataset.compactHeaderKey===key)return;
    btn.dataset.compactHeaderKey=key;btn.classList.add('cht-btn');btn.setAttribute('aria-label',LABELS[key]);btn.title=LABELS[key];
    btn.innerHTML=`<span class="cht-icon" aria-hidden="true">${ICONS[key]}</span><span class="cht-label">${LABELS[key]}</span>`;
  }
  function roleFrom(text){const t=norm(text);if(t.startsWith('gm')||t.includes(' gm '))return 'GM';if(t.includes('player'))return 'PLR';return 'ACC'}

  function install(){
    installStyles();
    const top=document.querySelector('.top-actions');if(!top)return;
    let tools=$('compactHeaderTools');
    if(!tools){
      tools=document.createElement('div');tools.id='compactHeaderTools';tools.className='compact-header-tools';tools.setAttribute('aria-label','Quick controls');
      tools.innerHTML='<span id="chtRole" class="cht-role" aria-hidden="true">ACC</span>';
      top.appendChild(tools);
    }
    const candidates=headerCandidates();
    const found={};for(const b of candidates){const k=keyFor(b);if(k&&!found[k])found[k]=b}

    for(const key of ['rules','create','search'])if(found[key]){decorate(found[key],key);tools.appendChild(found[key])}
    if(found.hero){found.hero.hidden=true;found.hero.setAttribute('aria-hidden','true');found.hero.dataset.compactHeaderRetired='true'}

    let more=$('compactHeaderMore');
    let menu=$('compactHeaderMenu');
    if(!more){more=document.createElement('button');more.id='compactHeaderMore';more.type='button';more.className='cht-more';more.setAttribute('aria-label','More account options');more.setAttribute('aria-expanded','false');more.textContent='⋯';tools.appendChild(more)}
    if(!menu){menu=document.createElement('div');menu.id='compactHeaderMenu';menu.className='cht-menu';menu.innerHTML='<div class="cht-account"><b>ACCOUNT</b><span id="chtAccountText">Signed in</span></div>';tools.appendChild(menu)}
    tools.appendChild(more);tools.appendChild(menu);

    const logout=found.logout||$('logoutBtn');
    if(logout&&logout.parentElement!==menu){logout.classList.add('cht-signout');menu.appendChild(logout)}
    const badge=$('connectionBadge');
    const syncAccount=()=>{const text=badge?.textContent?.trim()||'Signed in';const out=$('chtAccountText');if(out)out.textContent=text;const role=$('chtRole');if(role)role.textContent=roleFrom(text);more.title=text};
    syncAccount();
    if(badge&&!badge.dataset.compactHeaderObserved){badge.dataset.compactHeaderObserved='true';new MutationObserver(syncAccount).observe(badge,{childList:true,subtree:true,characterData:true})}

    if(!more.dataset.compactHeaderWired){
      more.dataset.compactHeaderWired='true';
      more.addEventListener('click',e=>{e.stopPropagation();const open=!menu.classList.contains('open');menu.classList.toggle('open',open);more.setAttribute('aria-expanded',String(open))});
      document.addEventListener('click',e=>{if(!tools.contains(e.target)){menu.classList.remove('open');more.setAttribute('aria-expanded','false')}});
      document.addEventListener('keydown',e=>{if(e.key==='Escape'&&menu.classList.contains('open')){menu.classList.remove('open');more.setAttribute('aria-expanded','false');more.focus()}});
    }
  }

  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;install()})}
  function boot(){install();const root=document.querySelector('.topbar')||document.body;new MutationObserver(schedule).observe(root,{childList:true,subtree:true});setTimeout(install,250);setTimeout(install,800)}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.AESTRA_COMPACT_HEADER={refresh:install};
})();
