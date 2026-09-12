/* Aestran GM published inscription controls v1
   Adds reliable Hide / Reveal / Delete controls to the published/shared inscription detail view. */
(function(){
  if(window.__aestraPublishedInscriptionControls)return;
  window.__aestraPublishedInscriptionControls=true;

  function escapeText(v){return String(v??'').trim();}

  function ensureRetractions(){
    if(!appState.playerRetractions||typeof appState.playerRetractions!=='object'){
      appState.playerRetractions={roots:{},compounds:{},inscriptions:{}};
    }
    if(!appState.playerRetractions.inscriptions||typeof appState.playerRetractions.inscriptions!=='object'){
      appState.playerRetractions.inscriptions={};
    }
    return appState.playerRetractions.inscriptions;
  }

  function currentPublishedCard(){
    const buttons=[...document.querySelectorAll('button')];
    const duplicate=buttons.find(b=>/duplicate to draft/i.test(escapeText(b.textContent)));
    const archive=buttons.find(b=>/open player archive/i.test(escapeText(b.textContent)));
    const anchor=duplicate||archive;
    if(!anchor)return null;
    const card=anchor.closest('.card')||anchor.parentElement?.parentElement;
    const actionRow=duplicate?.parentElement||archive?.parentElement;
    return {card,actionRow,duplicate,archive};
  }

  function currentInscription(card){
    const id=appState.selectedInscriptionId;
    let inscription=(appState.inscriptions||[]).find(x=>x.id===id);
    if(inscription)return inscription;

    const titleInput=card?.querySelector('input');
    const title=escapeText(titleInput?.value);
    if(title){
      const exact=(appState.inscriptions||[]).filter(x=>escapeText(x.title)===title);
      if(exact.length===1)return exact[0];
      inscription=exact.find(x=>x.published)||exact[0];
    }
    return inscription||null;
  }

  async function persistAndSync(message){
    try{ if(typeof renderAll==='function')renderAll(); }catch(_){}
    try{
      if(typeof saveWorkspaceNow==='function')saveWorkspaceNow({force:true});
      else if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
    }catch(_){}

    if(typeof buildPlayerSafeSnapshot!=='function')return;
    let snapshot;
    try{snapshot=buildPlayerSafeSnapshot();}catch(_){return;}

    try{
      if(typeof auditPlayerSafeSnapshot==='function'){
        const audit=auditPlayerSafeSnapshot(snapshot);
        if(audit&&!audit.ok){
          if(typeof liveSyncStatus==='function')liveSyncStatus(message+' saved in the GM workspace, but Player-safe audit blocked live sync.','warn');
          return;
        }
      }
      if(typeof liveDraftSyncReady==='function'&&!liveDraftSyncReady()){
        if(typeof liveSyncStatus==='function')liveSyncStatus(message+' saved locally. Sign in as GM to update the Player site.','warn');
        return;
      }
      if(typeof publishLiveSnapshot==='function'){
        if(typeof liveSyncStatus==='function')liveSyncStatus(message+' Syncing the Player site…');
        const result=await publishLiveSnapshot(snapshot);
        if(typeof liveSyncStatus==='function')liveSyncStatus(
          result?.ok?message+' Player devices update automatically.':message+' saved, but live sync failed: '+(result?.error||'unknown error'),
          result?.ok?'good':'warn'
        );
      }
    }catch(err){
      try{if(typeof liveSyncStatus==='function')liveSyncStatus(message+' saved, but live sync failed: '+String(err),'warn');}catch(_){}
    }
  }

  async function hideInscription(i){
    if(!i)return;
    if(!confirm('Hide “'+(i.title||'this inscription')+'” from players?\n\nIt will disappear from the Player Archive but remain safely in the GM archive.'))return;
    const retractions=ensureRetractions();
    retractions[i.id]={
      id:i.id,
      title:i.title||'Recovered inscription',
      ready:!!i.ready,
      retractedAt:new Date().toISOString()
    };
    i.published=false;
    i.ready=false;
    await persistAndSync('Hidden '+(i.title||'inscription')+' from players.');
    setTimeout(apply,0);
  }

  async function revealInscription(i){
    if(!i)return;
    i.published=true;
    i.ready=false;
    const retractions=ensureRetractions();
    delete retractions[i.id];
    await persistAndSync('Revealed '+(i.title||'inscription')+' to the Player Archive.');
    setTimeout(apply,0);
  }

  async function deleteInscription(i){
    if(!i)return;
    const published=!!i.published;
    const warning=published
      ?'This permanently deletes it from the GM archive and removes it from the Player Archive. This cannot be undone.'
      :'This permanently deletes it from the GM archive. This cannot be undone.';
    if(!confirm('Delete “'+(i.title||'this inscription')+'”?\n\n'+warning))return;

    appState.inscriptions=(appState.inscriptions||[]).filter(x=>x.id!==i.id);
    const retractions=ensureRetractions();
    delete retractions[i.id];

    if(Array.isArray(appState.discoveryLog)){
      appState.discoveryLog=appState.discoveryLog.map(d=>({
        ...d,
        affected:Array.isArray(d.affected)?d.affected.filter(x=>x!==i.id):d.affected,
        echoes:Array.isArray(d.echoes)?d.echoes.filter(e=>e?.id!==i.id):d.echoes
      }));
    }

    if(appState.selectedInscriptionId===i.id){
      appState.selectedInscriptionId=appState.inscriptions[0]?.id||null;
    }
    await persistAndSync('Deleted '+(i.title||'inscription')+'.');
    setTimeout(apply,0);
  }

  function makeButton(action,label,cls='btn ghost'){
    const b=document.createElement('button');
    b.type='button';
    b.className=cls;
    b.dataset.gmPublishedInscriptionAction=action;
    b.textContent=label;
    return b;
  }

  function apply(){
    const view=currentPublishedCard();
    if(!view?.actionRow)return;

    const i=currentInscription(view.card);
    if(!i)return;

    const row=view.actionRow;
    row.querySelectorAll('[data-gm-published-inscription-action]').forEach(b=>b.remove());

    const retractions=ensureRetractions();
    const hidden=!!retractions[i.id]&&!i.published;

    const visibilityBtn=makeButton(hidden?'reveal':'hide',hidden?'Reveal to Players':'Hide from Players');
    visibilityBtn.onclick=()=>hidden?revealInscription(i):hideInscription(i);

    const deleteBtn=makeButton('delete','Delete');
    deleteBtn.onclick=()=>deleteInscription(i);

    row.appendChild(visibilityBtn);
    row.appendChild(deleteBtn);
  }

  let queued=false;
  function queueApply(){
    if(queued)return;
    queued=true;
    setTimeout(()=>{queued=false;try{apply()}catch(_){}},0);
  }

  document.addEventListener('click',queueApply,true);
  const observer=new MutationObserver(queueApply);
  observer.observe(document.documentElement,{subtree:true,childList:true});
  queueApply();
})();