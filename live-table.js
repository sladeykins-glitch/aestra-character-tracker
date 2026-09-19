const CONFIG=window.AESTRA_CONFIG||{};
const CAMPAIGN_ID=CONFIG.campaignId;
const DISPLAY_QUERY=new URLSearchParams(location.search).get('display')==='1';
const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
let supabase=null,user=null,isGM=false,state=null,assets=[],party=[],recent=[],filterKind='all',previewUrl='';
let displayInitialized=false,lastDisplaySignature='',displayTransitionTimer=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId=id=>assets.find(a=>a.id===id)||null;
const pct=(a,b)=>Math.max(0,Math.min(100,b?Number(a||0)/Number(b)*100:0));
const configured=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&CAMPAIGN_ID);
const isInteractiveMap=asset=>asset?.kind==='map'&&asset?.metadata?.interactive===true;
const withMapRole=(url,role)=>url+(url.includes('?')?'&':'?')+'aestraRole='+encodeURIComponent(role);

async function ensureSupabase(){
  if(supabase)return supabase;
  if(!configured())throw new Error('Aestra Supabase configuration is missing.');
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase=mod.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
  return supabase;
}

function setAuthMessage(message){els.authMessage.textContent=message||''}
function showApp(){els.authGate.classList.add('hidden');els.app.classList.remove('hidden')}
function showAuth(){els.app.classList.add('hidden');els.authGate.classList.remove('hidden')}

async function checkRole(){
  const {data,error}=await supabase.from('profiles').select('is_gm').eq('id',user.id).maybeSingle();
  if(error)throw error;
  isGM=data?.is_gm===true;
  const displayOnly=DISPLAY_QUERY||!isGM;
  document.body.classList.toggle('display-only',displayOnly);
  if(!isGM){
    els.gmControls?.classList.add('hidden');
    els.gmQuickControls?.classList.add('hidden');
    els.gmHeader?.classList.add('hidden');
  }
}

async function loadState(){
  const {data,error}=await supabase.from('live_table_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  state=data;
  if(!state&&isGM){
    const fresh={campaign_id:CAMPAIGN_ID,mode:'scene',hud_visible:true,updated_by:user.id};
    const r=await supabase.from('live_table_state').insert(fresh).select().single();
    if(r.error)throw r.error;
    state=r.data;
  }
}

async function loadAssets(){
  const {data,error}=await supabase.from('live_table_assets').select('*').eq('campaign_id',CAMPAIGN_ID).order('created_at',{ascending:false});
  if(error)throw error;
  assets=data||[];
}

async function loadParty(){
  const {data,error}=await supabase.from('live_table_party').select('*').eq('campaign_id',CAMPAIGN_ID).order('name');
  if(error)throw error;
  party=data||[];
}

function renderParty(){
  if(!state?.hud_visible){els.partyHud.classList.add('hidden');return}
  els.partyHud.classList.remove('hidden');
  if(!party.length){
    els.partyHud.innerHTML='<div class="party-card"><div class="party-portrait">✦</div><div><div class="party-name">PARTY</div><div class="muted" style="font-size:9px">Character sheets will appear here.</div></div></div>';
    return;
  }
  els.partyHud.innerHTML=party.map(c=>{
    const portrait=c.portrait_url
      ? '<img class="party-portrait" src="'+esc(c.portrait_url)+'" alt="'+esc(c.name)+' portrait">'
      : '<div class="party-portrait">'+esc((c.name||'?')[0].toUpperCase())+'</div>';
    const statuses=(c.statuses||[]).map(s=>'<span class="status-pill">'+esc(s)+'</span>').join('');
    return '<article class="party-card">'+portrait+'<div><div class="party-name">'+esc(c.name||'Unnamed')+'</div>'+
      '<div class="resource"><span>HP</span><div class="resource-bar"><i style="width:'+pct(c.hp_current,c.hp_max)+'%"></i></div><b>'+Number(c.hp_current||0)+'/'+Number(c.hp_max||0)+'</b></div>'+
      '<div class="resource mp"><span>MP</span><div class="resource-bar"><i style="width:'+pct(c.mp_current,c.mp_max)+'%"></i></div><b>'+Number(c.mp_current||0)+'/'+Number(c.mp_max||0)+'</b></div>'+
      '<div class="resource ip"><span>IP</span><div class="resource-bar"><i style="width:'+pct(c.ip_current,c.ip_max)+'%"></i></div><b>'+Number(c.ip_current||0)+'/'+Number(c.ip_max||0)+'</b></div>'+
      (statuses?'<div class="status-row">'+statuses+'</div>':'')+'</div></article>';
  }).join('');
}

function setBackdrop(asset){
  els.backdrop.style.backgroundImage=asset?.image_url?'url("'+asset.image_url.replace(/"/g,'%22')+'")':'';
}

function displaySignature(s){
  if(!s)return '';
  return [
    s.mode||'scene',
    s.active_scene_id||'',
    s.map_asset_id||'',
    s.active_reveal_id||'',
    s.pinned_left_id||'',
    s.pinned_right_id||'',
    s.location_title||'',
    s.location_subtitle||'',
    s.hud_visible===false?'hud-off':'hud-on'
  ].join('|');
}

function playDisplayTransition(){
  if(!displayInitialized)return;
  const display=els.playerDisplay;
  if(!display)return;
  if(displayTransitionTimer)clearTimeout(displayTransitionTimer);
  display.classList.remove('display-transitioning');
  void display.offsetWidth;
  display.classList.add('display-transitioning');
  displayTransitionTimer=setTimeout(()=>{
    display.classList.remove('display-transitioning');
    displayTransitionTimer=null;
  },1250);
}

function renderPinned(host,id){
  const asset=byId(id);
  if(!asset){host.classList.add('hidden');host.innerHTML='';return}
  host.innerHTML='<img src="'+esc(asset.image_url)+'" alt="'+esc(asset.name)+'"><strong>'+esc(asset.name)+'</strong>';
  host.classList.remove('hidden');
}

function renderDisplay(){
  if(!state)return;
  const scene=byId(state.active_scene_id);
  const map=byId(state.map_asset_id);
  const reveal=byId(state.active_reveal_id);
  const mode=state.mode||'scene';
  const signature=displaySignature(state);
  if(displayInitialized&&signature!==lastDisplaySignature)playDisplayTransition();
  els.previewHeading.textContent=mode==='map'?'World Map':mode==='reveal'?'Reveal':mode==='title'?'Title Screen':mode==='blackout'?'Blackout':'Scene View';
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));

  const interactiveMapLive=mode==='map'&&isInteractiveMap(map);
  const backdropAsset=mode==='map'?(interactiveMapLive?scene:(map||scene)):scene;
  setBackdrop(backdropAsset);
  if(interactiveMapLive){
    const src=withMapRole(map.image_url,'player');
    if(els.worldMapFrame.dataset.assetId!==map.id){
      els.worldMapFrame.src=src;
      els.worldMapFrame.dataset.assetId=map.id;
    }
    els.worldMapFrame.classList.remove('hidden');
    els.playerDisplay.classList.add('map-live');
  }else{
    els.worldMapFrame.classList.add('hidden');
    els.playerDisplay.classList.remove('map-live');
  }
  const name=mode==='map'?(map?.name||'WORLD MAP'):(state.location_title||scene?.name||'AESTRA');
  const sub=mode==='map'?(map?.subtitle||'Aestra'):(state.location_subtitle||scene?.subtitle||'');
  els.locationName.textContent=String(name).toUpperCase();
  els.locationSubtitle.textContent=sub;
  els.locationTitle.classList.toggle('hidden',interactiveMapLive||mode==='title'||mode==='blackout');

  els.revealLayer.classList.toggle('hidden',mode!=='reveal'||!reveal);
  if(mode==='reveal'&&reveal){
    els.revealImage.src=reveal.image_url;
    els.revealImage.alt=reveal.name;
    els.revealKind.textContent=reveal.kind.replace('_',' ');
    els.revealName.textContent=reveal.name;
    els.revealSubtitle.textContent=reveal.subtitle||'';
  }

  els.titleLayer.classList.toggle('hidden',mode!=='title');
  els.blackoutLayer.classList.toggle('hidden',mode!=='blackout');
  renderPinned(els.pinLeft,state.pinned_left_id);
  renderPinned(els.pinRight,state.pinned_right_id);
  els.hudToggle.checked=state.hud_visible!==false;
  renderParty();
  lastDisplaySignature=signature;
  displayInitialized=true;
}

function sceneCard(asset){
  const active=state?.active_scene_id===asset.id;
  return '<article class="scene-card'+(active?' active':'')+'" data-scene-id="'+asset.id+'">'+
    '<div class="scene-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>'+
    '<div><strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||'Scene backdrop')+'</small></div>'+
    '<div class="scene-actions"><button type="button" data-scene-go="'+asset.id+'">'+(active?'LIVE':'GO')+'</button><button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderScenes(){
  const scenes=assets.filter(a=>a.kind==='scene');
  els.sceneStrip.innerHTML=scenes.length?scenes.map(sceneCard).join(''):'<p class="muted">No scene backdrops yet. Press + to upload one.</p>';
  els.sceneStrip.querySelectorAll('[data-scene-go]').forEach(b=>b.addEventListener('click',()=>activateScene(b.dataset.sceneGo)));
  els.sceneStrip.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeAssetFromDisplay(b.dataset.remove)));
  els.sceneStrip.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteAsset(b.dataset.delete)));
}

function revealCard(asset){
  const mapAction=asset.kind==='map'
    ? '<button type="button" data-map="'+asset.id+'">WORLD MAP</button>'
    : '<button type="button" data-pin="'+asset.id+'">PIN</button>';
  const thumb=isInteractiveMap(asset)
    ? '<div class="reveal-thumb interactive-map-thumb"><span>✦</span><b>INTERACTIVE ATLAS</b></div>'
    : '<div class="reveal-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>';
  return '<article class="reveal-card" data-kind="'+esc(asset.kind)+'">'+thumb+
    '<strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||asset.kind.replace('_',' '))+'</small>'+
    '<div class="card-actions"><button type="button" data-show="'+asset.id+'">SHOW</button>'+mapAction+'<button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderRevealGrid(){
  const visualAssets=assets.filter(a=>a.kind!=='scene'&&(filterKind==='all'||a.kind===filterKind));
  els.revealGrid.innerHTML=visualAssets.length?visualAssets.map(revealCard).join(''):'<p class="muted">No visuals in this category yet.</p>';
  els.revealGrid.querySelectorAll('[data-show]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.show)));
  els.revealGrid.querySelectorAll('[data-pin]').forEach(b=>b.addEventListener('click',()=>pinAsset(b.dataset.pin)));
  els.revealGrid.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>setWorldMap(b.dataset.map)));
  els.revealGrid.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeAssetFromDisplay(b.dataset.remove)));
  els.revealGrid.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteAsset(b.dataset.delete)));
}

function renderRecent(){
  const found=recent.map(byId).filter(Boolean).slice(0,8);
  els.recentList.innerHTML=found.length?found.map(a=>'<button class="recent-chip" type="button" data-recent="'+a.id+'">'+esc(a.name)+'</button>').join(''):'<p class="muted">Things you show will appear here.</p>';
  els.recentList.querySelectorAll('[data-recent]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.recent)));
}

function renderAll(){renderDisplay();renderScenes();renderRevealGrid();renderRecent()}

async function patchState(patch){
  if(!isGM)return;
  const payload={...patch,updated_by:user.id,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from('live_table_state').update(payload).eq('campaign_id',CAMPAIGN_ID).select().single();
  if(error){alert(error.message);return}
  state=data;
  renderAll();
}

async function activateScene(id){
  const asset=byId(id);if(!asset)return;
  await patchState({mode:'scene',active_scene_id:id,active_reveal_id:null,location_title:asset.name,location_subtitle:asset.subtitle||''});
}

async function showReveal(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  await patchState({mode:'reveal',active_reveal_id:id});
}

async function pinAsset(id){
  const left=state?.pinned_left_id;
  const right=state?.pinned_right_id;
  if(!left)await patchState({pinned_left_id:id});
  else if(!right)await patchState({pinned_right_id:id});
  else await patchState({pinned_left_id:id,pinned_right_id:null});
}

async function removeAssetFromDisplay(id){
  if(!state||!isGM)return;
  const patch={};
  if(state.active_scene_id===id){
    patch.active_scene_id=null;
    patch.location_title='';
    patch.location_subtitle='';
    if(state.mode==='scene')patch.mode='title';
  }
  if(state.active_reveal_id===id){
    patch.active_reveal_id=null;
    if(state.mode==='reveal')patch.mode=state.active_scene_id?'scene':'title';
  }
  if(state.map_asset_id===id){
    patch.map_asset_id=null;
    if(state.mode==='map')patch.mode=state.active_scene_id?'scene':'title';
  }
  if(state.pinned_left_id===id)patch.pinned_left_id=null;
  if(state.pinned_right_id===id)patch.pinned_right_id=null;
  if(Object.keys(patch).length)await patchState(patch);
}

async function deleteAsset(id){
  if(!isGM)return;
  const asset=byId(id);
  if(!asset)return;
  if(!confirm('Delete "'+asset.name+'" permanently? This removes it from the Live Table library and deletes its uploaded file.'))return;
  await removeAssetFromDisplay(id);
  const del=await supabase.from('live_table_assets').delete().eq('id',id);
  if(del.error){alert(del.error.message);return}
  if(asset.storage_path){
    const storageDelete=await supabase.storage.from('live-table').remove([asset.storage_path]);
    if(storageDelete.error)console.warn('Could not remove storage file',storageDelete.error);
  }
  assets=assets.filter(a=>a.id!==id);
  recent=recent.filter(x=>x!==id);
  renderAll();
}

async function setWorldMap(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  await patchState({mode:'map',map_asset_id:id,active_reveal_id:null});
}

function injectLiveMapPresentation(source){
  if(source.includes('id="aestra-live-table-map-bridge"'))return source;
  const style='<style id="aestra-live-table-map-style">#app.presentation #presentationExit{display:none!important}body.aestra-live-embedded{background:#05080b!important}</style>';
  const script='<script id="aestra-live-table-map-bridge">(function(){var role=new URLSearchParams(location.search).get("aestraRole");function apply(){if(role!=="player")return;document.body.classList.add("aestra-live-embedded");var app=document.getElementById("app");if(app)app.classList.add("presentation");var exit=document.getElementById("presentationExit");if(exit)exit.style.display="none";var toggle=document.getElementById("presentationToggle");if(toggle)toggle.style.display="none"}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(apply,80)});else setTimeout(apply,80);})();<\/script>';
  let out=source;
  out=out.includes('</head>')?out.replace('</head>',style+'</head>'):style+out;
  out=out.includes('</body>')?out.replace('</body>',script+'</body>'):out+script;
  return out;
}

async function importInteractiveMap(){
  if(!isGM)return;
  const file=els.interactiveMapFile.files?.[0];
  if(!file)return;
  els.mapImportStatus.textContent='Preparing interactive map…';
  try{
    if(file.size>30*1024*1024)throw new Error('That map file is larger than 30 MB.');
    const source=await file.text();
    if(!/<html[\s>]/i.test(source)||!/<body[\s>]/i.test(source))throw new Error('Choose the Aestra interactive map HTML file.');
    const prepared=injectLiveMapPresentation(source);
    const payload=new Blob([prepared],{type:'text/html'});
    const storagePath=CAMPAIGN_ID+'/interactive-map-'+crypto.randomUUID()+'.html';
    els.mapImportStatus.textContent='Uploading interactive atlas…';
    const up=await supabase.storage.from('live-table').upload(storagePath,payload,{cacheControl:'3600',upsert:false,contentType:'text/html'});
    if(up.error)throw up.error;
    const publicUrl=supabase.storage.from('live-table').getPublicUrl(storagePath).data.publicUrl;
    const existing=assets.find(isInteractiveMap);
    const row={
      campaign_id:CAMPAIGN_ID,
      kind:'map',
      name:existing?.name||'Aestra Interactive World Map',
      subtitle:'Interactive atlas',
      image_url:publicUrl,
      storage_path:storagePath,
      metadata:{interactive:true,source_name:file.name,imported_at:new Date().toISOString()},
      created_by:user.id,
      updated_at:new Date().toISOString()
    };
    let saved;
    if(existing){
      const result=await supabase.from('live_table_assets').update(row).eq('id',existing.id).select().single();
      if(result.error){await supabase.storage.from('live-table').remove([storagePath]);throw result.error}
      saved=result.data;
      if(existing.storage_path&&existing.storage_path!==storagePath)await supabase.storage.from('live-table').remove([existing.storage_path]);
      assets=assets.map(a=>a.id===saved.id?saved:a);
    }else{
      const result=await supabase.from('live_table_assets').insert(row).select().single();
      if(result.error){await supabase.storage.from('live-table').remove([storagePath]);throw result.error}
      saved=result.data;
      assets=[saved,...assets];
    }
    els.mapImportStatus.textContent='Interactive Aestra map linked. World Map mode now uses it.';
    await setWorldMap(saved.id);
    renderAll();
  }catch(err){
    console.error(err);
    els.mapImportStatus.textContent=err?.message||'Could not import the interactive map.';
  }finally{
    els.interactiveMapFile.value='';
  }
}

function openMapEditor(){
  const selected=byId(state?.map_asset_id);
  const map=isInteractiveMap(selected)?selected:assets.find(isInteractiveMap);
  if(!map){els.interactiveMapFile.click();return}
  window.open(withMapRole(map.image_url,'gm'),'aestra-world-map-editor');
}

function openAssetDialog(kind='npc'){
  els.assetForm.reset();
  els.assetKind.value=kind;
  els.assetPreview.classList.add('hidden');
  els.assetPreview.removeAttribute('src');
  els.assetMessage.textContent='';
  els.dialogTitle.textContent=kind==='scene'?'Upload scene backdrop':'Upload artwork';
  els.assetDialog.showModal();
}

function previewSelectedFile(){
  const file=els.assetFile.files?.[0];
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
  if(!file){els.assetPreview.classList.add('hidden');return}
  previewUrl=URL.createObjectURL(file);
  els.assetPreview.src=previewUrl;
  els.assetPreview.classList.remove('hidden');
}

async function uploadAsset(e){
  e.preventDefault();
  if(!isGM)return;
  const file=els.assetFile.files?.[0];
  if(!file){els.assetMessage.textContent='Choose an image first.';return}
  if(file.size>15*1024*1024){els.assetMessage.textContent='That image is larger than 15 MB.';return}
  const name=els.assetName.value.trim();
  if(!name){els.assetMessage.textContent='Give the visual a name.';return}
  const kind=els.assetKind.value;
  const subtitle=els.assetSubtitle.value.trim();
  els.saveAssetBtn.disabled=true;
  els.assetMessage.textContent='Uploading…';
  try{
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const storagePath=CAMPAIGN_ID+'/'+crypto.randomUUID()+'.'+ext;
    const up=await supabase.storage.from('live-table').upload(storagePath,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(up.error)throw up.error;
    const pub=supabase.storage.from('live-table').getPublicUrl(storagePath);
    const imageUrl=pub.data.publicUrl;
    const ins=await supabase.from('live_table_assets').insert({campaign_id:CAMPAIGN_ID,kind,name,subtitle,image_url:imageUrl,storage_path:storagePath,created_by:user.id}).select().single();
    if(ins.error){
      await supabase.storage.from('live-table').remove([storagePath]);
      throw ins.error;
    }
    assets=[ins.data,...assets];
    els.assetDialog.close();
    if(kind==='scene')await activateScene(ins.data.id);
    else{renderAll();recent=[ins.data.id,...recent.filter(x=>x!==ins.data.id)];renderRecent()}
  }catch(err){
    console.error(err);
    els.assetMessage.textContent=err?.message||'Upload failed.';
  }finally{
    els.saveAssetBtn.disabled=false;
  }
}

async function generateAiBackdrop(){
  if(!isGM)return;
  const name=els.aiSceneName.value.trim();
  const subtitle=els.aiSceneSubtitle.value.trim();
  const prompt=els.aiPrompt.value.trim();
  const quality=els.aiQuality.value;
  if(!name){els.aiStatus.textContent='Give the scene a name first.';els.aiSceneName.focus();return}
  if(!prompt){els.aiStatus.textContent='Describe the backdrop you want first.';els.aiPrompt.focus();return}
  els.generateBackdropBtn.disabled=true;
  els.aiStatus.textContent='Generating Aestra backdrop…';
  try{
    const {data,error}=await supabase.functions.invoke('generate-live-table-backdrop',{
      body:{campaignId:CAMPAIGN_ID,name,subtitle,prompt,quality}
    });
    if(error){
      let message=error.message||'Generation failed.';
      try{
        if(error.context){
          const details=await error.context.json();
          if(details?.error)message=details.error;
        }
      }catch(_){}
      throw new Error(message);
    }
    if(data?.error)throw new Error(data.error);
    if(!data?.asset)throw new Error('No scene was returned.');
    assets=[data.asset,...assets.filter(a=>a.id!==data.asset.id)];
    els.aiStatus.textContent='Backdrop created and saved. Putting it live now…';
    await activateScene(data.asset.id);
    els.aiStatus.textContent='Backdrop created, saved, and live.';
    els.aiSceneName.value='';
    els.aiSceneSubtitle.value='';
    els.aiPrompt.value='';
    renderAll();
  }catch(err){
    console.error(err);
    const msg=err?.message||'Could not generate the backdrop.';
    els.aiStatus.textContent=msg.includes('OPENAI_API_KEY')
      ? 'AI generator is installed, but the OpenAI API key still needs to be added to the Supabase function secrets.'
      : msg;
  }finally{
    els.generateBackdropBtn.disabled=false;
  }
}

function addAiPromptChip(value){
  const current=els.aiPrompt.value.trim();
  els.aiPrompt.value=current?current.replace(/[,. ]*$/,'')+', '+value:value;
  els.aiPrompt.focus();
}

function subscribeRealtime(){
  supabase.channel('aestra-live-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{if(payload.new){state=payload.new;renderAll()}})
    .subscribe();
  supabase.channel('aestra-live-assets')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_assets',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadAssets();renderAll()})
    .subscribe();
  supabase.channel('aestra-live-party')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_party',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadParty();renderParty()})
    .subscribe();
}

function wire(){
  els.authForm.addEventListener('submit',async e=>{
    e.preventDefault();setAuthMessage('Signing in…');
    try{
      await ensureSupabase();
      const {data,error}=await supabase.auth.signInWithPassword({email:els.emailInput.value.trim(),password:els.passwordInput.value});
      if(error)throw error;
      user=data.user;
      await startApp();
    }catch(err){setAuthMessage(err?.message||'Sign in failed.')}
  });
  els.logoutBtn.addEventListener('click',async()=>{await supabase?.auth.signOut();location.reload()});
  els.openDisplayBtn.addEventListener('click',()=>window.open('live-table.html?display=1','aestra-player-display'));
  els.addSceneBtn.addEventListener('click',()=>openAssetDialog('scene'));
  els.addVisualBtn.addEventListener('click',()=>openAssetDialog('npc'));
  els.closeDialogBtn.addEventListener('click',()=>els.assetDialog.close());
  els.cancelAssetBtn.addEventListener('click',()=>els.assetDialog.close());
  els.assetFile.addEventListener('change',previewSelectedFile);
  els.assetForm.addEventListener('submit',uploadAsset);
  els.returnSceneBtn.addEventListener('click',()=>patchState({mode:'scene',active_reveal_id:null}));
  els.clearPinsBtn.addEventListener('click',()=>patchState({pinned_left_id:null,pinned_right_id:null}));
  els.hudToggle.addEventListener('change',()=>patchState({hud_visible:els.hudToggle.checked}));
  els.modeSwitch.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    const mode=b.dataset.mode;
    if(mode==='map'&&!state?.map_asset_id){els.setMapAssetBtn.click();return}
    patchState({mode,active_reveal_id:mode==='reveal'?state?.active_reveal_id:null});
  }));
  els.revealTabs.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{
    filterKind=b.dataset.kind;
    els.revealTabs.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));
    renderRevealGrid();
  }));
  els.setMapAssetBtn.addEventListener('click',()=>{
    const maps=assets.filter(a=>a.kind==='map');
    if(!maps.length){openAssetDialog('map');return}
    const current=state?.map_asset_id;
    const index=Math.max(-1,maps.findIndex(m=>m.id===current));
    setWorldMap(maps[(index+1)%maps.length].id);
  });
  els.importInteractiveMapBtn.addEventListener('click',()=>els.interactiveMapFile.click());
  els.interactiveMapFile.addEventListener('change',importInteractiveMap);
  els.openMapEditorBtn.addEventListener('click',openMapEditor);
  els.generateBackdropBtn.addEventListener('click',generateAiBackdrop);
  document.querySelectorAll('[data-ai-chip]').forEach(b=>b.addEventListener('click',()=>addAiPromptChip(b.dataset.aiChip)));
}

async function startApp(){
  showApp();
  await checkRole();
  await Promise.all([loadState(),loadAssets(),loadParty()]);
  renderAll();
  subscribeRealtime();
}

async function boot(){
  try{
    wire();
    await ensureSupabase();
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    if(!data.session){showAuth();return}
    user=data.session.user;
    await startApp();
  }catch(err){
    console.error(err);
    showAuth();
    setAuthMessage(err?.message||'Could not start Aestra Live Table.');
  }
}
boot();