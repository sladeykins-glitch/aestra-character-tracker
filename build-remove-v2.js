// Build detail removal control. Loaded last so it survives all UI refinement layers.
(function(){
  const EDITORS={classes:'classesEditor',skills:'skillsEditor',equipment:'equipmentEditor',magic:'spellsEditor'};
  const activeSection=()=>document.querySelector('.build-tab.active')?.dataset.build||'classes';
  const getRows=section=>[...(document.getElementById(EDITORS[section])?.querySelectorAll('.entry-row')||[])];
  const getTitle=(row,section)=>{const v=[...row.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());return section==='equipment'?(v[1]||v[0]):v[0]};
  function target(){
    const modal=document.getElementById('buildDetailModal');
    if(!modal||modal.classList.contains('hidden'))return null;
    const section=activeSection();
    const shown=modal.querySelector('.build-detail-title')?.textContent?.trim()||'';
    const list=getRows(section);
    let row=list.find(r=>getTitle(r,section)===shown);
    if(!row&&list.length===1)row=list[0];
    return row?{row,title:shown||getTitle(row,section)||'this entry'}:null;
  }
  function install(){
    const modal=document.getElementById('buildDetailModal');
    if(!modal||modal.classList.contains('hidden'))return;
    const dialog=modal.querySelector('.build-detail-dialog');
    const content=modal.querySelector('.build-detail-content');
    if(!dialog||!content)return;
    let zone=dialog.querySelector('#buildNativeRemoveZone');
    if(!zone){
      zone=document.createElement('div');zone.id='buildNativeRemoveZone';zone.className='build-native-remove-zone';
      zone.innerHTML='<button id="buildNativeRemoveBtn" type="button"><span aria-hidden="true">✕</span> Remove from character</button>';
      content.insertAdjacentElement('afterend',zone);
    }
    zone.style.setProperty('display','block','important');
    const btn=zone.querySelector('#buildNativeRemoveBtn');
    btn.onclick=()=>{
      const t=target();
      if(!t){alert('Could not identify this entry. Close it and open it again.');return;}
      if(!confirm(`Remove ${t.title} from this character?`))return;
      const remove=t.row.querySelector('.remove-entry');
      if(!remove){alert(`Could not remove ${t.title}.`);return;}
      remove.click();
      modal.querySelector('.build-detail-close')?.click();
    };
  }
  document.addEventListener('click',e=>{if(e.target.closest?.('#buildMenuBody .build-entry')){setTimeout(install,0);setTimeout(install,80);setTimeout(install,250)}},true);
  new MutationObserver(install).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  const style=document.createElement('style');
  style.textContent=`#buildNativeRemoveZone.build-native-remove-zone{display:block!important;width:100%!important;margin:16px 0 0!important;position:relative!important;z-index:9999!important}#buildNativeRemoveBtn{display:flex!important;width:100%!important;min-height:48px!important;align-items:center!important;justify-content:center!important;gap:8px!important;padding:12px 16px!important;border:1px solid #b64b55!important;border-radius:10px!important;background:rgba(120,28,36,.55)!important;color:#ffd0d4!important;font:700 .88rem/1.2 inherit!important;letter-spacing:.01em!important;visibility:visible!important;opacity:1!important;pointer-events:auto!important;position:relative!important;z-index:10000!important}#buildNativeRemoveBtn:hover{background:rgba(153,37,47,.72)!important;border-color:#e36b76!important;color:#fff!important}@media(max-width:640px){#buildNativeRemoveBtn{min-height:50px!important}}`;
  document.head.appendChild(style);
  setInterval(install,300);
})();