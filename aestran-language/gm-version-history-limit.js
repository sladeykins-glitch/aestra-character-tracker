/* Aestran GM version history limit v1
   Keep the publish screen compact by showing only the three newest versions. */
(function(){
  if(window.__aestraVersionHistoryLimit)return;
  window.__aestraVersionHistoryLimit=true;

  const VERSION_RE=/^v?\d+(?:\.\d+){1,3}$/i;

  function exactVersionNodes(root){
    return [...root.querySelectorAll('*')].filter(el=>{
      if(el.children.length)return false;
      return VERSION_RE.test((el.textContent||'').trim());
    });
  }

  function commonAncestor(nodes,stop){
    if(!nodes.length)return null;
    let cur=nodes[0].parentElement;
    while(cur&&cur!==document.documentElement){
      if(nodes.every(n=>cur.contains(n)))return cur;
      if(cur===stop)break;
      cur=cur.parentElement;
    }
    return stop||null;
  }

  function directChild(container,node){
    let cur=node;
    while(cur&&cur.parentElement&&cur.parentElement!==container)cur=cur.parentElement;
    return cur&&cur.parentElement===container?cur:null;
  }

  function apply(){
    // Undo only styles previously applied by this patch before recalculating.
    document.querySelectorAll('[data-aestra-version-hidden="1"]').forEach(el=>{
      el.style.display='';
      delete el.dataset.aestraVersionHidden;
    });

    const heading=[...document.querySelectorAll('h1,h2,h3,h4,h5,h6,div,span')]
      .find(el=>(el.textContent||'').trim().toLowerCase()==='version history');
    if(!heading)return;

    const card=heading.closest('.card')||heading.parentElement;
    if(!card)return;

    const labels=exactVersionNodes(card);
    if(labels.length<=3)return;

    const listRoot=commonAncestor(labels,card);
    if(!listRoot)return;

    const items=[];
    labels.forEach(label=>{
      const item=directChild(listRoot,label);
      if(item&&!items.includes(item))items.push(item);
    });

    // If the shared ancestor is too high and produces one wrapper, use each label's
    // smallest sensible parent instead.
    const rows=items.length>=labels.length
      ? items
      : labels.map(label=>{
          let row=label.parentElement;
          while(row&&row.parentElement!==listRoot){
            const parent=row.parentElement;
            const versionCount=exactVersionNodes(parent).length;
            if(versionCount>1)break;
            row=parent;
          }
          return row;
        }).filter((row,i,a)=>row&&a.indexOf(row)===i);

    rows.slice(3).forEach(row=>{
      row.style.display='none';
      row.dataset.aestraVersionHidden='1';
    });
  }

  let queued=false;
  function queueApply(){
    if(queued)return;
    queued=true;
    setTimeout(()=>{queued=false;try{apply()}catch(_){}},0);
  }

  try{
    if(typeof renderPublish==='function'){
      const prev=renderPublish;
      renderPublish=function(){
        const result=prev.apply(this,arguments);
        queueMicrotask(apply);
        return result;
      };
    }
  }catch(_){}

  const observer=new MutationObserver(queueApply);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  queueApply();
})();