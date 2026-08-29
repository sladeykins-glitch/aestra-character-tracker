// Persistent removal control for the visible Build detail modal.
(function(){
  const SECTIONS={classes:'classesEditor',skills:'skillsEditor',equipment:'equipmentEditor',magic:'spellsEditor'};
  const active=()=>document.querySelector('.build-tab.active')?.dataset.build||'classes';
  const rows=section=>[...(document.getElementById(SECTIONS[section])?.querySelectorAll('.entry-row')||[])];
  const vals=row=>[...row.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());
  function titleOf(row,section){const v=vals(row);return section==='equipment'?(v[1]||v[0]):v[0]}
  function visibleModal(){const m=document.getElementById('buildDetailModal');return m&&!m.classList.contains('hidden')?m:null}
  function findTarget(){const modal=visibleModal();if(!modal)return null;const section=active();const title=modal.querySelector('.build-detail-title')?.textContent?.trim()||'';const list=rows(section);let index=list.findIndex(r=>titleOf(r,section)===title);if(index<0&&list.length===1)index=0;return index>=0?{section,index,row:list[index],title:title||titleOf(list[index],section)||'this entry'}:null}
  function ensure(){const modal=visibleModal();if(!modal)return;const dialog=modal.querySelector('.build-detail-dialog');if(!dialog)return;let btn=dialog.querySelector('.build-remove-v2');if(!btn){btn=document.createElement('button');btn.type='button';btn.className='build-remove-v2';btn.innerHTML='<span aria-hidden="true">✕</span> Remove from character';const footer=dialog.querySelector('.build-detail-footer');footer?footer.before(btn):dialog.appendChild(btn)}btn.onclick=()=>{const t=findTarget();if(!t)return alert('Could not find this entry to remove.');if(!confirm(`Remove ${t.title} from this character?`))return;const remove=t.row.querySelector('.remove-entry');if(!remove)return alert(`Could not remove ${t.title}.`);remove.click();dialog.querySelector('.build-detail-close')?.click()}}
  document.addEventListener('click',()=>setTimeout(ensure,0),true);
  const observer=new MutationObserver(ensure);observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  setInterval(ensure,250);
  const style=document.createElement('style');style.textContent=`.build-remove-v2{display:flex!important;align-items:center!important;justify-content:center!important;gap:8px!important;width:100%!important;min-height:46px!important;margin:18px 0 8px!important;padding:11px 14px!important;border:1px solid rgba(221,88,88,.72)!important;border-radius:10px!important;background:rgba(105,24,31,.34)!important;color:#ffb0b0!important;font-size:.86rem!important;font-weight:700!important;position:relative!important;z-index:50!important;visibility:visible!important;opacity:1!important}.build-remove-v2:hover{border-color:rgba(241,112,112,.95)!important;background:rgba(135,32,41,.48)!important;color:#ffe0e0!important}`;document.head.appendChild(style);
  ensure();
})();