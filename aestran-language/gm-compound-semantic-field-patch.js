/* Aestran GM compound semantic fields v1 */
(function(){
  function uniqueMeanings(values){const out=[];(values||[]).forEach(v=>{const s=String(v||'').trim();if(s&&!out.some(x=>x.toLowerCase()===s.toLowerCase()))out.push(s)});return out;}
  function normaliseCompoundSemantics(c){
    if(!c)return c;const legacy=String(c.gloss||'').trim();
    const legacyMeanings=legacy?legacy.split(/\\s*[,;]\\s*/).filter(Boolean):[];c.semanticField=uniqueMeanings(Array.isArray(c.semanticField)?c.semanticField:legacyMeanings);
    if(!c.knowledge||typeof c.knowledge!=='object')c.knowledge={confirmed:[],suspected:[],hidden:[]};
    ['confirmed','suspected','hidden'].forEach(k=>c.knowledge[k]=uniqueMeanings(Array.isArray(c.knowledge[k])?c.knowledge[k]:[]).filter(m=>c.semanticField.some(x=>x.toLowerCase()===m.toLowerCase())));
    c.semanticField.forEach(m=>{const placed=['confirmed','suspected','hidden'].some(k=>c.knowledge[k].some(x=>x.toLowerCase()===m.toLowerCase()));if(!placed)c.knowledge.hidden.push(m)});
    ['confirmed','suspected','hidden'].forEach(k=>c.knowledge[k]=c.knowledge[k].map(m=>c.semanticField.find(x=>x.toLowerCase()===m.toLowerCase())||m));
    c.gloss=c.semanticField[0]||legacy||c.id.replace(/_/g,' ').toLowerCase();return c;
  }
  function normaliseAllCompoundSemantics(){DATA.compounds.forEach(normaliseCompoundSemantics)}
  function compoundHasPlayerMeaning(c){normaliseCompoundSemantics(c);return !!((c.knowledge.confirmed||[]).length||(c.knowledge.suspected||[]).length)}
  function compoundMeaningState(c,m){normaliseCompoundSemantics(c);if(c.knowledge.confirmed.includes(m))return 'confirmed';if(c.knowledge.suspected.includes(m))return 'suspected';return 'hidden'}
  function setCompoundMeaningState(c,m,state){normaliseCompoundSemantics(c);['confirmed','suspected','hidden'].forEach(k=>c.knowledge[k]=c.knowledge[k].filter(x=>x!==m));if(!c.knowledge[state].includes(m))c.knowledge[state].push(m);appState.draftChanges.push({name:`${c.id} → ${m}`,type:'knowledge',status:'reviewed',desc:`Built Word meaning changed to ${state}.`});if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();renderAll()}
  function addCompoundMeaning(c,value){normaliseCompoundSemantics(c);const m=String(value||'').trim();if(!m||c.semanticField.some(x=>x.toLowerCase()===m.toLowerCase()))return false;c.semanticField.push(m);c.knowledge.hidden.push(m);if(!c.gloss)c.gloss=m;appState.draftChanges.push({name:c.id,type:'compound semantics',status:'reviewed',desc:`Added Built Word meaning: ${m}.`});if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();renderAll();return true}
  function removeCompoundMeaning(c,m){normaliseCompoundSemantics(c);c.semanticField=c.semanticField.filter(x=>x!==m);['confirmed','suspected','hidden'].forEach(k=>c.knowledge[k]=c.knowledge[k].filter(x=>x!==m));c.gloss=c.semanticField[0]||c.id.replace(/_/g,' ').toLowerCase();appState.draftChanges.push({name:c.id,type:'compound semantics',status:'reviewed',desc:`Removed Built Word meaning: ${m}.`});if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();renderAll()}
  window.normaliseCompoundSemantics=normaliseCompoundSemantics;window.compoundHasPlayerMeaning=compoundHasPlayerMeaning;normaliseAllCompoundSemantics();

  const previousRenderLanguage=renderLanguage;
  renderLanguage=function(){
    normaliseAllCompoundSemantics();previousRenderLanguage();
    if(lexMode!=='compounds'||!lexSelected)return;const c=compoundMap[lexSelected];if(!c)return;normaliseCompoundSemantics(c);
    const ed=document.getElementById('lexEditor');if(!ed||ed.querySelector('.compound-semantic-field'))return;
    const section=document.createElement('section');section.className='compound-semantic-field';section.style.cssText='margin-top:16px;text-align:left;border-top:1px solid rgba(116,136,171,.16);padding-top:16px';
    const rows=c.semanticField.length?c.semanticField.map(m=>{const st=compoundMeaningState(c,m),key=encodeURIComponent(m);return `<div class="meaning-row row" style="justify-content:space-between;gap:10px"><span style="flex:1">${escapeHTML(m)}</span><select data-comp-meaning="${key}" style="max-width:130px"><option ${st==='hidden'?'selected':''}>hidden</option><option ${st==='suspected'?'selected':''}>suspected</option><option ${st==='confirmed'?'selected':''}>confirmed</option></select><button class="btn ghost" data-remove-comp-meaning="${key}" title="Remove meaning" style="padding:8px 10px">×</button></div>`}).join(''):'<div class="muted" style="padding:5px 0 10px">No meanings saved yet.</div>';
    section.innerHTML=`<h3>Semantic field</h3><div class="muted" style="margin:5px 0 10px">Built Words can carry several related meanings. Reveal each meaning independently, just like a root glyph.</div><div class="stack">${rows}</div><div class="row" style="gap:8px;margin-top:12px"><input data-new-comp-meaning placeholder="Add another meaning…" style="flex:1"><button class="btn" data-add-comp-meaning>+ Add meaning</button></div>`;
    const removeWord=ed.querySelector('#removeSavedWord');if(removeWord?.parentNode)removeWord.parentNode.insertBefore(section,removeWord);else ed.appendChild(section);
    const copy=ed.querySelector('.compound-control-copy');if(copy){const b=copy.querySelector('b'),s=copy.querySelector('span');if(b)b.textContent='Players know this word name';if(s)s.textContent='Reveal the established Built Word name. Individual meanings are controlled separately below.'}
    section.querySelectorAll('[data-comp-meaning]').forEach(sel=>sel.onchange=()=>setCompoundMeaningState(c,decodeURIComponent(sel.dataset.compMeaning),sel.value));
    section.querySelectorAll('[data-remove-comp-meaning]').forEach(btn=>btn.onclick=()=>removeCompoundMeaning(c,decodeURIComponent(btn.dataset.removeCompMeaning)));
    const input=section.querySelector('[data-new-comp-meaning]'),add=section.querySelector('[data-add-comp-meaning]');const submit=()=>{if(addCompoundMeaning(c,input.value))input.value=''};add.onclick=submit;input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();submit()}};
  };

  const previousMaps=playerSafeIdMaps;
  playerSafeIdMaps=function(){
    normaliseAllCompoundSemantics();
    const maps=previousMaps();
    let wordN=1;
    // A revealed meaning must NOT reveal the established Built Word name.
    // The real ID is public only when the separate "Players know this word name" state is on.
    DATA.compounds.forEach(c=>{maps.compoundIds[c.id]=c.known?c.id:'WORD_'+String(wordN++).padStart(3,'0')});
    return maps;
  };
  const previousBuildSnapshot=buildPlayerSafeSnapshot;
  buildPlayerSafeSnapshot=function(){normaliseAllCompoundSemantics();const snap=previousBuildSnapshot(),source=DATA.compounds.filter(c=>!c.transient);(snap.compounds||[]).forEach((out,i)=>{const c=source[i];if(!c)return;normaliseCompoundSemantics(c);out.meanings=[...(c.knowledge.confirmed||[])];out.suspected=[...(c.knowledge.suspected||[])];if(out.meanings.length||out.suspected.length)out.writeOrderRule=c.writeOrderRule||out.writeOrderRule||''});return snap};

  const previousPlayerGlyphMeta=playerGlyphMeta;
  playerGlyphMeta=function(id){const c=compoundMap[id];if(!c)return previousPlayerGlyphMeta(id);normaliseCompoundSemantics(c);const known=[...(c.knowledge.confirmed||[]),...(c.knowledge.suspected||[]).map(x=>x+'?')];if(!known.length&&c.known)known.push(c.id);return {id,type:'Compound glyph',known,hidden:(c.knowledge.hidden||[]).length,notes:known.length?'The party has learned part of this Built Word’s semantic field.':'This Built Word remains semantically unknown.'}};
  const previousRenderPlayer=renderPlayer;
  renderPlayer=function(){normaliseAllCompoundSemantics();const temp=[];DATA.compounds.forEach(c=>{if(!c.known&&compoundHasPlayerMeaning(c)){c.known=true;temp.push(c)}});try{return previousRenderPlayer()}finally{temp.forEach(c=>c.known=false)}};
})();