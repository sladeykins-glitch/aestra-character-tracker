// Reliable removal control for the visible Build detail modal.
(function(){
  const SECTIONS={classes:'classesEditor',skills:'skillsEditor',equipment:'equipmentEditor',magic:'spellsEditor'};
  let target=null;
  const active=()=>document.querySelector('.build-tab.active')?.dataset.build||'classes';
  const cards=()=>[...document.querySelectorAll('#buildMenuBody .build-entry')];
  const rows=section=>[...(document.getElementById(SECTIONS[section])?.querySelectorAll('.entry-row')||[])];
  document.addEventListener('click',e=>{
    const card=e.target.closest?.('#buildMenuBody .build-entry');
    if(!card)return;
    target={section:active(),index:cards().indexOf(card)};
  },true);
  function installButton(){
    const modal=document.getElementById('buildDetailModal');
    const dialog=modal?.querySelector('.build-detail-dialog');
    if(!dialog||modal.classList.contains('hidden'))return;
    let btn=dialog.querySelector('.build-remove-v2');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';btn.className='build-remove-v2';
      btn.innerHTML='<span aria-hidden="true">✕</span> Remove from character';
      dialog.appendChild(btn);
    }
    btn.onclick=()=>{
      if(!target)return;
      const row=rows(target.section)[target.index];
      if(!row)return alert('Could not find this entry to remove.');
      const title=dialog.querySelector('.build-detail-title')?.textContent?.trim()||'this entry';
      if(!confirm(`Remove ${title} from this character?`))return;
      const remove=row.querySelector('.remove-entry');
      if(!remove)return alert(`Could not remove ${title}.`);
      remove.click();
      dialog.querySelector('.build-detail-close')?.click();
    };
  }
  const boot=()=>{
    const modal=document.getElementById('buildDetailModal');
    if(!modal)return setTimeout(boot,100);
    new MutationObserver(installButton).observe(modal,{attributes:true,attributeFilter:['class'],subtree:false});
    modal.addEventListener('transitionend',installButton);
  };
  const style=document.createElement('style');style.textContent=`
    .build-remove-v2{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;width:100%!important;min-height:44px!important;margin:22px 0 0!important;padding:11px 14px!important;border:1px solid rgba(221,88,88,.58)!important;border-radius:10px!important;background:rgba(91,20,25,.24)!important;color:#f3a5a5!important;font-size:.84rem!important;position:relative!important;z-index:10!important}
    .build-remove-v2:hover{border-color:rgba(241,112,112,.85)!important;background:rgba(121,29,36,.38)!important;color:#ffd0d0!important}
  `;document.head.appendChild(style);boot();
})();