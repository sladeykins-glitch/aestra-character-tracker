/* Aestran GM cloud-first sync safety v1 */
(function(){
  if(window.__aestraCloudFirstSync)return;
  window.__aestraCloudFirstSync=true;

  const originalScheduleLiveDraftSave=scheduleLiveDraftSave;
  const originalSaveLiveDraft=saveLiveDraft;
  const originalLoadCloudDraftIntoWorkspace=loadCloudDraftIntoWorkspace;
  let syncResolved=false;
  let resolving=false;

  function parsedLocalWorkspace(){
    try{
      const raw=localStorage.getItem(WORKSPACE_STORAGE_KEY);
      const parsed=raw?JSON.parse(raw):null;
      return parsed&&parsed.state?parsed:null;
    }catch(_){return null}
  }
  function localSavedMs(){
    const local=parsedLocalWorkspace();
    const value=local?.savedAt||workspaceBootstrap?.savedAt||null;
    const ms=value?Date.parse(value):0;
    return Number.isFinite(ms)?ms:0;
  }
  function workspaceRichness(snap){
    if(!snap||typeof snap!=='object')return {roots:0,customRoots:0,customCompounds:0,inscriptions:0};
    const fullRoots=Array.isArray(snap.fullRoots)?snap.fullRoots.length:0;
    const customRoots=Array.isArray(snap.customRoots)?snap.customRoots.length:0;
    const customCompounds=Array.isArray(snap.customCompounds)?snap.customCompounds.length:0;
    const inscriptions=Array.isArray(snap.state?.inscriptions)?snap.state.inscriptions.length:0;
    return {roots:fullRoots,customRoots,customCompounds,inscriptions};
  }
  function isStructurallyRicher(local,cloud){
    const a=workspaceRichness(local),b=workspaceRichness(cloud);
    return a.roots>b.roots||a.customRoots>b.customRoots||a.customCompounds>b.customCompounds||a.inscriptions>b.inscriptions;
  }
  function stampCloudWorkspace(row){
    const snap=clone(row.private_state);
    snap.savedAt=row.updated_at||snap.savedAt||new Date().toISOString();
    return snap;
  }
  function setResumeMessage(text){
    try{sessionStorage.setItem('aestra-gm-cloud-resume-message',text)}catch(_){}
  }
  function showResumeMessage(){
    try{
      const text=sessionStorage.getItem('aestra-gm-cloud-resume-message');
      if(!text)return;
      sessionStorage.removeItem('aestra-gm-cloud-resume-message');
      setTimeout(()=>{workspaceStatus(text,'good');liveSyncStatus(text,'good')},120);
    }catch(_){}
  }

  scheduleLiveDraftSave=function(snapshot){
    if(!syncResolved)return;
    return originalScheduleLiveDraftSave(snapshot);
  };

  async function resolveCloudFirst(){
    if(resolving)return false;
    if(!liveDraftSyncReady())return false;
    resolving=true;
    try{
      const row=await fetchCloudDraft();
      const localMs=localSavedMs();
      const cloudMs=row?.updated_at?Date.parse(row.updated_at):0;
      const threshold=2500;

      if(row?.private_state&&row.private_state.state){
        const localSnap=parsedLocalWorkspace()||workspaceBootstrap||workspaceSnapshot();
        if(isStructurallyRicher(localSnap,row.private_state)){
          syncResolved=true;
          liveSyncStatus('This browser contains additional GM content not present in the cloud copy. Keeping the richer browser workspace and repairing the private cloud backup…','good');
          await originalSaveLiveDraft(workspaceSnapshot(),{quiet:true});
          liveSyncStatus('Connected · richer browser workspace preserved and backed up privately to cloud.','good');
          return true;
        }
        if(cloudMs>localMs+threshold){
          const cloudSnap=stampCloudWorkspace(row);
          localStorage.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(cloudSnap));
          setResumeMessage('Loaded the newer GM workspace from your cloud account.');
          workspaceStatus('Newer cloud workspace found — loading it safely…','good');
          liveSyncStatus('Newer cloud workspace found. Loading it before cloud autosave starts…','good');
          setTimeout(()=>location.reload(),180);
          return false;
        }
        syncResolved=true;
        if(localMs>cloudMs+threshold){
          liveSyncStatus('This browser has newer GM changes. Updating the private cloud copy…','good');
          await originalSaveLiveDraft(workspaceSnapshot(),{quiet:true});
          liveSyncStatus('Connected · newer browser workspace saved privately to cloud.','good');
        }else{
          liveSyncStatus('Connected · local and cloud GM workspaces are in sync. Private autosave is on.','good');
        }
        return true;
      }

      syncResolved=true;
      await originalSaveLiveDraft(workspaceSnapshot(),{quiet:true});
      liveSyncStatus('Connected · this GM workspace is now backed up privately to cloud.','good');
      return true;
    }catch(err){
      syncResolved=false;
      liveSyncStatus('Cloud comparison failed, so cloud autosave is paused to protect your GM workspace. Local autosave is still safe.','warn');
      return false;
    }finally{
      resolving=false;
    }
  }

  refreshLiveIdentity=async function(){
    if(!liveClient)return;
    const {data:{session}}=await liveClient.auth.getSession();
    liveSession=session||null;liveProfile=null;syncResolved=false;
    if(!liveSession){
      renderLiveIdentity();
      liveSyncStatus('Offline/local mode. Sign in to back up this GM workspace and publish to players.');
      return;
    }
    const {data,error}=await liveClient.from('profiles').select('display_name,is_gm').eq('id',liveSession.user.id).maybeSingle();
    if(error){
      renderLiveIdentity();
      liveSyncStatus('Signed in, but profile permissions could not be read. Cloud writes remain paused.','warn');
      return;
    }
    liveProfile=data||{is_gm:false};
    renderLiveIdentity();
    if(!liveProfile.is_gm){
      liveSyncStatus('This account is signed in but is not marked as a GM. Cloud GM sync and live publishing are blocked.','warn');
      return;
    }
    await resolveCloudFirst();
  };

  saveLiveDraft=async function(snapshot=workspaceSnapshot(),opts={}){
    if(!liveDraftSyncReady())return false;
    if(!syncResolved){
      const ready=await resolveCloudFirst();
      if(!ready)return false;
    }
    return originalSaveLiveDraft(snapshot,opts);
  };

  loadCloudDraftIntoWorkspace=async function(){
    const row=await fetchCloudDraft();
    if(!row?.private_state||!row.private_state.state){
      liveSyncStatus('No compatible cloud GM workspace is available yet.','warn');
      return;
    }
    const localMs=localSavedMs(),cloudMs=row.updated_at?Date.parse(row.updated_at):0;
    const wording=cloudMs>=localMs
      ? 'Load the cloud GM workspace on this device? It is at least as new as this browser copy.'
      : 'The cloud workspace is older than this browser copy. Load it anyway and replace the newer local workspace?';
    if(!confirm(wording))return;
    const snap=stampCloudWorkspace(row);
    localStorage.setItem(WORKSPACE_STORAGE_KEY,JSON.stringify(snap));
    setResumeMessage('Cloud GM workspace loaded on this device.');
    workspaceStatus('Cloud workspace loaded — reloading…','good');
    setTimeout(()=>location.reload(),140);
  };

  window.aestraResolveCloudFirst=resolveCloudFirst;
  showResumeMessage();
})();