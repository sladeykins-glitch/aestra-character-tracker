// Force-visible removal control for Build detail popups.
(function(){
  const EDITORS={classes:'classesEditor',skills:'skillsEditor',equipment:'equipmentEditor',magic:'spellsEditor'};
  const button=document.createElement('button');
  button.id='forceBuildRemoveBtn';
  button.type='button';
  button.innerHTML='<span aria-hidden="true">✕</span> Remove from character';
  Object.assign(button.style,{position:'fixed',left:'50%',transform:'translateX(-50%)',bottom:'28px',width:'min(520px,calc(100vw - 32px))',minHeight:'50px',zIndex:'2147483647',display:'none',border:'1px solid #d35c67',borderRadius:'12px',background:'rgba(126,28,38,.96)',color:'#ffe1e4',fontWeight:'700',fontSize:'14px',padding:'12px 16px',boxShadow:'0 12px 35px rgba(0,0,0,.55)',cursor:'pointer'});
  document.body.appendChild(button);
  function activeSection(){return document.querySelector('.build-tab.active')?.dataset.build||'classes'}
  function getRows(section){return [...(document.getElementById(EDITORS[section])?.querySelectorAll('.entry-row')||[])]}
  function rowTitle(row,section){const v=[...row.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());return section==='equipment'?(v[1]||v[0]):v[0]}
  function current(){
    const modal=document.getElementById('buildDetailModal');
    if(!modal||modal.classList.contains('hidden'))return null;
    const section=activeSection();
    const shown=modal.querySelector('.build-detail-title')?.textContent?.trim()||'';
    const list=getRows(section);
    let row=list.find(r=>rowTitle(r,section)===shown);
    if(!row&&list.length===1)row=list[0];
    return row?{modal,row,title:shown||rowTitle(row,section)||'this entry'}:null;
  }
  function sync(){button.style.display=current()?'flex':'none';button.style.alignItems='center';button.style.justifyContent='center';button.style.gap='8px'}
  button.addEventListener('click',()=>{
    const t=current();
    if(!t)return sync();
    if(!confirm(`Remove ${t.title} from this character?`))return;
    const remove=t.row.querySelector('.remove-entry');
    if(!remove){alert(`Could not remove ${t.title}.`);return;}
    remove.click();
    t.modal.querySelector('.build-detail-close')?.click();
    setTimeout(sync,250);
  });
  document.addEventListener('click',()=>setTimeout(sync,30),true);
  new MutationObserver(sync).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['class']});
  setInterval(sync,250);
})();