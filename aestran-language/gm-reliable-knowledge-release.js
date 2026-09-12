/* Aestran reliable knowledge release v1
   Keeps semantic reveal definitions in sync and guarantees that releasing
   a queued meaning updates player knowledge, discoveries, and the live snapshot. */
(function(){
  if(window.__aestraReliableKnowledgeRelease)return;
  window.__aestraReliableKnowledgeRelease=true;

  function unique(values){
    const out=[];
    (values||[]).forEach(v=>{
      const s=String(v||'').trim();
      if(s&&!out.some(x=>x.toLowerCase()===s.toLowerCase()))out.push(s);
    });
    return out;
  }

  function rootRevealId(id,meaning){
    return 'root-'+String(id).toLowerCase()+'-'+safeConceptId(meaning).toLowerCase();
  }
  function compoundMeaningRevealId(id,meaning){
    return 'compound-'+String(id).toLowerCase()+'-meaning-'+safeConceptId(meaning).toLowerCase();
  }

  function ensureRevealDefinitions(){
    if(!Array.isArray(revealDefs))return;

    DATA.roots.forEach(r=>{
      if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
      const meanings=Array.isArray(r.semanticField)?r.semanticField:[];
      meanings.forEach(meaning=>{
        const existing=revealDefs.find(d=>d.root===r.id&&String(d.meaning||'').toLowerCase()===String(meaning).toLowerCase());
        if(existing)return;
        revealDefs.push({
          id:rootRevealId(r.id,meaning),
          root:r.id,
          meaning,
          label:r.id+' → '+meaning
        });
      });
    });

    DATA.compounds.forEach(c=>{
      if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
      const meanings=Array.isArray(c.semanticField)?c.semanticField:[];
      meanings.forEach(meaning=>{
        const existing=revealDefs.find(d=>d.compound===c.id&&String(d.meaning||'').toLowerCase()===String(meaning).toLowerCase());
        if(existing)return;
        revealDefs.push({
          id:compoundMeaningRevealId(c.id,meaning),
          compound:c.id,
          meaning,
          label:c.id+' → '+meaning
        });
      });
    });
  }

  function rootState(d){
    const r=rootMap[d.root];
    if(!r)return 'missing';
    if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
    if((r.knowledge?.confirmed||[]).includes(d.meaning))return 'confirmed';
    if((r.knowledge?.suspected||[]).includes(d.meaning))return 'suspected';
    return 'hidden';
  }

  function compoundMeaningState(d){
    const c=compoundMap[d.compound];
    if(!c)return 'missing';
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    if((c.knowledge?.confirmed||[]).includes(d.meaning))return 'confirmed';
    if((c.knowledge?.suspected||[]).includes(d.meaning))return 'suspected';
    return 'hidden';
  }

  function setCompoundMeaningConfirmed(c,meaning){
    if(window.normaliseCompoundSemantics)window.normaliseCompoundSemantics(c);
    if(!c.knowledge)c.knowledge={confirmed:[],suspected:[],hidden:[]};
    ['confirmed','suspected','hidden'].forEach(k=>{
      c.knowledge[k]=(c.knowledge[k]||[]).filter(x=>String(x).toLowerCase()!==String(meaning).toLowerCase());
    });
    c.knowledge.confirmed=unique([...(c.knowledge.confirmed||[]),meaning]);
  }

  function makeDiscovery(d,stamp,idx,beforeById,affectedNow){
    const echoes=affectedNow.map(i=>({
      id:i.id,
      title:i.title,
      before:beforeById.get(i.id)||'',
      after:playerSafeInscriptionReading(i)
    })).filter(e=>e.before!==e.after);

    return {
      id:'disc-'+stamp+'-'+idx+'-'+Math.random().toString(36).slice(2,6),
      revealId:d.id,
      label:d.label||(d.meaning?((d.root||d.compound)+' → '+d.meaning):(d.compound||d.root||'Discovery')),
      description:typeof revealDescription==='function'
        ?revealDescription(d)
        :(d.meaning?'The relic resolves a new meaning.':'The relic establishes a new word.'),
      kind:d.compound&&!d.meaning?'established word':'new meaning',
      glyphId:typeof revealGlyphId==='function'?revealGlyphId(d):(d.root||d.compound||null),
      at:stamp+idx,
      affected:echoes.map(e=>e.id),
      echoes
    };
  }

  async function publishReleasedState(createdIds){
    if(createdIds.length&&typeof enqueueDiscoveryRevealIds==='function')enqueueDiscoveryRevealIds(createdIds);
    appState.discoveryRevealIndex=0;
    appState.discoveryRevealActive=false;
    appState.pendingKnowledge=[];
    renderAll();

    try{saveWorkspaceNow({force:true});}
    catch(_){if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();}

    const snapshot=buildPlayerSafeSnapshot();
    const audit=typeof auditPlayerSafeSnapshot==='function'?auditPlayerSafeSnapshot(snapshot):{ok:true};

    if(!audit.ok){
      if(typeof liveSyncStatus==='function')liveSyncStatus('Knowledge was released in the GM workspace, but the Player-safe audit blocked live sync.','warn');
      return;
    }
    if(typeof liveDraftSyncReady==='function'&&!liveDraftSyncReady()){
      if(typeof liveSyncStatus==='function')liveSyncStatus('Knowledge released locally. Sign in as GM to update Player devices.','warn');
      return;
    }
    if(typeof publishLiveSnapshot==='function'){
      if(typeof liveSyncStatus==='function')liveSyncStatus('Releasing discoveries to connected players…');
      const live=await publishLiveSnapshot(snapshot);
      if(typeof liveSyncStatus==='function')liveSyncStatus(
        live?.ok?'Discoveries released live. Player Lexicons update automatically.':'Discovery release saved locally, but live sync failed: '+(live?.error||'unknown error'),
        live?.ok?'good':'warn'
      );
    }
  }

  function installReleaseHandler(){
    ensureRevealDefinitions();
    const releaseBtn=document.getElementById('pushKnowledge');
    if(!releaseBtn||releaseBtn.dataset.reliableKnowledgeRelease==='1')return;
    releaseBtn.dataset.reliableKnowledgeRelease='1';

    releaseBtn.onclick=async()=>{
      ensureRevealDefinitions();
      if(!(appState.pendingKnowledge||[]).length)return;

      releaseBtn.disabled=true;
      const pending=[...appState.pendingKnowledge];
      appState.lastKnowledgePush=pending;
      const stamp=Date.now(),createdIds=[];

      try{
        pending.forEach((pid,idx)=>{
          const d=revealDefs.find(x=>x.id===pid);
          if(!d)return;

          let alreadyConfirmed=false;
          if(d.root)alreadyConfirmed=rootState(d)==='confirmed';
          else if(d.compound&&d.meaning)alreadyConfirmed=compoundMeaningState(d)==='confirmed';
          else if(d.compound)alreadyConfirmed=!!compoundMap[d.compound]?.known;
          if(alreadyConfirmed)return;

          const affectedNow=typeof knowledgeAffectedInscriptions==='function'?knowledgeAffectedInscriptions([pid]):[];
          const beforeById=new Map(affectedNow.map(i=>[i.id,playerSafeInscriptionReading(i)]));

          if(d.root){
            const r=rootMap[d.root];
            if(!r)return;
            if(typeof setMeaningState==='function')setMeaningState(d.root,d.meaning,'confirmed',{render:false});
            else{
              if(window.normaliseRootSemantics)window.normaliseRootSemantics(r);
              ['confirmed','suspected','hidden'].forEach(k=>r.knowledge[k]=(r.knowledge[k]||[]).filter(x=>x!==d.meaning));
              r.knowledge.confirmed=unique([...(r.knowledge.confirmed||[]),d.meaning]);
            }
          }else if(d.compound&&d.meaning){
            const c=compoundMap[d.compound];if(!c)return;
            setCompoundMeaningConfirmed(c,d.meaning);
          }else if(d.compound){
            const c=compoundMap[d.compound];if(!c)return;
            c.known=true;
          }

          const entry=makeDiscovery(d,stamp,idx,beforeById,affectedNow);
          appState.discoveryLog.unshift(entry);
          createdIds.push(entry.id);
        });

        await publishReleasedState(createdIds);
      }finally{
        releaseBtn.disabled=false;
        try{renderPublish();}catch(_){}
      }
    };
  }

  try{
    const previousRenderPublish=renderPublish;
    renderPublish=function(){
      ensureRevealDefinitions();
      const result=previousRenderPublish.apply(this,arguments);
      queueMicrotask(installReleaseHandler);
      return result;
    };
  }catch(_){}

  queueMicrotask(installReleaseHandler);
})();