/* Aestran GM Basic Sign editor + usage panel v1 */
(function(){
  const previousRenderLanguage = renderLanguage;
  const previousRenderGlyphMaker = renderGlyphMaker;
  const previousSaveGlyphMakerRoot = saveGlyphMakerRoot;

  function editingRootId(){ return appState.editingRootId || null; }

  function pathToDraftStrokes(path){
    if(!path)return [];
    try{
      return parseCanonicalGridSegments(path).map(function(seg){
        return [[seg[0].x,seg[0].y],[seg[1].x,seg[1].y]];
      });
    }catch(_){ return []; }
  }

  function cleanSemanticRows(rows){
    const out=[];
    (rows||[]).forEach(function(row){
      const text=String(row&&row.text||'').trim();
      if(!text)return;
      if(out.some(function(x){return x.text.toLowerCase()===text.toLowerCase();}))return;
      const state=['hidden','suspected','confirmed'].includes(row.state)?row.state:'hidden';
      out.push({text:text,state:state});
    });
    return out;
  }

  function semanticRowsFromRoot(r){
    if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
    return (r.semanticField||[]).map(function(m){
      let state='hidden';
      if((r.knowledge?.confirmed||[]).includes(m))state='confirmed';
      else if((r.knowledge?.suspected||[]).includes(m))state='suspected';
      return {text:m,state:state};
    });
  }

  function applySemanticRows(r,rows){
    const clean=cleanSemanticRows(rows);
    if(!clean.length)return false;
    r.semanticField=clean.map(function(x){return x.text;});
    r.knowledge={confirmed:[],suspected:[],hidden:[]};
    clean.forEach(function(x){r.knowledge[x.state].push(x.text);});
    if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
    return true;
  }

  function replaceConcept(node,from,to){
    if(typeof node==='string')return node===from?to:node;
    if(!node||typeof node!=='object')return node;
    return {...node,a:replaceConcept(node.a,from,to),b:replaceConcept(node.b,from,to)};
  }

  function mapArrayValue(arr,from,to){
    return (arr||[]).map(function(v){return v===from?to:v;});
  }

  function safeRevealId(rootId,meaning){
    return 'root-'+rootId.toLowerCase()+'-'+safeConceptId(meaning).toLowerCase();
  }

  function renameRootReferences(oldId,newId){
    if(oldId===newId)return;

    DATA.compounds.forEach(function(c){ c.tree=replaceConcept(c.tree,oldId,newId); });
    (appState.inscriptions||[]).forEach(function(ins){ ins.units=mapArrayValue(ins.units,oldId,newId); });
    (appState.currentUnits||[]).forEach(function(u){ if(u.concept===oldId)u.concept=newId; });
    (appState.discoveryLog||[]).forEach(function(d){ if(d.glyphId===oldId)d.glyphId=newId; });

    const revealIdMap=new Map();
    revealDefs.forEach(function(d){
      if(d.root!==oldId)return;
      const oldReveal=d.id;
      const newReveal=safeRevealId(newId,d.meaning||'meaning');
      revealIdMap.set(oldReveal,newReveal);
      d.root=newId;
      d.id=newReveal;
      d.label=newId+' → '+(d.meaning||'meaning');
    });

    const remap=function(list){
      return (list||[]).map(function(id){return revealIdMap.get(id)||id;});
    };
    appState.pendingKnowledge=remap(appState.pendingKnowledge);
    appState.lastKnowledgePush=remap(appState.lastKnowledgePush);
    (appState.discoveryLog||[]).forEach(function(d){ if(revealIdMap.has(d.revealId))d.revealId=revealIdMap.get(d.revealId); });

    if(appState.rootReviewed&&Object.prototype.hasOwnProperty.call(appState.rootReviewed,oldId)){
      appState.rootReviewed[newId]=appState.rootReviewed[oldId];
      delete appState.rootReviewed[oldId];
    }
    if(appState.selectedAudit===oldId)appState.selectedAudit=newId;
  }

  function similarityExcludingSelf(path,selfId){
    if(!path)return null;
    const user=canonicalPathGridEdges(path);
    if(!user.length)return null;
    const candidates=[
      ...DATA.roots.filter(function(r){return r.id!==selfId;}).map(function(r){return {id:r.id,path:r.svgPath};}),
      ...DATA.compounds.filter(function(c){return c.canonicalPath;}).map(function(c){return {id:c.id,path:c.canonicalPath};})
    ];
    let best=null;
    candidates.forEach(function(c){
      const m=bestTranslatedGridScore(user,canonicalPathGridEdges(c.path));
      if(!best||m.score>best.score)best={id:c.id,path:c.path,score:m.score};
    });
    return best;
  }

  function directDependents(id){
    return DATA.compounds.filter(function(c){return treeUsesConcept(c.tree,id);}).map(function(c){return c.id;});
  }

  function allDependentCompounds(id){
    const remove=new Set();
    let changed=true;
    while(changed){
      changed=false;
      DATA.compounds.forEach(function(c){
        if(remove.has(c.id))return;
        if(treeUsesConcept(c.tree,id)||Array.from(remove).some(function(dep){return treeUsesConcept(c.tree,dep);})){remove.add(c.id);changed=true;}
      });
    }
    return Array.from(remove);
  }

  function inscriptionsUsing(id,dependentIds){
    const ids=new Set([id].concat(dependentIds||[]));
    return (appState.inscriptions||[]).filter(function(ins){return (ins.units||[]).some(function(u){return ids.has(u);});});
  }

  function tags(items){
    if(!items.length)return '<span class="muted">None</span>';
    return items.map(function(x){return '<span class="pill">'+escapeHTML(x)+'</span>';}).join(' ');
  }

  function usagePanelHTML(r){
    const direct=directDependents(r.id);
    const cascade=allDependentCompounds(r.id);
    const inscriptions=inscriptionsUsing(r.id,cascade);
    return '<section class="root-usage-panel" style="margin-top:16px;border-top:1px solid rgba(116,136,171,.16);padding-top:16px;text-align:left">'+
      '<h3>Sign usage</h3>'+
      '<div class="muted" style="margin:5px 0 12px">See where this Basic Sign is used before changing or removing it.</div>'+
      '<div style="display:grid;gap:13px">'+
        '<div><b>Used by Built Words</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+tags(direct)+'</div></div>'+
        '<div><b>Used in inscriptions</b><div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px">'+
          (inscriptions.length?inscriptions.map(function(i){return '<span class="pill">'+escapeHTML(i.title||i.id)+'</span>';}).join(' '):'<span class="muted">None</span>')+
        '</div></div>'+
        (cascade.length?'<div class="glyph-similarity-box warn" style="margin:0"><div class="glyph-similarity-copy">Removing this sign would also remove '+cascade.length+' dependent Built Word'+(cascade.length===1?'':'s')+'.</div></div>':'')+
      '</div>'+
    '</section>';
  }

  window.beginEditBasicSign=function(id){
    const r=rootMap[id];
    if(!r)return;
    if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
    appState.editingRootId=id;
    appState.glyphMakerMode='root';
    appState.rootGlyphDraft={
      name:r.id,
      meaning:(r.semanticField||[])[0]||'',
      semanticDraft:semanticRowsFromRoot(r),
      strokes:pathToDraftStrokes(r.svgPath)
    };
    go('glyphMaker');
    renderGlyphMaker();
  };

  window.cancelBasicSignEdit=function(){
    const id=editingRootId();
    appState.editingRootId=null;
    appState.rootGlyphDraft={name:'NEW_SIGN',meaning:'new idea',semanticDraft:[{text:'new idea',state:'hidden'}],strokes:[]};
    lexMode='roots';
    if(id&&rootMap[id]){lexSelected=id;appState.selectedLex=id;}
    go('language');
    renderLanguage();
  };

  window.removeSavedRoot=function(id){
    const r=rootMap[id];
    if(!r)return;
    const dependent=allDependentCompounds(id);
    const affectedIds=new Set([id].concat(dependent));
    const inscriptions=inscriptionsUsing(id,dependent);
    const extra=(dependent.length?'\n\nThis will also remove '+dependent.length+' Built Word'+(dependent.length===1?'':'s')+' that depend on it: '+dependent.join(', ')+'.':'')+
      (inscriptions.length?'\n\n'+inscriptions.length+' saved inscription'+(inscriptions.length===1?'':'s')+' reference this sign or those words. Those references will be removed and the inscriptions unpublished.':'');
    if(!confirm('Remove “'+id+'” from Basic Signs?'+extra))return;

    DATA.roots=DATA.roots.filter(function(x){return x.id!==id;});
    delete rootMap[id];
    if(appState.rootReviewed)delete appState.rootReviewed[id];

    DATA.compounds=DATA.compounds.filter(function(c){return !affectedIds.has(c.id);});
    dependent.forEach(function(cid){delete compoundMap[cid];if(appState.compoundReviewed)delete appState.compoundReviewed[cid];});

    (appState.inscriptions||[]).forEach(function(ins){
      const before=(ins.units||[]).length;
      ins.units=(ins.units||[]).filter(function(u){return !affectedIds.has(u);});
      if(ins.units.length!==before)ins.published=false;
    });
    (appState.currentUnits||[]).forEach(function(u){
      if(affectedIds.has(u.concept)){u.concept=null;u.unknown=true;u.amb=false;u.sense='Aestran has no clear expression yet';}
    });

    const removedRevealIds=new Set();
    revealDefs.forEach(function(d){
      if(d.root===id||(d.compound&&affectedIds.has(d.compound)))removedRevealIds.add(d.id);
    });
    for(let i=revealDefs.length-1;i>=0;i--){
      const d=revealDefs[i];
      if(d.root===id||(d.compound&&affectedIds.has(d.compound)))revealDefs.splice(i,1);
    }
    appState.pendingKnowledge=(appState.pendingKnowledge||[]).filter(function(pid){return !removedRevealIds.has(pid);});
    appState.lastKnowledgePush=(appState.lastKnowledgePush||[]).filter(function(pid){return !removedRevealIds.has(pid);});
    appState.discoveryLog=(appState.discoveryLog||[]).filter(function(d){return d.glyphId!==id&&!affectedIds.has(d.glyphId)&&!removedRevealIds.has(d.revealId);});

    appState.draftChanges.push({name:id,type:'root',status:'reviewed',desc:'Removed Basic Sign'+(dependent.length?' and dependent Built Words: '+dependent.join(', '):'')+'.'});
    lexSelected=DATA.roots[0]?.id||null;
    appState.selectedLex=lexSelected;
    renderAll();
    saveWorkspaceNow({force:true});
  };

  renderLanguage=function(){
    previousRenderLanguage();
    if(lexMode!=='roots'||!lexSelected)return;
    const r=rootMap[lexSelected],ed=document.getElementById('lexEditor');
    if(!r||!ed)return;

    if(!ed.querySelector('.root-usage-panel')){
      const holder=document.createElement('div');
      holder.innerHTML=usagePanelHTML(r);
      const panel=holder.firstElementChild;
      const semantic=ed.querySelector('.root-semantic-editor');
      if(semantic&&semantic.parentNode)semantic.parentNode.insertBefore(panel,semantic);
      else ed.appendChild(panel);
    }

    if(!ed.querySelector('#editBasicSign')){
      const btn=document.createElement('button');
      btn.className='btn';
      btn.id='editBasicSign';
      btn.textContent='Edit Basic Sign';
      btn.style.cssText='width:100%;margin-top:12px';
      btn.onclick=function(){beginEditBasicSign(r.id);};
      ed.appendChild(btn);
    }

    if(!ed.querySelector('#removeBasicSign')){
      const btn=document.createElement('button');
      btn.className='btn ghost';
      btn.id='removeBasicSign';
      btn.textContent='Remove Basic Sign';
      btn.style.cssText='width:100%;margin-top:8px';
      btn.onclick=function(){removeSavedRoot(r.id);};
      ed.appendChild(btn);
    }
  };

  renderGlyphMaker=function(){
    previousRenderGlyphMaker();
    const id=editingRootId();
    if(!id||appState.glyphMakerMode!=='root')return;
    const body=document.getElementById('glyphMakerBody');
    const form=body&&body.querySelector('.glyph-maker-form');
    if(!form)return;

    const title=form.querySelector('h3');
    if(title)title.textContent='Edit basic sign';
    const nameInput=document.getElementById('gmRootName');
    if(nameInput)nameInput.value=appState.rootGlyphDraft.name;
    const save=document.getElementById('gmSaveRoot');
    if(save)save.textContent='Save changes';

    if(!form.querySelector('.root-edit-banner')){
      const banner=document.createElement('div');
      banner.className='glyph-similarity-box good root-edit-banner';
      banner.innerHTML='<div class="glyph-similarity-title"><span>Editing Basic Sign</span><span class="pill good">'+escapeHTML(id)+'</span></div><div class="glyph-similarity-copy">You can rename the sign, redraw the rune, change writing order, and edit all of its meanings. References are updated automatically.</div>';
      form.insertBefore(banner,form.firstChild);
    }

    const wrap=save&&save.parentElement;
    if(wrap&&!document.getElementById('gmCancelRootEdit')){
      const cancel=document.createElement('button');
      cancel.className='btn ghost';
      cancel.id='gmCancelRootEdit';
      cancel.textContent='Cancel edit';
      cancel.type='button';
      cancel.onclick=cancelBasicSignEdit;
      wrap.insertBefore(cancel,save);
    }
  };

  saveGlyphMakerRoot=function(){
    const oldId=editingRootId();
    if(!oldId)return previousSaveGlyphMakerRoot();
    const r=rootMap[oldId];
    if(!r){appState.editingRootId=null;return previousSaveGlyphMakerRoot();}

    const d=appState.rootGlyphDraft;
    const name=String(d.name||'').trim();
    const path=rootDraftPath();
    const writeOrder=rootDraftWriteOrder();
    const rows=cleanSemanticRows(d.semanticDraft||[]);
    if(!name||!rows.length){alert('Give the Basic Sign a name and at least one meaning first.');return;}
    if(!path){alert('Draw the glyph first.');return;}

    const newId=safeConceptId(name);
    if(newId!==oldId&&(rootMap[newId]||compoundMap[newId])){
      alert('The name '+newId+' is already in use. Choose another sign name.');
      return;
    }

    const similarity=similarityExcludingSelf(path,oldId);
    if(similarity&&similarity.score>=.86){
      alert('This sign is too similar to '+similarity.id+' ('+Math.round(similarity.score*100)+'%). Change the shape before saving.');
      return;
    }

    r.id=newId;
    r.svgPath=path;
    r.writeOrder=writeOrder;
    r.writeOrderRule='write each point-to-point segment in the order it was drawn';
    r.grid='8x8';
    r.gridStatus='point-canon';
    r.geometryStatus='grid-aligned edited';
    applySemanticRows(r,rows);

    if(newId!==oldId){
      delete rootMap[oldId];
      renameRootReferences(oldId,newId);
      rootMap[newId]=r;
    }else rootMap[oldId]=r;

    appState.draftChanges.push({name:newId,type:'root',status:'reviewed',desc:'Edited Basic Sign'+(newId!==oldId?' and renamed '+oldId+' → '+newId:'')+'.'});
    appState.editingRootId=null;
    appState.rootGlyphDraft={name:'NEW_SIGN',meaning:'new idea',semanticDraft:[{text:'new idea',state:'hidden'}],strokes:[]};
    lexMode='roots';
    lexSelected=newId;
    appState.selectedLex=newId;
    renderAll();
    saveWorkspaceNow({force:true});
    go('language');
  };
})();