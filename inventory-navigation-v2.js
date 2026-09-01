// Authoritative tracker page navigation.
(function(){
  if(window.__AESTRA_NAVIGATION__)return;
  window.__AESTRA_NAVIGATION__=true;

  function directPage(pageName){
    const shell=document.getElementById('mobilePageShell');
    const page=shell?.querySelector(`.mobile-page[data-mobile-page="${pageName}"]`);
    if(!shell||!page)return false;
    shell.dataset.activePage=pageName;
    shell.querySelectorAll('.mobile-page').forEach(p=>{
      const on=p===page;
      p.classList.toggle('mobile-page-active',on);
      p.setAttribute('aria-hidden',String(!on));
    });
    document.querySelectorAll('#grandMobileNav button[data-jump]').forEach(b=>{
      const on=b.dataset.jump===pageName;
      b.classList.toggle('active',on);
      b.setAttribute('aria-current',on?'page':'false');
    });
    return true;
  }

  function scrollTarget(pageName){
    if(pageName==='inventory')return document.getElementById('equipmentWorkbench')||document.querySelector('#mobilePageShell .mobile-page[data-mobile-page="inventory"]')||document.getElementById('inventoryEditor')?.closest('article.panel');
    return document.querySelector(`#mobilePageShell .mobile-page[data-mobile-page="${pageName}"]`);
  }

  function go(pageName,{smooth=true}={}){
    const name=String(pageName||'').trim();if(!name)return false;
    const nav=document.querySelector(`#grandMobileNav button[data-jump="${CSS.escape(name)}"]`);
    let handled=false;
    if(nav){
      nav.click();
      handled=true;
    }else handled=directPage(name);

    const target=scrollTarget(name);
    if(target)setTimeout(()=>target.scrollIntoView({behavior:smooth?'smooth':'auto',block:'start'}),40);
    document.dispatchEvent(new CustomEvent('aestra:navigation',{detail:{page:name}}));
    return handled||!!target;
  }

  document.addEventListener('click',e=>{
    const trigger=e.target.closest?.('[data-aestra-nav]');
    if(!trigger)return;
    const page=trigger.dataset.aestraNav;if(!page)return;
    e.preventDefault();e.stopPropagation();
    go(page);
  });

  window.AESTRA_NAV={go};
  window.AESTRA_GO_TO_INVENTORY=()=>go('inventory');
})();
