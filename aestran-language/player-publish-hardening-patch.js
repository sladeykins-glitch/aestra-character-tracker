/* Aestran Player publish hardening v3 */
(function(){
  runePath=function(id){const c=compoundMap()[id];return rootMap()[id]?.svgPath||c?.svgPath||c?.canonicalPath||''};
  applyRemoteSnapshot=function(next,{realtime=false}={}){
    if(!validSnapshot(next))return false;
    const beforeDiscoveries=new Set((SNAP.discoveries||[]).map(discoveryKey)),beforeInscriptions=new Set((SNAP.inscriptions||[]).map(x=>String(x.id)));
    const newDiscoveries=(next.discoveries||[]).filter((x,i)=>!beforeDiscoveries.has(discoveryKey(x,i))),newInscriptions=(next.inscriptions||[]).filter(x=>!beforeInscriptions.has(String(x.id)));
    SNAP=next;saveSnapshot();selectedGlyph=null;practiceTarget=null;practiceMode='free';clearDrawing();
    const validIds=new Set([...(SNAP.roots||[]).map(x=>x.id),...(SNAP.compounds||[]).map(x=>x.id)]);
    bubbleLayout=Object.fromEntries(Object.entries(bubbleLayout||{}).filter(([id])=>validIds.has(id)));saveLayout();renderAll();
    if(realtime&&(newDiscoveries.length||newInscriptions.length))showLiveToast({discoveries:newDiscoveries.length,inscriptions:newInscriptions.length});
    return true;
  };
})();