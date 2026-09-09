/* Aestran GM v0.16.3 — optional third-idea compound builder */
(function(){
  function buildTree(b){
    const first={rel:b.rel,a:b.a,b:b.b};
    if(!b.third||!b.c)return first;
    return b.grouping==='right'
      ? {rel:b.rel,a:b.a,b:{rel:b.rel2,a:b.b,b:b.c}}
      : {rel:b.rel2,a:first,b:b.c};
  }
  window.glyphMakerTree=buildTree;

  if(appState && appState.glyphMaker){
    const b=appState.glyphMaker;
    if(b.third===undefined)b.third=false;
    if(!b.rel2)b.rel2='joined';
    if(!b.c)b.c='LIGHT';
    if(!b.grouping)b.grouping='left';
  }

  saveGlyphMakerCompound=function(){
    const b=appState.glyphMaker,tree=buildTree(b);
    const name=(b.name||'').trim(), meaning=(b.meaning||'').trim();
    if(!name||!meaning){alert('Give the new word a name and meaning first.');return;}
    const customPath=compoundDraftPath(), customWriteOrder=compoundDraftWriteOrder();
    if(customPath){
      const similarity=compoundDraftSimilarity();
      if(similarity&&similarity.score>=.86){alert(`This custom word-rune is too similar to ${similarity.id} (${Math.round(similarity.score*100)}%). Change the shape before saving.`);return;}
    }
    const id=uniqueConceptId(name);
    const c={id,tree,gloss:meaning,known:false,canonical:!!customPath,constructionStatus:customPath?'draft custom rune':'draft',visualSystem:customPath?'8x8 custom whole-word rune':'8x8 current-root composition',compositionVersion:customPath?'manual-whole-word-canon-v1':'current-root-canon-v1'};
    if(customPath){
      c.canonicalPath=customPath;
      c.writeOrder=customWriteOrder;
      c.writeOrderRule='write each point-to-point segment in the order it was drawn in the word glyph builder';
    }
    DATA.compounds.push(c);compoundMap[id]=c;
    appState.draftChanges.push({name:id,type:'compound',status:'review',desc:customPath?'New word saved with a manually drawn whole-word rune.':(b.third?'New three-idea word built from the current 8×8 root canon.':'New word built from the current 8×8 root canon; no legacy contextual glyph forms.')});
    appState.compoundGlyphDraft={strokes:[]};
    lexMode='compounds';lexSelected=id;appState.selectedLex=id;
    go('language');
  };

  renderGlyphMaker=function(){
    const body=document.getElementById('glyphMakerBody');if(!body)return;
    const mode=appState.glyphMakerMode;
    document.getElementById('glyphMakerCompoundTab').classList.toggle('active',mode==='compound');
    document.getElementById('glyphMakerRootTab').classList.toggle('active',mode==='root');
    if(mode==='compound'){
      const b=appState.glyphMaker,tree=buildTree(b),cd=appState.compoundGlyphDraft||(appState.compoundGlyphDraft={strokes:[]});
      if(b.third===undefined)b.third=false;if(!b.rel2)b.rel2='joined';if(!b.c)b.c='LIGHT';if(!b.grouping)b.grouping='left';
      const existing=DATA.compounds.find(c=>c.tree&&JSON.stringify(c.tree)===JSON.stringify(tree));
      const relOptions=(value)=>`<option value="inside" ${value==='inside'?'selected':''}>inside</option><option value="joined" ${value==='joined'?'selected':''}>joined with</option><option value="above" ${value==='above'?'selected':''}>above</option><option value="below" ${value==='below'?'selected':''}>below</option>`;
      const thirdSection=b.third?`<div style="display:grid;gap:10px;padding:12px;border:1px solid rgba(216,193,124,.15);border-radius:14px;background:rgba(12,17,23,.35)"><div class="row" style="justify-content:space-between;gap:10px"><div><b>Third idea</b><div class="muted" style="font-size:11px;margin-top:3px">Add another concept to make a more complex word.</div></div><button class="btn ghost" id="gmRemoveThird">Remove third idea</button></div><div class="glyph-maker-relation"><label class="field"><span>Second relationship</span><select id="gmRel2">${relOptions(b.rel2)}</select></label><label class="field"><span>Third idea</span><select id="gmC">${glyphMakerConceptOptions(b.c)}</select></label><label class="field"><span>Grouping</span><select id="gmGrouping"><option value="left" ${b.grouping==='left'?'selected':''}>(First + Second) → Third</option><option value="right" ${b.grouping==='right'?'selected':''}>First → (Second + Third)</option></select></label></div><div class="muted" style="font-size:11px">${b.grouping==='right'?`Structure: ${escapeHTML(b.a)} ${escapeHTML(b.rel)} (${escapeHTML(b.b)} ${escapeHTML(b.rel2)} ${escapeHTML(b.c)})`:`Structure: (${escapeHTML(b.a)} ${escapeHTML(b.rel)} ${escapeHTML(b.b)}) ${escapeHTML(b.rel2)} ${escapeHTML(b.c)}`}</div></div>`:`<button class="btn" id="gmAddThird" type="button">+ Add third idea</button>`;
      body.innerHTML=`<div class="glyph-maker-layout"><div class="card glyph-maker-form"><div><h3>Build a word glyph</h3><div class="muted">Combine two or three existing concepts. Use the third idea when a word needs a more specific or layered meaning.</div></div><div class="glyph-maker-relation"><label class="field"><span>First idea</span><select id="gmA">${glyphMakerConceptOptions(b.a)}</select></label><label class="field"><span>Relationship</span><select id="gmRel">${relOptions(b.rel)}</select></label><label class="field"><span>Second idea</span><select id="gmB">${glyphMakerConceptOptions(b.b)}</select></label></div>${thirdSection}<label class="field"><span>Word name</span><input id="gmName" value="${escapeHTML(b.name)}" placeholder="e.g. DARK_KING"></label><label class="field"><span>What does it mean?</span><input id="gmMeaning" value="${escapeHTML(b.meaning)}" placeholder="e.g. dark ruler"></label>${existing?`<div class="glyph-similarity-box warn"><div class="glyph-similarity-title"><span>This structure already exists</span><span class="pill warn">${escapeHTML(existing.id)}</span></div><div class="glyph-similarity-copy">You can still create a different conventional word, but the underlying construction matches an existing entry.</div></div>`:''}<div class="glyph-draw-wrap"><div class="grid12-note"><span class="grid12-badge">OPTIONAL CUSTOM RUNE</span><span>Leave this blank to keep the automatic compound composition, or draw a dedicated whole-word form here.</span></div><canvas id="compoundGlyphCanvas"></canvas><div class="grid12-caption">Press one point, drag to another, and release. If you draw a custom rune, that drawing becomes this word's canonical whole-word glyph.</div><div class="glyph-draw-actions"><div class="left-actions"><button class="btn" id="gmCompoundUndo">Undo line</button><button class="btn" id="gmCompoundClear">Clear</button></div><span class="pill">${(cd.strokes||[]).length} line${(cd.strokes||[]).length===1?'':'s'}</span></div></div><div id="gmCompoundSimilarity">${compoundDraftSimilarityHTML()}</div><div class="glyph-maker-save"><button class="btn primary" id="gmSaveCompound">Save word glyph</button><span class="muted">Saved under Dictionary → Built words.</span></div></div><div class="card glyph-maker-preview"><div><div class="gm-preview-label">Live preview</div>${proposalGlyph(tree,210)}<h2 style="margin-top:10px">${escapeHTML(b.name||'NEW WORD')}</h2><div class="muted" style="margin-top:6px">${escapeHTML(compactTreeReading(tree))}</div><div style="margin-top:18px"><div class="gm-preview-label">Custom whole-word preview</div><div class="gm-root-preview"><svg viewBox="0 0 100 100" aria-label="new compound preview"><path id="gmCompoundPreviewPath" d="${compoundDraftPath()}"></path></svg></div><div class="muted" id="gmCompoundPreviewCopy" style="margin-top:6px">${(cd.strokes||[]).length?'This drawn rune will be saved as the dedicated whole-word form.':'No custom rune drawn yet. Saving now will use the automatic compound composition.'}</div></div></div></div></div>`;
      const rerender=()=>renderGlyphMaker();
      document.getElementById('gmA').onchange=e=>{b.a=e.target.value;rerender()};document.getElementById('gmRel').onchange=e=>{b.rel=e.target.value;rerender()};document.getElementById('gmB').onchange=e=>{b.b=e.target.value;rerender()};
      if(b.third){document.getElementById('gmRel2').onchange=e=>{b.rel2=e.target.value;rerender()};document.getElementById('gmC').onchange=e=>{b.c=e.target.value;rerender()};document.getElementById('gmGrouping').onchange=e=>{b.grouping=e.target.value;rerender()};document.getElementById('gmRemoveThird').onclick=()=>{b.third=false;rerender()};}
      else document.getElementById('gmAddThird').onclick=()=>{b.third=true;rerender()};
      document.getElementById('gmName').oninput=e=>{b.name=e.target.value;};document.getElementById('gmMeaning').oninput=e=>{b.meaning=e.target.value;};
      document.getElementById('gmCompoundUndo').onclick=()=>{cd.strokes.pop();renderGlyphMaker()};document.getElementById('gmCompoundClear').onclick=()=>{cd.strokes=[];renderGlyphMaker()};document.getElementById('gmSaveCompound').onclick=saveGlyphMakerCompound;bindCompoundGlyphCanvas();
    }else{
      const d=appState.rootGlyphDraft;
      body.innerHTML=`<div class="glyph-maker-layout"><div class="card glyph-maker-form"><div><h3>Draw a new basic sign</h3><div class="muted">Use this only when the idea is fundamental enough that existing glyphs cannot express it simply.</div></div><div class="grid12-note"><span class="grid12-badge">8 × 8 GRID</span><span>Press one point, drag to another, and release. Each gesture creates exactly one straight segment.</span></div><label class="field"><span>Sign name</span><input id="gmRootName" value="${escapeHTML(d.name)}" placeholder="e.g. TIME"></label><label class="field"><span>Core meaning</span><input id="gmRootMeaning" value="${escapeHTML(d.meaning)}" placeholder="e.g. time / duration"></label><div class="glyph-draw-wrap"><canvas id="rootGlyphCanvas"></canvas><div class="grid12-caption">Horizontal, vertical and diagonal lines are all valid. The checker compares your draft with every existing root and whole-word rune.</div><div class="glyph-draw-actions"><div class="left-actions"><button class="btn" id="gmRootUndo">Undo line</button><button class="btn" id="gmRootClear">Clear</button></div><span class="pill">${(d.strokes||[]).length} line${(d.strokes||[]).length===1?'':'s'}</span></div></div><div class="glyph-maker-save"><button class="btn primary" id="gmSaveRoot">Save basic sign</button><span class="muted">Very similar shapes are blocked before saving.</span></div></div><div class="card glyph-maker-preview"><div><div class="gm-preview-label">Canonical preview</div><div class="gm-root-preview"><svg viewBox="0 0 100 100" aria-label="new root preview"><path id="gmRootPreviewPath" d="${rootDraftPath()}"></path></svg></div><h2 id="gmRootPreviewName">${escapeHTML(d.name||'NEW SIGN')}</h2><div class="muted" id="gmRootPreviewMeaning" style="margin-top:6px">${escapeHTML(d.meaning||'')}</div><div id="gmRootSimilarity">${rootDraftSimilarityHTML()}</div></div></div></div>`;
      document.getElementById('gmRootName').oninput=e=>{d.name=e.target.value;updateRootDraftPreview()};document.getElementById('gmRootMeaning').oninput=e=>{d.meaning=e.target.value;updateRootDraftPreview()};
      document.getElementById('gmRootUndo').onclick=()=>{d.strokes.pop();renderGlyphMaker()};document.getElementById('gmRootClear').onclick=()=>{d.strokes=[];renderGlyphMaker()};document.getElementById('gmSaveRoot').onclick=saveGlyphMakerRoot;bindRootGlyphCanvas();
    }
  };
})();
