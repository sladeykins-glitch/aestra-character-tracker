/* Aestran GM full Basic Sign persistence hardening v1 */
(function(){
  const previousWorkspaceSnapshot=workspaceSnapshot;

  function restoreFullRoots(){
    const saved=workspaceBootstrap&&Array.isArray(workspaceBootstrap.fullRoots)?workspaceBootstrap.fullRoots:null;
    if(!saved||!saved.length)return false;

    const restored=saved.map(function(r){return clone(r);});
    DATA.roots.splice(0,DATA.roots.length,...restored);
    Object.keys(rootMap).forEach(function(id){delete rootMap[id];});
    DATA.roots.forEach(function(r){rootMap[r.id]=r;});

    // Remove stale review keys from roots that were renamed/deleted and provide
    // a default for any root restored without a review entry.
    if(!appState.rootReviewed||typeof appState.rootReviewed!=='object')appState.rootReviewed={};
    Object.keys(appState.rootReviewed).forEach(function(id){
      if(!rootMap[id])delete appState.rootReviewed[id];
    });
    DATA.roots.forEach(function(r){
      if(appState.rootReviewed[r.id]===undefined)appState.rootReviewed[r.id]=false;
    });

    if(appState.selectedLex&&!rootMap[appState.selectedLex]&&appState.lexMode==='roots'){
      appState.selectedLex=DATA.roots[0]?.id||null;
    }
    return true;
  }

  workspaceSnapshot=function(){
    const snap=previousWorkspaceSnapshot();
    // Keep schema 3 so older bootstrap code still accepts the workspace.
    // The extra field is additive and contains the authoritative current root set.
    snap.fullRoots=DATA.roots.map(function(r){return clone(r);});
    return snap;
  };

  if(restoreFullRoots()){
    try{
      if(typeof renderAll==='function')renderAll();
      if(typeof scheduleWorkspaceSave==='function')scheduleWorkspaceSave();
    }catch(_){}
  }
})();