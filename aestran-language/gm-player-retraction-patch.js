/* Aestran GM retract / republish player content v2 — inscription hide / reveal UX */
(function(){
  if(window.__aestraPlayerRetractions)return;
  window.__aestraPlayerRetractions=true;

  const PLAYER_RESET_EPOCH='2026-09-12-fresh-slate-v1';
  function emptyRetractions(){return {roots:{},compounds:{},inscriptions:{}}}
  function resetPlayerFacingStateOnce(){
    const already=workspaceBootstrap?.state?.playerKnowledgeResetEpoch||appState.playerKnowledgeResetEpoch;
    if(already===PLAYER_RESET_EPOCH){appState.playerKnowledgeResetEpoch=PLAYER_RESET_EPOCH;return false;}
    DATA.roots.forEach(r=>{
      const k=r.knowledge||{confirmed:[],suspected:[],hidden:[]};
      k.hidden=unique([...(k.hidden||[]),...(k.confirmed||[]),...(k.suspected||[])]);
      k.confirmed=[];k.suspected=[];r.knowledge=k;
    });
    DATA.compounds.forEach(comp=>{
      comp.known=false;
      if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(comp);
      if(comp.knowledge){
        comp.knowledge.hidden=unique([...(comp.knowledge.hidden||[]),...(comp.knowledge.confirmed||[]),...(comp.knowledge.suspected||[])]);
        comp.knowledge.confirmed=[];comp.knowledge.suspected=[];
      }
    });
    (appState.inscriptions||[]).forEach(i=>{i.published=false;i.ready=false});
    appState.pendingKnowledge=[];
    appState.lastKnowledgePush=[];
    appState.discoveryLog=[];
    appState.pendingDiscoveryRevealIds=[];
    appState.lastDiscoveryBatchIds=[];
    appState.selectedPlayerGlyph=null;
    appState.playerRetractions=emptyRetractions();
    appState.playerKnowledgeResetEpoch=PLAYER_RESET_EPOCH;
    return true;
  }
  function unique(values){
    const out=[];
    (values||[]).forEach(v=>{const s=String(v||'').trim();if(s&&!out.some(x=>x.toLowerCase()===s.toLowerCase()))out.push(s)});
    return out;
  }
  function normaliseRetractions(value){
    const src=value&&typeof value==='object'?value:{};
    return {
      roots:src.roots&&typeof src.roots==='object'?src.roots:{},
      compounds:src.compounds&&typeof src.compounds==='object'?src.compounds:{},
      inscriptions:src.inscriptions&&typeof src.inscriptions==='object'?src.inscriptions:{}
    };
  }

  appState.playerRetractions=normaliseRetractions(
    workspaceBootstrap?.state?.playerRetractions||appState.playerRetractions||emptyRetractions()
  );

  function pruneOrphanedInscriptionRetractions(){
    const liveIds=new Set((appState.inscriptions||[]).map(i=>i.id));
    const hidden=appState.playerRetractions?.inscriptions||{};
    let changed=false;
    Object.keys(hidden).forEach(id=>{
      if(!liveIds.has(id)){
        delete hidden[id];
        changed=true;
      }
    });
    return changed;
  }

  const resetApplied=resetPlayerFacingStateOnce();
  const orphanRetractionsPruned=pruneOrphanedInscriptionRetractions();

  const previousWorkspaceSnapshot=workspaceSnapshot;
  workspaceSnapshot=function(){
    pruneOrphanedInscriptionRetractions();
    const snap=previousWorkspaceSnapshot();
    if(!snap.state)snap.state={};
    snap.state.playerRetractions=clone(appState.playerRetractions);
    snap.state.playerKnowledgeResetEpoch=appState.playerKnowledgeResetEpoch||PLAYER_RESET_EPOCH;
    return snap;
  };

  function removePlayerDiscoveriesFor(id,revealIds=[]){
    const ids=new Set(revealIds);
    appState.discoveryLog=(appState.discoveryLog||[]).filter(d=>d.glyphId!==id&&!ids.has(d.revealId));
    appState.lastKnowledgePush=(appState.lastKnowledgePush||[]).filter(x=>!ids.has(x));
    appState.pendingKnowledge=(appState.pendingKnowledge||[]).filter(x=>!ids.has(x));
    appState.pendingDiscoveryRevealIds=(appState.pendingDiscoveryRevealIds||[]).filter(x=>(appState.discoveryLog||[]).some(d=>d.id===x));
    appState.lastDiscoveryBatchIds=(appState.lastDiscoveryBatchIds||[]).filter(x=>(appState.discoveryLog||[]).some(d=>d.id===x));
  }

  function rootRevealIds(id){
    return revealDefs.filter(d=>d.root===id).map(d=>d.id);
  }
  function compoundRevealIds(id){
    return revealDefs.filter(d=>d.compound===id).map(d=>d.id);
  }

  function addFreshDiscovery({id,meaning=null,kind='new meaning',label=null,description=null,revealId=null}){
    const stamp=Date.now()+Math.floor(Math.random()*1000);
    const entry={
      id:'disc-republished-'+stamp+'-'+Math.random().toString(36).slice(2,8),
      revealId:revealId||('republished-'+String(id).toLowerCase()+'-'+safeConceptId(meaning||'word').toLowerCase()),
      label:label||(meaning?id+' → '+meaning:id),
      description:description||(meaning?'The relic reconstructs this meaning as a fresh discovery.':'The relic reconstructs this established word as a fresh discovery.'),
      kind,
      glyphId:id,
      at:stamp,
      affected:[],
      echoes:[]
    };
    appState.discoveryLog.unshift(entry);
    return entry.id;
  }

  async function pushCurrentPlayerState(message){
    renderAll();
    saveWorkspaceNow({force:true});
    const snapshot=buildPlayerSafeSnapshot();
    const audit=auditPlayerSafeSnapshot(snapshot);
    if(!audit.ok){
      liveSyncStatus(message+' saved in the GM workspace, but the Player-safe audit blocked live sync.','warn');
      return false;
    }
    if(!liveDraftSyncReady()){
      liveSyncStatus(message+' saved locally. Sign in as GM to update the Player site.','warn');
      return false;
    }
    liveSyncStatus(message+' Syncing the Player site…');
    const result=await publishLiveSnapshot(snapshot);
    liveSyncStatus(result.ok?message+' Player devices update automatically.':message+' saved, but live sync failed: '+(result.error||'unknown error'),result.ok?'good':'warn');
    return !!result.ok;
  }

  window.retractPlayerRoot=async function(id){
    const r=rootMap[id];if(!r)return;
    const k=r.knowledge||{confirmed:[],suspected:[],hidden:[]};
    const confirmed=[...(k.confirmed||[])],suspected=[...(k.suspected||[])];
    if(!confirmed.length&&!suspected.length)return;
    if(!confirm('Retract “'+id+'” from players?\n\nIts currently learned meanings will disappear from the Player Lexicon and related Discovery entries will be removed. The GM language truth is kept.'))return;
    appState.playerRetractions.roots[id]={id,confirmed,suspected,retractedAt:new Date().toISOString()};
    k.hidden=unique([...(k.hidden||[]),...confirmed,...suspected]);
    k.confirmed=[];k.suspected=[];
    removePlayerDiscoveriesFor(id,rootRevealIds(id));
    await pushCurrentPlayerState('Retracted '+id+' from players.');
  };

  window.retractPlayerCompound=async function(id){
    const c=compoundMap[id];if(!c)return;
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    const k=c.knowledge||{confirmed:[],suspected:[],hidden:[]};
    const confirmed=[...(k.confirmed||[])],suspected=[...(k.suspected||[])],known=!!c.known;
    if(!known&&!confirmed.length&&!suspected.length)return;
    if(!confirm('Retract “'+id+'” from players?\n\nIts revealed word name/meanings will disappear from the Player Lexicon and its Discovery entries will be removed. The Built Word remains in your GM dictionary.'))return;
    appState.playerRetractions.compounds[id]={id,known,confirmed,suspected,retractedAt:new Date().toISOString()};
    k.hidden=unique([...(k.hidden||[]),...confirmed,...suspected]);
    k.confirmed=[];k.suspected=[];c.known=false;
    removePlayerDiscoveriesFor(id,compoundRevealIds(id));
    await pushCurrentPlayerState('Retracted '+id+' from players.');
  };

  window.retractPlayerInscription=async function(id){
    const i=(appState.inscriptions||[]).find(x=>x.id===id);if(!i||!i.published)return;
    if(!confirm('Hide “'+(i.title||'this inscription')+'” from players?\n\nIt will disappear from their Archive, but stay saved on the GM side. You can reveal it again at any time.'))return;
    appState.playerRetractions.inscriptions[id]={id,title:i.title||'Recovered inscription',ready:!!i.ready,retractedAt:new Date().toISOString()};
    i.published=false;i.ready=false;
    await pushCurrentPlayerState('Hidden '+(i.title||'inscription')+' from players.');
  };

  window.republishPlayerRoot=async function(id){
    const rec=appState.playerRetractions.roots[id],r=rootMap[id];if(!rec||!r)return;
    const k=r.knowledge||{confirmed:[],suspected:[],hidden:[]};
    k.confirmed=unique([...(k.confirmed||[]),...(rec.confirmed||[])]);
    k.suspected=unique([...(k.suspected||[]),...(rec.suspected||[])]);
    const restored=[...k.confirmed,...k.suspected];
    k.hidden=(k.hidden||[]).filter(m=>!restored.some(x=>x.toLowerCase()===String(m).toLowerCase()));
    const created=[];
    (rec.confirmed||[]).forEach(m=>{
      const def=revealDefs.find(d=>d.root===id&&d.meaning===m);
      created.push(addFreshDiscovery({id,meaning:m,revealId:def?.id,label:def?.label,description:def?revealDescription(def):null}));
    });
    (rec.suspected||[]).forEach(m=>{
      const def=revealDefs.find(d=>d.root===id&&d.meaning===m);
      created.push(addFreshDiscovery({id,meaning:m,revealId:def?.id,label:def?.label,description:def?revealDescription(def):null}));
    });
    delete appState.playerRetractions.roots[id];
    if(created.length&&typeof enqueueDiscoveryRevealIds==='function')enqueueDiscoveryRevealIds(created);
    await pushCurrentPlayerState('Republished '+id+' as a fresh discovery.');
  };

  window.republishPlayerCompound=async function(id){
    const rec=appState.playerRetractions.compounds[id],c=compoundMap[id];if(!rec||!c)return;
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    const k=c.knowledge||{confirmed:[],suspected:[],hidden:[]};
    c.known=!!rec.known;
    k.confirmed=unique([...(k.confirmed||[]),...(rec.confirmed||[])]);
    k.suspected=unique([...(k.suspected||[]),...(rec.suspected||[])]);
    const restored=[...k.confirmed,...k.suspected];
    k.hidden=(k.hidden||[]).filter(m=>!restored.some(x=>x.toLowerCase()===String(m).toLowerCase()));
    const created=[];
    if(rec.known){
      const def=revealDefs.find(d=>d.compound===id);
      created.push(addFreshDiscovery({id,kind:'established word',revealId:def?.id,label:def?.label||id,description:def?revealDescription(def):null}));
    }
    (rec.confirmed||[]).forEach(m=>created.push(addFreshDiscovery({id,meaning:m,kind:'new meaning'})));
    (rec.suspected||[]).forEach(m=>created.push(addFreshDiscovery({id,meaning:m,kind:'new meaning'})));
    delete appState.playerRetractions.compounds[id];
    if(created.length&&typeof enqueueDiscoveryRevealIds==='function')enqueueDiscoveryRevealIds(created);
    await pushCurrentPlayerState('Republished '+id+' as a fresh discovery.');
  };

  window.republishPlayerInscription=async function(id){
    const rec=appState.playerRetractions.inscriptions[id],i=(appState.inscriptions||[]).find(x=>x.id===id);if(!rec||!i)return;
    i.published=true;i.ready=false;
    delete appState.playerRetractions.inscriptions[id];
    await pushCurrentPlayerState('Revealed '+(i.title||'inscription')+' to the Player Archive.');
  };

  function knownPlayerItems(){
    const roots=DATA.roots.filter(r=>(r.knowledge?.confirmed||[]).length||(r.knowledge?.suspected||[]).length);
    const compounds=DATA.compounds.filter(c=>{
      if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
      return !!c.known||!!(c.knowledge?.confirmed||[]).length||!!(c.knowledge?.suspected||[]).length;
    });
    return {roots,compounds};
  }

  function ensureKnowledgeRetractionPanel(){
    const screen=document.getElementById('knowledge');if(!screen)return;
    let card=document.getElementById('knownPlayerContentCard');
    if(!card){
      card=document.createElement('div');card.id='knownPlayerContentCard';card.className='card';
      const right=screen.querySelector('.knowledge-workbench>.stack:last-child');
      (right||screen.querySelector('.knowledge-workbench')||screen).appendChild(card);
    }
    const items=knownPlayerItems();
    const roots=items.roots.map(r=>{
      const vals=[...(r.knowledge?.confirmed||[]),...(r.knowledge?.suspected||[]).map(x=>x+' ?')];
      return '<div class="meaning-row row" style="justify-content:space-between;gap:10px"><div><b>'+escapeHTML(r.id)+'</b><div class="muted" style="font-size:10px">'+escapeHTML(vals.join(' · '))+'</div></div><button class="btn ghost" data-retract-root="'+escapeHTML(r.id)+'">Retract</button></div>';
    }).join('');
    const words=items.compounds.map(c=>{
      const vals=[...(c.knowledge?.confirmed||[]),...(c.knowledge?.suspected||[]).map(x=>x+' ?')];
      const copy=[c.known?'word name known':'',...vals].filter(Boolean).join(' · ');
      return '<div class="meaning-row row" style="justify-content:space-between;gap:10px"><div><b>'+escapeHTML(c.id)+'</b><div class="muted" style="font-size:10px">'+escapeHTML(copy)+'</div></div><button class="btn ghost" data-retract-compound="'+escapeHTML(c.id)+'">Retract</button></div>';
    }).join('');
    card.innerHTML='<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h3>Currently known by players</h3><div class="muted">Retract a sign without deleting it from the GM dictionary. Republishing later creates a fresh reveal event.</div></div><span class="pill">'+(items.roots.length+items.compounds.length)+' visible</span></div><div class="stack" style="margin-top:12px">'+(roots+words||'<div class="muted">The Player Lexicon is currently empty.</div>')+'</div>';
    card.querySelectorAll('[data-retract-root]').forEach(b=>b.onclick=()=>retractPlayerRoot(b.dataset.retractRoot));
    card.querySelectorAll('[data-retract-compound]').forEach(b=>b.onclick=()=>retractPlayerCompound(b.dataset.retractCompound));
  }

  function ensureInscriptionRetractionControl(){
    const id=appState.selectedInscriptionId,i=(appState.inscriptions||[]).find(x=>x.id===id);
    if(!i)return;
    const del=document.getElementById('deleteInscription');
    const duplicateBtn=[...document.querySelectorAll('button')].find(b=>/duplicate to draft/i.test((b.textContent||'').trim()));
    const archiveBtn=[...document.querySelectorAll('button')].find(b=>/open player archive/i.test((b.textContent||'').trim()));
    const host=del?.parentElement||document.getElementById('inscriptionEditor')||duplicateBtn?.parentElement||archiveBtn?.parentElement;
    if(!host)return;
    host.querySelectorAll('[data-player-inscription-action]').forEach(x=>x.remove());
    const rec=appState.playerRetractions.inscriptions[id];
    if(i.published){
      const btn=document.createElement('button');btn.className='btn ghost';btn.dataset.playerInscriptionAction='hide';btn.textContent='Hide from Players';btn.style.marginTop=duplicateBtn||archiveBtn?'0':'8px';btn.onclick=()=>retractPlayerInscription(id);host.appendChild(btn);
    }else if(rec){
      const btn=document.createElement('button');btn.className='btn';btn.dataset.playerInscriptionAction='reveal';btn.textContent='Reveal to Players';btn.style.marginTop=duplicateBtn||archiveBtn?'0':'8px';btn.onclick=()=>republishPlayerInscription(id);host.appendChild(btn);
    }
  }

  window.deletePlayerRetraction=function(kind,id){
    const bucket=kind==='root'
      ? appState.playerRetractions.roots
      : kind==='compound'
        ? appState.playerRetractions.compounds
        : appState.playerRetractions.inscriptions;
    const rec=bucket&&bucket[id];
    if(!rec)return;

    const title=rec.title||rec.id||id;
    const copy=kind==='inscription'
      ? 'The inscription will remain saved on the GM side and hidden from players.'
      : 'The GM dictionary entry will remain intact and hidden from players.';
    if(!confirm('Delete “'+title+'” from Retracted from Players?\n\n'+copy+' The saved restore record will be discarded, so this old reveal can no longer be republished from this panel.'))return;

    delete bucket[id];
    try{saveWorkspaceNow({force:true});}
    catch(_){if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();}
    try{renderPublish();}catch(_){renderAll();}
    if(typeof liveSyncStatus==='function')liveSyncStatus(title+' removed from the republish list. GM content was kept.','good');
  };

  function retractionRows(){
    pruneOrphanedInscriptionRetractions();
    const rows=[];
    Object.values(appState.playerRetractions.roots||{}).forEach(r=>rows.push({kind:'root',id:r.id,title:r.id,copy:'Basic Sign · '+[...(r.confirmed||[]),...(r.suspected||[])].join(' · ')}));
    Object.values(appState.playerRetractions.compounds||{}).forEach(r=>rows.push({kind:'compound',id:r.id,title:r.id,copy:'Built Word'+(r.known?' · word name':'')}));
    Object.values(appState.playerRetractions.inscriptions||{}).forEach(r=>rows.push({kind:'inscription',id:r.id,title:r.title||r.id,copy:'Hidden inscription · kept in GM archive'}));
    return rows;
  }

  function ensurePublishRetractions(){
    const impact=document.getElementById('publishImpact');if(!impact)return;
    let card=document.getElementById('playerRetractionsCard');
    if(!card){
      card=document.createElement('div');card.id='playerRetractionsCard';card.className='card';
      impact.closest('.card')?.insertAdjacentElement('afterend',card);
    }
    const rows=retractionRows();
    card.innerHTML='<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h3>Retracted from Players</h3><div class="muted">GM content kept safely here. Republish restores it and generates a brand-new player reveal.</div></div><span class="pill">'+rows.length+' retracted</span></div><div class="stack" style="margin-top:12px">'+(rows.length?rows.map(r=>'<div class="meaning-row row" style="justify-content:space-between;gap:10px"><div><b>'+escapeHTML(r.title)+'</b><div class="muted" style="font-size:10px">'+escapeHTML(r.copy)+'</div></div><div class="row" style="gap:8px;flex:0 0 auto"><button class="btn" data-republish-kind="'+r.kind+'" data-republish-id="'+escapeHTML(r.id)+'">'+(r.kind==='inscription'?'Reveal':'Republish')+'</button><button class="btn ghost" data-delete-retraction-kind="'+r.kind+'" data-delete-retraction-id="'+escapeHTML(r.id)+'">Delete</button></div></div>').join(''):'<div class="muted">Nothing is currently retracted.</div>')+'</div>';
    card.querySelectorAll('[data-republish-kind]').forEach(b=>b.onclick=()=>{
      const kind=b.dataset.republishKind,id=b.dataset.republishId;
      if(kind==='root')republishPlayerRoot(id);
      else if(kind==='compound')republishPlayerCompound(id);
      else republishPlayerInscription(id);
    });
    card.querySelectorAll('[data-delete-retraction-kind]').forEach(b=>b.onclick=()=>{
      deletePlayerRetraction(b.dataset.deleteRetractionKind,b.dataset.deleteRetractionId);
    });
  }

  const previousRenderKnowledge=renderKnowledge;
  renderKnowledge=function(){const r=previousRenderKnowledge.apply(this,arguments);queueMicrotask(ensureKnowledgeRetractionPanel);return r};

  const previousRenderInscriptions=renderInscriptions;
  renderInscriptions=function(){const r=previousRenderInscriptions.apply(this,arguments);queueMicrotask(ensureInscriptionRetractionControl);return r};

  const previousRenderPublish=renderPublish;
  renderPublish=function(){const r=previousRenderPublish.apply(this,arguments);queueMicrotask(ensurePublishRetractions);return r};

  queueMicrotask(()=>{if(resetApplied||orphanRetractionsPruned){renderAll();saveWorkspaceNow({force:true})}ensureKnowledgeRetractionPanel();ensureInscriptionRetractionControl();ensurePublishRetractions()});
})();