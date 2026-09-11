/* Aestran GM Built Word usage panel v1 */
(function(){
  const previousRenderLanguage=renderLanguage;

  function collectComponents(node,out){
    out=out||[];
    if(typeof node==='string'){out.push(node);return out;}
    if(node&&typeof node==='object'){collectComponents(node.a,out);collectComponents(node.b,out);}
    return out;
  }
  function directDependents(id){
    return DATA.compounds.filter(function(c){return c.id!==id&&treeUsesConcept(c.tree,id);}).map(function(c){return c.id;});
  }
  function allDependents(id){
    const seen=new Set(),queue=[id];
    while(queue.length){
      const cur=queue.shift();
      DATA.compounds.forEach(function(c){
        if(c.id===id||seen.has(c.id))return;
        if(treeUsesConcept(c.tree,cur)){seen.add(c.id);queue.push(c.id);}
      });
    }
    return Array.from(seen);
  }
  function inscriptionsUsing(id){
    return (appState.inscriptions||[]).filter(function(ins){return (ins.units||[]).includes(id);});
  }
  function tagList(items){
    if(!items.length)return '<span class="muted">None</span>';
    return items.map(function(x){return '<span class="pill">'+escapeHTML(x)+'</span>';}).join(' ');
  }

  renderLanguage=function(){
    previousRenderLanguage();
    if(lexMode!=='compounds'||!lexSelected)return;
    const c=compoundMap[lexSelected],ed=document.getElementById('lexEditor');
    if(!c||!ed||ed.querySelector('.built-word-usage-panel'))return;

    const components=Array.from(new Set(collectComponents(c.tree,[])));
    const direct=directDependents(c.id);
    const cascade=allDependents(c.id);
    const inscriptions=inscriptionsUsing(c.id);

    const section=document.createElement('section');
    section.className='built-word-usage-panel';
    section.style.cssText='margin-top:16px;border-top:1px solid rgba(116,136,171,.16);padding-top:16px;text-align:left';
    section.innerHTML=
      '<h3>Word usage</h3>'+
      '<div class="muted" style="margin:5px 0 12px">See what this Built Word uses and what depends on it before editing or removing it.</div>'+
      '<div style="display:grid;gap:13px">'+
        '<div><b>Built from</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+tagList(components)+'</div></div>'+
        '<div><b>Used by Built Words</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+tagList(direct)+'</div></div>'+
        '<div><b>Used in inscriptions</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+
          (inscriptions.length?inscriptions.map(function(i){return '<span class="pill">'+escapeHTML(i.title||i.id)+'</span>';}).join(' '):'<span class="muted">None</span>')+
        '</div></div>'+
        (cascade.length?'<div class="glyph-similarity-box warn" style="margin:0"><div class="glyph-similarity-copy">Removing this word would also remove '+cascade.length+' dependent Built Word'+(cascade.length===1?'':'s')+'. The existing removal confirmation will list them before anything is deleted.</div></div>':'')+
      '</div>';

    const remove=ed.querySelector('#removeSavedWord');
    const edit=ed.querySelector('#editSavedWord');
    if(edit&&edit.parentNode)edit.parentNode.insertBefore(section,edit);
    else if(remove&&remove.parentNode)remove.parentNode.insertBefore(section,remove);
    else ed.appendChild(section);
  };
})();