// Inventory-side equipment shop. Core equipment is purchased here, then enters the equipment loadout.
(function(){
  let decorating=false;
  let walletFlashTimer=null;

  const zenitInput=()=>document.getElementById('zenit');
  const zenit=()=>Math.max(0,Number(zenitInput()?.value)||0);
  const fire=(el,type='input')=>el?.dispatchEvent(new Event(type,{bubbles:true}));

  function setZenit(value){
    const el=zenitInput();if(!el)return false;
    el.value=String(Math.max(0,Math.floor(Number(value)||0)));
    fire(el,'input');fire(el,'change');
    document.dispatchEvent(new CustomEvent('aestra:zenit-changed',{detail:{zenit:Number(el.value)||0}}));
    return true;
  }

  function toast(text){
    let t=document.getElementById('equipmentPurchaseToast');
    if(!t){t=document.createElement('div');t.id='equipmentPurchaseToast';t.className='equipment-purchase-toast';document.body.appendChild(t)}
    t.textContent=text;t.classList.add('show');clearTimeout(walletFlashTimer);walletFlashTimer=setTimeout(()=>t.classList.remove('show'),1800);
  }

  function openEquipmentPicker(){
    const trigger=document.querySelector('[data-core-mode="equipment"]');
    if(!trigger){toast('Equipment library is not ready yet.');return}
    trigger.click();
    requestAnimationFrame(decoratePicker);
  }

  function installInventoryBuyButton(){
    const head=document.querySelector('#equipmentWorkbench .equipment-workbench-head');
    if(!head||document.getElementById('buyEquipmentBtn'))return;
    const actions=document.createElement('div');actions.className='equipment-shop-actions';
    actions.innerHTML=`<div class="equipment-wallet"><small>ZENIT</small><strong id="equipmentWalletValue">${zenit()}z</strong></div><button id="buyEquipmentBtn" type="button" class="primary">Buy Equipment</button>`;
    head.appendChild(actions);
    actions.querySelector('#buyEquipmentBtn').addEventListener('click',openEquipmentPicker);
    const sync=()=>{const out=document.getElementById('equipmentWalletValue');if(out)out.textContent=`${zenit()}z`};
    zenitInput()?.addEventListener('input',sync);zenitInput()?.addEventListener('change',sync);document.addEventListener('aestra:zenit-changed',sync);sync();
  }

  function equipmentCost(card){
    const meta=card.querySelector('.core-lib-head small')?.textContent||'';
    const matches=[...meta.matchAll(/(?:^|·|\s)(\d+)z(?:\s|·|$)/gi)];
    return matches.length?Math.max(0,Number(matches.at(-1)[1])||0):0;
  }

  function updatePickerWallet(){
    const out=document.getElementById('coreEquipmentWalletValue');if(out)out.textContent=`${zenit()}z`;
    document.querySelectorAll('#coreLibraryBody .equipment-buy-paid').forEach(btn=>{
      const cost=Number(btn.dataset.cost)||0;
      btn.disabled=cost>zenit();
      btn.title=btn.disabled?`You need ${cost-zenit()} more Zenit`:'';
    });
  }

  function buyCard(card,useGold){
    const original=card._aestraOriginalAdd;
    if(typeof original!=='function')return;
    const cost=equipmentCost(card);
    if(useGold&&cost>zenit()){toast(`Not enough Zenit — you need ${cost}z.`);return}
    if(useGold&&cost>0)setZenit(zenit()-cost);
    original();
    toast(useGold?`Purchased for ${cost}z.`:'Added without spending Zenit.');
  }

  function decoratePicker(){
    if(decorating)return;decorating=true;
    requestAnimationFrame(()=>{
      decorating=false;
      const modal=document.getElementById('coreLibraryModal'),body=document.getElementById('coreLibraryBody');
      if(!modal||!body||modal.classList.contains('hidden')||modal.dataset.mode!=='equipment')return;
      const filters=body.querySelector('.equipment-picker-filters');
      if(filters&&!document.getElementById('coreEquipmentWallet')){
        const wallet=document.createElement('div');wallet.id='coreEquipmentWallet';wallet.className='core-equipment-wallet';wallet.innerHTML='<span>Available Zenit</span><strong id="coreEquipmentWalletValue"></strong>';
        filters.appendChild(wallet);
      }
      body.querySelectorAll('.core-lib-card').forEach(card=>{
        if(card.dataset.purchaseReady==='1')return;
        const add=card.querySelector('.core-lib-head>button.primary');if(!add)return;
        const original=()=>add.onclick?.call(add,new MouseEvent('click',{bubbles:true}));
        // Preserve the original library action before replacing the button.
        const originalHandler=add.onclick;
        card._aestraOriginalAdd=()=>{if(typeof originalHandler==='function')originalHandler.call(add)};
        const cost=equipmentCost(card);
        const actions=document.createElement('div');actions.className='equipment-purchase-actions';
        actions.innerHTML=`<button type="button" class="primary equipment-buy-paid" data-cost="${cost}">${cost>0?`Buy · ${cost}z`:'Buy · Free'}</button><button type="button" class="ghost equipment-buy-free">Add without gold</button>`;
        add.replaceWith(actions);
        actions.querySelector('.equipment-buy-paid').onclick=()=>buyCard(card,true);
        actions.querySelector('.equipment-buy-free').onclick=()=>buyCard(card,false);
        card.dataset.purchaseReady='1';
      });
      updatePickerWallet();
    });
  }

  function installPickerDecorator(){
    const body=document.getElementById('coreLibraryBody');if(!body)return;
    new MutationObserver(decoratePicker).observe(body,{childList:true});
    document.getElementById('coreLibrarySearch')?.addEventListener('input',decoratePicker);
    document.addEventListener('aestra:zenit-changed',updatePickerWallet);
  }

  function moveBuyingOutOfBuild(){
    const body=document.getElementById('buildMenuBody');if(!body)return;
    const adjust=()=>requestAnimationFrame(()=>{
      const title=document.getElementById('buildMenuTitle')?.textContent?.trim().toLowerCase();
      const existing=body.querySelector('.equipment-build-shop-note');
      if(title!=='equipment'){existing?.remove();return}
      body.querySelector('.build-core-add')?.classList.add('equipment-buy-moved');
      const core=body.querySelector('.build-core-add');if(core)core.style.display='none';
      if(!body.querySelector('.equipment-build-shop-note')){
        const note=document.createElement('div');note.className='equipment-build-shop-note';note.innerHTML='<span>Equipment purchasing has moved to <strong>Inventory</strong>.</span><button type="button">Go to Inventory</button>';
        body.querySelector('.build-actions')?.prepend(note);
        note.querySelector('button').onclick=()=>{
          const nav=document.querySelector('[data-mobile-target="inventory"], [data-page-target="inventory"], #grandMobileNav [data-page="inventory"]');
          if(nav){nav.click();return}
          document.querySelector('#equipmentWorkbench')?.scrollIntoView({behavior:'smooth',block:'start'});
        };
      }
    });
    new MutationObserver(adjust).observe(body,{childList:true});
    document.querySelectorAll('.build-tab,.build-cycle').forEach(b=>b.addEventListener('click',adjust));adjust();
  }

  function installStyles(){
    if(document.getElementById('equipmentPurchaseStyles'))return;
    const s=document.createElement('style');s.id='equipmentPurchaseStyles';s.textContent=`
      .equipment-workbench-head{align-items:center!important}.equipment-shop-actions{display:flex;align-items:center;gap:8px;margin-left:auto}.equipment-wallet{display:grid;justify-items:end;line-height:1}.equipment-wallet small{font-size:.48rem;letter-spacing:.12em;color:#968b78}.equipment-wallet strong{margin-top:4px;font:700 .92rem Georgia,serif;color:#e4c679}.equipment-shop-actions #buyEquipmentBtn{width:auto!important;min-height:36px!important;padding:7px 13px!important;white-space:nowrap!important}
      .core-equipment-wallet{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 11px;border:1px solid rgba(211,171,91,.18);border-radius:11px;background:rgba(4,6,9,.5)}.core-equipment-wallet span{font-size:.66rem;color:#988d79}.core-equipment-wallet strong{font:700 1rem Georgia,serif;color:#e5c879}
      .equipment-purchase-actions{display:flex;gap:6px;align-items:center;justify-content:flex-end;flex-wrap:wrap}.equipment-purchase-actions button{width:auto!important;min-width:0!important;max-width:none!important;height:32px!important;min-height:32px!important;padding:5px 9px!important;border-radius:8px!important;font-size:.68rem!important;white-space:nowrap!important}.equipment-purchase-actions .equipment-buy-free{opacity:.78}.equipment-purchase-actions .equipment-buy-paid:disabled{opacity:.36!important;cursor:not-allowed!important}
      .equipment-build-shop-note{flex:1 1 100%;display:flex;align-items:center;justify-content:space-between;gap:9px;padding:8px 10px;border:1px solid rgba(211,171,91,.13);border-radius:10px;background:rgba(211,171,91,.045);font-size:.7rem;color:#a89b83}.equipment-build-shop-note button{width:auto!important;min-height:30px!important;padding:4px 9px!important;font-size:.64rem!important}.equipment-purchase-toast{position:fixed;left:50%;bottom:78px;z-index:19000;transform:translate(-50%,10px);opacity:0;pointer-events:none;padding:8px 12px;border-radius:999px;border:1px solid rgba(211,171,91,.28);background:rgba(12,12,16,.96);color:#e5d6b3;font-size:.72rem;transition:opacity .15s ease,transform .15s ease}.equipment-purchase-toast.show{opacity:1;transform:translate(-50%,0)}
      @media(max-width:640px){.equipment-workbench-head{align-items:flex-start!important;flex-wrap:wrap}.equipment-workbench-head>small{order:3;width:100%}.equipment-shop-actions{margin-left:0;width:100%;justify-content:space-between}.equipment-wallet{justify-items:start}.equipment-purchase-actions{width:100%;justify-content:flex-start}.core-lib-head{grid-template-columns:1fr!important}.equipment-purchase-actions button{flex:0 0 auto!important}.equipment-build-shop-note{align-items:flex-start;flex-direction:column}}
    `;document.head.appendChild(s);
  }

  function install(){installStyles();installInventoryBuyButton();installPickerDecorator();moveBuyingOutOfBuild();}
  install();
  setTimeout(installInventoryBuyButton,350);
  setTimeout(installInventoryBuyButton,1000);
})();