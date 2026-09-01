// Final UI guard for shared Build library source tabs and Equipment -> Inventory navigation.
(function(){
  if(window.__AESTRA_PICKER_NAV_FIX__)return;
  window.__AESTRA_PICKER_NAV_FIX__=true;

  function tabKey(btn){
    if(!btn)return'';
    if(btn.dataset.ubpTab)return`base:${btn.dataset.ubpTab}`;
    if(btn.hasAttribute('data-ubp-natural'))return'natural';
    if(btn.hasAttribute('data-ubp-techno'))return'techno';
    return'';
  }

  function findTab(key){
    const tabs=document.getElementById('ubpTabs');if(!tabs)return null;
    if(key.startsWith('base:'))return tabs.querySelector(`[data-ubp-tab="${key.slice(5)}"]`);
    if(key==='natural')return tabs.querySelector('[data-ubp-natural]');
    if(key==='techno')return tabs.querySelector('[data-ubp-techno]');
    return null;
  }

  function assertSelected(key){
    const modal=document.getElementById('unifiedBuildPicker');
    if(!modal||modal.classList.contains('hidden'))return;
    const tabs=document.getElementById('ubpTabs'),selected=findTab(key);
    if(!tabs||!selected)return;
    tabs.querySelectorAll('button').forEach(btn=>{
      const on=btn===selected;
      if(btn.classList.contains('active')!==on)btn.classList.toggle('active',on);
      btn.setAttribute('aria-selected',String(on));
    });
  }

  function settleSelected(key){
    assertSelected(key);
    requestAnimationFrame(()=>assertSelected(key));
    [35,90,180,360,650].forEach(ms=>setTimeout(()=>assertSelected(key),ms));
  }

  document.addEventListener('click',e=>{
    const source=e.target.closest?.('#ubpTabs button');
    if(source){
      const key=tabKey(source);
      if(key)settleSelected(key);
      return;
    }

    const inventory=e.target.closest?.('.equipment-build-shop-note button');
    if(!inventory||!/go\s+to\s+inventory/i.test(inventory.textContent||''))return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const nav=document.querySelector('#grandMobileNav button[data-jump="inventory"]');
    if(nav){nav.click();return}

    const page=document.querySelector('#mobilePageShell .mobile-page[data-mobile-page="inventory"]');
    if(page){
      document.querySelectorAll('#mobilePageShell .mobile-page').forEach(p=>{
        const on=p===page;p.classList.toggle('mobile-page-active',on);p.setAttribute('aria-hidden',String(!on));
      });
      const shell=document.getElementById('mobilePageShell');if(shell)shell.dataset.activePage='inventory';
      page.scrollIntoView({behavior:'smooth',block:'start'});
      return;
    }
    document.getElementById('equipmentWorkbench')?.scrollIntoView({behavior:'smooth',block:'start'});
  },true);
})();