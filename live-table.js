const CONFIG=window.AESTRA_CONFIG||{};
const CAMPAIGN_ID=CONFIG.campaignId;
const DISPLAY_QUERY=new URLSearchParams(location.search).get('display')==='1';
const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
let supabase=null,user=null,isGM=false,state=null,assets=[],party=[],recent=[],filterKind='all',previewUrl='';

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId=id=>assets.find(a=>a.id===id)||null;
const pct=(a,b)=>Math.max(0,Math.min(100,b?Number(a||0)/Number(b)*100:0));
const configured=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&CAMPAIGN_ID);

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
  els.previewHeading.textContent=mode==='map'?'World Map':mode==='reveal'?'Reveal':mode==='title'?'Title Screen':mode==='blackout'?'Blackout':'Scene View';
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));

  setBackdrop(mode==='map'?(map||scene):scene);
  const name=mode==='map'?(map?.name||'WORLD MAP'):(state.location_title||scene?.name||'AESTRA');
  const sub=mode==='map'?(map?.subtitle||'Aestra'):(state.location_subtitle||scene?.subtitle||'');
  els.locationName.textContent=String(name).toUpperCase();
  els.locationSubtitle.textContent=sub;
  els.locationTitle.classList.toggle('hidden',mode==='title'||mode==='blackout');

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
}

function sceneCard(asset){
  const active=state?.active_scene_id===asset.id;
  return '<article class="scene-card'+(active?' active':'')+'" data-scene-id="'+asset.id+'">'+
    '<div class="scene-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>'+
    '<div><strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||'Scene backdrop')+'</small></div>'+
    '<button type="button">'+(active?'LIVE':'GO')+'</button></article>';
}

function renderScenes(){
  const scenes=assets.filter(a=>a.kind==='scene');
  els.sceneStrip.innerHTML=scenes.length?scenes.map(sceneCard).join(''):'<p class="muted">No scene backdrops yet. Press + to upload one.</p>';
  els.sceneStrip.querySelectorAll('[data-scene-id]').forEach(card=>card.querySelector('button').addEventListener('click',()=>activateScene(card.dataset.sceneId)));
}

function revealCard(asset){
  const mapAction=asset.kind==='map'
    ? '<button type="button" data-map="'+asset.id+'">WORLD MAP</button>'
    : '<button type="button" data-pin="'+asset.id+'">PIN</button>';
  return '<article class="reveal-card" data-kind="'+esc(asset.kind)+'"><div class="reveal-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>'+
    '<strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||asset.kind.replace('_',' '))+'</small>'+
    '<div class="card-actions"><button type="button" data-show="'+asset.id+'">SHOW</button>'+mapAction+'</div></article>';
}

function renderRevealGrid(){
  const visualAssets=assets.filter(a=>a.kind!=='scene'&&(filterKind==='all'||a.kind===filterKind));
  els.revealGrid.innerHTML=visualAssets.length?visualAssets.map(revealCard).join(''):'<p class="muted">No visuals in this category yet.</p>';
  els.revealGrid.querySelectorAll('[data-show]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.show)));
  els.revealGrid.querySelectorAll('[data-pin]').forEach(b=>b.addEventListener('click',()=>pinAsset(b.dataset.pin)));
  els.revealGrid.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>setWorldMap(b.dataset.map)));
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

async function setWorldMap(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  await patchState({mode:'map',map_asset_id:id,active_reveal_id:null});
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