/* Aestran GM root/basic-sign semantic field editor v1 */
(function(){
  const previousRenderLanguage = renderLanguage;
  const previousSaveGlyphMakerRoot = saveGlyphMakerRoot;

  function uniqueMeanings(values){
    const out=[];
    (values||[]).forEach(function(v){
      String(v||'').split(/\s*[,;]\s*/).forEach(function(part){
        const s=part.trim();
        if(s&&!out.some(function(x){return x.toLowerCase()===s.toLowerCase();}))out.push(s);
      });
    });
    return out;
  }

  function normaliseRootSemantics(r){
    if(!r)return false;
    const oldField=Array.isArray(r.semanticField)?r.semanticField.slice():[];
    const nextField=uniqueMeanings(oldField);
    let changed=JSON.stringify(oldField)!==JSON.stringify(nextField);
    r.semanticField=nextField;
    if(!r.knowledge||typeof r.knowledge!=='object'){
      r.knowledge={confirmed:[],suspected:[],hidden:nextField.slice()};
      changed=true;
    }
    const nextKnowledge={confirmed:[],suspected:[],hidden:[]};
    ['confirmed','suspected','hidden'].forEach(function(state){
      (r.knowledge[state]||[]).forEach(function(raw){
        const bits=uniqueMeanings([raw]);
        bits.forEach(function(m){
          const canonical=nextField.find(function(x){return x.toLowerCase()===m.toLowerCase();});
          if(canonical&&!nextKnowledge[state].includes(canonical))nextKnowledge[state].push(canonical);
        });
      });
    });
    nextField.forEach(function(m){
      const placed=['confirmed','suspected','hidden'].some(function(k){return nextKnowledge[k].includes(m);});
      if(!placed)nextKnowledge.hidden.push(m);
    });
    if(JSON.stringify(r.knowledge)!==JSON.stringify(nextKnowledge))changed=true;
    r.knowledge=nextKnowledge;
    return changed;
  }

  function normaliseAllRoots(){
    let changed=false;
    DATA.roots.forEach(function(r){if(normaliseRootSemantics(r))changed=true;});
    if(changed&&typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
  }

  function rootMeaningState(r,m){
    normaliseRootSemantics(r);
    if(r.knowledge.confirmed.includes(m))return 'confirmed';
    if(r.knowledge.suspected.includes(m))return 'suspected';
    return 'hidden';
  }

  function setRootMeaningState(r,m,state){
    normaliseRootSemantics(r);
    ['confirmed','suspected','hidden'].forEach(function(k){r.knowledge[k]=r.knowledge[k].filter(function(x){return x!==m;});});
    if(!r.knowledge[state].includes(m))r.knowledge[state].push(m);
    appState.draftChanges.push({name:r.id+' → '+m,type:'knowledge',status:'reviewed',desc:'Basic Sign meaning changed to '+state+'.'});
    if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
    renderAll();
  }

  function addRootMeaning(r,value){
    normaliseRootSemantics(r);
    const additions=uniqueMeanings([value]).filter(function(m){return !r.semanticField.some(function(x){return x.toLowerCase()===m.toLowerCase();});});
    if(!additions.length)return false;
    additions.forEach(function(m){r.semanticField.push(m);r.knowledge.hidden.push(m);});
    appState.draftChanges.push({name:r.id,type:'root semantics',status:'reviewed',desc:'Added Basic Sign meaning'+(additions.length>1?'s':'')+': '+additions.join(', ')+'.'});
    if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
    renderAll();
    return true;
  }

  function removeRootMeaning(r,m){
    normaliseRootSemantics(r);
    if(r.semanticField.length<=1){alert('A Basic Sign must keep at least one meaning. Add another meaning before removing this one.');return;}
    r.semanticField=r.semanticField.filter(function(x){return x!==m;});
    ['confirmed','suspected','hidden'].forEach(function(k){r.knowledge[k]=r.knowledge[k].filter(function(x){return x!==m;});});
    appState.draftChanges.push({name:r.id,type:'root semantics',status:'reviewed',desc:'Removed Basic Sign meaning: '+m+'.'});
    if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
    renderAll();
  }

  function editorHTML(r){
    normaliseRootSemantics(r);
    const rows=r.semanticField.map(function(m){
      const st=rootMeaningState(r,m),key=encodeURIComponent(m);
      return '<div class="meaning-row row" style="justify-content:space-between;gap:10px">'+
        '<span style="flex:1">'+escapeHTML(m)+'</span>'+
        '<select data-root-semantic="'+key+'" style="max-width:130px">'+
          '<option value="hidden" '+(st==='hidden'?'selected':'')+'>hidden</option>'+
          '<option value="suspected" '+(st==='suspected'?'selected':'')+'>suspected</option>'+
          '<option value="confirmed" '+(st==='confirmed'?'selected':'')+'>confirmed</option>'+
        '</select>'+
        '<button class="btn ghost" data-remove-root-semantic="'+key+'" title="Remove meaning" style="padding:8px 10px">×</button>'+
      '</div>';
    }).join('');
    return '<section class="root-semantic-editor" style="margin-top:18px;text-align:left;border-top:1px solid rgba(116,136,171,.16);padding-top:16px">'+
      '<h3>Semantic field</h3>'+
      '<div class="muted" style="margin:5px 0 10px">Add as many related meanings as this Basic Sign needs. Each one can be revealed independently.</div>'+
      '<div class="stack">'+rows+'</div>'+
      '<div class="row" style="gap:8px;margin-top:12px">'+
        '<input data-new-root-semantic placeholder="Add another meaning…" style="flex:1">'+
        '<button class="btn" data-add-root-semantic>+ Add meaning</button>'+
      '</div>'+
    '</section>';
  }

  function bindRootEditor(ed,r){
    ed.querySelectorAll('[data-root-semantic]').forEach(function(sel){
      sel.onchange=function(){setRootMeaningState(r,decodeURIComponent(sel.dataset.rootSemantic),sel.value);};
    });
    ed.querySelectorAll('[data-remove-root-semantic]').forEach(function(btn){
      btn.onclick=function(){removeRootMeaning(r,decodeURIComponent(btn.dataset.removeRootSemantic));};
    });
    const input=ed.querySelector('[data-new-root-semantic]'),add=ed.querySelector('[data-add-root-semantic]');
    if(input&&add){
      const submit=function(){const value=input.value;if(addRootMeaning(r,value))input.value='';};
      add.onclick=submit;
      input.onkeydown=function(e){if(e.key==='Enter'){e.preventDefault();submit();}};
    }
  }

  renderLanguage=function(){
    normaliseAllRoots();
    previousRenderLanguage();
    if(lexMode!=='roots'||!lexSelected)return;
    const r=rootMap[lexSelected],ed=document.getElementById('lexEditor');
    if(!r||!ed)return;

    const oldHeading=Array.from(ed.querySelectorAll('h3')).find(function(h){return h.textContent.trim().toLowerCase()==='semantic field';});
    if(oldHeading){
      const oldStack=oldHeading.nextElementSibling;
      if(oldStack&&oldStack.classList.contains('stack'))oldStack.remove();
      oldHeading.remove();
    }
    ed.querySelectorAll('[data-meaning]').forEach(function(el){
      const row=el.closest('.meaning-row');if(row)row.remove();
    });
    if(!ed.querySelector('.root-semantic-editor'))ed.insertAdjacentHTML('beforeend',editorHTML(r));
    bindRootEditor(ed,r);
  };

  saveGlyphMakerRoot=function(){
    previousSaveGlyphMakerRoot();
    const id=lexMode==='roots'?lexSelected:null;
    const r=id&&rootMap[id];
    if(r&&normaliseRootSemantics(r)){
      if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
      renderLanguage();
    }
  };

  normaliseAllRoots();
  window.normaliseRootSemantics=normaliseRootSemantics;
})();