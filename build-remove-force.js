// Class removal control shown directly before the class picker buttons.
(function(){
  const CLASS_EDITOR='classesEditor';
  const ACTIONS='#buildMenuBody .build-actions';
  const rows=()=>[...(document.getElementById(CLASS_EDITOR)?.querySelectorAll('.entry-row')||[])];
  const title=row=>String(row?.querySelector('input,textarea,select')?.value||'Unnamed Class').trim()||'Unnamed Class';

  function activeClasses(){return document.querySelector('.build-tab.active')?.dataset.build==='classes'}

  function closePicker(){document.querySelector('.class-remove-picker')?.remove()}

  function removeRow(row){
    const name=title(row);
    if(!confirm(`Remove ${name} from this character?`))return;
    const remove=row.querySelector('.remove-entry');
    if(!remove){alert(`Could not remove ${name}.`);return;}
    remove.click();
    closePicker();
  }

  function togglePicker(anchor){
    const existing=document.querySelector('.class-remove-picker');
    if(existing){existing.remove();return;}
    const list=rows();
    if(!list.length)return;
    const panel=document.createElement('div');
    panel.className='class-remove-picker';
    panel.innerHTML=`<div class="class-remove-picker-head"><strong>Remove a class</strong><button type="button" class="class-remove-close" aria-label="Close">×</button></div><div class="class-remove-list"></div>`;
    const holder=panel.querySelector('.class-remove-list');
    list.forEach(row=>{
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='class-remove-option';
      btn.innerHTML=`<span>${title(row)}</span><span aria-hidden="true">✕</span>`;
      btn.onclick=()=>removeRow(row);
      holder.appendChild(btn);
    });
    panel.querySelector('.class-remove-close').onclick=closePicker;
    anchor.closest('.build-actions')?.insertAdjacentElement('afterend',panel);
  }

  function install(){
    if(!activeClasses()){closePicker();return;}
    const actions=document.querySelector(ACTIONS);
    if(!actions)return;
    let btn=actions.querySelector('.class-remove-before-picker');
    const count=rows().length;
    if(!btn){
      btn=document.createElement('button');
      btn.type='button';
      btn.className='class-remove-before-picker';
      actions.prepend(btn);
    }
    btn.innerHTML='<span aria-hidden="true">−</span> Remove Class';
    btn.disabled=count===0;
    btn.title=count?`Remove one of ${count} current class${count===1?'':'es'}`:'No classes to remove';
    btn.onclick=()=>togglePicker(btn);
  }

  const style=document.createElement('style');
  style.textContent=`
    .class-remove-before-picker{order:-10!important;border:1px solid rgba(210,83,91,.62)!important;background:rgba(105,24,31,.26)!important;color:#f3a5aa!important;font-weight:700!important}
    .class-remove-before-picker:hover:not(:disabled){border-color:rgba(235,104,113,.9)!important;background:rgba(132,30,39,.42)!important;color:#ffd2d5!important}
    .class-remove-before-picker:disabled{opacity:.38!important;cursor:not-allowed!important}
    .class-remove-picker{margin:-2px 0 12px;padding:12px;border:1px solid rgba(210,83,91,.36);border-radius:12px;background:rgba(17,15,20,.96);box-shadow:0 12px 30px rgba(0,0,0,.28)}
    .class-remove-picker-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:9px;color:#e7c57d}
    .class-remove-close{width:32px;height:32px;padding:0!important;border-radius:50%!important;background:transparent!important}
    .class-remove-list{display:grid;gap:7px}
    .class-remove-option{width:100%;display:flex!important;align-items:center;justify-content:space-between;text-align:left!important;padding:10px 12px!important;border:1px solid rgba(210,83,91,.3)!important;border-radius:9px!important;background:rgba(92,22,29,.2)!important;color:#f0c3c6!important}
    .class-remove-option:hover{background:rgba(122,30,38,.38)!important;border-color:rgba(226,95,104,.66)!important;color:#ffe0e2!important}
    @media(max-width:640px){.class-remove-before-picker{grid-column:1/-1!important}.class-remove-picker{margin-top:0}}
  `;
  document.head.appendChild(style);

  function boot(){
    const body=document.getElementById('buildMenuBody');
    if(!body){setTimeout(boot,100);return;}
    install();
    new MutationObserver(()=>requestAnimationFrame(install)).observe(body,{childList:true,subtree:false});
    document.getElementById(CLASS_EDITOR)?.addEventListener('input',()=>requestAnimationFrame(install));
    document.getElementById(CLASS_EDITOR)&&new MutationObserver(()=>requestAnimationFrame(install)).observe(document.getElementById(CLASS_EDITOR),{childList:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('.build-tab'))setTimeout(install,0)},true);
  }
  boot();
})();