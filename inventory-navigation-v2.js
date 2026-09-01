// Reliable Build Equipment -> Inventory navigation.
(function(){
  if(window.__AESTRA_INVENTORY_NAV_V2__)return;
  window.__AESTRA_INVENTORY_NAV_V2__=true;

  function goInventory(){
    const nav=document.querySelector('#grandMobileNav button[data-jump="inventory"]');
    const shell=document.getElementById('mobilePageShell');
    const page=shell?.querySelector('.mobile-page[data-mobile-page="inventory"]');

    // Keep the page shell and visible navigation state synchronized directly.
    if(shell&&page){
      shell.dataset.activePage='inventory';
      shell.querySelectorAll('.mobile-page').forEach(p=>{
        const on=p===page;
        p.classList.toggle('mobile-page-active',on);
        p.setAttribute('aria-hidden',String(!on));
      });
      document.querySelectorAll('#grandMobileNav button[data-jump]').forEach(b=>{
        const on=b.dataset.jump==='inventory';
        b.classList.toggle('active',on);
        b.setAttribute('aria-current',on?'page':'false');
      });
    }

    // Also fire the tracker's own navigation handler so any future page-side effects still run.
    if(nav)nav.click();

    const target=document.getElementById('equipmentWorkbench')||page||document.getElementById('inventoryEditor')?.closest('article.panel');
    setTimeout(()=>target?.scrollIntoView({behavior:'smooth',block:'start'}),40);
  }

  function wire(){
    const btn=document.querySelector('.equipment-build-shop-note button');
    if(!btn||btn.dataset.inventoryNavV2==='1')return;
    btn.dataset.inventoryNavV2='1';
    btn.onclick=e=>{e.preventDefault();e.stopPropagation();goInventory()};
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('.equipment-build-shop-note button');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();goInventory();
  },true);

  const body=document.getElementById('buildMenuBody');
  if(body)new MutationObserver(()=>requestAnimationFrame(wire)).observe(body,{childList:true,subtree:true});
  wire();setTimeout(wire,250);setTimeout(wire,900);
  window.AESTRA_GO_TO_INVENTORY=goInventory;
})();
