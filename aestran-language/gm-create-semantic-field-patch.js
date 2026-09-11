/* Aestran GM creation-time semantic fields v1 */
(function(){
  const previousRenderGlyphMaker = renderGlyphMaker;
  const previousSaveGlyphMakerRoot = saveGlyphMakerRoot;
  const previousSaveGlyphMakerCompound = saveGlyphMakerCompound;

  function cleanRows(rows){
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

  function ensureRootDraft(){
    const d=appState.rootGlyphDraft||(appState.rootGlyphDraft={name:'',meaning:'',strokes:[]});
    if(!Array.isArray(d.semanticDraft)||!d.semanticDraft.length){
      d.semanticDraft=[{text:String(d.meaning||''),state:'hidden'}];
    }
    return d;
  }

  function ensureCompoundDraft(){
    const b=appState.glyphMaker||(appState.glyphMaker={});
    if(!Array.isArray(b.semanticDraft)||!b.semanticDraft.length){
      b.semanticDraft=[{text:String(b.meaning||''),state:'hidden'}];
    }
    return b;
  }

  function syncLegacyMeaning(owner){
    const rows=cleanRows(owner.semanticDraft);
    owner.meaning=rows[0]?rows[0].text:'';
  }

  function rowsHTML(rows,prefix){
    return (rows||[]).map(function(row,i){
      const text=escapeHTML(row.text||'');
      const state=row.state||'hidden';
      return '<div class="meaning-row row" style="justify-content:space-between;gap:10px">'+
        '<input data-'+prefix+'-text="'+i+'" value="'+text+'" placeholder="Meaning" style="flex:1">'+
        '<select data-'+prefix+'-state="'+i+'" style="max-width:130px">'+
          '<option value="hidden" '+(state==='hidden'?'selected':'')+'>hidden</option>'+
          '<option value="suspected" '+(state==='suspected'?'selected':'')+'>suspected</option>'+
          '<option value="confirmed" '+(state==='confirmed'?'selected':'')+'>confirmed</option>'+
        '</select>'+
        '<button class="btn ghost" data-'+prefix+'-remove="'+i+'" type="button" title="Remove meaning" style="padding:8px 10px">×</button>'+
      '</div>';
    }).join('');
  }

  function semanticEditorHTML(rows,prefix,label){
    return '<section class="creation-semantic-field" data-semantic-owner="'+prefix+'" style="margin-top:4px;border-top:1px solid rgba(116,136,171,.16);padding-top:14px">'+
      '<div><b>Semantic field</b><div class="muted" style="font-size:11px;margin-top:4px">'+label+' Each meaning can start hidden, suspected or confirmed.</div></div>'+
      '<div class="stack" style="margin-top:10px">'+rowsHTML(rows,prefix)+'</div>'+
      '<button class="btn" data-'+prefix+'-add type="button" style="margin-top:10px">+ Add meaning</button>'+
    '</section>';
  }

  function bindSemanticEditor(owner,prefix){
    document.querySelectorAll('[data-'+prefix+'-text]').forEach(function(input){
      input.oninput=function(){
        const i=Number(input.getAttribute('data-'+prefix+'-text'));
        if(owner.semanticDraft[i])owner.semanticDraft[i].text=input.value;
        syncLegacyMeaning(owner);
      };
    });
    document.querySelectorAll('[data-'+prefix+'-state]').forEach(function(sel){
      sel.onchange=function(){
        const i=Number(sel.getAttribute('data-'+prefix+'-state'));
        if(owner.semanticDraft[i])owner.semanticDraft[i].state=sel.value;
      };
    });
    document.querySelectorAll('[data-'+prefix+'-remove]').forEach(function(btn){
      btn.onclick=function(){
        if(owner.semanticDraft.length<=1){alert('Keep at least one meaning while creating the glyph.');return;}
        const i=Number(btn.getAttribute('data-'+prefix+'-remove'));
        owner.semanticDraft.splice(i,1);
        syncLegacyMeaning(owner);
        renderGlyphMaker();
      };
    });
    const add=document.querySelector('[data-'+prefix+'-add]');
    if(add)add.onclick=function(){
      owner.semanticDraft.push({text:'',state:'hidden'});
      renderGlyphMaker();
      const inputs=document.querySelectorAll('[data-'+prefix+'-text]');
      if(inputs.length)inputs[inputs.length-1].focus();
    };
  }

  function applyRowsToRoot(r,rows){
    const cleaned=cleanRows(rows);
    if(!cleaned.length)return false;
    r.semanticField=cleaned.map(function(x){return x.text;});
    r.knowledge={confirmed:[],suspected:[],hidden:[]};
    cleaned.forEach(function(x){r.knowledge[x.state].push(x.text);});
    if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
    return true;
  }

  function applyRowsToCompound(c,rows){
    const cleaned=cleanRows(rows);
    if(!cleaned.length)return false;
    c.semanticField=cleaned.map(function(x){return x.text;});
    c.knowledge={confirmed:[],suspected:[],hidden:[]};
    cleaned.forEach(function(x){c.knowledge[x.state].push(x.text);});
    c.gloss=cleaned[0].text;
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    return true;
  }

  renderGlyphMaker=function(){
    previousRenderGlyphMaker();
    const body=document.getElementById('glyphMakerBody');
    if(!body)return;

    if(appState.glyphMakerMode==='root'){
      const d=ensureRootDraft();
      const legacy=document.getElementById('gmRootMeaning');
      const field=legacy&&legacy.closest('label.field');
      if(field){
        field.style.display='none';
        if(!body.querySelector('[data-semantic-owner="create-root"]')){
          field.insertAdjacentHTML('afterend',semanticEditorHTML(d.semanticDraft,'create-root','Define all meanings for this Basic Sign before saving.'));
        }
      }
      bindSemanticEditor(d,'create-root');
      syncLegacyMeaning(d);
      const preview=document.getElementById('gmRootPreviewMeaning');
      if(preview)preview.textContent=cleanRows(d.semanticDraft).map(function(x){return x.text;}).join(' · ');
      return;
    }

    if(appState.glyphMakerMode==='compound'&&!appState.editingCompoundId){
      const b=ensureCompoundDraft();
      const legacy=document.getElementById('gmMeaning');
      const field=legacy&&legacy.closest('label.field');
      if(field){
        field.style.display='none';
        if(!body.querySelector('[data-semantic-owner="create-compound"]')){
          field.insertAdjacentHTML('afterend',semanticEditorHTML(b.semanticDraft,'create-compound','Define the Built Word’s meanings now, instead of reopening it after creation.'));
        }
      }
      bindSemanticEditor(b,'create-compound');
      syncLegacyMeaning(b);
    }
  };

  saveGlyphMakerRoot=function(){
    const d=ensureRootDraft();
    const rows=cleanRows(d.semanticDraft);
    if(!rows.length){alert('Add at least one meaning before saving this Basic Sign.');return;}
    d.meaning=rows[0].text;
    const before=new Set(DATA.roots.map(function(r){return r.id;}));
    previousSaveGlyphMakerRoot();
    const created=DATA.roots.find(function(r){return !before.has(r.id);});
    if(created){
      applyRowsToRoot(created,rows);
      appState.draftChanges.push({name:created.id,type:'root semantics',status:'reviewed',desc:'Created with '+rows.length+' semantic meaning'+(rows.length===1?'':'s')+'.'});
      d.semanticDraft=[{text:'',state:'hidden'}];
      if(typeof saveWorkspaceNow==='function')saveWorkspaceNow({force:true});
      if(typeof renderLanguage==='function')renderLanguage();
    }
  };

  saveGlyphMakerCompound=function(){
    if(appState.editingCompoundId)return previousSaveGlyphMakerCompound();
    const b=ensureCompoundDraft();
    const rows=cleanRows(b.semanticDraft);
    if(!rows.length){alert('Add at least one meaning before saving this Built Word.');return;}
    b.meaning=rows[0].text;
    const before=new Set(DATA.compounds.map(function(c){return c.id;}));
    previousSaveGlyphMakerCompound();
    const created=DATA.compounds.find(function(c){return !before.has(c.id);});
    if(created){
      applyRowsToCompound(created,rows);
      appState.draftChanges.push({name:created.id,type:'compound semantics',status:'reviewed',desc:'Created with '+rows.length+' semantic meaning'+(rows.length===1?'':'s')+'.'});
      b.semanticDraft=[{text:'',state:'hidden'}];
      if(typeof saveWorkspaceNow==='function')saveWorkspaceNow({force:true});
      if(typeof renderLanguage==='function')renderLanguage();
    }
  };
})();