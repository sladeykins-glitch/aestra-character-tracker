/* Aestran GM publish hardening v0.17.1 */
(function(){
  DATA.version='0.17.1-player-publish-hardening';
  function affineMultiply(a,b){return [a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];}
  function affineFromTransform(text=''){let out=[1,0,0,1,0,0],m;const re=/(translate|scale)\(([^)]+)\)/g;while((m=re.exec(text))){const nums=m[2].trim().split(/[ ,]+/).map(Number).filter(Number.isFinite);let op=[1,0,0,1,0,0];if(m[1]==='translate'){const tx=nums[0]||0,ty=nums.length>1?nums[1]:0;op=[1,0,0,1,tx,ty]}else{const sx=nums[0]??1,sy=nums.length>1?nums[1]:sx;op=[sx,0,0,sy,0,0]}out=affineMultiply(out,op)}return out;}
  function affinePoint(m,p){return {x:m[0]*p.x+m[2]*p.y+m[4],y:m[1]*p.x+m[3]*p.y+m[5]};}
  function compactNumber(n){const v=Math.round(n*1000)/1000;return Number.isInteger(v)?String(v):String(v).replace(/0+$/,'').replace(/\.$/,'');}
  function compoundResolvedPath(c){if(!c)return '';const inner=compoundSVGInner(c);if(!inner)return '';const holder=document.createElementNS('http://www.w3.org/2000/svg','svg');holder.innerHTML=inner;const segments=[];const walk=(el,parent=[1,0,0,1,0,0])=>{const local=affineMultiply(parent,affineFromTransform(el.getAttribute?.('transform')||''));if((el.tagName||'').toLowerCase()==='path'){parseCanonicalGridSegments(el.getAttribute('d')||'').forEach(seg=>segments.push([affinePoint(local,seg[0]),affinePoint(local,seg[1])]))}Array.from(el.children||[]).forEach(ch=>walk(ch,local))};Array.from(holder.children).forEach(ch=>walk(ch));return segments.map(([a,b])=>`M ${compactNumber(a.x)} ${compactNumber(a.y)} L ${compactNumber(b.x)} ${compactNumber(b.y)}`).join(' ');}
  window.compoundResolvedPath=compoundResolvedPath;
  buildPlayerSafeSnapshot=function(){
    const maps=playerSafeIdMaps();
    const roots=DATA.roots.map(r=>{const k=r.knowledge||{},confirmed=[...(k.confirmed||[])],suspected=[...(k.suspected||[])];return {id:maps.rootIds[r.id],kind:'root',meanings:confirmed,suspected,discovered:r.discovered!==false,svgPath:r.svgPath,writeOrder:clone(r.writeOrder||[]),writeOrderRule:(confirmed.length||suspected.length)?(r.writeOrderRule||''):''}});
    const compounds=DATA.compounds.filter(c=>!c.transient).map(c=>({id:maps.compoundIds[c.id],kind:'compound',known:!!c.known,tree:c.known?mapPlayerSafeTree(c.tree,maps):null,svgPath:compoundResolvedPath(c),canonicalPath:c.canonicalPath||'',writeOrder:clone(c.writeOrder||[]),writeOrderRule:c.known?(c.writeOrderRule||''):''}));
    const inscriptions=(appState.inscriptions||[]).filter(i=>i.published).map(i=>({id:i.id,title:i.title||'Recovered inscription',units:(i.units||[]).map(u=>mapPlayerSafeConcept(u,maps)),style:i.style||'natural',playerNote:i.playerNote||'',published:true}));
    const discoveries=(appState.discoveryLog||[]).map(d=>({id:d.id,label:d.label||'',description:d.description||'',kind:d.kind||'',glyphId:d.glyphId?mapPlayerSafeConcept(d.glyphId,maps):null,at:d.at||null,affected:[...(d.affected||[])],echoes:(d.echoes||[]).map(e=>({id:e.id,title:e.title||'',before:e.before||'',after:e.after||''}))}));
    return {schema:2,kind:'aestra-player-snapshot',publishedVersion:appState.publishedVersion,exportedAt:new Date().toISOString(),roots,compounds,relationships:clone(DATA.relationships||[]),modifiers:clone(DATA.modifiers||[]),inscriptions,discoveries};
  };
  const releaseBtn=document.getElementById('pushKnowledge');
  if(releaseBtn)releaseBtn.onclick=async()=>{
    if(!appState.pendingKnowledge.length)return;releaseBtn.disabled=true;
    const pending=[...appState.pendingKnowledge];appState.lastKnowledgePush=pending;const stamp=Date.now(),createdIds=[];
    pending.forEach((pid,idx)=>{const d=revealDefs.find(x=>x.id===pid);if(!d||revealApplied(d))return;const affectedNow=knowledgeAffectedInscriptions([pid]);const beforeById=new Map(affectedNow.map(i=>[i.id,playerSafeInscriptionReading(i)]));if(d.root)setMeaningState(d.root,d.meaning,'confirmed',{render:false});else if(d.compound)compoundMap[d.compound].known=true;const echoes=affectedNow.map(i=>({id:i.id,title:i.title,before:beforeById.get(i.id)||'',after:playerSafeInscriptionReading(i)})).filter(e=>e.before!==e.after);const entry={id:'disc-'+stamp+'-'+idx,revealId:pid,label:d.label,description:revealDescription(d),kind:d.compound?'established word':'new meaning',glyphId:revealGlyphId(d),at:stamp+idx,affected:echoes.map(e=>e.id),echoes};appState.discoveryLog.unshift(entry);createdIds.push(entry.id)});
    enqueueDiscoveryRevealIds(createdIds);appState.discoveryRevealIndex=0;appState.discoveryRevealActive=false;appState.pendingKnowledge=[];renderAll();
    const snapshot=buildPlayerSafeSnapshot(),audit=auditPlayerSafeSnapshot(snapshot);
    if(liveDraftSyncReady()&&audit.ok){liveSyncStatus('Releasing discoveries to connected players…');const live=await publishLiveSnapshot(snapshot);liveSyncStatus(live.ok?'Discoveries released live. Player Lexicons update automatically.':'Discovery release saved locally, but live sync failed: '+(live.error||'unknown error'),live.ok?'good':'warn')}else if(!liveDraftSyncReady())liveSyncStatus('Discovery released locally. Sign in as GM to push it to connected players.','warn');
    releaseBtn.disabled=false;renderPublish();scheduleWorkspaceSave();
  };
})();