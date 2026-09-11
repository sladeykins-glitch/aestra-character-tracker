/* Aestran GM Built Word editor v1 */
(function(){
  const originalRenderLanguage=renderLanguage;
  const originalRenderGlyphMaker=renderGlyphMaker;
  const originalSaveGlyphMakerCompound=saveGlyphMakerCompound;
  const originalGlyphMakerConceptOptions=glyphMakerConceptOptions;

  function editingId(){return appState.editingCompoundId||null}
  function nodeIsString(v){return typeof v==='string'}
  function decomposeTree(tree){
    if(!tree||typeof tree!=='object'||!tree.rel)return null;
    if(nodeIsString(tree.a)&&nodeIsString(tree.b))return {a:tree.a,rel:tree.rel,b:tree.b,third:false,rel2:'joined',c:'LIGHT',grouping:'left'};
    if(tree.a&&typeof tree.a==='object'&&tree.a.rel&&nodeIsString(tree.a.a)&&nodeIsString(tree.a.b)&&nodeIsString(tree.b)){
      return {a:tree.a.a,rel:tree.a.rel,b:tree.a.b,third:true,rel2:tree.rel,c:tree.b,grouping:'left'};
    }
    if(nodeIsString(tree.a)&&tree.b&&typeof tree.b==='object'&&tree.b.rel&&nodeIsString(tree.b.a)&&nodeIsString(tree.b.b)){
      return {a:tree.a,rel:tree.rel,b:tree.b.a,third:true,rel2:tree.b.rel,c:tree.b.b,grouping:'right'};
    }
    return null;
  }
  function pathToDraftStrokes(path){
    if(!path)return [];
    try{return parseCanonicalGridSegments(path).map(seg=>[[seg[0].x,seg[0].y],[seg[1].x,seg[1].y]])}catch(_){return []}
  }
  function replaceConcept(node,from,to){
    if(typeof node==='string')return node===from?to:node;
    if(!node||typeof node!=='object')return node;
    return {...node,a:replaceConcept(node.a,from,to),b:replaceConcept(node.b,from,to)};
  }
  function replaceArrayValue(arr,from,to){return (arr||[]).map(v=>v===from?to:v)}
  function replaceRevealId(list,oldReveal,newReveal){return (list||[]).map(v=>v===oldReveal?newReveal:v)}
  function renameCompoundReferences(oldId,newId){
    if(oldId===newId)return;
    DATA.compounds.forEach(c=>{if(c.id!==oldId)c.tree=replaceConcept(c.tree,oldId,newId)});
    (appState.inscriptions||[]).forEach(ins=>ins.units=replaceArrayValue(ins.units,oldId,newId));
    (appState.currentUnits||[]).forEach(u=>{if(u.concept===oldId)u.concept=newId});
    (appState.discoveryLog||[]).forEach(d=>{if(d.glyphId===oldId)d.glyphId=newId});
    const oldReveal='compound-'+oldId.toLowerCase(),newReveal='compound-'+newId.toLowerCase();
    revealDefs.forEach(d=>{if(d.compound===oldId){d.compound=newId;if(d.id===oldReveal)d.id=newReveal;d.label=d.label?.replace(oldId,newId)}});
    appState.pendingKnowledge=replaceRevealId(appState.pendingKnowledge,oldReveal,newReveal);
    appState.lastKnowledgePush=replaceRevealId(appState.lastKnowledgePush,oldReveal,newReveal);
    (appState.discoveryLog||[]).forEach(d=>{if(d.revealId===oldReveal)d.revealId=newReveal});
    if(appState.compoundReviewed&&Object.prototype.hasOwnProperty.call(appState.compoundReviewed,oldId)){
      appState.compoundReviewed[newId]=appState.compoundReviewed[oldId];delete appState.compoundReviewed[oldId];
    }
  }
  function setPrimaryMeaning(c,value){
    const next=String(value||'').trim();if(!next)return false;
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    const field=Array.isArray(c.semanticField)?c.semanticField:[];
    const old=field[0]||String(c.gloss||'').trim();
    if(!field.length)field.push(next);else field[0]=next;
    c.semanticField=field.filter((m,i,a)=>m&&a.findIndex(x=>x.toLowerCase()===m.toLowerCase())===i);
    if(c.knowledge){
      ['confirmed','suspected','hidden'].forEach(k=>{
        const had=(c.knowledge[k]||[]).includes(old);
        c.knowledge[k]=(c.knowledge[k]||[]).filter(x=>x!==old&&x!==next);
        if(had)c.knowledge[k].unshift(next);
      });
      const placed=['confirmed','suspected','hidden'].some(k=>(c.knowledge[k]||[]).includes(next));
      if(!placed)c.knowledge.hidden.unshift(next);
    }
    c.gloss=next;return true;
  }
  function similarityExcludingSelf(path,selfId){
    if(!path)return null;const user=canonicalPathGridEdges(path);if(!user.length)return null;
    const candidates=[...DATA.roots.map(r=>({id:r.id,path:r.svgPath})),...DATA.compounds.filter(c=>c.id!==selfId&&c.canonicalPath).map(c=>({id:c.id,path:c.canonicalPath}))];
    let best=null;candidates.forEach(c=>{const m=bestTranslatedGridScore(user,canonicalPathGridEdges(c.path));if(!best||m.score>best.score)best={...c,score:m.score}});return best;
  }

  window.beginEditBuiltWord=function(id){
    const c=compoundMap[id];if(!c)return;
    const parts=decomposeTree(c.tree);
    if(!parts){alert('This Built Word has a structure deeper than the current 3-idea editor can safely reopen.');return;}
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    appState.editingCompoundId=id;
    appState.glyphMakerMode='compound';
    appState.glyphMaker={...parts,name:c.id,meaning:(c.semanticField&&c.semanticField[0])||c.gloss||''};
    appState.compoundGlyphDraft={strokes:pathToDraftStrokes(c.canonicalPath||'')};
    go('glyphMaker');renderGlyphMaker();
  };
  window.cancelBuiltWordEdit=function(){
    const id=editingId();appState.editingCompoundId=null;appState.compoundGlyphDraft={strokes:[]};
    lexMode='compounds';if(id&&compoundMap[id]){lexSelected=id;appState.selectedLex=id}go('language');renderLanguage();
  };

  glyphMakerConceptOptions=function(selected){
    let html=originalGlyphMakerConceptOptions(selected),id=editingId();
    if(id){const esc=id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');html=html.replace(new RegExp('<option value="'+esc+'"[^>]*>[^<]*<\\/option>','g'),'')}
    return html;
  };

  renderLanguage=function(){
    originalRenderLanguage();
    if(lexMode!=='compounds'||!lexSelected)return;const c=compoundMap[lexSelected],ed=document.getElementById('lexEditor');if(!c||!ed||ed.querySelector('#editSavedWord'))return;
    const btn=document.createElement('button');btn.className='btn';btn.id='editSavedWord';btn.textContent='Edit Built Word';btn.style.cssText='width:100%;margin-top:12px';btn.onclick=()=>beginEditBuiltWord(c.id);
    const remove=ed.querySelector('#removeSavedWord');if(remove?.parentNode)remove.parentNode.insertBefore(btn,remove);else ed.appendChild(btn);
  };

  renderGlyphMaker=function(){
    originalRenderGlyphMaker();
    const id=editingId();if(!id||appState.glyphMakerMode!=='compound')return;
    const body=document.getElementById('glyphMakerBody'),form=body?.querySelector('.glyph-maker-form');if(!form)return;
    const banner=document.createElement('div');banner.className='glyph-similarity-box good';banner.innerHTML=`<div class="glyph-similarity-title"><span>Editing Built Word</span><span class="pill good">${escapeHTML(id)}</span></div><div class="glyph-similarity-copy">Change the construction, name, primary meaning or custom whole-word rune. Other semantic meanings are preserved.</div>`;form.insertBefore(banner,form.firstChild);
    const save=document.getElementById('gmSaveCompound');if(save)save.textContent='Save changes';
    const saveWrap=save?.parentElement;if(saveWrap&&!document.getElementById('gmCancelCompoundEdit')){const cancel=document.createElement('button');cancel.className='btn ghost';cancel.id='gmCancelCompoundEdit';cancel.textContent='Cancel edit';cancel.onclick=cancelBuiltWordEdit;saveWrap.insertBefore(cancel,save)}
    const duplicate=[...form.querySelectorAll('.glyph-similarity-box.warn')].find(x=>x.textContent.includes(id)&&x.textContent.includes('structure already exists'));if(duplicate)duplicate.remove();
  };

  saveGlyphMakerCompound=function(){
    const oldId=editingId();if(!oldId)return originalSaveGlyphMakerCompound();
    const c=compoundMap[oldId];if(!c){appState.editingCompoundId=null;return originalSaveGlyphMakerCompound()}
    const b=appState.glyphMaker,tree=glyphMakerTree(b),name=String(b.name||'').trim(),meaning=String(b.meaning||'').trim();
    if(!name||!meaning){alert('Give the Built Word a name and primary meaning first.');return;}
    if(treeUsesConcept(tree,oldId)){alert('A Built Word cannot contain itself as one of its component ideas.');return;}
    const newId=safeConceptId(name);
    if(newId!==oldId&&(rootMap[newId]||compoundMap[newId])){alert(`The name ${newId} is already in use. Choose another Built Word name.`);return;}
    const customPath=compoundDraftPath(),customWriteOrder=compoundDraftWriteOrder();
    if(customPath){const sim=similarityExcludingSelf(customPath,oldId);if(sim&&sim.score>=.86){alert(`This custom word-rune is too similar to ${sim.id} (${Math.round(sim.score*100)}%). Change the shape before saving.`);return;}}
    const wasKnown=!!c.known,oldCanonical=!!c.canonical;
    c.tree=tree;c.id=newId;c.known=wasKnown;c.canonical=!!customPath;c.constructionStatus=customPath?'draft custom rune':'draft';c.visualSystem=customPath?'8x8 custom whole-word rune':'8x8 current-root composition';c.compositionVersion=customPath?'manual-whole-word-canon-v1':'current-root-canon-v1';
    setPrimaryMeaning(c,meaning);
    if(customPath){c.canonicalPath=customPath;c.writeOrder=customWriteOrder;c.writeOrderRule='write each point-to-point segment in the order it was drawn in the word glyph builder'}else{delete c.canonicalPath;delete c.writeOrder;delete c.writeOrderRule}
    if(newId!==oldId){delete compoundMap[oldId];renameCompoundReferences(oldId,newId);compoundMap[newId]=c}else compoundMap[oldId]=c;
    appState.draftChanges.push({name:newId,type:'compound',status:'reviewed',desc:`Edited Built Word${newId!==oldId?` and renamed ${oldId} → ${newId}`:''}${oldCanonical!==c.canonical?' with updated whole-word rune mode':''}.`});
    appState.editingCompoundId=null;appState.compoundGlyphDraft={strokes:[]};lexMode='compounds';lexSelected=newId;appState.selectedLex=newId;
    renderAll();saveWorkspaceNow({force:true});go('language');
  };
})();
