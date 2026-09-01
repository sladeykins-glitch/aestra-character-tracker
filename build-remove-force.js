// Legacy Build removal controls. The final controller loaded later owns the live UI.
(function(){
  const SECTIONS={
    classes:{editor:'classesEditor',button:'Remove Class',picker:'Remove a class',noun:'class'},
    skills:{editor:'skillsEditor',button:'Remove Skill',picker:'Remove a skill',noun:'skill'},
    equipment:{editor:'equipmentEditor',button:'Remove Equipment',picker:'Remove equipment',noun:'equipment item'},
    magic:{editor:'spellsEditor',button:'Remove Magic',picker:'Remove magic',noun:'magic entry'}
  };
  const ACTIONS='#buildMenuBody .build-actions';
  const finalOwns=()=>window.__AESTRA_BUILD_REMOVE_FINAL__===true;
  const activeKey=()=>document.querySelector('.build-tab.active')?.dataset.build||'classes';
  const config=()=>SECTIONS[activeKey()]||SECTIONS.classes;
  const rows=()=>[...(document.getElementById(config().editor)?.querySelectorAll('.entry-row')||[])];
  const title=row=>{
    const values=[...row?.querySelectorAll?.('input,textarea,select')||[]].map(x=>String(x.value||'').trim());
    if(activeKey()==='equipment')return values[1]||values[0]||'Unnamed Item';
    if(activeKey()==='magic')return values[0]||'Unnamed Magic';
    if(activeKey()==='skills')return values[0]||'Unnamed Skill';
    return values[0]||'Unnamed Class';
  };

  function closePicker(){document.querySelector('.build-remove-picker')?.remove()}

  function removeRow(row){
    const name=title(row);
    if(!confirm(`Remove ${name} from this character?`))return;
    const remove=row.querySelector('.remove-entry');
    if(!remove){alert(`Could not remove ${name}.`);return;}
    remove.click();
    closePicker();
  }

  function togglePicker(anchor){
    if(finalOwns())return;
    const existing=document.querySelector('.build-remove-picker');
    if(existing){existing.remove();return;}
    const list=rows(),c=config();
    if(!list.length)return;
    const panel=document.createElement('div');
    panel.className='build-remove-picker';
    panel.innerHTML=`<div class="build-remove-picker-head"><strong>${c.picker}</strong><button type="button" class="build-remove-close" aria-label="Close">×</button></div><div class="build-remove-list"></div>`;
    const holder=panel.querySelector('.build-remove-list');
    list.forEach(row=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='build-remove-option';
      btn.innerHTML=`<span>${title(row)}</span><span aria-hidden="true">✕</span>`;
      btn.onclick=()=>removeRow(row);
      holder.appendChild(btn);
    });
    panel.querySelector('.build-remove-close').onclick=closePicker;
    anchor.closest('.build-actions')?.insertAdjacentElement('afterend',panel);
  }

  function install(){
    const actions=document.querySelector(ACTIONS);
    if(finalOwns()){
      closePicker();
      actions?.querySelectorAll('.build-remove-before-picker').forEach(el=>el.remove());
      return;
    }
    if(!actions)return;
    const c=config(),count=rows().length;
    let btn=actions.querySelector('.build-remove-before-picker');
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='build-remove-before-picker';
      actions.prepend(btn);
    }
    btn.innerHTML=`<span aria-hidden="true">−</span> ${c.button}`;
    btn.dataset.removeSection=activeKey();
    btn.disabled=count===0;
    btn.title=count?`Remove one of ${count} current ${c.noun}${count===1?'':'s'}`:`No ${c.noun}s to remove`;
    btn.onclick=()=>togglePicker(btn);
  }

  const style=document.createElement('style');
  style.textContent=`
    .build-remove-before-picker{order:-10!important;border:1px solid rgba(210,83,91,.62)!important;background:rgba(105,24,31,.26)!important;color:#f3a5aa!important;font-weight:700!important}
    .build-remove-before-picker:hover:not(:disabled){border-color:rgba(235,104,113,.9)!important;background:rgba(132,30,39,.42)!important;color:#ffd2d5!important}
    .build-remove-before-picker:disabled{opacity:.38!important;cursor:not-allowed!important}
    .build-remove-picker{margin:-2px 0 12px;padding:12px;border:1px solid rgba(210,83,91,.36);border-radius:12px;background:rgba(17,15,20,.96);box-shadow:0 12px 30px rgba(0,0,0,.28)}
    .build-remove-picker-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:#e7c57d}
    .build-remove-close{width:32px;height:32px;padding:0!important;border-radius:50%!important;background:transparent!important}
    .build-remove-list{display:grid;gap:7px}
    .build-remove-option{width:100%;display:flex!important;align-items:center;justify-content:space-between;text-align:left!important;padding:10px 12px!important;border:1px solid rgba(210,83,91,.3)!important;border-radius:9px!important;background:rgba(92,22,29,.2)!important;color:#f0c3c6!important}
    .build-remove-option:hover{background:rgba(122,30,38,.38)!important;border-color:rgba(226,95,104,.66)!important;color:#ffe0e2!important}
    @media(max-width:640px){.build-remove-before-picker{grid-column:1/-1!important}.build-remove-picker{margin-top:0}}
  `;
  document.head.appendChild(style);

  function boot(){
    const body=document.getElementById('buildMenuBody');
    if(!body){setTimeout(boot,100);return;}
    install();
    new MutationObserver(()=>requestAnimationFrame(()=>{closePicker();install()})).observe(body,{childList:true,subtree:false});
    Object.values(SECTIONS).forEach(s=>{
      const editor=document.getElementById(s.editor);
      editor?.addEventListener('input',()=>requestAnimationFrame(install));
      if(editor)new MutationObserver(()=>requestAnimationFrame(install)).observe(editor,{childList:true});
    });
    document.addEventListener('click',e=>{if(e.target.closest?.('.build-tab,.build-cycle'))setTimeout(()=>{closePicker();install()},0)},true);
  }
  boot();
})();
