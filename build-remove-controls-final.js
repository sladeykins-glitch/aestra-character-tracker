// Final persistent removal controls for Build & Abilities.
// Loaded after the legacy/build refinement layers and isolated from older remove-control code.
(function(){
  if(window.__AESTRA_BUILD_REMOVE_FINAL__)return;
  window.__AESTRA_BUILD_REMOVE_FINAL__=true;

  const SECTIONS={
    classes:{editor:'classesEditor',button:'Remove Class',picker:'Remove a class',empty:'No classes to remove'},
    skills:{editor:'skillsEditor',button:'Remove Skill',picker:'Remove a skill',empty:'No skills to remove'},
    equipment:{editor:'equipmentEditor',button:'Remove Equipment',picker:'Remove equipment',empty:'No equipment to remove'},
    magic:{editor:'spellsEditor',button:'Remove Magic',picker:'Remove magic',empty:'No magic to remove'}
  };
  let raf=0,menuObserver=null,observedMenu=null;
  const activeKey=()=>document.querySelector('.build-tab.active')?.dataset.build||'classes';
  const cfg=()=>SECTIONS[activeKey()]||SECTIONS.classes;
  const rows=()=>[...(document.getElementById(cfg().editor)?.querySelectorAll('.entry-row')||[])];

  function rowTitle(row,key=activeKey()){
    const v=[...row.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());
    if(key==='equipment')return v[1]||v[0]||'Unnamed Item';
    if(key==='skills')return v[0]||'Unnamed Skill';
    if(key==='magic')return v[0]||'Unnamed Magic';
    return v[0]||'Unnamed Class';
  }

  function closePicker(){document.getElementById('buildSectionRemovePicker')?.remove()}

  function removeRow(row,key){
    const name=rowTitle(row,key);
    if(!confirm(`Remove ${name} from this character?`))return;
    const remove=row.querySelector('.remove-entry');
    if(!remove){alert(`Could not remove ${name}.`);return;}
    remove.click();
    closePicker();
    queueEnsure(0,40,120,300);
  }

  function openPicker(btn){
    const existing=document.getElementById('buildSectionRemovePicker');
    if(existing){existing.remove();return;}
    const key=activeKey(),c=SECTIONS[key],list=rows();
    if(!list.length)return;
    const panel=document.createElement('div');
    panel.id='buildSectionRemovePicker';
    panel.className='build-section-remove-picker';
    panel.innerHTML=`<div class="build-section-remove-head"><strong>${c.picker}</strong><button type="button" class="build-section-remove-close" aria-label="Close">×</button></div><div class="build-section-remove-list"></div>`;
    const holder=panel.querySelector('.build-section-remove-list');
    list.forEach(row=>{
      const option=document.createElement('button');
      option.type='button';
      option.className='build-section-remove-option';
      option.innerHTML=`<span>${rowTitle(row,key)}</span><span aria-hidden="true">✕</span>`;
      option.onclick=()=>removeRow(row,key);
      holder.appendChild(option);
    });
    panel.querySelector('.build-section-remove-close').onclick=closePicker;
    btn.closest('.build-actions')?.insertAdjacentElement('afterend',panel);
  }

  function ensure(){
    const actions=document.querySelector('#buildMenuBody .build-actions');
    if(!actions)return;

    // The final controller is the only controller allowed to own this slot.
    actions.querySelectorAll('.class-remove-before-picker,.build-remove-before-picker').forEach(el=>el.remove());

    const key=activeKey(),c=SECTIONS[key],count=rows().length;
    let btn=document.getElementById('buildSectionRemoveBtn');
    if(!btn||!actions.contains(btn)){
      btn?.remove();
      btn=document.createElement('button');
      btn.id='buildSectionRemoveBtn';
      btn.type='button';
      btn.className='build-section-remove-final';
      actions.prepend(btn);
    }
    const label=`− ${c.button}`;
    if(btn.textContent.trim()!==label)btn.textContent=label;
    btn.dataset.removeSection=key;
    const disabled=count===0;
    if(btn.disabled!==disabled)btn.disabled=disabled;
    btn.title=count?`${c.button} (${count} available)`:c.empty;
    btn.onclick=()=>openPicker(btn);
  }

  function schedule(){
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(ensure);
  }

  function queueEnsure(...delays){
    for(const delay of delays)setTimeout(ensure,delay);
  }

  function watchBuildMenu(){
    const menu=document.getElementById('buildMenu');
    if(!menu||menu===observedMenu)return;
    menuObserver?.disconnect();
    observedMenu=menu;
    menuObserver=new MutationObserver(mutations=>{
      if(mutations.some(m=>m.type==='childList'))schedule();
    });
    menuObserver.observe(menu,{childList:true,subtree:true});
  }

  const style=document.createElement('style');
  style.id='buildRemoveFinalStyles';
  style.textContent=`
    #buildSectionRemoveBtn.build-section-remove-final{order:-10!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;border:1px solid rgba(210,83,91,.62)!important;background:rgba(105,24,31,.26)!important;color:#f3a5aa!important;font-weight:700!important;visibility:visible!important}
    #buildSectionRemoveBtn.build-section-remove-final:hover:not(:disabled){border-color:rgba(235,104,113,.9)!important;background:rgba(132,30,39,.42)!important;color:#ffd2d5!important}
    #buildSectionRemoveBtn.build-section-remove-final:disabled{display:inline-flex!important;visibility:visible!important;opacity:.38!important;cursor:not-allowed!important}
    .build-section-remove-picker{margin:-2px 0 12px;padding:12px;border:1px solid rgba(210,83,91,.36);border-radius:12px;background:rgba(17,15,20,.97);box-shadow:0 12px 30px rgba(0,0,0,.28)}
    .build-section-remove-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:#e7c57d}
    .build-section-remove-close{width:32px;height:32px;padding:0!important;border-radius:50%!important;background:transparent!important}
    .build-section-remove-list{display:grid;gap:7px}
    .build-section-remove-option{width:100%;display:flex!important;align-items:center;justify-content:space-between;text-align:left!important;padding:10px 12px!important;border:1px solid rgba(210,83,91,.3)!important;border-radius:9px!important;background:rgba(92,22,29,.2)!important;color:#f0c3c6!important}
    .build-section-remove-option:hover{background:rgba(122,30,38,.38)!important;border-color:rgba(226,95,104,.66)!important;color:#ffe0e2!important}
    @media(max-width:640px){#buildSectionRemoveBtn.build-section-remove-final{grid-column:1/-1!important}.build-section-remove-picker{margin-top:0}}
  `;
  document.head.appendChild(style);

  document.addEventListener('click',e=>{
    if(e.target.closest?.('.build-tab,.build-cycle')){
      closePicker();
      // Skills can finish its own redraw a little after the tab click, so check several times.
      queueEnsure(0,35,90,180,360,700,1200);
    }
  },true);
  document.addEventListener('input',e=>{if(e.target.closest?.('#classesEditor,#skillsEditor,#equipmentEditor,#spellsEditor'))schedule()},true);
  document.addEventListener('change',e=>{if(e.target.closest?.('#classesEditor,#skillsEditor,#equipmentEditor,#spellsEditor'))schedule()},true);

  function start(){
    watchBuildMenu();
    ensure();
    // Reattach if another layer ever replaces the Build menu itself, and keep a cheap final safety check.
    setInterval(()=>{watchBuildMenu();ensure()},750);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
