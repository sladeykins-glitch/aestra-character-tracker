// Persistent removal control for the visible Build detail modal.
(function(){
  const SECTIONS={classes:'classesEditor',skills:'skillsEditor',equipment:'equipmentEditor',magic:'spellsEditor'};
  const active=()=>document.querySelector('.build-tab.active')?.dataset.build||'classes';
  const rows=section=>[...(document.getElementById(SECTIONS[section])?.querySelectorAll('.entry-row')||[])];
  const vals=row=>[...row.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());
  function titleOf(row,section){const v=vals(row);return section==='equipment'?(v[1]||v[0]):v[0]}
  function findTarget(){const modal=document.getElementById('buildDetailModal');if(!modal||modal.classList.contains('hidden'))return null;const section=active();const title=modal.querySelector('.build-detail-title')?.textContent?.trim()||'';const list=rows(section);let index=list.findIndex(r=>titleOf(r,section)===title);if(index<0&&list.length===1)index=0;return index>=0?{row:list[index],title:title||titleOf(list[index],section)||'this entry'}:null}
  function ensure(){
    const modal=document.getElementById('buildDetailModal');if(!modal||modal.classList.contains('hidden'))return;
    const content=modal.querySelector('.build-detail-content');if(!content)return;
    let wrap=content.querySelector('.build-remove-zone');
    if(!wrap){wrap=document.createElement('div');wrap.className='build-remove-zone';wrap.innerHTML='<button type="button" class="build-remove-v2"><span aria-hidden="true">✕</span> Remove from character</button>';content.appendChild(wrap)}
    const btn=wrap.querySelector('.build-remove-v2');
    btn.onclick=()=>{const t=findTarget();if(!t)return alert('Could not find this entry to remove.');if(!confirm(`Remove ${t.title} from this character?`))return;const remove=t.row.querySelector('.remove-entry');if(!remove)return alert(`Could not remove ${t.title}.`);remove.click();modal.querySelector('.build-detail-close')?.click()};
  }
  document.addEventListener('click',e=>{if(e.target.closest?.('#buildMenuBody .build-entry'))setTimeout(ensure,20)},true);
  setInterval(ensure,200);
  const style=document.createElement('style');style.textContent=`.build-remove-zone{display:block!important;width:100%!important;margin-top:8px!important}.build-remove-v2{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;width:100%!important;min-height:48px!important;padding:12px 14px!important;border:1px solid rgba(221,88,88,.78)!important;border-radius:10px!important;background:rgba(105,24,31,.42)!important;color:#ffb0b0!important;font-size:.88rem!important;font-weight:700!important;position:relative!important;z-index:100!important;visibility:visible!important;opacity:1!important}.build-remove-v2:hover{border-color:rgba(241,112,112,.98)!important;background:rgba(135,32,41,.55)!important;color:#ffe0e0!important}`;document.head.appendChild(style);
})();