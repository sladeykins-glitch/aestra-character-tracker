import {drawImageCover,SceneAtmosphereRenderer} from './live-table-effects.js?v=5';
import {LifecycleManager,changedKeys,delegate,valueEqual} from './live-table-runtime.js?v=1';

const CONFIG=window.AESTRA_CONFIG||{};
const CAMPAIGN_ID=CONFIG.campaignId;
const DISPLAY_QUERY=new URLSearchParams(location.search).get('display')==='1';
const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
let supabase=null,user=null,isGM=false,state=null,assets=[],party=[],recent=[],filterKind='all',previewUrl='';
let libraryDragAssetId='';
const IS_PLAYER_DISPLAY=DISPLAY_QUERY;
const canGMControl=()=>isGM&&!IS_PLAYER_DISPLAY;
const shouldReceivePlayerMap=()=>IS_PLAYER_DISPLAY||!isGM;
let displayInitialized=false,lastDisplaySignature='',displayTransitionTimer=null,lastDisplayMode='scene',lastRenderedSceneId='',lastRenderedTransitionNonce=0;
const interactiveMapCache=new Map();
let interactiveMapLoadToken=0;
let mapState=null,mapStateSaveTimer=null,mapBridgeReady=false;
let mapMotionChannel=null,mapMotionReady=false,lastMapMotionSentAt=0,lastMapCameraSentAt=0,lastMapJourneySentAt=0;
let browserMapMotionChannel=null;
let lastPolledMapMirrorSignature='',lastPolledMapCameraSignature='',lastPolledMapJourneySignature='';
let mapCameraPersistTimer=null;
let lastPlayerMapStateUpdatedAt='';
let mapStatePersistBusy=false,mapStatePersistPending=null,lastMapStatePersistAt=0;
let cueSequenceDragId='';
let sceneCastDragId='';
let sceneCastArrangeMode=false;
const SCENE_CAST_SLOTS=[
  {key:'far-left',label:'Far Left',x:8},
  {key:'left',label:'Left',x:25},
  {key:'centre-left',label:'Centre Left',x:42},
  {key:'centre-right',label:'Centre Right',x:58},
  {key:'right',label:'Right',x:75},
  {key:'far-right',label:'Far Right',x:92}
];
const SCENE_CAST_SLOT_KEYS=new Set(SCENE_CAST_SLOTS.map(slot=>slot.key));
const SCENE_CAST_SIZE_TIERS=['tiny','small','medium','large','massive'];
const SCENE_CAST_SIZE_KEYS=new Set(SCENE_CAST_SIZE_TIERS);
const SCENE_CAST_DEFAULT_SIZE='medium';
const sceneCastArtworkBoundsCache=new Map();
const sceneCastLeaveTimers=new Map();
const cuePreloadedUrls=new Set();
const cuePreloadedAudioUrls=new Set();
const cueAudioPreloaders=new Map();
let liveAudioEngine=null;
let aiBackdropPreviewState=null;
let gmAudioPreview=null;
let majorIntroAssetId='';
let majorIntroTimer=0;
let majorIntroAudio=null;
let majorIntroInitialized=false;
let lastMajorIntroNonce=0;
const runtimeLifecycle=new LifecycleManager();
let realtimeChannels=[];

let derivedStateRef=null;
let derivedAssetsRef=null;
const derivedStateCache=new Map();

function derivedStateValue(key,factory){
  if(derivedStateRef!==state||derivedAssetsRef!==assets){
    derivedStateRef=state;
    derivedAssetsRef=assets;
    derivedStateCache.clear();
  }
  if(derivedStateCache.has(key))return derivedStateCache.get(key);
  const value=factory();
  derivedStateCache.set(key,value);
  return value;
}

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId=id=>assets.find(a=>a.id===id)||null;
const pct=(a,b)=>Math.max(0,Math.min(100,b?Number(a||0)/Number(b)*100:0));
const configured=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&CAMPAIGN_ID);
const isInteractiveMap=asset=>asset?.kind==='map'&&asset?.metadata?.interactive===true;
const withMapRole=(url,role)=>url+(url.includes('?')?'&':'?')+'aestraRole='+encodeURIComponent(role);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const warmedArtworkUrls=new Set();
let thumbnailBackfillRunning=false;

function assetMetadata(asset){
  return asset?.metadata&&typeof asset.metadata==='object'&&!Array.isArray(asset.metadata)?asset.metadata:{};
}

function assetThumbnailUrl(asset){
  return assetMetadata(asset).thumbnail_url||asset?.image_url||'';
}

function thumbnailEligibleAsset(asset){
  if(!asset?.id||!asset?.image_url||isInteractiveMap(asset))return false;
  return asset.kind!=='map'||/.(?:png|jpe?g|webp|gif)(?:$|[?#])/i.test(asset.image_url);
}

async function imageBlobToThumbnail(blob,maxSide=512){
  if(!(blob instanceof Blob)||!blob.type.startsWith('image/'))throw new Error('Thumbnail source is not an image.');

  let source=null;
  let revoke='';
  try{
    if('createImageBitmap' in window){
      source=await createImageBitmap(blob);
    }else{
      revoke=URL.createObjectURL(blob);
      source=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error('Could not decode artwork for thumbnail.'));
        img.src=revoke;
      });
    }

    const sw=Number(source.width||source.naturalWidth)||1;
    const sh=Number(source.height||source.naturalHeight)||1;
    const scale=Math.min(1,maxSide/Math.max(sw,sh));
    const width=Math.max(1,Math.round(sw*scale));
    const height=Math.max(1,Math.round(sh*scale));
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const ctx=canvas.getContext('2d',{alpha:false});
    if(!ctx)throw new Error('Thumbnail canvas unavailable.');
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(source,0,0,width,height);

    const encode=(type,quality)=>new Promise(resolve=>canvas.toBlob(resolve,type,quality));
    let out=await encode('image/webp',.78);
    let ext='webp';
    if(!out){
      out=await encode('image/jpeg',.8);
      ext='jpg';
    }
    if(!out)throw new Error('Could not encode thumbnail.');
    return {blob:out,width,height,ext,mime:out.type||('image/'+ext)};
  }finally{
    try{source?.close?.()}catch(_){}
    if(revoke)URL.revokeObjectURL(revoke);
  }
}

async function uploadThumbnailBlob(blob){
  const thumb=await imageBlobToThumbnail(blob);
  const path=CAMPAIGN_ID+'/thumbs/'+crypto.randomUUID()+'.'+thumb.ext;
  const up=await supabase.storage.from('live-table').upload(path,thumb.blob,{
    cacheControl:'31536000',
    upsert:false,
    contentType:thumb.mime
  });
  if(up.error)throw up.error;
  const url=supabase.storage.from('live-table').getPublicUrl(path).data.publicUrl;
  return {
    thumbnail_url:url,
    thumbnail_path:path,
    thumbnail_width:thumb.width,
    thumbnail_height:thumb.height,
    thumbnail_version:1
  };
}

async function ensureAssetThumbnail(asset){
  if(!canGMControl()||!thumbnailEligibleAsset(asset))return asset;
  const meta=assetMetadata(asset);
  if(meta.thumbnail_url&&meta.thumbnail_path)return asset;

  let uploaded=null;
  try{
    const response=await fetch(asset.image_url,{cache:'force-cache'});
    if(!response.ok)throw new Error('Could not fetch artwork for thumbnail.');
    const blob=await response.blob();
    uploaded=await uploadThumbnailBlob(blob);
    const metadata={...meta,...uploaded};
    const result=await supabase.from('live_table_assets')
      .update({metadata,updated_at:new Date().toISOString()})
      .eq('id',asset.id)
      .select()
      .single();
    if(result.error)throw result.error;
    assets=assets.map(item=>item.id===asset.id?result.data:item);
    return result.data;
  }catch(err){
    if(uploaded?.thumbnail_path){
      try{await supabase.storage.from('live-table').remove([uploaded.thumbnail_path])}catch(_){}
    }
    console.warn('Could not create thumbnail for '+(asset?.name||'asset'),err);
    return asset;
  }
}

async function backfillAssetThumbnails(){
  if(thumbnailBackfillRunning||!canGMControl()||document.hidden)return;
  if(navigator.connection?.saveData)return;
  const pending=assets.filter(asset=>thumbnailEligibleAsset(asset)&&!assetMetadata(asset).thumbnail_url);
  if(!pending.length)return;
  thumbnailBackfillRunning=true;
  let changed=false;
  try{
    for(const asset of pending){
      if(document.hidden)break;
      const before=assetMetadata(asset).thumbnail_url;
      const updated=await ensureAssetThumbnail(asset);
      if(!before&&assetMetadata(updated).thumbnail_url)changed=true;
      await new Promise(resolve=>setTimeout(resolve,60));
    }
  }finally{
    thumbnailBackfillRunning=false;
  }
  if(changed){
    renderScenes();
    renderRevealGrid();
    renderSceneInspector();
  }
}

function scheduleThumbnailBackfill(delay=900){
  if(!canGMControl())return;
  runtimeLifecycle.timeout('thumbnail-backfill',backfillAssetThumbnails,delay);
}

function warmArtwork(url){
  const src=String(url||'');
  if(!src||warmedArtworkUrls.has(src))return;
  warmedArtworkUrls.add(src);
  if(warmedArtworkUrls.size>96)warmedArtworkUrls.delete(warmedArtworkUrls.values().next().value);
  const img=new Image();
  img.decoding='async';
  img.fetchPriority='high';
  img.src=src;
}

function audioLibrary(){
  return derivedStateValue('audioLibrary',()=>{
    const raw=state?.audio_library;
    if(!Array.isArray(raw))return [];
    return raw
      .filter(item=>item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.url==='string')
      .map(item=>({
        id:item.id,
        name:String(item.name||'Untitled Track').slice(0,80),
        url:item.url,
        storage_path:String(item.storage_path||''),
        mime:String(item.mime||'audio/mpeg'),
        created_at:item.created_at||''
      }))
      .slice(0,60);
  });
}

function audioById(id){
  return id?audioLibrary().find(item=>item.id===id)||null:null;
}

const MAJOR_INTRO_STYLES=new Set(['cinematic','royal','ominous','relic','faith']);
const MAJOR_INTRO_DURATIONS=[3200,4200,5400];

function normalizeMajorIntroConfig(raw,asset=null){
  const source=raw&&typeof raw==='object'?raw:{};
  const fallbackName=String(asset?.name||'Major Character').slice(0,80);
  const fallbackTitle=String(asset?.subtitle||'').slice(0,120);
  return {
    display_name:String(source.display_name||fallbackName).trim().slice(0,80)||fallbackName,
    title:String(source.title??fallbackTitle).trim().slice(0,120),
    style:MAJOR_INTRO_STYLES.has(source.style)?source.style:'cinematic',
    duration_ms:MAJOR_INTRO_DURATIONS.includes(Number(source.duration_ms))?Number(source.duration_ms):4200,
    audio_id:typeof source.audio_id==='string'&&source.audio_id?source.audio_id:null
  };
}

function majorIntroConfig(asset){
  const raw=assetMetadata(asset).major_intro;
  return raw&&typeof raw==='object'&&!Array.isArray(raw)
    ? normalizeMajorIntroConfig(raw,asset)
    : null;
}

function renderMajorIntroAudioOptions(selected=null){
  if(!els.majorIntroAudio)return;
  const tracks=audioLibrary();
  els.majorIntroAudio.innerHTML='<option value="">No audio sting</option>'+tracks.map(track=>
    '<option value="'+esc(track.id)+'">'+esc(track.name)+'</option>'
  ).join('');
  els.majorIntroAudio.value=selected&&audioById(selected)?selected:'';
}

function openMajorIntroDialog(id){
  if(!canGMControl())return;
  const asset=byId(id);
  if(!isSceneCastAsset(asset))return;
  majorIntroAssetId=id;
  const cfg=majorIntroConfig(asset)||normalizeMajorIntroConfig({},asset);
  if(els.majorIntroDialogTitle)els.majorIntroDialogTitle.textContent=majorIntroConfig(asset)?'Edit Major Introduction':'Set Up Major Introduction';
  if(els.majorIntroEditorImage){
    els.majorIntroEditorImage.src=asset.image_url||'';
    els.majorIntroEditorImage.alt=asset.name||'Character artwork';
  }
  if(els.majorIntroEditorAssetName)els.majorIntroEditorAssetName.textContent=asset.name||'Character';
  if(els.majorIntroDisplayName)els.majorIntroDisplayName.value=cfg.display_name;
  if(els.majorIntroTitleInput)els.majorIntroTitleInput.value=cfg.title;
  if(els.majorIntroStyle)els.majorIntroStyle.value=cfg.style;
  if(els.majorIntroDuration)els.majorIntroDuration.value=String(cfg.duration_ms);
  renderMajorIntroAudioOptions(cfg.audio_id);
  if(els.majorIntroMessage)els.majorIntroMessage.textContent='';
  els.majorIntroDialog?.showModal();
}

function closeMajorIntroDialog(){
  majorIntroAssetId='';
  if(els.majorIntroDialog?.open)els.majorIntroDialog.close();
}

function majorIntroFormConfig(asset){
  return normalizeMajorIntroConfig({
    display_name:els.majorIntroDisplayName?.value||asset?.name||'Major Character',
    title:els.majorIntroTitleInput?.value||'',
    style:els.majorIntroStyle?.value||'cinematic',
    duration_ms:Number(els.majorIntroDuration?.value)||4200,
    audio_id:els.majorIntroAudio?.value||null
  },asset);
}

async function saveMajorIntroConfig(playAfter=false){
  if(!canGMControl())return;
  const asset=byId(majorIntroAssetId);
  if(!isSceneCastAsset(asset))return;
  const cfg=majorIntroFormConfig(asset);
  if(!cfg.display_name){
    if(els.majorIntroMessage)els.majorIntroMessage.textContent='Give the introduction a display name.';
    els.majorIntroDisplayName?.focus();
    return;
  }

  if(els.majorIntroSaveBtn)els.majorIntroSaveBtn.disabled=true;
  if(els.majorIntroSavePlayBtn)els.majorIntroSavePlayBtn.disabled=true;
  if(els.majorIntroMessage)els.majorIntroMessage.textContent='Saving introduction…';
  try{
    const metadata={...assetMetadata(asset),major_intro:cfg};
    const result=await supabase.from('live_table_assets')
      .update({metadata,updated_at:new Date().toISOString()})
      .eq('id',asset.id)
      .select()
      .single();
    if(result.error)throw result.error;
    assets=assets.map(item=>item.id===asset.id?result.data:item);
    renderRevealGrid();
    if(playAfter){
      const id=asset.id;
      closeMajorIntroDialog();
      await triggerMajorIntro(id,cfg);
    }else{
      if(els.majorIntroMessage)els.majorIntroMessage.textContent='Saved. INTRO is now ready for one-click use.';
      setTimeout(()=>closeMajorIntroDialog(),420);
    }
  }catch(err){
    console.error(err);
    if(els.majorIntroMessage)els.majorIntroMessage.textContent=err?.message||'Could not save the introduction.';
  }finally{
    if(els.majorIntroSaveBtn)els.majorIntroSaveBtn.disabled=false;
    if(els.majorIntroSavePlayBtn)els.majorIntroSavePlayBtn.disabled=false;
  }
}

function majorIntroSignal(){
  const raw=state?.transition_state?.major_intro;
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null;
}

async function triggerMajorIntro(id,configOverride=null){
  if(!canGMControl())return;
  const asset=byId(id);
  if(!isSceneCastAsset(asset))return;
  const cfg=configOverride?normalizeMajorIntroConfig(configOverride,asset):majorIntroConfig(asset);
  if(!cfg){
    openMajorIntroDialog(id);
    return;
  }

  const previous=majorIntroSignal();
  const nonce=(Number(previous?.nonce)||0)+1;
  const signal={
    nonce,
    asset_id:asset.id,
    image_url:asset.image_url||'',
    display_name:cfg.display_name||asset.name||'Major Character',
    title:cfg.title||'',
    style:cfg.style,
    duration_ms:cfg.duration_ms,
    audio_id:cfg.audio_id||null,
    triggered_at:new Date().toISOString()
  };
  await patchState({
    transition_state:{
      ...(state?.transition_state&&typeof state.transition_state==='object'?state.transition_state:{}),
      major_intro:signal
    }
  });
}

function stopMajorIntroPresentation(){
  if(majorIntroTimer)clearTimeout(majorIntroTimer);
  majorIntroTimer=0;
  if(majorIntroAudio){
    try{majorIntroAudio.pause()}catch(_){}
    majorIntroAudio=null;
  }
  els.playerDisplay?.classList.remove('major-intro-active');
  if(els.majorIntroLayer){
    els.majorIntroLayer.classList.remove('is-playing');
    els.majorIntroLayer.classList.add('hidden');
    els.majorIntroLayer.setAttribute('aria-hidden','true');
  }
}

function playMajorIntroAudio(audioId,duration){
  if(majorIntroAudio){
    try{majorIntroAudio.pause()}catch(_){}
    majorIntroAudio=null;
  }
  const track=audioById(audioId);
  if(!track?.url)return;
  const audio=new Audio(track.url);
  audio.preload='auto';
  audio.volume=.82;
  majorIntroAudio=audio;
  audio.play().catch(err=>{
    if(err?.name!=='NotAllowedError')console.warn('Major intro audio failed',err);
  });
  setTimeout(()=>{
    if(majorIntroAudio!==audio)return;
    try{audio.pause()}catch(_){}
    majorIntroAudio=null;
  },Math.max(1000,duration));
}

function playMajorIntro(signal){
  if(!signal||!els.majorIntroLayer)return;
  const duration=MAJOR_INTRO_DURATIONS.includes(Number(signal.duration_ms))?Number(signal.duration_ms):4200;
  const style=MAJOR_INTRO_STYLES.has(signal.style)?signal.style:'cinematic';
  const kicker={
    cinematic:'MAJOR CHARACTER',
    royal:'ROYAL PRESENCE',
    ominous:'THREAT REVEALED',
    relic:'RELIC RESONANCE',
    faith:'THE FAITH'
  }[style];

  stopMajorIntroPresentation();
  warmArtwork(signal.image_url||'');
  els.majorIntroLayer.dataset.style=style;
  els.majorIntroLayer.style.setProperty('--intro-duration',duration+'ms');
  if(els.majorIntroArt){
    els.majorIntroArt.src=signal.image_url||'';
    els.majorIntroArt.alt=signal.display_name||'Major character';
  }
  if(els.majorIntroKicker)els.majorIntroKicker.textContent=kicker;
  if(els.majorIntroName)els.majorIntroName.textContent=String(signal.display_name||'Major Character').toUpperCase();
  if(els.majorIntroTitle){
    els.majorIntroTitle.textContent=signal.title||'';
    els.majorIntroTitle.classList.toggle('hidden',!signal.title);
  }
  els.majorIntroLayer.classList.remove('hidden','is-playing');
  els.majorIntroLayer.setAttribute('aria-hidden','false');
  void els.majorIntroLayer.offsetWidth;
  els.playerDisplay?.classList.add('major-intro-active');
  els.majorIntroLayer.classList.add('is-playing');
  if(signal.audio_id)playMajorIntroAudio(signal.audio_id,duration);

  majorIntroTimer=setTimeout(stopMajorIntroPresentation,duration+120);
}

function renderMajorIntro(){
  const signal=majorIntroSignal();
  const nonce=Number(signal?.nonce)||0;
  if(!majorIntroInitialized){
    lastMajorIntroNonce=nonce;
    majorIntroInitialized=true;
    return;
  }
  if(!nonce||nonce===lastMajorIntroNonce)return;
  lastMajorIntroNonce=nonce;
  playMajorIntro(signal);
}

function normalizeAudioState(raw){
  const source=raw&&typeof raw==='object'?raw:{};
  const fades=[800,1800,3000,5000];
  return {
    music_id:typeof source.music_id==='string'&&source.music_id?source.music_id:null,
    ambience_id:typeof source.ambience_id==='string'&&source.ambience_id?source.ambience_id:null,
    music_volume:clamp01(source.music_volume??.65),
    ambience_volume:clamp01(source.ambience_volume??.55),
    master_volume:clamp01(source.master_volume??1),
    muted:source.muted===true,
    emergency:source.emergency===true,
    fade_ms:fades.includes(Number(source.fade_ms))?Number(source.fade_ms):1800
  };
}

function normalizeCueAudio(raw){
  if(!raw||typeof raw!=='object')return null;
  const cfg=normalizeAudioState(raw);
  return {
    music_id:cfg.music_id,
    ambience_id:cfg.ambience_id,
    music_volume:cfg.music_volume,
    ambience_volume:cfg.ambience_volume,
    fade_ms:cfg.fade_ms
  };
}

function cueAudioSnapshot(){
  return normalizeCueAudio(normalizeAudioState(state?.audio_state));
}

class LiveTableAudioChannel{
  constructor(engine,name){
    this.engine=engine;
    this.name=name;
    this.active=0;
    this.currentId=null;
    this.fadeFrames=[0,0];
    this.slots=[this.makeAudio(),this.makeAudio()];
  }

  makeAudio(){
    const audio=document.createElement('audio');
    audio.loop=true;
    audio.preload='auto';
    audio.setAttribute('playsinline','');
    audio.volume=0;
    document.body.appendChild(audio);
    return audio;
  }

  stopFade(index){
    if(this.fadeFrames[index])cancelAnimationFrame(this.fadeFrames[index]);
    this.fadeFrames[index]=0;
  }

  fade(index,target,duration,pauseAtZero=false,clearAtZero=false){
    const audio=this.slots[index];
    this.stopFade(index);
    const start=Number(audio.volume)||0;
    const end=clamp01(target);
    const ms=Math.max(80,Number(duration)||800);
    const started=performance.now();
    const tick=now=>{
      const p=Math.min(1,(now-started)/ms);
      const eased=1-Math.pow(1-p,2);
      audio.volume=start+(end-start)*eased;
      if(p<1){
        this.fadeFrames[index]=requestAnimationFrame(tick);
        return;
      }
      this.fadeFrames[index]=0;
      audio.volume=end;
      if(end<=.001&&pauseAtZero){
        audio.pause();
        if(clearAtZero){
          audio.removeAttribute('src');
          try{audio.load()}catch(_){}
        }
      }
    };
    this.fadeFrames[index]=requestAnimationFrame(tick);
  }

  async tryPlay(audio){
    if(!audio?.src)return false;
    try{
      await audio.play();
      this.engine.clearUnlock();
      return true;
    }catch(err){
      if(err?.name==='NotAllowedError')this.engine.requireUnlock();
      else console.warn('Live Table '+this.name+' audio playback failed',err);
      return false;
    }
  }

  apply(asset,target,duration,muted){
    const desired=muted?0:clamp01(target);
    const same=asset&&asset.id===this.currentId;
    if(same){
      const audio=this.slots[this.active];
      if(desired>0&&audio.paused)void this.tryPlay(audio);
      this.fade(this.active,desired,duration,desired<=.001);
      return;
    }

    const oldIndex=this.active;
    const old=this.slots[oldIndex];

    if(!asset){
      this.currentId=null;
      this.fade(oldIndex,0,duration,true,true);
      return;
    }

    const newIndex=oldIndex===0?1:0;
    const incoming=this.slots[newIndex];
    this.stopFade(newIndex);
    incoming.pause();
    incoming.volume=0;
    incoming.src=asset.url;
    incoming.currentTime=0;
    try{incoming.load()}catch(_){}

    this.active=newIndex;
    this.currentId=asset.id;

    this.fade(oldIndex,0,duration,true,true);
    if(desired>0){
      void this.tryPlay(incoming);
      this.fade(newIndex,desired,duration,false);
    }
  }
}

class LiveTableAudioEngine{
  constructor(){
    this.enabled=IS_PLAYER_DISPLAY;
    this.lastCfg=null;
    this.lastLibrary=[];
    this.music=new LiveTableAudioChannel(this,'music');
    this.ambience=new LiveTableAudioChannel(this,'ambience');
  }

  requireUnlock(){
    if(!this.enabled)return;
    els.audioUnlock?.classList.remove('hidden');
  }

  clearUnlock(){
    els.audioUnlock?.classList.add('hidden');
  }

  sync(cfg,library){
    this.lastCfg=cfg;
    this.lastLibrary=library;
    if(!this.enabled){
      this.clearUnlock();
      return;
    }
    const map=new Map(library.map(item=>[item.id,item]));
    const duration=cfg.emergency?650:cfg.fade_ms;
    const music=cfg.music_id?map.get(cfg.music_id)||null:null;
    const ambience=cfg.ambience_id?map.get(cfg.ambience_id)||null:null;
    const master=cfg.master_volume;
    this.music.apply(music,cfg.music_volume*master,duration,cfg.muted);
    this.ambience.apply(ambience,cfg.ambience_volume*master,duration,cfg.muted);
    if((music||ambience)&&!cfg.muted){
      // Playback methods will reveal the unlock control if the browser blocks autoplay.
    }else{
      this.clearUnlock();
    }
  }

  unlock(){
    if(!this.enabled||!this.lastCfg)return;
    this.sync({...this.lastCfg,muted:false,emergency:false},this.lastLibrary);
  }
}

function getLiveAudioEngine(){
  if(!liveAudioEngine)liveAudioEngine=new LiveTableAudioEngine();
  return liveAudioEngine;
}

function syncLiveAudio(){
  if(!state)return;
  getLiveAudioEngine().sync(normalizeAudioState(state.audio_state),audioLibrary());
}

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
  const displayOnly=IS_PLAYER_DISPLAY||!isGM;
  document.body.classList.toggle('display-only',displayOnly);
  if(displayOnly){
    els.gmControls?.classList.add('hidden');
    els.gmQuickControls?.classList.add('hidden');
    els.gmHeader?.classList.add('hidden');
  }
}

function liveStateRevision(value){
  const timestamp=Date.parse(value?.updated_at||'');
  return Number.isFinite(timestamp)?timestamp:0;
}

function acceptLiveState(next,{force=false}={}){
  if(!next)return false;
  if(!force&&state&&liveStateRevision(next)<liveStateRevision(state))return false;
  state=next;
  return true;
}

async function loadState(){
  const {data,error}=await supabase.from('live_table_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  acceptLiveState(data,{force:true});
  if(!state&&canGMControl()){
    const fresh={campaign_id:CAMPAIGN_ID,mode:'scene',hud_visible:true,updated_by:user.id};
    const r=await supabase.from('live_table_state').insert(fresh).select().single();
    if(r.error)throw r.error;
    acceptLiveState(r.data,{force:true});
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

async function loadMapState(){
  const {data,error}=await supabase.from('live_table_map_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  mapState=data||null;
}

function partyAnimationState(){
  return PARTY_SPRITE_STATES.includes(state?.party_animation_state)?state.party_animation_state:'idle';
}

function partyAnimationForCharacter(characterId){
  const cfg=partySpriteCharacter(characterId);
  const requested=cfg.animations[partyAnimationState()];
  if(requested?.url)return requested;
  const idle=cfg.animations.idle;
  return idle?.url?idle:null;
}

let partySpriteAnimationRaf=0;
function updatePartySpriteSheetFrame(el,frame){
  const cols=Math.max(1,Number(el.dataset.columns)||1);
  const rows=Math.max(1,Number(el.dataset.rows)||1);
  const count=Math.max(1,Math.min(cols*rows,Number(el.dataset.frameCount)||cols*rows));
  const safe=((frame%count)+count)%count;
  const col=safe%cols;
  const row=Math.floor(safe/cols);
  el.dataset.frame=String(safe);
  const img=el.querySelector('.party-sprite-sheet-image');
  if(img){
    img.style.left=(-col*100)+'%';
    img.style.top=(-row*100)+'%';
  }
}

function startPartySpriteAnimationLoop(){
  if(partySpriteAnimationRaf)return;
  const tick=timestamp=>{
    const sheets=document.querySelectorAll('.party-sprite-sheet[data-frame-count]');
    sheets.forEach(el=>{
      const fps=Math.max(1,Math.min(30,Number(el.dataset.fps)||10));
      const nextAt=Number(el.dataset.nextFrameAt)||0;
      if(timestamp<nextAt)return;
      const frame=(Number(el.dataset.frame)||0)+1;
      updatePartySpriteSheetFrame(el,frame);
      el.dataset.nextFrameAt=String(timestamp+(1000/fps));
    });
    partySpriteAnimationRaf=requestAnimationFrame(tick);
  };
  partySpriteAnimationRaf=requestAnimationFrame(tick);
}

function partySpriteMarkup(animation,cfg){
  if(!animation?.url)return '';
  const commonStyle='--party-sprite-scale:'+(cfg.scale/100)+';--party-sprite-x:'+cfg.x+'px;--party-sprite-y:'+cfg.y+'px';
  if(animation.type==='sheet'){
    const cols=Math.max(1,Number(animation.columns)||1);
    const rows=Math.max(1,Number(animation.rows)||1);
    const count=Math.max(1,Math.min(cols*rows,Number(animation.frame_count)||cols*rows));
    const fps=Math.max(1,Math.min(30,Number(animation.fps)||10));
    return '<div class="party-sprite-stage" aria-hidden="true"><div class="party-sprite-sheet party-hud-sprite" data-columns="'+cols+'" data-rows="'+rows+'" data-frame-count="'+count+'" data-fps="'+fps+'" data-frame="0" style="'+commonStyle+'"><img class="party-sprite-sheet-image" src="'+esc(animation.url)+'" alt="" style="width:'+(cols*100)+'%;height:'+(rows*100)+'%" /></div></div>';
  }
  return '<div class="party-sprite-stage" aria-hidden="true"><img class="party-hud-sprite" src="'+esc(animation.url)+'" alt="" style="'+commonStyle+'" /></div>';
}

function renderPartyAnimationControls(){
  const group=els.partyAnimationControls;
  if(!group)return;
  const current=partyAnimationState();
  group.querySelectorAll('[data-party-animation]').forEach(button=>{
    const active=button.dataset.partyAnimation===current;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',active?'true':'false');
  });
}

function syncPartyHudSafeArea(){
  if(!els.playerDisplay||!els.partyHud)return;
  const hidden=els.partyHud.classList.contains('hidden')||state?.hud_visible===false||state?.mode==='map';
  const height=hidden?0:Math.ceil(els.partyHud.getBoundingClientRect().height);
  els.playerDisplay.style.setProperty('--party-hud-safe-height',height+'px');
}

function renderParty(){
  if(!state?.hud_visible){
    els.partyHud.classList.add('hidden');
    syncPartyHudSafeArea();
    return;
  }
  els.partyHud.classList.remove('hidden');
  if(!party.length){
    els.partyHud.innerHTML='<div class="party-card-shell no-party-sprite"><div class="party-card"><div class="party-portrait">✦</div><div><div class="party-name">PARTY</div><div class="muted" style="font-size:9px">Character sheets will appear here.</div></div></div></div>';
    requestAnimationFrame(syncPartyHudSafeArea);
    return;
  }
  els.partyHud.innerHTML=party.map(c=>{
    const portrait=c.portrait_url
      ? '<img class="party-portrait" src="'+esc(c.portrait_url)+'" alt="'+esc(c.name)+' portrait" decoding="async" fetchpriority="high">'
      : '<div class="party-portrait">'+esc((c.name||'?')[0].toUpperCase())+'</div>';
    const cfg=partySpriteCharacter(c.character_id);
    const animation=partyAnimationForCharacter(c.character_id);
    const sprite=partySpriteMarkup(animation,cfg);
    const statuses=(c.statuses||[]).map(s=>'<span class="status-pill">'+esc(s)+'</span>').join('');
    return '<article class="party-card-shell'+(animation?' has-party-sprite':' no-party-sprite')+'" data-character-id="'+esc(c.character_id)+'">'+
      '<div class="party-card">'+
        '<div class="party-token-wrap">'+portrait+'</div>'+
        '<div class="party-card-info"><div class="party-name">'+esc(c.name||'Unnamed')+'</div>'+
          '<div class="resource"><span>HP</span><div class="resource-bar"><i style="width:'+pct(c.hp_current,c.hp_max)+'%"></i></div><b>'+Number(c.hp_current||0)+'/'+Number(c.hp_max||0)+'</b></div>'+
          '<div class="resource mp"><span>MP</span><div class="resource-bar"><i style="width:'+pct(c.mp_current,c.mp_max)+'%"></i></div><b>'+Number(c.mp_current||0)+'/'+Number(c.mp_max||0)+'</b></div>'+
          '<div class="resource ip"><span>IP</span><div class="resource-bar"><i style="width:'+pct(c.ip_current,c.ip_max)+'%"></i></div><b>'+Number(c.ip_current||0)+'/'+Number(c.ip_max||0)+'</b></div>'+
          (statuses?'<div class="status-row">'+statuses+'</div>':'')+
        '</div>'+
      '</div>'+
      sprite+
    '</article>';
  }).join('');
  startPartySpriteAnimationLoop();
  requestAnimationFrame(syncPartyHudSafeArea);
}


/* Party sprite assignment v1 */
const PARTY_SPRITE_STATES=['idle','run','sleep'];
const PARTY_SPRITE_STATE_LABELS={idle:'Idle',run:'Run',sleep:'Sleep'};

function partySpriteSettings(){
  const raw=state?.party_sprite_settings;
  return raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
}

function normalizePartySpriteCharacter(raw){
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const animations=source.animations&&typeof source.animations==='object'&&!Array.isArray(source.animations)?source.animations:{};
  const normalizedAnimations={};
  for(const key of PARTY_SPRITE_STATES){
    const item=animations[key];
    normalizedAnimations[key]=item&&typeof item==='object'&&!Array.isArray(item)?{
      url:String(item.url||''),
      storage_path:String(item.storage_path||''),
      name:String(item.name||''),
      mime:String(item.mime||''),
      type:(String(item.mime||'').toLowerCase()==='image/gif'||/\.gif$/i.test(String(item.name||'')))?'animated':(item.type==='sheet'?'sheet':'animated'),
      columns:Math.max(1,Math.min(16,Number(item.columns)||1)),
      rows:Math.max(1,Math.min(16,Number(item.rows)||1)),
      frame_count:Math.max(1,Math.min(256,Number(item.frame_count)||1)),
      fps:Math.max(1,Math.min(30,Number(item.fps)||10))
    }:{url:'',storage_path:'',name:'',mime:'',type:'animated',columns:1,rows:1,frame_count:1,fps:10};
  }
  return {
    animations:normalizedAnimations,
    scale:Math.max(50,Math.min(150,Number(source.scale)||100)),
    x:Math.max(-80,Math.min(80,Number(source.x)||0)),
    y:Math.max(-80,Math.min(80,Number(source.y)||0))
  };
}

function partySpriteCharacter(characterId){
  return normalizePartySpriteCharacter(partySpriteSettings()[characterId]);
}

function renderPartySpriteEditor(){
  const list=document.getElementById('partySpriteList');
  if(!list||!canGMControl())return;
  if(!party.length){
    list.innerHTML='<p class="party-sprite-empty">Party characters will appear here when character sheets are linked to the Live Table.</p>';
    return;
  }
  list.innerHTML=party.map(character=>{
    const cfg=partySpriteCharacter(character.character_id);
    const portrait=character.portrait_url
      ? '<img src="'+esc(character.portrait_url)+'" alt="" />'
      : '<span>'+esc((character.name||'?')[0].toUpperCase())+'</span>';
    const slots=PARTY_SPRITE_STATES.map(animationState=>{
      const anim=cfg.animations[animationState];
      const preview=anim.url
        ? '<img src="'+esc(anim.url)+'" alt="'+esc(character.name||'Character')+' '+PARTY_SPRITE_STATE_LABELS[animationState]+' animation" />'
        : '<span class="party-sprite-placeholder">No animation</span>';
      const isGif=String(anim.mime||'').toLowerCase()==='image/gif'||/\.gif$/i.test(String(anim.name||''));
      const sheetControls=anim.url?'<div class="party-sprite-format">'+
        (isGif
          ? '<div class="party-sprite-format-badge">Animated GIF · detected automatically</div>'
          : '<label>Format<select data-party-sprite-format="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'">'+
              '<option value="animated"'+(anim.type!=='sheet'?' selected':'')+'>Animated file</option>'+
              '<option value="sheet"'+(anim.type==='sheet'?' selected':'')+'>Sprite sheet</option>'+
            '</select></label>')+
        (!isGif&&anim.type==='sheet'?'<div class="party-sprite-sheet-fields">'+
          '<label>Columns<input type="number" min="1" max="16" value="'+anim.columns+'" data-party-sprite-sheet-field="columns" data-character-id="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'" /></label>'+
          '<label>Rows<input type="number" min="1" max="16" value="'+anim.rows+'" data-party-sprite-sheet-field="rows" data-character-id="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'" /></label>'+
          '<label>Frames<input type="number" min="1" max="256" value="'+anim.frame_count+'" data-party-sprite-sheet-field="frame_count" data-character-id="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'" /></label>'+
          '<label>FPS<input type="number" min="1" max="30" value="'+anim.fps+'" data-party-sprite-sheet-field="fps" data-character-id="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'" /></label>'+
        '</div>':'')+
      '</div>':'';
      return '<div class="party-sprite-slot'+(anim.url?' has-file':'')+'">'+
        '<div class="party-sprite-slot-head"><strong>'+PARTY_SPRITE_STATE_LABELS[animationState]+'</strong>'+
        (anim.url?'<button type="button" data-party-sprite-remove="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'" title="Remove '+PARTY_SPRITE_STATE_LABELS[animationState]+' animation">×</button>':'')+
        '</div>'+
        '<div class="party-sprite-preview">'+preview+'</div>'+
        '<label class="party-sprite-upload">'+(anim.url?'Replace':'Upload')+
          '<input type="file" accept="image/png,image/gif,image/webp" data-party-sprite-file="'+esc(character.character_id)+'" data-party-sprite-state="'+animationState+'" />'+
        '</label>'+
        '<small>'+esc(anim.name||'PNG, GIF or WebP · up to 20 MB')+'</small>'+sheetControls+
      '</div>';
    }).join('');
    return '<article class="party-sprite-character" data-party-sprite-character="'+esc(character.character_id)+'">'+
      '<header><div class="party-sprite-character-id">'+portrait+'</div><div><strong>'+esc(character.name||'Unnamed')+'</strong><small>'+esc(character.player_name||'Party character')+'</small></div></header>'+
      '<div class="party-sprite-slots">'+slots+'</div>'+
      '<div class="party-sprite-tuning">'+
        '<label>Scale <output data-party-sprite-scale-output="'+esc(character.character_id)+'">'+Math.round(cfg.scale)+'%</output>'+
          '<input type="range" min="50" max="150" step="1" value="'+cfg.scale+'" data-party-sprite-scale="'+esc(character.character_id)+'" /></label>'+
        '<label>X offset <output>'+Math.round(cfg.x)+'</output><input type="range" min="-80" max="80" step="1" value="'+cfg.x+'" data-party-sprite-x="'+esc(character.character_id)+'" /></label>'+
        '<label>Y offset <output>'+Math.round(cfg.y)+'</output><input type="range" min="-80" max="80" step="1" value="'+cfg.y+'" data-party-sprite-y="'+esc(character.character_id)+'" /></label>'+
        '<button type="button" data-party-sprite-reset="'+esc(character.character_id)+'">Reset alignment</button>'+
      '</div>'+
    '</article>';
  }).join('');
}

async function savePartySpriteCharacter(characterId,nextConfig){
  if(!canGMControl()||!characterId)return null;
  const next={...partySpriteSettings(),[characterId]:normalizePartySpriteCharacter(nextConfig)};
  return patchState({party_sprite_settings:next});
}

function partySpriteExt(file){
  const fromName=(String(file?.name||'').split('.').pop()||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  if(['png','gif','webp'].includes(fromName))return fromName;
  return ({'image/png':'png','image/gif':'gif','image/webp':'webp'})[file?.type]||'webp';
}

async function uploadPartySprite(characterId,animationState,input){
  if(!canGMControl()||!PARTY_SPRITE_STATES.includes(animationState))return;
  const file=input?.files?.[0];
  if(input)input.value='';
  if(!file)return;
  if(file.size>20*1024*1024){alert('Character animations must be 20 MB or smaller.');return}
  if(!['image/png','image/gif','image/webp'].includes(file.type)&&!/\.(png|gif|webp)$/i.test(file.name||'')){
    alert('Choose a PNG, GIF or WebP animation.');
    return;
  }
  const card=document.querySelector('[data-party-sprite-character="'+CSS.escape(characterId)+'"]');
  card?.classList.add('is-saving');
  const current=partySpriteCharacter(characterId);
  const old=current.animations[animationState];
  const ext=partySpriteExt(file);
  const storagePath=CAMPAIGN_ID+'/party-sprites/'+characterId+'/'+animationState+'-'+crypto.randomUUID()+'.'+ext;
  try{
    const up=await supabase.storage.from('live-table').upload(storagePath,file,{
      cacheControl:'31536000',
      upsert:false,
      contentType:file.type||('image/'+ext)
    });
    if(up.error)throw up.error;
    const url=supabase.storage.from('live-table').getPublicUrl(storagePath).data.publicUrl;
    const next=normalizePartySpriteCharacter(current);
    next.animations[animationState]={
      url,
      storage_path:storagePath,
      name:String(file.name||PARTY_SPRITE_STATE_LABELS[animationState]).slice(0,120),
      mime:file.type||('image/'+ext),
      type:ext==='png'?'sheet':'animated',
      columns:ext==='png'?5:1,
      rows:ext==='png'?5:1,
      frame_count:ext==='png'?25:1,
      fps:10
    };
    const saved=await savePartySpriteCharacter(characterId,next);
    if(!saved){
      await supabase.storage.from('live-table').remove([storagePath]);
      return;
    }
    if(old.storage_path&&old.storage_path!==storagePath){
      const removed=await supabase.storage.from('live-table').remove([old.storage_path]);
      if(removed.error)console.warn('Could not remove replaced party sprite',removed.error);
    }
  }catch(err){
    console.error('Party sprite upload failed',err);
    alert(err?.message||'Could not upload that character animation.');
  }finally{
    card?.classList.remove('is-saving');
    renderPartySpriteEditor();
  }
}

async function removePartySprite(characterId,animationState){
  if(!canGMControl()||!PARTY_SPRITE_STATES.includes(animationState))return;
  const current=partySpriteCharacter(characterId);
  const old=current.animations[animationState];
  if(!old.url)return;
  const next=normalizePartySpriteCharacter(current);
  next.animations[animationState]={url:'',storage_path:'',name:'',mime:'',type:'animated',columns:1,rows:1,frame_count:1,fps:10};
  const saved=await savePartySpriteCharacter(characterId,next);
  if(saved&&old.storage_path){
    const removed=await supabase.storage.from('live-table').remove([old.storage_path]);
    if(removed.error)console.warn('Could not remove party sprite storage object',removed.error);
  }
}

async function savePartySpriteTuning(characterId,patch){
  const current=partySpriteCharacter(characterId);
  await savePartySpriteCharacter(characterId,{...current,...patch});
}

function setupPartySpriteEditor(){
  if(!canGMControl()||document.getElementById('partySpritePanel')||!els.gmPanelReveals)return;
  const panel=gmModule('gm-party-sprites-module','Party Sprites');
  panel.id='partySpritePanel';
  panel.innerHTML='<div class="section-head compact"><div><p class="eyebrow">Party HUD</p><h2>Character Sprites</h2></div><span class="party-sprite-note">Linked by character</span></div>'+
    '<p class="muted party-sprite-help">Assign Idle, Run and Sleep animations to each party character. Scale and offsets apply to that character across every animation.</p>'+
    '<div id="partySpriteList" class="party-sprite-list"></div>';
  els.gmPanelReveals.append(panel);

  panel.addEventListener('change',event=>{
    const target=event.target;
    const characterId=target?.dataset?.partySpriteFile;
    if(characterId){
      uploadPartySprite(characterId,target.dataset.partySpriteState,target);
      return;
    }
    if(target?.dataset?.partySpriteFormat){
      const characterId=target.dataset.partySpriteFormat;
      const animationState=target.dataset.partySpriteState;
      const current=partySpriteCharacter(characterId);
      const next=normalizePartySpriteCharacter(current);
      next.animations[animationState]={...next.animations[animationState],type:target.value==='sheet'?'sheet':'animated'};
      savePartySpriteCharacter(characterId,next);
      return;
    }
    if(target?.dataset?.partySpriteSheetField){
      const characterId=target.dataset.characterId;
      const animationState=target.dataset.partySpriteState;
      const field=target.dataset.partySpriteSheetField;
      const current=partySpriteCharacter(characterId);
      const next=normalizePartySpriteCharacter(current);
      next.animations[animationState]={...next.animations[animationState],[field]:Number(target.value)};
      savePartySpriteCharacter(characterId,next);
      return;
    }
    if(target?.dataset?.partySpriteScale)savePartySpriteTuning(target.dataset.partySpriteScale,{scale:Number(target.value)});
    if(target?.dataset?.partySpriteX)savePartySpriteTuning(target.dataset.partySpriteX,{x:Number(target.value)});
    if(target?.dataset?.partySpriteY)savePartySpriteTuning(target.dataset.partySpriteY,{y:Number(target.value)});
  });
  panel.addEventListener('input',event=>{
    const target=event.target;
    const output=target?.closest('label')?.querySelector('output');
    if(!output)return;
    if(target.dataset.partySpriteScale)output.textContent=Math.round(Number(target.value)||100)+'%';
    else output.textContent=String(Math.round(Number(target.value)||0));
  });
  panel.addEventListener('click',event=>{
    const remove=event.target.closest('[data-party-sprite-remove]');
    if(remove){removePartySprite(remove.dataset.partySpriteRemove,remove.dataset.partySpriteState);return}
    const reset=event.target.closest('[data-party-sprite-reset]');
    if(reset)savePartySpriteTuning(reset.dataset.partySpriteReset,{scale:100,x:0,y:0});
  });
  renderPartySpriteEditor();
}

function setBackdrop(asset){
  els.backdrop.style.backgroundImage=asset?.image_url?'url("'+asset.image_url.replace(/"/g,'%22')+'")':'';
}

const TRANSITION_STYLE_KEYS=['soft-fade','dream','crystal-flash','relic-glitch','darkness','memory','impact','mist-veil','ink-bleed','eclipse','water-ripple','relic-aperture','depth-blur','leyline-pulse'];
const TRANSITION_DURATIONS=[800,1250,1800,3000];

function normalizeTransition(raw){
  const source=raw&&typeof raw==='object'?raw:{};
  return {
    style:TRANSITION_STYLE_KEYS.includes(source.style)?source.style:'soft-fade',
    duration_ms:TRANSITION_DURATIONS.includes(Number(source.duration_ms))?Number(source.duration_ms):1250
  };
}

function transitionState(){
  return normalizeTransition(state?.transition_state);
}

function transitionLabel(style){
  return ({
    'soft-fade':'Soft Fade',
    dream:'Dream',
    'crystal-flash':'Crystal Flash',
    'relic-glitch':'Relic Glitch',
    darkness:'Darkness',
    memory:'Memory',
    impact:'Impact',
    'mist-veil':'Mist Veil',
    'ink-bleed':'Ink Bleed',
    eclipse:'Eclipse',
    'water-ripple':'Water Ripple',
    'relic-aperture':'Relic Aperture',
    'depth-blur':'Depth Blur',
    'leyline-pulse':'Leyline Pulse'
  })[style]||'Soft Fade';
}

function transitionEnabledForMode(mode){
  return mode==='scene'||mode==='title';
}

function transitionNonce(){
  return Number(state?.transition_state?.nonce)||0;
}

function nextTransitionNonce(){
  return transitionNonce()+1;
}

let transitionCanvasRenderer=null;

function smoothstep(a,b,x){
  const t=Math.max(0,Math.min(1,(x-a)/Math.max(.0001,b-a)));
  return t*t*(3-2*t);
}

class TransitionCanvasRenderer{
  constructor(canvas,host){
    this.canvas=canvas;
    this.host=host;
    this.ctx=canvas?.getContext('2d',{alpha:true,desynchronized:true})||null;
    this.width=0;
    this.height=0;
    this.pixelRatio=1;
    this.raf=0;
    this.startedAt=0;
    this.cfg={style:'soft-fade',duration_ms:1250};
    this.running=false;
    this.backdropSrc='';
    this.backdropReady=false;
    this.backdropImg=new Image();
    this.backdropImg.crossOrigin='anonymous';
    this.backdropImg.onload=()=>{this.backdropReady=true};
    this.backdropImg.onerror=()=>{this.backdropReady=false};
    this.snapshot=document.createElement('canvas');
    this.snapshotCtx=this.snapshot.getContext('2d',{alpha:true});
    this.hasSnapshot=false;
    this.snapshotPrepared=false;
    this.motes=[];
    this.shards=[];
    this.dust=[];
    this.seed=Math.random()*1000;
    this.prefersReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    if(this.host)this.resizeObserver.observe(this.host);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)this.stop(true);
    });
    this.resize();
  }

  resize(){
    if(!this.canvas||!this.host)return;
    const rect=this.host.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    this.width=rect.width;
    this.height=rect.height;
    this.pixelRatio=Math.min(window.devicePixelRatio||1,1.35);
    const w=Math.max(1,Math.round(this.width*this.pixelRatio));
    const h=Math.max(1,Math.round(this.height*this.pixelRatio));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;
      this.canvas.height=h;
      this.canvas.style.width=this.width+'px';
      this.canvas.style.height=this.height+'px';
    }
    if(this.snapshot.width!==w||this.snapshot.height!==h){
      this.snapshot.width=w;
      this.snapshot.height=h;
      this.hasSnapshot=false;
    }
  }

  setBackdropSource(src){
    const next=src||'';
    if(next===this.backdropSrc)return;
    this.backdropSrc=next;
    this.backdropReady=false;
    if(!next){
      this.backdropImg.removeAttribute('src');
      return;
    }
    this.backdropImg.src=next;
  }

  clearSnapshot(){
    if(!this.snapshotCtx)return;
    this.snapshotCtx.setTransform(1,0,0,1,0,0);
    this.snapshotCtx.clearRect(0,0,this.snapshot.width,this.snapshot.height);
    this.hasSnapshot=false;
  }

  captureBackdrop(){
    this.clearSnapshot();
    if(!this.snapshotCtx||!this.backdropReady||!this.backdropImg?.naturalWidth)return;
    drawImageCover(this.snapshotCtx,this.backdropImg,0,0,this.snapshot.width,this.snapshot.height);
    this.hasSnapshot=true;
  }

  preparePreviousMode(mode){
    this.resize();
    this.clearSnapshot();
    const ctx=this.snapshotCtx;
    if(!ctx)return;
    const w=this.width,h=this.height,pr=this.pixelRatio;
    const previous=mode||'scene';

    if(previous==='scene'){
      this.captureBackdrop();
      this.snapshotPrepared=true;
      return;
    }

    ctx.setTransform(pr,0,0,pr,0,0);

    if(previous==='blackout'){
      ctx.fillStyle='#000';
      ctx.fillRect(0,0,w,h);
      this.hasSnapshot=true;
      this.snapshotPrepared=true;
      return;
    }

    if(previous==='title'){
      ctx.fillStyle='#000';
      ctx.fillRect(0,0,w,h);
      const img=els.titleLayer?.querySelector('img');
      if(img?.complete&&img.naturalWidth){
        const scale=Math.min(w/img.naturalWidth,h/img.naturalHeight);
        const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
        ctx.drawImage(img,(w-dw)/2,(h-dh)/2,dw,dh);
      }
      this.hasSnapshot=true;
      this.snapshotPrepared=true;
      return;
    }

    if(previous==='reveal'){
      ctx.fillStyle='#05080b';
      ctx.fillRect(0,0,w,h);
      const img=els.revealImage;
      if(img?.complete&&img.naturalWidth){
        const maxW=w*.68,maxH=h*.72;
        const scale=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight);
        const dw=img.naturalWidth*scale,dh=img.naturalHeight*scale;
        const dx=(w-dw)/2,dy=(h-dh)/2;
        ctx.fillStyle='rgba(11,15,20,.94)';
        ctx.fillRect(w*.08,h*.09,w*.84,h*.82);
        ctx.drawImage(img,dx,dy,dw,dh);
      }else{
        const g=ctx.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,Math.max(w,h)*.62);
        g.addColorStop(0,'rgba(31,40,49,.92)');
        g.addColorStop(1,'rgba(3,5,8,1)');
        ctx.fillStyle=g;
        ctx.fillRect(0,0,w,h);
      }
      this.hasSnapshot=true;
      this.snapshotPrepared=true;
      return;
    }

    if(previous==='map'){
      const g=ctx.createRadialGradient(w*.5,h*.5,0,w*.5,h*.5,Math.max(w,h)*.72);
      g.addColorStop(0,'#14232a');
      g.addColorStop(.5,'#091116');
      g.addColorStop(1,'#020506');
      ctx.fillStyle=g;
      ctx.fillRect(0,0,w,h);
      ctx.strokeStyle='rgba(206,177,101,.16)';
      ctx.lineWidth=1;
      for(let x=0;x<w;x+=Math.max(36,w/14)){
        ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
      }
      for(let y=0;y<h;y+=Math.max(36,h/8)){
        ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
      }
      ctx.fillStyle='rgba(220,194,125,.72)';
      ctx.textAlign='center';
      ctx.textBaseline='middle';
      ctx.font='700 '+Math.max(14,Math.min(28,w*.028))+'px Georgia,serif';
      ctx.fillText('WORLD MAP',w*.5,h*.5);
      this.hasSnapshot=true;
      this.snapshotPrepared=true;
      return;
    }

    ctx.fillStyle='#05080b';
    ctx.fillRect(0,0,w,h);
    this.hasSnapshot=true;
    this.snapshotPrepared=true;
  }

  buildParticles(){
    const w=Math.max(1,this.width),h=Math.max(1,this.height);
    this.motes=Array.from({length:34},()=>({
      x:Math.random()*w,
      y:Math.random()*h,
      r:1+Math.random()*4.5,
      phase:Math.random()*Math.PI*2,
      drift:18+Math.random()*52,
      alpha:.12+Math.random()*.42
    }));
    this.shards=Array.from({length:26},()=>({
      x:w*(.5+(Math.random()-.5)*.28),
      y:h*(.48+(Math.random()-.5)*.25),
      angle:Math.random()*Math.PI*2,
      len:22+Math.random()*95,
      width:2+Math.random()*10,
      speed:110+Math.random()*360,
      spin:(Math.random()-.5)*5,
      tint:Math.random()<.62?'cyan':'gold'
    }));
    this.dust=Array.from({length:40},()=>({
      x:Math.random()*w,
      y:Math.random()*h,
      r:.5+Math.random()*2.2,
      phase:Math.random()*Math.PI*2,
      alpha:.08+Math.random()*.28
    }));
  }

  play(config){
    if(!this.ctx||!this.canvas)return;
    this.stop(false);
    this.resize();
    if(!this.snapshotPrepared)this.captureBackdrop();
    this.snapshotPrepared=false;
    this.buildParticles();
    this.cfg=normalizeTransition(config);
    this.startedAt=performance.now();
    this.seed=Math.random()*1000;
    this.running=true;
    this.host?.classList.add('transition-canvas-active');

    // Paint immediately. Waiting for the first rAF leaves one browser paint where
    // the always-present Scene backdrop can leak through during a mode switch.
    this.draw(.001,this.startedAt);
    this.raf=requestAnimationFrame(now=>this.frame(now));
  }

  stop(clear=true){
    this.running=false;
    if(this.raf)cancelAnimationFrame(this.raf);
    this.raf=0;
    this.host?.classList.remove('transition-canvas-active');
    if(clear)this.clear();
  }

  clear(){
    if(!this.ctx)return;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
  }

  frame(now){
    if(!this.running||!this.ctx)return;
    const duration=Math.max(120,this.cfg.duration_ms);
    const p=Math.max(0,Math.min(1,(now-this.startedAt)/duration));
    this.draw(p,now);
    if(p>=1){
      this.stop(true);
      return;
    }
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  beginFrame(){
    const ctx=this.ctx;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
    ctx.imageSmoothingEnabled=true;
  }

  drawSnapshot(alpha=1,filter='none',scale=1,dx=0,dy=0){
    if(!this.hasSnapshot||alpha<=0)return;
    const ctx=this.ctx,w=this.width,h=this.height;
    ctx.save();
    ctx.globalAlpha=Math.max(0,Math.min(1,alpha));
    ctx.filter=filter;
    ctx.translate(w/2+dx,h/2+dy);
    ctx.scale(scale,scale);
    ctx.drawImage(this.snapshot,0,0,this.snapshot.width,this.snapshot.height,-w/2,-h/2,w,h);
    ctx.restore();
  }

  draw(p,now){
    this.beginFrame();
    if(this.prefersReduced){
      this.drawReduced(p);
      return;
    }
    switch(this.cfg.style){
      case 'dream':this.drawDream(p,now);break;
      case 'crystal-flash':this.drawCrystal(p,now);break;
      case 'relic-glitch':this.drawGlitch(p,now);break;
      case 'darkness':this.drawDarkness(p);break;
      case 'memory':this.drawMemory(p,now);break;
      case 'impact':this.drawImpact(p,now);break;
      case 'mist-veil':this.drawMistVeil(p,now);break;
      case 'ink-bleed':this.drawInkBleed(p,now);break;
      case 'eclipse':this.drawEclipse(p,now);break;
      case 'water-ripple':this.drawWaterRipple(p,now);break;
      case 'relic-aperture':this.drawRelicAperture(p,now);break;
      case 'depth-blur':this.drawDepthBlur(p,now);break;
      case 'leyline-pulse':this.drawLeylinePulse(p,now);break;
      case 'soft-fade':
      default:this.drawSoftFade(p);break;
    }
  }

  drawReduced(p){
    const ctx=this.ctx;
    const alpha=Math.sin(Math.PI*p)*.92;
    ctx.fillStyle='rgba(2,4,7,'+alpha+')';
    ctx.fillRect(0,0,this.width,this.height);
  }

  drawSoftFade(p){
    const ctx=this.ctx,w=this.width,h=this.height;
    const cover=Math.pow(Math.sin(Math.PI*p),.78);
    const oldAlpha=1-smoothstep(.18,.58,p);
    this.drawSnapshot(oldAlpha,'blur('+(p*3.5).toFixed(1)+'px)',1+p*.008);
    ctx.fillStyle='rgba(2,4,7,'+(cover*.96)+')';
    ctx.fillRect(0,0,w,h);
    if(p>.5){
      const glow=(1-p)*.12;
      const g=ctx.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,w*.72);
      g.addColorStop(0,'rgba(212,225,219,'+glow+')');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.fillRect(0,0,w,h);
    }
  }

  drawDarkness(p){
    const ctx=this.ctx,w=this.width,h=this.height;
    const inA=smoothstep(0,.28,p);
    const outA=1-smoothstep(.7,1,p);
    const alpha=Math.min(inA,outA);
    this.drawSnapshot(1-smoothstep(.08,.34,p),'none',1);
    ctx.fillStyle='rgba(0,0,0,'+alpha+')';
    ctx.fillRect(0,0,w,h);
  }

  drawDream(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const swell=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.18,.62,p);
    const time=now*.001;
    const breath=.5+.5*Math.sin(time*.9+this.seed);
    const driftX=Math.sin(time*.78+this.seed*.17)*3.2*swell;
    const driftY=Math.cos(time*.61+this.seed*.11)*1.8*swell;
    const zoom=1+swell*(.010+breath*.004);

    // Keep the dream movement continuous across the whole image. The previous
    // implementation warped 7px strips individually, which produced visible
    // bands and required 100+ filtered draw calls per frame on large displays.
    if(this.hasSnapshot&&oldAlpha>0){
      this.drawSnapshot(oldAlpha*.9,'none',zoom,driftX,driftY);

      // Two faint full-frame echoes give a soft, liquid dream shimmer without
      // chopping the image into bands or invoking an expensive per-strip blur.
      if(swell>.02){
        ctx.save();
        ctx.globalCompositeOperation='screen';
        this.drawSnapshot(oldAlpha*swell*.085,'none',zoom*1.002,driftX+3.4*swell,driftY-1.2*swell);
        this.drawSnapshot(oldAlpha*swell*.055,'none',Math.max(.996,zoom*.998),driftX-2.6*swell,driftY+1.5*swell);
        ctx.restore();
      }
    }

    const wash=ctx.createRadialGradient(w*.5,h*.44,0,w*.5,h*.44,Math.max(w,h)*.78);
    wash.addColorStop(0,'rgba(236,249,255,'+(.18+swell*.32)+')');
    wash.addColorStop(.35,'rgba(125,190,224,'+(swell*.19)+')');
    wash.addColorStop(.72,'rgba(74,72,126,'+(swell*.24)+')');
    wash.addColorStop(1,'rgba(4,7,15,'+(swell*.62)+')');
    ctx.fillStyle=wash;
    ctx.fillRect(0,0,w,h);

    // Draw all motes in one glow pass instead of constructing a radial
    // gradient for every mote on every frame.
    if(swell>.015&&this.motes.length){
      ctx.save();
      ctx.globalCompositeOperation='lighter';
      ctx.globalAlpha=.22*swell;
      ctx.fillStyle='rgba(211,242,255,.9)';
      ctx.shadowColor='rgba(138,205,239,.72)';
      ctx.shadowBlur=8+10*swell;
      ctx.beginPath();
      for(const m of this.motes){
        const y=(m.y-(p*m.drift*2.1)+h)%h;
        const x=m.x+Math.sin(m.phase+time*1.2)*11*swell;
        const r=Math.max(.8,m.r*(.65+swell*.55));
        ctx.moveTo(x+r,y);
        ctx.arc(x,y,r,0,Math.PI*2);
      }
      ctx.fill();
      ctx.restore();
    }

    const vignette=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.18,w*.5,h*.5,Math.max(w,h)*.74);
    vignette.addColorStop(0,'rgba(0,0,0,0)');
    vignette.addColorStop(1,'rgba(1,4,12,'+(swell*.44)+')');
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,w,h);
  }

  drawMistVeil(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const swell=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.12,.54,p);
    this.drawSnapshot(oldAlpha,'none',1+swell*.006);

    const veil=Math.pow(swell,.72);
    const time=now*.00022;
    const bands=[
      {x:.08,y:.32,r:.48,a:.54,s:.9},
      {x:.42,y:.62,r:.56,a:.48,s:1.2},
      {x:.78,y:.38,r:.52,a:.50,s:1.05},
      {x:.62,y:.16,r:.44,a:.38,s:.72}
    ];
    ctx.save();
    ctx.globalCompositeOperation='source-over';
    for(let i=0;i<bands.length;i++){
      const b=bands[i];
      const x=w*(b.x+Math.sin(time*b.s+i)*.05);
      const y=h*(b.y+Math.cos(time*(b.s*.8)+i*.7)*.035);
      const r=Math.max(w,h)*b.r;
      const g=ctx.createRadialGradient(x,y,0,x,y,r);
      g.addColorStop(0,'rgba(218,231,226,'+(veil*b.a)+')');
      g.addColorStop(.48,'rgba(154,174,177,'+(veil*b.a*.7)+')');
      g.addColorStop(1,'rgba(37,45,52,0)');
      ctx.fillStyle=g;
      ctx.fillRect(0,0,w,h);
    }
    ctx.fillStyle='rgba(18,24,29,'+(veil*.34)+')';
    ctx.fillRect(0,0,w,h);
    ctx.restore();
  }

  drawInkBleed(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const oldAlpha=1-smoothstep(.08,.47,p);
    this.drawSnapshot(oldAlpha,'none',1+p*.004);

    const close=smoothstep(.03,.5,p);
    const open=smoothstep(.5,.98,p);
    const coverage=p<=.5?close:1-open;
    const base=Math.max(w,h)*(0.025+coverage*.86);
    const points=[
      [.50,.48,1.00],[.18,.22,.58],[.82,.24,.62],[.20,.76,.66],
      [.80,.78,.64],[.48,.08,.52],[.52,.92,.55],[.06,.52,.50],[.94,.50,.50]
    ];
    ctx.save();
    ctx.fillStyle='rgba(3,4,7,'+Math.min(1,coverage*1.18)+')';
    for(let i=0;i<points.length;i++){
      const q=points[i];
      const wobble=1+Math.sin(now*.0011+i*1.73)*.035*coverage;
      ctx.beginPath();
      ctx.arc(w*q[0],h*q[1],base*q[2]*wobble,0,Math.PI*2);
      ctx.fill();
    }
    if(coverage>.58){
      ctx.fillStyle='rgba(0,0,0,'+smoothstep(.58,.88,coverage)+')';
      ctx.fillRect(0,0,w,h);
    }
    ctx.restore();
  }

  drawEclipse(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const half=p<.5?1-p*2:(p-.5)*2;
    const oldAlpha=1-smoothstep(.08,.48,p);
    this.drawSnapshot(oldAlpha,'none',1);

    const radius=Math.max(3,Math.hypot(w,h)*.58*Math.pow(half,.72));
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.985)';
    ctx.fillRect(0,0,w,h);
    ctx.globalCompositeOperation='destination-out';
    ctx.beginPath();
    ctx.arc(w*.5,h*.5,radius,0,Math.PI*2);
    ctx.fill();
    ctx.restore();

    const ringAlpha=Math.min(1,(1-half)*2.1)*(.72+.18*Math.sin(now*.0015));
    if(ringAlpha>.02){
      ctx.save();
      ctx.strokeStyle='rgba(223,198,126,'+ringAlpha*.72+')';
      ctx.shadowColor='rgba(113,196,220,'+ringAlpha*.42+')';
      ctx.shadowBlur=16;
      ctx.lineWidth=Math.max(1.2,Math.min(3,w*.002));
      ctx.beginPath();
      ctx.arc(w*.5,h*.5,radius+1.5,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
  }

  drawWaterRipple(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const swell=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.12,.6,p);
    const wave=Math.sin(p*Math.PI*5.5)*swell;
    this.drawSnapshot(oldAlpha*.86,'none',1+swell*.008);
    if(oldAlpha>0&&swell>.02){
      ctx.save();
      ctx.globalCompositeOperation='screen';
      this.drawSnapshot(oldAlpha*swell*.10,'none',1.006+wave*.0025,0,wave*1.8);
      this.drawSnapshot(oldAlpha*swell*.065,'none',.997-wave*.0018,0,-wave*1.4);
      ctx.restore();
    }

    const cx=w*.5,cy=h*.5,maxR=Math.hypot(w,h)*.56;
    ctx.save();
    ctx.strokeStyle='rgba(188,226,236,'+(swell*.28)+')';
    ctx.lineWidth=1.4;
    for(let i=0;i<4;i++){
      const rp=(p*1.55+i*.18)%1;
      const r=maxR*rp;
      ctx.globalAlpha=(1-rp)*swell;
      ctx.beginPath();
      ctx.ellipse(cx,cy,r,r*.54,0,0,Math.PI*2);
      ctx.stroke();
    }
    ctx.restore();

    const g=ctx.createRadialGradient(cx,cy,0,cx,cy,maxR);
    g.addColorStop(0,'rgba(204,238,244,'+(swell*.16)+')');
    g.addColorStop(.55,'rgba(61,117,138,'+(swell*.12)+')');
    g.addColorStop(1,'rgba(3,11,18,'+(swell*.46)+')');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
  }

  drawRelicAperture(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const close=p<.5?smoothstep(0,.5,p):1-smoothstep(.5,1,p);
    const oldAlpha=1-smoothstep(.12,.5,p);
    this.drawSnapshot(oldAlpha,'none',1);

    const cx=w*.5,cy=h*.5,maxR=Math.hypot(w,h)*.59;
    const aperture=maxR*(1-close);
    ctx.save();
    ctx.fillStyle='rgba(3,6,8,'+Math.min(.98,.12+close*.94)+')';
    ctx.beginPath();
    ctx.rect(0,0,w,h);
    ctx.arc(cx,cy,Math.max(2,aperture),0,Math.PI*2,true);
    ctx.fill('evenodd');

    const rings=4;
    for(let i=0;i<rings;i++){
      const rr=Math.max(6,aperture+(i+1)*(22+Math.min(w,h)*.018));
      const rot=(i%2?1:-1)*now*.00016*(i+1);
      ctx.save();
      ctx.translate(cx,cy);
      ctx.rotate(rot);
      ctx.strokeStyle=i%2?'rgba(109,211,229,'+(.22+close*.36)+')':'rgba(224,190,102,'+(.24+close*.42)+')';
      ctx.lineWidth=1.1+i*.45;
      ctx.setLineDash([Math.max(10,rr*.10),Math.max(8,rr*.055)]);
      ctx.beginPath();
      ctx.arc(0,0,rr,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  drawDepthBlur(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const swell=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.16,.6,p);
    const blur=(swell*12).toFixed(1);
    const zoom=1+swell*.028;
    this.drawSnapshot(oldAlpha,'blur('+blur+'px) saturate('+(1-swell*.22)+')',zoom);
    const cover=Math.pow(swell,.82);
    ctx.fillStyle='rgba(8,11,15,'+(cover*.72)+')';
    ctx.fillRect(0,0,w,h);
    const g=ctx.createRadialGradient(w*.5,h*.46,0,w*.5,h*.46,Math.max(w,h)*.62);
    g.addColorStop(0,'rgba(217,227,226,'+(swell*.10)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.fillRect(0,0,w,h);
  }

  drawLeylinePulse(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const swell=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.14,.56,p);
    this.drawSnapshot(oldAlpha,'none',1+swell*.006);

    const pulse=Math.exp(-Math.pow((p-.46)/.18,2));
    const branches=[
      [[.02,.72],[.19,.62],[.34,.68],[.49,.45],[.67,.52],[.98,.28]],
      [[.08,.20],[.27,.34],[.44,.29],[.57,.48],[.76,.70],[.96,.76]],
      [[.20,.98],[.31,.76],[.47,.66],[.55,.48],[.62,.31],[.70,.02]],
      [[.00,.46],[.23,.48],[.39,.41],[.55,.48],[.75,.44],[1,.52]]
    ];
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(let i=0;i<branches.length;i++){
      const pts=branches[i];
      const progress=Math.min(1,Math.max(0,p*2.1-i*.06));
      if(progress<=0)continue;
      ctx.beginPath();
      ctx.moveTo(pts[0][0]*w,pts[0][1]*h);
      const total=pts.length-1;
      const end=progress*total;
      for(let j=1;j<=Math.floor(end)&&j<pts.length;j++)ctx.lineTo(pts[j][0]*w,pts[j][1]*h);
      const frac=end-Math.floor(end);
      const j=Math.floor(end);
      if(frac>0&&j<total){
        const a=pts[j],b=pts[j+1];
        ctx.lineTo((a[0]+(b[0]-a[0])*frac)*w,(a[1]+(b[1]-a[1])*frac)*h);
      }
      ctx.strokeStyle=i%2?'rgba(118,228,241,'+(.25+pulse*.65)+')':'rgba(238,202,106,'+(.22+pulse*.62)+')';
      ctx.lineWidth=1.1+pulse*1.7;
      ctx.shadowColor=i%2?'rgba(89,207,233,.8)':'rgba(229,187,82,.75)';
      ctx.shadowBlur=7+pulse*15;
      ctx.stroke();
    }
    ctx.restore();

    const flash=Math.min(.86,pulse*.72);
    if(flash>.01){
      const g=ctx.createRadialGradient(w*.54,h*.48,0,w*.54,h*.48,Math.max(w,h)*.62);
      g.addColorStop(0,'rgba(226,251,255,'+flash+')');
      g.addColorStop(.26,'rgba(123,220,237,'+(flash*.46)+')');
      g.addColorStop(.62,'rgba(218,179,78,'+(flash*.18)+')');
      g.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=g;
      ctx.fillRect(0,0,w,h);
    }
    ctx.fillStyle='rgba(3,7,12,'+(swell*.22)+')';
    ctx.fillRect(0,0,w,h);
  }

  drawCrystal(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const burst=Math.exp(-Math.pow((p-.39)/.13,2));
    const trail=Math.max(0,1-smoothstep(.42,1,p));
    this.drawSnapshot(1-smoothstep(.2,.48,p),'brightness('+(1+burst*.55)+')',1+burst*.018);

    ctx.save();
    ctx.globalCompositeOperation='lighter';

    const rays=18;
    ctx.translate(w*.5,h*.48);
    for(let i=0;i<rays;i++){
      const a=(i/rays)*Math.PI*2+now*.00008;
      const inner=18+burst*22;
      const outer=(70+burst*Math.max(w,h)*.72)*(0.72+((i*37)%10)/30);
      ctx.strokeStyle=i%3===0?'rgba(244,205,105,'+(burst*.32)+')':'rgba(143,230,249,'+(burst*.28)+')';
      ctx.lineWidth=.7+(i%4)*.45;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a)*inner,Math.sin(a)*inner);
      ctx.lineTo(Math.cos(a)*outer,Math.sin(a)*outer);
      ctx.stroke();
    }
    ctx.restore();

    for(const s of this.shards){
      const travel=speedEase(p)*s.speed;
      const x=s.x+Math.cos(s.angle)*travel;
      const y=s.y+Math.sin(s.angle)*travel;
      const alpha=Math.min(1,burst*1.8+trail*.22)*(1-p);
      if(alpha<=.01)continue;
      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(s.angle+s.spin*p);
      ctx.globalAlpha=alpha;
      const g=ctx.createLinearGradient(0,0,s.len,0);
      if(s.tint==='gold'){
        g.addColorStop(0,'rgba(255,237,174,.1)');
        g.addColorStop(.55,'rgba(244,197,82,.72)');
        g.addColorStop(1,'rgba(255,251,220,0)');
      }else{
        g.addColorStop(0,'rgba(214,251,255,.08)');
        g.addColorStop(.55,'rgba(117,225,245,.72)');
        g.addColorStop(1,'rgba(225,252,255,0)');
      }
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.lineTo(s.len,s.width*.5);
      ctx.lineTo(s.len*.72,-s.width*.62);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    const flash=ctx.createRadialGradient(w*.5,h*.48,0,w*.5,h*.48,Math.max(w,h)*.62);
    flash.addColorStop(0,'rgba(255,255,255,'+Math.min(.96,burst*1.15)+')');
    flash.addColorStop(.15,'rgba(222,251,255,'+(burst*.76)+')');
    flash.addColorStop(.42,'rgba(112,220,242,'+(burst*.28)+')');
    flash.addColorStop(.7,'rgba(224,179,76,'+(burst*.12)+')');
    flash.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=flash;
    ctx.fillRect(0,0,w,h);
  }

  drawGlitch(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const strength=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.28,.72,p);

    if(this.hasSnapshot){
      const strip=10;
      for(let y=0;y<h;y+=strip){
        const band=Math.sin((y+this.seed)*.13+Math.floor(now/42))*strength;
        const offset=band*22*(.35+Math.sin(y*.031+this.seed)*.65);
        const sy=Math.floor(y*this.pixelRatio);
        const sh=Math.max(1,Math.ceil(strip*this.pixelRatio));

        ctx.save();
        ctx.globalAlpha=.12*strength;
        ctx.globalCompositeOperation='screen';
        ctx.drawImage(this.snapshot,0,sy,this.snapshot.width,sh,offset+7,y,w,strip+1);
        ctx.fillStyle='rgba(80,232,247,.15)';
        ctx.fillRect(0,y,w,strip);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha=.1*strength;
        ctx.globalCompositeOperation='screen';
        ctx.drawImage(this.snapshot,0,sy,this.snapshot.width,sh,offset-7,y,w,strip+1);
        ctx.fillStyle='rgba(229,68,132,.12)';
        ctx.fillRect(0,y,w,strip);
        ctx.restore();

        ctx.save();
        ctx.globalAlpha=Math.max(.12,oldAlpha*.72);
        ctx.drawImage(this.snapshot,0,sy,this.snapshot.width,sh,offset,y,w,strip+1);
        ctx.restore();
      }
    }

    ctx.save();
    for(let y=0;y<h;y+=8){
      ctx.fillStyle='rgba(105,224,237,'+(.018+.035*strength)+')';
      ctx.fillRect(0,y,w,1);
    }
    const blocks=14;
    for(let i=0;i<blocks;i++){
      const yy=((i*73+Math.floor(now/55)*41+this.seed*17)%h);
      const bw=30+((i*53)%180);
      const xx=((i*97+this.seed*23)%Math.max(1,w-bw));
      const alpha=(i%3===0?.16:.06)*strength;
      ctx.fillStyle=i%2?'rgba(77,228,240,'+alpha+')':'rgba(218,68,127,'+alpha+')';
      ctx.fillRect(xx,yy,bw,2+(i%4)*2);
    }
    ctx.restore();

    const dark=.18+.46*strength;
    ctx.fillStyle='rgba(2,6,9,'+dark+')';
    ctx.fillRect(0,0,w,h);
  }

  drawMemory(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const swell=Math.sin(Math.PI*p);
    const oldAlpha=1-smoothstep(.22,.68,p);
    this.drawSnapshot(oldAlpha,'grayscale('+(swell*.88)+') sepia('+(swell*.55)+') blur('+(swell*2.2)+'px)',1+swell*.008);

    ctx.fillStyle='rgba(92,72,46,'+(swell*.13)+')';
    ctx.fillRect(0,0,w,h);

    for(const d of this.dust){
      const x=d.x+Math.sin(d.phase+now*.0006)*9;
      const y=(d.y-p*26+h)%h;
      ctx.fillStyle='rgba(236,218,174,'+(d.alpha*swell)+')';
      ctx.beginPath();
      ctx.arc(x,y,d.r,0,Math.PI*2);
      ctx.fill();
    }

    const vignette=ctx.createRadialGradient(w*.5,h*.46,Math.min(w,h)*.16,w*.5,h*.46,Math.max(w,h)*.72);
    vignette.addColorStop(0,'rgba(247,230,189,'+(swell*.035)+')');
    vignette.addColorStop(.62,'rgba(49,38,27,'+(swell*.14)+')');
    vignette.addColorStop(1,'rgba(3,4,5,'+(swell*.72)+')');
    ctx.fillStyle=vignette;
    ctx.fillRect(0,0,w,h);
  }

  drawImpact(p,now){
    const ctx=this.ctx,w=this.width,h=this.height;
    const pulseA=Math.exp(-Math.pow((p-.13)/.055,2));
    const pulseB=Math.exp(-Math.pow((p-.31)/.075,2))*.72;
    const pulse=Math.min(1,pulseA+pulseB);
    const oldAlpha=1-smoothstep(.12,.42,p);
    this.drawSnapshot(oldAlpha,'contrast('+(1+pulse*.5)+') brightness('+(1+pulse*.35)+')',1+pulse*.025);

    ctx.fillStyle='rgba(235,249,255,'+(pulse*.92)+')';
    ctx.fillRect(0,0,w,h);

    const cx=w*.5,cy=h*.48;
    const ringP=smoothstep(.08,.72,p);
    const radius=ringP*Math.max(w,h)*.58;
    ctx.save();
    ctx.strokeStyle='rgba(178,231,242,'+((1-ringP)*.48)+')';
    ctx.lineWidth=1.5+(1-ringP)*3.5;
    ctx.beginPath();
    ctx.arc(cx,cy,radius,0,Math.PI*2);
    ctx.stroke();

    for(let i=0;i<16;i++){
      const a=(i/16)*Math.PI*2;
      const inner=radius*.35;
      const outer=radius*(.75+((i*17)%8)/20);
      ctx.strokeStyle='rgba(225,242,245,'+((1-ringP)*.18)+')';
      ctx.lineWidth=1;
      ctx.beginPath();
      ctx.moveTo(cx+Math.cos(a)*inner,cy+Math.sin(a)*inner);
      ctx.lineTo(cx+Math.cos(a)*outer,cy+Math.sin(a)*outer);
      ctx.stroke();
    }
    ctx.restore();

    const dark=smoothstep(.28,.5,p)*(1-smoothstep(.58,1,p));
    ctx.fillStyle='rgba(1,3,5,'+(dark*.82)+')';
    ctx.fillRect(0,0,w,h);
  }
}

function speedEase(p){
  return p<.45?Math.pow(p/.45,1.8):1+((p-.45)/.55)*.7;
}

function getTransitionCanvasRenderer(){
  if(!transitionCanvasRenderer&&els.transitionFxCanvas&&els.playerDisplay){
    transitionCanvasRenderer=new TransitionCanvasRenderer(els.transitionFxCanvas,els.playerDisplay);
  }
  return transitionCanvasRenderer;
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
    s.hud_visible===false?'hud-off':'hud-on',
    Number(s.transition_state?.nonce)||0
  ].join('|');
}

function playDisplayTransition(config=transitionState()){
  if(!displayInitialized)return;
  getTransitionCanvasRenderer()?.play(config);
}

function renderTransitionControls(){
  if(!state)return;
  const cfg=transitionState();
  const enabled=transitionEnabledForMode(state?.mode);
  if(els.transitionStyle)els.transitionStyle.value=cfg.style;
  if(els.transitionDuration)els.transitionDuration.value=String(cfg.duration_ms);
  if(els.previewTransitionBtn)els.previewTransitionBtn.disabled=!enabled;
  if(els.transitionStatus){
    els.transitionStatus.textContent=transitionLabel(cfg.style)+' · '+(cfg.duration_ms/1000).toFixed(cfg.duration_ms%1000?2:0)+'s'+(!enabled?' · Scene & title only':'');
  }
}

async function setTransitionSetting(key,value){
  if(!canGMControl())return;
  const current=transitionState();
  const next={...current,nonce:transitionNonce()};
  if(key==='style')next.style=TRANSITION_STYLE_KEYS.includes(value)?value:'soft-fade';
  if(key==='duration_ms')next.duration_ms=TRANSITION_DURATIONS.includes(Number(value))?Number(value):1250;
  await patchState({transition_state:next});
}

async function previewTransition(){
  if(!canGMControl()||!transitionEnabledForMode(state?.mode))return;
  const cfg=transitionState();
  await patchState({transition_state:{...cfg,nonce:nextTransitionNonce()}});
}

async function fetchInteractiveMapSource(asset){
  if(!asset?.id||!asset?.image_url)throw new Error('Interactive map file is missing.');
  if(interactiveMapCache.has(asset.id))return interactiveMapCache.get(asset.id);
  const response=await fetch(asset.image_url,{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the interactive map file.');
  const source=await response.text();
  if(!/<html[\s>]/i.test(source)||!/<body[\s>]/i.test(source)){
    throw new Error('The stored world map is not valid HTML.');
  }
  interactiveMapCache.set(asset.id,source);
  return source;
}

function mapSourceForRole(source,role){
  let preparedSource=source;

  preparedSource=preparedSource
    .replace('>Travel active route</button>','>Begin Journey</button>')
    .replace('The party star will travel the snapped hex path and settle at the destination.','The party caravan will travel the snapped hex path and settle at the destination.')
    .replace("const duration=Math.max(2200,Math.min(12000,days*250));","const duration=Math.max(3200,Math.min(24000,days*650));");

  const oldPartyMarkup="core.innerHTML='<span class=\"party-symbol\">✦</span><span class=\"party-label\">Party</span>';";
  const caravanMarkup="core.innerHTML='<span class=\"party-symbol party-caravan\" aria-hidden=\"true\"><svg viewBox=\"0 0 72 52\" xmlns=\"http://www.w3.org/2000/svg\"><path class=\"caravan-canopy\" d=\"M17 24c1-9 7-15 18-15 12 0 20 6 21 15H17Z\"/><path class=\"caravan-body\" d=\"M13 23h47l-4 17H18l-5-17Z\"/><path class=\"caravan-trim\" d=\"M18 25h37M26 11v27M44 11v27\"/><path class=\"caravan-tongue\" d=\"M59 32h9l3 4\"/><circle class=\"caravan-wheel\" cx=\"25\" cy=\"42\" r=\"6\"/><circle class=\"caravan-wheel\" cx=\"50\" cy=\"42\" r=\"6\"/><circle class=\"caravan-hub\" cx=\"25\" cy=\"42\" r=\"2\"/><circle class=\"caravan-hub\" cx=\"50\" cy=\"42\" r=\"2\"/><circle class=\"caravan-lantern\" cx=\"62\" cy=\"28\" r=\"2.4\"/></svg></span><span class=\"party-label\">Party Caravan</span>';";
  if(preparedSource.includes(oldPartyMarkup))preparedSource=preparedSource.replace(oldPartyMarkup,caravanMarkup);

  const caravanStyle='<style id="aestra-party-caravan-style">'+
    '#partyToken .party-core{width:34px!important;height:28px!important;border-radius:10px!important;border:1px solid rgba(244,210,132,.36)!important;background:radial-gradient(circle at 50% 45%,rgba(22,28,31,.94),rgba(8,11,14,.96) 72%)!important;box-shadow:0 0 0 2px rgba(31,23,13,.62),0 0 13px rgba(228,178,76,.28),0 0 22px rgba(94,183,215,.10)!important;padding:2px!important}'+
    '#partyToken .party-symbol.party-caravan{display:block;width:30px;height:23px;line-height:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7)) drop-shadow(0 0 4px rgba(231,190,97,.24));pointer-events:none}'+
    '#partyToken .party-symbol.party-caravan svg{display:block;width:100%;height:100%;overflow:visible}'+
    '#partyToken .caravan-canopy{fill:#d8c28e;stroke:#4a3518;stroke-width:2;stroke-linejoin:round}'+
    '#partyToken .caravan-body{fill:#9a642c;stroke:#3c2814;stroke-width:2;stroke-linejoin:round}'+
    '#partyToken .caravan-trim{fill:none;stroke:#f0d68f;stroke-width:1.6;stroke-linecap:round;opacity:.8}'+
    '#partyToken .caravan-tongue{fill:none;stroke:#d8b46a;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'+
    '#partyToken .caravan-wheel{fill:#2e241b;stroke:#d8b46a;stroke-width:2}'+
    '#partyToken .caravan-hub{fill:#ecd18a}'+
    '#partyToken .caravan-lantern{fill:#9ee8f2;stroke:#e5ffff;stroke-width:.8;filter:drop-shadow(0 0 3px #73d8e8)}'+
    '#app.party-token-active #partyToken .party-core,#app.party-token-dragging #partyToken .party-core{width:58px!important;height:47px!important;border-radius:14px!important;box-shadow:0 0 0 3px rgba(31,23,13,.72),0 0 25px rgba(228,178,76,.42),0 0 40px rgba(94,183,215,.18),0 10px 24px rgba(0,0,0,.4)!important}'+
    '#app.party-token-active #partyToken .party-symbol.party-caravan,#app.party-token-dragging #partyToken .party-symbol.party-caravan{width:52px;height:40px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.78)) drop-shadow(0 0 7px rgba(231,190,97,.35))}'+
    '</style>';
  preparedSource=preparedSource.includes('</head>')?preparedSource.replace('</head>',caravanStyle+'</head>'):caravanStyle+preparedSource;

  // This marker is inside the atlas' private IIFE, after data/camera variables
  // exist. Expose one direct API here instead of trying to reach those lexicals
  // from a second script outside the IIFE.
  const mirrorAnchor="  const saveKey = 'aestraMapDataV78';";
  const nl=String.fromCharCode(10);
  const bridgeLines=[
    "  const aLiveRole="+JSON.stringify(role)+";",
    "  function aCollectLiveView(){",
    "    const r=wrap.getBoundingClientRect();",
    "    const fitScale=Math.max(.0001,Math.min(r.width/W,r.height/H));",
    "    return {centerX:(r.width/2-tx)/Math.max(scale,.0001),centerY:(r.height/2-ty)/Math.max(scale,.0001),zoom:scale/fitScale};",
    "  }",
    "  function aCollectLiveJourney(){",
    "    const party=journeyDisplayPos||(data.travel&&data.travel.party)||null;",
    "    const activeRoute=(data.travel&&data.travel.routes||[]).find(route=>route.id===data.travel.activeRouteId)||null;",
    "    let travel=null;",
    "    if(activeRoute&&activeRoute.points&&activeRoute.points.length>=2){",
    "      const path=routeHexPath(activeRoute.points);",
    "      const days=Math.max(0,path.length-1);",
    "      let currentDay=0;",
    "      const pos=journeyDisplayPos||(data.travel&&data.travel.party);",
    "      if(pos&&path.length){let nearest=0,best=Infinity;for(let i=0;i<path.length;i++){const d=Math.hypot(path[i].x-pos.x,path[i].y-pos.y);if(d<best){best=d;nearest=i}}currentDay=Math.max(0,Math.min(days,nearest))}",
    "      const end=path[path.length-1];",
    "      let destination='Destination';",
    "      if(end&&Array.isArray(data.markers)&&data.markers.length){let best=null,bestD=Infinity;for(const m of data.markers){const d=Math.hypot((m.x||0)-end.x,(m.y||0)-end.y);if(d<bestD){bestD=d;best=m}}if(best&&bestD<120)destination=best.name||destination}",
    "      const justArrived=!!activeRoute.travelled&&!!activeRoute.completedAt&&(Date.now()-Date.parse(activeRoute.completedAt)<5000);",
    "      travel={active:!!journeyActive,planned:!journeyActive&&!activeRoute.travelled,arrived:justArrived,routeName:activeRoute.name||'Planned Route',destination:destination,totalDays:days,currentDay:journeyActive?currentDay:(activeRoute.travelled?days:0),remainingDays:Math.max(0,days-(journeyActive?currentDay:(activeRoute.travelled?days:0))),progress:days?Math.max(0,Math.min(1,(journeyActive?currentDay:(activeRoute.travelled?days:0))/days)):0};",
    "    }",
    "    return {party:party?{x:Number(party.x)||0,y:Number(party.y)||0,visible:party.visible!==false}:null,travel:travel};",
    "  }",
    "  function aCollectLiveMirror(){",
    "    const r=wrap.getBoundingClientRect();",
    "    const fitScale=Math.max(.0001,Math.min(r.width/W,r.height/H));",
    "    const controls={};",
    "    document.querySelectorAll('input[type=checkbox][id]').forEach(el=>{controls[el.id]=!!el.checked});",
    "    ['hexSize','hexOpacity','fogOpacity'].forEach(id=>{const el=document.getElementById(id);if(el)controls[id]=el.value});",
    "    const party=journeyDisplayPos||(data.travel&&data.travel.party)||null;",
    "    const activeRoute=(data.travel&&data.travel.routes||[]).find(route=>route.id===data.travel.activeRouteId)||null;",
    "    let travel=null;",
    "    if(activeRoute&&activeRoute.points&&activeRoute.points.length>=2){",
    "      const path=routeHexPath(activeRoute.points);",
    "      const days=Math.max(0,path.length-1);",
    "      let currentDay=0;",
    "      const pos=journeyDisplayPos||(data.travel&&data.travel.party);",
    "      if(pos&&path.length){let nearest=0,best=Infinity;for(let i=0;i<path.length;i++){const d=Math.hypot(path[i].x-pos.x,path[i].y-pos.y);if(d<best){best=d;nearest=i}}currentDay=Math.max(0,Math.min(days,nearest))}",
    "      const end=path[path.length-1];",
    "      let destination='Destination';",
    "      if(end&&Array.isArray(data.markers)&&data.markers.length){let best=null,bestD=Infinity;for(const m of data.markers){const d=Math.hypot((m.x||0)-end.x,(m.y||0)-end.y);if(d<bestD){bestD=d;best=m}}if(best&&bestD<120)destination=best.name||destination}",
    "      const justArrived=!!activeRoute.travelled&&!!activeRoute.completedAt&&(Date.now()-Date.parse(activeRoute.completedAt)<5000);",
    "      travel={active:!!journeyActive,planned:!journeyActive&&!activeRoute.travelled,arrived:justArrived,routeName:activeRoute.name||'Planned Route',destination:destination,totalDays:days,currentDay:journeyActive?currentDay:(activeRoute.travelled?days:0),remainingDays:Math.max(0,days-(journeyActive?currentDay:(activeRoute.travelled?days:0))),progress:days?Math.max(0,Math.min(1,(journeyActive?currentDay:(activeRoute.travelled?days:0))/days)):0};",
    "    }",
    "    return {version:5,data:JSON.parse(JSON.stringify(data)),controls:controls,view:aCollectLiveView(),liveParty:party?{x:Number(party.x)||0,y:Number(party.y)||0,visible:party.visible!==false}:null,travel:travel};",
    "  }",
    "  function aApplyLiveView(view){",
    "    if(!view)return false;",
    "    try{",
    "      const r=wrap.getBoundingClientRect();",
    "      const fitScale=Math.max(.0001,Math.min(r.width/W,r.height/H));",
    "      const zoom=Math.max(.12,Math.min(8,Number(view.zoom)||1));",
    "      scale=fitScale*zoom;",
    "      tx=r.width/2-(Number(view.centerX)||W/2)*scale;",
    "      ty=r.height/2-(Number(view.centerY)||H/2)*scale;",
    "      applyTransform();",
    "      return true;",
    "    }catch(err){console.warn('Aestra live view apply failed',err);return false}",
    "  }",
    "  function aApplyLiveJourney(payload){",
    "    if(!payload)return false;",
    "    try{",
    "      if(payload.party&&data.travel&&data.travel.party){data.travel.party.x=Number(payload.party.x)||0;data.travel.party.y=Number(payload.party.y)||0;data.travel.party.visible=payload.party.visible!==false;if(typeof updatePartyDomPosition==='function'&&partyTokenEl&&partyTokenEl.querySelector('.party-core'))updatePartyDomPosition(data.travel.party);else renderTravel()}",
    "      if(aLiveRole==='player'&&window.aestraUpdateTravelHud)window.aestraUpdateTravelHud(payload.travel||null);",
    "      return true;",
    "    }catch(err){console.warn('Aestra live journey apply failed',err);return false}",
    "  }",
    "  function aApplyLiveMirror(mirror){",
    "    if(!mirror)return false;",
    "    try{",
    "      const payload=(mirror.data)?mirror:{data:mirror};",
    "      if(aLiveRole==='player'&&!document.getElementById('app').classList.contains('presentation'))setPresentation(true);",
    "      if(payload.data){data=JSON.parse(JSON.stringify(payload.data));normalizeData()}",
    "      const controls=payload.controls||payload.layers||{};",
    "      Object.entries(controls).forEach(([id,value])=>{const el=document.getElementById(id);if(!el)return;if(el.type==='checkbox')el.checked=!!value;else el.value=value});",
    "      if(payload.liveParty&&data.travel&&data.travel.party){data.travel.party.x=Number(payload.liveParty.x)||0;data.travel.party.y=Number(payload.liveParty.y)||0;data.travel.party.visible=payload.liveParty.visible!==false}",
    "      const fog=document.getElementById('fogOpacity');if(fog&&data.fog&&controls.fogOpacity==null)fog.value=data.fog.opacity||82;",
    "      renderAll();if(typeof syncLegendFilters==='function')syncLegendFilters();",
    "      if(aLiveRole==='player'&&window.aestraUpdateTravelHud)window.aestraUpdateTravelHud(payload.travel||null);",
    "      const applyView=()=>{if(payload.view)aApplyLiveView(payload.view)};",
    "      applyView();if(aLiveRole==='player')setTimeout(applyView,55);",
    "      if(aLiveRole==='player'){const exit=document.getElementById('presentationExit');if(exit)exit.style.display='none';const toggle=document.getElementById('presentationToggle');if(toggle)toggle.style.display='none'}",
    "      return true;",
    "    }catch(err){console.warn('Aestra live mirror apply failed',err);return false}",
    "  }",
    "  window.AestraLiveBridge={version:6,role:aLiveRole,collect:aCollectLiveMirror,collectView:aCollectLiveView,collectJourney:aCollectLiveJourney,apply:aApplyLiveMirror,applyView:aApplyLiveView,applyJourney:aApplyLiveJourney,applyParty:(x,y)=>{try{data.travel.party.x=Number(x)||0;data.travel.party.y=Number(y)||0;data.travel.party.visible=true;if(typeof updatePartyDomPosition==='function'&&partyTokenEl&&partyTokenEl.querySelector('.party-core'))updatePartyDomPosition(data.travel.party);else renderTravel();return true}catch(err){return false}},present:()=>{try{setPresentation(true);return true}catch(err){return false}}};",
    "  parent.postMessage({type:'aestra-map-ready',role:aLiveRole},'*');"
  ];
  const bridgeCode=bridgeLines.join(nl)+nl+nl;
  if(preparedSource.includes(mirrorAnchor)){
    preparedSource=preparedSource.replace(mirrorAnchor,bridgeCode+mirrorAnchor);
  }else{
    console.error('Aestra live bridge anchor not found');
  }

  if(role==='player'){
    const initMarker="  setTool('pan');\n  renderAll();\n  fit();\n  applyAmbientParallax();";
    const playerInit="  setTool('pan');\n  renderAll();\n  fit();\n  applyAmbientParallax();\n  setTimeout(() => { try { setPresentation(true); const exit=document.getElementById('presentationExit'); if(exit) exit.style.display='none'; const toggle=document.getElementById('presentationToggle'); if(toggle) toggle.style.display='none'; } catch (_) {} }, 120);";
    if(preparedSource.includes(initMarker))preparedSource=preparedSource.replace(initMarker,playerInit);
  }

  const playerStyle=role==='player'
    ? '<style id="aestra-live-table-runtime-style">'+
      '#app.presentation #presentationExit{display:none!important}#app.presentation #presentationToggle{display:none!important}body.aestra-live-embedded{background:#05080b!important}'+
      '#aestraTravelHud{position:fixed;left:50%;top:24px;transform:translate(-50%,-18px);z-index:9998;width:min(560px,calc(100vw - 72px));opacity:0;pointer-events:none;transition:opacity .35s ease,transform .35s ease;font-family:Inter,system-ui,sans-serif}'+
      '#aestraTravelHud.show{opacity:1;transform:translate(-50%,0)}'+
      '#aestraTravelHud .travel-panel{position:relative;overflow:hidden;border:1px solid rgba(224,185,104,.34);border-radius:16px;padding:12px 16px 13px;background:linear-gradient(180deg,rgba(5,9,13,.92),rgba(5,8,11,.78));box-shadow:0 16px 36px rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.035);backdrop-filter:blur(10px)}'+
      '#aestraTravelHud .travel-panel:before{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent,rgba(90,194,215,.05),transparent);pointer-events:none}'+
      '#aestraTravelHud .travel-kicker{font-family:Georgia,serif;color:#d9bd7d;font-size:10px;letter-spacing:.24em;text-transform:uppercase}'+
      '#aestraTravelHud .travel-title-row{display:flex;align-items:end;justify-content:space-between;gap:16px;margin-top:4px}'+
      '#aestraTravelHud .travel-route{font-family:Georgia,serif;color:#f3ead8;font-size:20px;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}'+
      '#aestraTravelHud .travel-day{color:#d8c69b;font-size:11px;letter-spacing:.08em;white-space:nowrap}'+
      '#aestraTravelHud .travel-destination{margin-top:3px;color:#99b9c1;font-size:10px;letter-spacing:.09em;text-transform:uppercase}'+
      '#aestraTravelHud .travel-bar{height:3px;margin-top:10px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.08)}'+
      '#aestraTravelHud .travel-fill{height:100%;width:0;background:linear-gradient(90deg,#9f7a3e,#e0c178,#8fd2df);box-shadow:0 0 10px rgba(135,210,225,.28);transition:width .18s linear}'+
      '#aestraTravelHud .travel-meta{display:flex;justify-content:space-between;margin-top:7px;color:#a8a197;font-size:9px;letter-spacing:.08em;text-transform:uppercase}'+
      '#aestraTravelHud.arrived .travel-panel{animation:aestraArrival 1.2s ease both;border-color:rgba(219,190,120,.6)}'+
      '@keyframes aestraArrival{0%{box-shadow:0 0 0 rgba(0,0,0,0)}35%{box-shadow:0 0 38px rgba(205,173,94,.24),0 16px 36px rgba(0,0,0,.42)}100%{box-shadow:0 16px 36px rgba(0,0,0,.42)}}'+
      '</style>'
    : '<style id="aestra-live-table-runtime-style">body.aestra-live-embedded{background:#05080b!important}</style>';

  const travelHud=role==='player'
    ? '<div id="aestraTravelHud"><div class="travel-panel"><div class="travel-kicker">JOURNEY</div><div class="travel-title-row"><div class="travel-route">Travelling</div><div class="travel-day">DAY 0 / 0</div></div><div class="travel-destination">Destination</div><div class="travel-bar"><div class="travel-fill"></div></div><div class="travel-meta"><span class="travel-elapsed">0 days travelled</span><span class="travel-remaining">0 days remaining</span></div></div></div><script>(function(){var hideTimer=null;window.aestraUpdateTravelHud=function(t){var hud=document.getElementById("aestraTravelHud");if(!hud)return;if(!t){hud.classList.remove("show","arrived");return}var show=!!(t.active||t.arrived);if(!show){hud.classList.remove("show","arrived");return}clearTimeout(hideTimer);hud.classList.toggle("arrived",!!t.arrived);hud.querySelector(".travel-kicker").textContent=t.arrived?"DESTINATION REACHED":"JOURNEY";hud.querySelector(".travel-route").textContent=t.routeName||"Travelling";hud.querySelector(".travel-day").textContent="DAY "+Math.min(t.totalDays||0,t.currentDay||0)+" / "+(t.totalDays||0);hud.querySelector(".travel-destination").textContent=t.arrived?(t.destination||"Destination"):("BOUND FOR "+(t.destination||"Destination"));hud.querySelector(".travel-fill").style.width=((t.arrived?1:(t.progress||0))*100)+"%";hud.querySelector(".travel-elapsed").textContent=(t.currentDay||0)+" days travelled";hud.querySelector(".travel-remaining").textContent=(t.remainingDays||0)+" days remaining";hud.classList.add("show");if(t.arrived){hideTimer=setTimeout(function(){hud.classList.remove("show","arrived")},3200)}}})();<\\/script>'
    : '';

  const addition=playerStyle+travelHud;
  return preparedSource.includes('</body>')?preparedSource.replace('</body>',addition+'</body>'):preparedSource+addition;
}

async function mountInteractiveMap(asset,role='player'){
  const frame=els.worldMapFrame;
  const token=++interactiveMapLoadToken;
  frame.classList.remove('hidden');
  els.playerDisplay.classList.add('map-live','map-loading');
  try{
    const source=await fetchInteractiveMapSource(asset);
    if(token!==interactiveMapLoadToken)return;
    if(frame.dataset.assetId===asset.id&&frame.dataset.role===role&&frame.srcdoc){
      if(role==='player'&&mapState?.state)sendMapStateToFrame();
      return;
    }
    mapBridgeReady=false;
    frame.removeAttribute('src');
    frame.onload=()=>{
      setTimeout(async()=>{
        try{
          const bridge=frame.contentWindow?.AestraLiveBridge;
          if(els.mapImportStatus&&bridge){
            els.mapImportStatus.textContent=(role==='gm')
              ? 'GM atlas bridge connected — full live mirroring active.'
              : 'Player atlas bridge connected — waiting for GM mirror…';
          }
        }catch(_){}
        if(role==='player'&&mapState?.state)sendMapStateToFrame();
        if(role==='player'&&supabase){
          try{
            const {data}=await supabase.from('live_table_map_state').select('state,updated_at').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
            if(data?.state){
              const applied=applyMapMirrorToPlayer(data.state);
              if(applied)lastPlayerMapStateUpdatedAt=data.updated_at||'';
            }
          }catch(_){}
        }
      },180);
    };
    frame.srcdoc=mapSourceForRole(source,role);
    frame.dataset.assetId=asset.id;
    frame.dataset.role=role;
  }catch(err){
    console.error(err);
    if(token!==interactiveMapLoadToken)return;
    frame.removeAttribute('src');
    frame.srcdoc='<!doctype html><html><body style="margin:0;background:#05080b;color:#d8c58b;font-family:Georgia,serif;display:grid;place-items:center;height:100vh;text-align:center"><div><div style="font-size:34px">✦</div><h2>World map could not be loaded</h2><p style="color:#9aa3ad;font-family:system-ui,sans-serif">'+esc(err?.message||'Unknown map error')+'</p></div></body></html>';
    frame.dataset.assetId=asset?.id||'error';
    frame.dataset.role=role;
  }finally{
    if(token===interactiveMapLoadToken)els.playerDisplay.classList.remove('map-loading');
  }
}

function sendMapStateToFrame(){
  if(!mapState?.state||!els.worldMapFrame?.contentWindow)return false;
  const stored=mapState.state;
  const win=els.worldMapFrame.contentWindow;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.apply)return bridge.apply(stored)===true;
  }catch(err){
    console.warn('Direct map state apply failed',err);
  }
  return false;
}

async function persistMapState(nextState){
  if(!canGMControl()||!nextState)return;
  if(mapStatePersistBusy){
    mapStatePersistPending=nextState;
    return;
  }
  mapStatePersistBusy=true;
  try{
    const payload={
      campaign_id:CAMPAIGN_ID,
      state:nextState,
      updated_by:user.id,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await supabase.from('live_table_map_state').upsert(payload,{onConflict:'campaign_id'}).select().single();
    if(error){console.error('Map sync save failed',error);return}
    mapState=data;
    lastMapStatePersistAt=performance.now();
    if(els.mapImportStatus)els.mapImportStatus.textContent='Full GM map mirror is live — player display synced.';
  }finally{
    mapStatePersistBusy=false;
    if(mapStatePersistPending){
      const pending=mapStatePersistPending;
      mapStatePersistPending=null;
      const wait=Math.max(0,170-(performance.now()-lastMapStatePersistAt));
      clearTimeout(mapStateSaveTimer);
      mapStateSaveTimer=setTimeout(()=>persistMapState(pending),wait);
    }
  }
}

function queueMapStateSave(nextState){
  if(!canGMControl()||!nextState)return;
  mapStatePersistPending=nextState;
  if(mapStatePersistBusy)return;
  const wait=Math.max(0,170-(performance.now()-lastMapStatePersistAt));
  clearTimeout(mapStateSaveTimer);
  mapStateSaveTimer=setTimeout(()=>{
    const pending=mapStatePersistPending;
    mapStatePersistPending=null;
    if(pending)persistMapState(pending);
  },wait);
}

function applyMapMirrorToPlayer(mirror){
  if(!shouldReceivePlayerMap()||!mirror)return false;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return false;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.apply)return bridge.apply(mirror)===true;
  }catch(err){
    console.warn('Direct live mirror apply failed',err);
  }
  return false;
}

function sendMapMirror(mirror){
  if(!canGMControl()||!mirror)return;

  mapState={
    campaign_id:CAMPAIGN_ID,
    state:mirror,
    updated_by:user.id,
    updated_at:new Date().toISOString()
  };

  // Same-browser/tabletop path: no server round-trip.
  try{
    browserMapMotionChannel?.postMessage({kind:'mirror',mirror});
  }catch(err){
    console.warn('Local map mirror failed',err);
  }

  // Cross-device path. Keep large mirrors off Broadcast if they approach
  // lower-plan payload limits; the persisted state remains the fallback.
  if(mapMotionReady&&mapMotionChannel){
    try{
      const serialized=JSON.stringify(mirror);
      if(serialized.length<230000){
        mapMotionChannel.send({
          type:'broadcast',
          event:'map-mirror',
          payload:{mirror}
        }).catch(err=>console.warn('Realtime map mirror failed',err));
      }
    }catch(err){
      console.warn('Could not serialize map mirror',err);
    }
  }

  queueMapStateSave(mirror);
}

function applyMapCameraToPlayer(view){
  if(!shouldReceivePlayerMap()||!view)return false;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return false;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.applyView)return bridge.applyView(view)===true;
  }catch(err){
    console.warn('Direct camera motion apply failed',err);
  }
  return false;
}

function persistFinalMapCamera(){
  clearTimeout(mapCameraPersistTimer);
  mapCameraPersistTimer=setTimeout(()=>{
    if(!canGMControl()||state?.mode!=='map')return;
    const win=els.worldMapFrame?.contentWindow;
    try{
      const bridge=win?.AestraLiveBridge;
      const journey=bridge?.collectJourney?.();
      if(journey?.travel?.active){
        persistFinalMapCamera();
        return;
      }
      const mirror=bridge?.collect?.();
      if(!mirror)return;
      // Save the resting camera position without rebroadcasting the heavy mirror.
      mapState={
        campaign_id:CAMPAIGN_ID,
        state:mirror,
        updated_by:user.id,
        updated_at:new Date().toISOString()
      };
      const signature=JSON.stringify({...mirror,view:null,liveParty:null,travel:null});
      lastPolledMapMirrorSignature=signature;
      queueMapStateSave(mirror);
    }catch(err){
      console.warn('Could not persist final camera position',err);
    }
  },260);
}

function sendMapCameraMotion(view){
  if(!canGMControl()||!view)return;
  const centerX=Number(view.centerX),centerY=Number(view.centerY),zoom=Number(view.zoom);
  if(!Number.isFinite(centerX)||!Number.isFinite(centerY)||!Number.isFinite(zoom))return;
  const now=performance.now();
  if(now-lastMapCameraSentAt<28)return;
  lastMapCameraSentAt=now;
  const camera={centerX,centerY,zoom};

  if(mapState?.state)mapState.state={...mapState.state,view:camera};

  try{
    browserMapMotionChannel?.postMessage({kind:'camera-motion',view:camera});
  }catch(err){
    console.warn('Local camera motion broadcast failed',err);
  }

  if(mapMotionReady&&mapMotionChannel){
    mapMotionChannel.send({
      type:'broadcast',
      event:'camera-motion',
      payload:{view:camera}
    }).catch(err=>console.warn('Camera motion broadcast failed',err));
  }

  persistFinalMapCamera();
}

function applyJourneyMotionToPlayer(payload){
  if(!shouldReceivePlayerMap()||!payload)return false;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return false;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.applyJourney)return bridge.applyJourney(payload)===true;
  }catch(err){
    console.warn('Direct journey motion apply failed',err);
  }
  return false;
}

function sendJourneyMotion(payload){
  if(!canGMControl()||!payload)return;
  const now=performance.now();
  if(now-lastMapJourneySentAt<28)return;
  lastMapJourneySentAt=now;

  try{
    browserMapMotionChannel?.postMessage({kind:'journey-motion',payload});
  }catch(err){
    console.warn('Local journey motion broadcast failed',err);
  }

  if(mapMotionReady&&mapMotionChannel){
    mapMotionChannel.send({
      type:'broadcast',
      event:'journey-motion',
      payload
    }).catch(err=>console.warn('Journey motion broadcast failed',err));
  }
}

function applyPartyMotionToPlayer(x,y){
  if(!shouldReceivePlayerMap())return;
  const nx=Number(x),ny=Number(y);
  if(!Number.isFinite(nx)||!Number.isFinite(ny))return;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.applyParty&&bridge.applyParty(nx,ny))return;
  }catch(err){
    console.warn('Direct party motion apply failed',err);
  }
  win.postMessage({type:'aestra-map-party-motion-apply',x:nx,y:ny},'*');
}

function sendPartyMotion(x,y){
  if(!canGMControl())return;
  const nx=Number(x),ny=Number(y);
  if(!Number.isFinite(nx)||!Number.isFinite(ny))return;
  const now=performance.now();
  if(now-lastMapMotionSentAt<35)return;
  lastMapMotionSentAt=now;
  try{
    browserMapMotionChannel?.postMessage({kind:'party-motion',x:nx,y:ny});
  }catch(err){
    console.warn('Local party motion broadcast failed',err);
  }
  if(mapMotionReady&&mapMotionChannel){
    mapMotionChannel.send({
      type:'broadcast',
      event:'party-motion',
      payload:{x:nx,y:ny}
    }).catch(err=>console.warn('Party motion broadcast failed',err));
  }
}

function handleMapBridgeMessage(event){
  if(event.source!==els.worldMapFrame?.contentWindow)return;
  const message=event.data||{};
  if(message.type==='aestra-map-ready'){
    mapBridgeReady=true;
    if(shouldReceivePlayerMap()&&mapState?.state)sendMapStateToFrame();
    if(els.mapImportStatus&&state?.mode==='map'){
      els.mapImportStatus.textContent=shouldReceivePlayerMap()
        ? 'Player map connected.'
        : 'Full GM map mirror is live — drawings, layers, routes and view sync to players.';
    }
    return;
  }
  if(message.type==='aestra-map-mirror'&&canGMControl()&&message.mirror){
    sendMapMirror(message.mirror);
    return;
  }
  if(message.type==='aestra-map-party-motion'&&canGMControl()){
    sendPartyMotion(message.x,message.y);
    return;
  }
  if(message.type==='aestra-map-state'&&canGMControl()&&message.state){
    // Ignore the old plain-data bridge. Full versioned mirrors are authoritative.
    return;
  }
}

const SCENE_EFFECT_KEYS=['rain','storm','mist','wind','snow','ash','heat','magic','cold','spores','crystal','rays','dream','relic','clouds','petals','fireflies','underwater','moon','blackpetals','rainglass'];

function sceneEffectState(){
  return derivedStateValue('sceneEffects',()=>{
    const raw=state?.scene_effects&&typeof state.scene_effects==='object'?state.scene_effects:{};
    const effects=Array.isArray(raw.effects)
      ? [...new Set(raw.effects.filter(effect=>SCENE_EFFECT_KEYS.includes(effect)))]
      : [];
    const intensity=[1,2,3,4,5].includes(Number(raw.intensity))?Number(raw.intensity):2;
    const fadeMs=[350,900,1800].includes(Number(raw.fade_ms))?Number(raw.fade_ms):900;
    return {effects,intensity,fade_ms:fadeMs};
  });
}

let sceneAtmosphereRenderer=null;

function getSceneAtmosphereRenderer(){
  if(!sceneAtmosphereRenderer&&els.sceneFxCanvas&&els.sceneEffects){
    sceneAtmosphereRenderer=new SceneAtmosphereRenderer(els.sceneFxCanvas,els.sceneEffects,els.sceneFxShaderCanvas);
  }
  return sceneAtmosphereRenderer;
}

function renderSceneEffects(mode=state?.mode||'scene'){
  const cfg=sceneEffectState();
  const sceneOnly=mode==='scene';
  const host=els.sceneEffects;
  if(host){
    host.className='scene-effects intensity-'+cfg.intensity;
    host.style.setProperty('--scene-fx-fade',cfg.fade_ms+'ms');
    if(sceneOnly&&cfg.effects.length){
      host.classList.add('active');
      cfg.effects.forEach(effect=>host.classList.add('fx-'+effect));
    }
  }
  getSceneAtmosphereRenderer()?.setConfig(sceneOnly?cfg:{...cfg,effects:[]});

  const buttons=[...document.querySelectorAll('[data-scene-fx]')];
  buttons.forEach(button=>{
    const selected=cfg.effects.includes(button.dataset.sceneFx);
    button.classList.toggle('active',selected);
    button.setAttribute('aria-pressed',selected?'true':'false');
    button.disabled=!canGMControl()||!sceneOnly;
  });
  if(els.sceneFxIntensity){
    els.sceneFxIntensity.value=String(cfg.intensity);
    els.sceneFxIntensity.disabled=!canGMControl()||!sceneOnly;
  }
  if(els.sceneFxFade){
    els.sceneFxFade.value=String(cfg.fade_ms);
    els.sceneFxFade.disabled=!canGMControl()||!sceneOnly;
  }
  if(els.clearSceneFxBtn)els.clearSceneFxBtn.disabled=!canGMControl()||!sceneOnly||!cfg.effects.length;
  if(els.sceneEffectsPanel)els.sceneEffectsPanel.classList.toggle('scene-inactive',!sceneOnly);
  if(els.sceneFxStatus){
    els.sceneFxStatus.textContent=!sceneOnly
      ? 'Scene effects are paused outside Scene mode.'
      : cfg.effects.length
        ? cfg.effects.length+' effect'+(cfg.effects.length===1?'':'s')+' active • intensity '+cfg.intensity
        : 'No scene effects active.';
  }
}

async function toggleSceneEffect(effect){
  if(!canGMControl()||state?.mode!=='scene'||!SCENE_EFFECT_KEYS.includes(effect))return;
  const cfg=sceneEffectState();
  const next=cfg.effects.includes(effect)
    ? cfg.effects.filter(item=>item!==effect)
    : [...cfg.effects,effect];
  await patchState({scene_effects:{...cfg,effects:next}});
}

async function setSceneEffectSetting(key,value){
  if(!canGMControl()||state?.mode!=='scene')return;
  const next={...sceneEffectState()};
  if(key==='intensity')next.intensity=Math.max(1,Math.min(5,Number(value)||2));
  if(key==='fade_ms')next.fade_ms=[350,900,1800].includes(Number(value))?Number(value):900;
  await patchState({scene_effects:next});
}

function renderPinned(host,id){
  const asset=byId(id);
  if(!asset){host.classList.add('hidden');host.innerHTML='';delete host.dataset.kind;return}
  host.dataset.kind=asset.kind||'other';
  host.innerHTML='<img src="'+esc(asset.image_url)+'" alt="'+esc(asset.name)+'" decoding="async" fetchpriority="high"><strong>'+esc(asset.name)+'</strong>';
  host.classList.remove('hidden');
}

function renderDisplay(){
  if(!state)return;
  const scene=byId(state.active_scene_id);
  const map=byId(state.map_asset_id);
  const reveal=byId(state.active_reveal_id);
  const mode=state.mode||'scene';
  if(mode==='scene')warmArtwork(scene?.image_url);
  if(mode==='reveal')warmArtwork(reveal?.image_url);
  warmArtwork(byId(state.pinned_left_id)?.image_url);
  warmArtwork(byId(state.pinned_right_id)?.image_url);
  const signature=displaySignature(state);
  const currentSceneId=state.active_scene_id||'';
  const currentTransitionNonce=transitionNonce();
  // A reveal sits over the current scene/title. Closing or removing it should
  // uncover that display directly, rather than replaying its cue transition.
  const returningFromReveal=lastDisplayMode==='reveal'&&(mode==='scene'||mode==='title');
  const transitionTargetChanged=!returningFromReveal&&(
    (mode==='scene'&&(lastDisplayMode!=='scene'||currentSceneId!==lastRenderedSceneId))
    ||(mode==='title'&&lastDisplayMode!=='title')
  );
  const cueTransitionTriggered=transitionEnabledForMode(mode)&&currentTransitionNonce!==lastRenderedTransitionNonce;
  if(displayInitialized&&(transitionTargetChanged||cueTransitionTriggered)){
    getTransitionCanvasRenderer()?.preparePreviousMode(lastDisplayMode);
    playDisplayTransition(state?.transition_state);
  }
  els.previewHeading.textContent=mode==='map'?'World Map':mode==='reveal'?'Reveal':mode==='title'?'Title Screen':mode==='blackout'?'Blackout':'Scene View';
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));

  const interactiveMapLive=mode==='map'&&isInteractiveMap(map);
  const backdropAsset=mode==='map'?(interactiveMapLive?scene:(map||scene)):scene;
  setBackdrop(backdropAsset);
  getTransitionCanvasRenderer()?.setBackdropSource(backdropAsset?.image_url||'');
  if(interactiveMapLive){
    const mapRole=shouldReceivePlayerMap()?'player':'gm';
    mountInteractiveMap(map,mapRole);
  }else{
    interactiveMapLoadToken++;
    els.worldMapFrame.classList.add('hidden');
    els.playerDisplay.classList.remove('map-live','map-loading');
  }
  const name=mode==='map'?(map?.name||'WORLD MAP'):(state.location_title||scene?.name||'AESTRA');
  const sub=mode==='map'?(map?.subtitle||'Aestra'):(state.location_subtitle||scene?.subtitle||'');
  els.locationName.textContent=String(name).toUpperCase();
  els.locationSubtitle.textContent=sub;
  els.locationTitle.classList.toggle('hidden',interactiveMapLive||mode==='title'||mode==='blackout');

  els.revealLayer.classList.toggle('hidden',mode!=='reveal'||!reveal);
  if(mode==='reveal'&&reveal){
    els.revealLayer.dataset.kind=reveal.kind||'other';
    els.revealImage.src=reveal.image_url;
    els.revealImage.alt=reveal.name;
    els.revealKind.textContent=reveal.kind.replace('_',' ');
    els.revealName.textContent=reveal.name;
    els.revealSubtitle.textContent=reveal.subtitle||'';
    els.revealLayer.dataset.anchor=isCompactRevealAsset(reveal)?compactRevealAnchor(normalizeSceneCast()):'center';
  }else if(els.revealLayer){
    delete els.revealLayer.dataset.kind;
    delete els.revealLayer.dataset.anchor;
  }

  els.titleLayer.classList.toggle('hidden',mode!=='title');
  els.blackoutLayer.classList.toggle('hidden',mode!=='blackout');
  renderPinned(els.pinLeft,state.pinned_left_id);
  renderPinned(els.pinRight,state.pinned_right_id);
  els.hudToggle.checked=state.hud_visible!==false;
  renderParty();
  getSceneAtmosphereRenderer()?.setBackdropSource(mode==='scene'?(scene?.image_url||''):'');
  renderSceneEffects(mode);
  // The world map already represents the party with the caravan marker.
  // Hide the character HUD there to keep the map presentation uncluttered.
  els.partyHud.classList.toggle('hidden',mode==='map'||state.hud_visible===false);
  requestAnimationFrame(syncPartyHudSafeArea);
  lastDisplaySignature=signature;
  lastDisplayMode=mode;
  lastRenderedSceneId=currentSceneId;
  lastRenderedTransitionNonce=currentTransitionNonce;
  displayInitialized=true;
}


const LIBRARY_FOLDER_KINDS=['scene','npc','item','map','handout','creature','clue','location_detail','other'];

function normalizeAssetFolders(raw=state?.asset_folders){
  const source=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{};
  const out={};
  for(const kind of LIBRARY_FOLDER_KINDS){
    const list=Array.isArray(source[kind])?source[kind]:[];
    out[kind]=list.filter(folder=>folder&&typeof folder.id==='string'&&typeof folder.name==='string')
      .map(folder=>({id:folder.id,name:String(folder.name).trim().slice(0,60)||'Untitled Folder'})).slice(0,80);
  }
  return out;
}

function assetFolderId(asset){
  const id=assetMetadata(asset).library_folder_id;
  return typeof id==='string'&&id?id:'';
}

function folderCollapsedKey(kind,id){return 'aestra-live-folder:'+CAMPAIGN_ID+':'+kind+':'+id}
function folderIsCollapsed(kind,id){
  try{
    const value=localStorage.getItem(folderCollapsedKey(kind,id));
    return value===null?true:value==='1';
  }catch(_){return true}
}
function setFolderCollapsed(kind,id,collapsed){
  try{localStorage.setItem(folderCollapsedKey(kind,id),collapsed?'1':'0')}catch(_){}
}

function libraryFolderToolbar(kind){
  return '<div class="library-folder-toolbar"><button type="button" data-folder-add="'+esc(kind)+'">＋ Folder</button><span>Drag cards into folders to organise them.</span></div>';
}

function libraryFolderBlock(kind,folder,items,cardRenderer){
  const collapsed=folderIsCollapsed(kind,folder.id);
  return '<section class="library-folder'+(collapsed?' is-collapsed':'')+'" data-folder-kind="'+esc(kind)+'" data-folder-id="'+esc(folder.id)+'">'+
    '<div class="library-folder-head" data-folder-toggle="'+esc(folder.id)+'" data-folder-kind="'+esc(kind)+'">'+
      '<button type="button" class="library-folder-chevron" aria-label="'+(collapsed?'Open':'Close')+' folder">'+(collapsed?'▸':'▾')+'</button>'+
      '<strong>📁 '+esc(folder.name)+'</strong><span>'+items.length+'</span>'+
      '<div class="library-folder-actions"><button type="button" data-folder-rename="'+esc(folder.id)+'" data-folder-kind="'+esc(kind)+'">Rename</button><button type="button" data-folder-delete="'+esc(folder.id)+'" data-folder-kind="'+esc(kind)+'">Delete</button></div>'+
    '</div>'+
    '<div class="library-folder-content">'+(items.length?items.map(cardRenderer).join(''):'<p class="library-folder-empty">Drop assets here</p>')+'</div>'+
  '</section>';
}

function renderFolderedLibrary(kind,items,cardRenderer,{toolbar=true}={}){
  const folders=normalizeAssetFolders()[kind]||[];
  const validIds=new Set(folders.map(folder=>folder.id));
  const byFolder=new Map(folders.map(folder=>[folder.id,[]]));
  const unsorted=[];
  for(const item of items){
    const id=assetFolderId(item);
    if(id&&validIds.has(id))byFolder.get(id).push(item);
    else unsorted.push(item);
  }
  let html=toolbar?libraryFolderToolbar(kind):'';
  html+=folders.map(folder=>libraryFolderBlock(kind,folder,byFolder.get(folder.id)||[],cardRenderer)).join('');
  if(unsorted.length||!folders.length){
    const looseId='__unsorted__';
    const collapsed=folders.length?folderIsCollapsed(kind,looseId):false;
    html+='<section class="library-folder library-unsorted'+(collapsed?' is-collapsed':'')+'" data-folder-kind="'+esc(kind)+'" data-folder-id="'+looseId+'">'+
      (folders.length?'<div class="library-folder-head" data-folder-toggle="'+looseId+'" data-folder-kind="'+esc(kind)+'"><button type="button" class="library-folder-chevron">'+(collapsed?'▸':'▾')+'</button><strong>Unsorted</strong><span>'+unsorted.length+'</span></div>':'')+
      '<div class="library-folder-content">'+(unsorted.length?unsorted.map(cardRenderer).join(''):'<p class="library-folder-empty">No assets yet.</p>')+'</div></section>';
  }
  return html;
}

async function createLibraryFolder(kind){
  if(!canGMControl()||!LIBRARY_FOLDER_KINDS.includes(kind))return;
  const name=prompt('Folder name');
  if(!name?.trim())return;
  const folders=normalizeAssetFolders();
  folders[kind]=[...folders[kind],{id:crypto.randomUUID(),name:name.trim().slice(0,60)}];
  await patchState({asset_folders:folders});
  renderScenes();renderRevealGrid();
}

async function renameLibraryFolder(kind,id){
  if(!canGMControl())return;
  const folders=normalizeAssetFolders();
  const folder=folders[kind]?.find(item=>item.id===id);
  if(!folder)return;
  const name=prompt('Rename folder',folder.name);
  if(!name?.trim())return;
  folders[kind]=folders[kind].map(item=>item.id===id?{...item,name:name.trim().slice(0,60)}:item);
  await patchState({asset_folders:folders});
  renderScenes();renderRevealGrid();
}

async function deleteLibraryFolder(kind,id){
  if(!canGMControl())return;
  const folders=normalizeAssetFolders();
  const folder=folders[kind]?.find(item=>item.id===id);
  if(!folder)return;
  if(!confirm('Delete folder "'+folder.name+'"? Its assets will move to Unsorted.'))return;
  const affected=assets.filter(asset=>asset.kind===kind&&assetFolderId(asset)===id);
  for(const asset of affected){
    const metadata={...assetMetadata(asset)};
    delete metadata.library_folder_id;
    const result=await supabase.from('live_table_assets').update({metadata,updated_at:new Date().toISOString()}).eq('id',asset.id).select().single();
    if(!result.error)assets=assets.map(item=>item.id===asset.id?result.data:item);
  }
  folders[kind]=folders[kind].filter(item=>item.id!==id);
  await patchState({asset_folders:folders});
  renderScenes();renderRevealGrid();
}

async function moveAssetToLibraryFolder(assetId,kind,folderId){
  if(!canGMControl())return;
  const asset=byId(assetId);
  if(!asset||asset.kind!==kind)return;
  const metadata={...assetMetadata(asset)};
  if(folderId==='__unsorted__')delete metadata.library_folder_id;
  else{
    const valid=normalizeAssetFolders()[kind]?.some(folder=>folder.id===folderId);
    if(!valid)return;
    metadata.library_folder_id=folderId;
  }
  const result=await supabase.from('live_table_assets').update({metadata,updated_at:new Date().toISOString()}).eq('id',asset.id).select().single();
  if(result.error){alert(result.error.message);return}
  assets=assets.map(item=>item.id===asset.id?result.data:item);
  renderScenes();renderRevealGrid();
}

function wireLibraryFolders(host){
  if(!host)return;
  delegate(host,'click','[data-folder-add],[data-folder-toggle],[data-folder-rename],[data-folder-delete]',(event,target)=>{
    if(target.dataset.folderAdd){createLibraryFolder(target.dataset.folderAdd);return}
    const kind=target.dataset.folderKind||target.closest('[data-folder-kind]')?.dataset.folderKind;
    if(target.dataset.folderRename){event.stopPropagation();renameLibraryFolder(kind,target.dataset.folderRename);return}
    if(target.dataset.folderDelete){event.stopPropagation();deleteLibraryFolder(kind,target.dataset.folderDelete);return}
    if(target.dataset.folderToggle){
      if(event.target.closest('.library-folder-actions'))return;
      const id=target.dataset.folderToggle;
      const folder=target.closest('.library-folder');
      const collapsed=!folder.classList.contains('is-collapsed');
      setFolderCollapsed(kind,id,collapsed);
      folder.classList.toggle('is-collapsed',collapsed);
      const chevron=folder.querySelector('.library-folder-chevron');
      if(chevron)chevron.textContent=collapsed?'▸':'▾';
    }
  });
  delegate(host,'dragstart','.scene-card,.reveal-card',(event,card)=>{
    libraryDragAssetId=card.dataset.sceneId||card.dataset.assetId||'';
    if(event.dataTransfer){event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',libraryDragAssetId)}
  });
  delegate(host,'dragend','.scene-card,.reveal-card',()=>{
    libraryDragAssetId='';
    host.querySelectorAll('.is-folder-drop').forEach(el=>el.classList.remove('is-folder-drop'));
  });
  delegate(host,'dragover','.library-folder',(event,folder)=>{
    if(!libraryDragAssetId)return;
    event.preventDefault();folder.classList.add('is-folder-drop');
  });
  delegate(host,'dragleave','.library-folder',(event,folder)=>{
    if(!folder.contains(event.relatedTarget))folder.classList.remove('is-folder-drop');
  });
  delegate(host,'drop','.library-folder',(event,folder)=>{
    event.preventDefault();folder.classList.remove('is-folder-drop');
    const id=libraryDragAssetId||event.dataTransfer?.getData('text/plain')||'';
    moveAssetToLibraryFolder(id,folder.dataset.folderKind||'',folder.dataset.folderId||'__unsorted__');
    libraryDragAssetId='';
  });
}

function sceneCard(asset){
  const active=state?.active_scene_id===asset.id;
  return '<article class="scene-card'+(active?' active':'')+'" draggable="true" data-scene-id="'+asset.id+'">'+
    '<div class="scene-thumb"><img src="'+esc(assetThumbnailUrl(asset))+'" alt="" loading="'+(active?'eager':'lazy')+'" decoding="async" fetchpriority="'+(active?'high':'low')+'"></div>'+
    '<div><strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||'Scene backdrop')+'</small></div>'+
    '<div class="scene-actions"><button type="button" class="scene-inspect-btn" data-scene-inspect="'+asset.id+'">INSPECT</button><button type="button" data-scene-go="'+asset.id+'">'+(active?'LIVE':'GO')+'</button><button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderScenes(){
  const scenes=assets.filter(a=>a.kind==='scene');
  els.sceneStrip.innerHTML=renderFolderedLibrary('scene',scenes,sceneCard);
}

function isSceneCastAsset(asset){
  return Boolean(asset&&(asset.kind==='npc'||asset.kind==='creature'));
}

function isCompactRevealAsset(asset){
  return Boolean(asset&&(asset.kind==='item'||asset.kind==='clue'));
}

function normalizeSceneCast(raw){
  const useLive=arguments.length===0||raw===undefined||raw===state?.scene_cast;
  if(useLive)return derivedStateValue('sceneCast',()=>normalizeSceneCastValue(state?.scene_cast));
  return normalizeSceneCastValue(raw);
}

function normalizeSceneCastValue(raw){
  const source=raw&&typeof raw==='object'?raw:{};
  const ids=Array.isArray(source.ids)
    ? [...new Set(source.ids.filter(id=>typeof id==='string'&&isSceneCastAsset(byId(id))))].slice(0,6)
    : [];
  const active_id=ids.includes(source.active_id)?source.active_id:null;
  const layouts={};
  if(source.layouts&&typeof source.layouts==='object'&&!Array.isArray(source.layouts)){
    for(const [sceneId,rawLayout] of Object.entries(source.layouts).slice(0,80)){
      if(!sceneId||!rawLayout||typeof rawLayout!=='object'||Array.isArray(rawLayout))continue;
      const clean={};
      for(const [id,slot] of Object.entries(rawLayout)){
        if(typeof id==='string'&&SCENE_CAST_SLOT_KEYS.has(slot)&&isSceneCastAsset(byId(id)))clean[id]=slot;
      }
      if(Object.keys(clean).length)layouts[sceneId]=clean;
    }
  }
  const sizes={};
  if(source.sizes&&typeof source.sizes==='object'&&!Array.isArray(source.sizes)){
    for(const [id,tier] of Object.entries(source.sizes).slice(0,160)){
      if(typeof id==='string'&&SCENE_CAST_SIZE_KEYS.has(tier)&&isSceneCastAsset(byId(id)))sizes[id]=tier;
    }
  }
  return {ids,active_id,layouts,sizes};
}

function sceneCastSizeTier(cast,id){
  const tier=cast?.sizes?.[id];
  return SCENE_CAST_SIZE_KEYS.has(tier)?tier:SCENE_CAST_DEFAULT_SIZE;
}

function sceneCastSizeLabel(tier){
  return tier?String(tier).charAt(0).toUpperCase()+String(tier).slice(1):'Medium';
}

function sceneCastSizeOptions(selected){
  return SCENE_CAST_SIZE_TIERS.map(tier=>
    '<option value="'+tier+'"'+(tier===selected?' selected':'')+'>'+sceneCastSizeLabel(tier)+'</option>'
  ).join('');
}

function fallbackSceneCastArtworkBounds(img){
  const width=Number(img?.naturalWidth)||1;
  const height=Number(img?.naturalHeight)||1;
  return {ratio:Math.max(.08,Math.min(5,width/height)),imageHeight:'100%',imageTop:'0%',imageLeft:'0%'};
}

function sceneCastArtworkBounds(url,img){
  const key=String(url||'');
  if(!key)return Promise.resolve(fallbackSceneCastArtworkBounds(img));
  if(sceneCastArtworkBoundsCache.has(key))return sceneCastArtworkBoundsCache.get(key);

  const promise=new Promise(resolve=>{
    const fallback=()=>{
      if(img?.complete&&img.naturalWidth){resolve(fallbackSceneCastArtworkBounds(img));return}
      let settled=false;
      const finish=()=>{
        if(settled)return;
        settled=true;
        resolve(fallbackSceneCastArtworkBounds(img));
      };
      img?.addEventListener('load',finish,{once:true});
      setTimeout(finish,1000);
    };

    const probe=new Image();
    probe.crossOrigin='anonymous';
    probe.decoding='async';
    probe.onload=()=>{
      const naturalWidth=Number(probe.naturalWidth)||1;
      const naturalHeight=Number(probe.naturalHeight)||1;
      const maxSide=256;
      const scale=Math.min(1,maxSide/Math.max(naturalWidth,naturalHeight));
      const width=Math.max(1,Math.round(naturalWidth*scale));
      const height=Math.max(1,Math.round(naturalHeight*scale));
      const canvas=document.createElement('canvas');
      canvas.width=width;
      canvas.height=height;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      if(!ctx){resolve(fallbackSceneCastArtworkBounds(probe));return}

      try{
        ctx.clearRect(0,0,width,height);
        ctx.drawImage(probe,0,0,width,height);
        const pixels=ctx.getImageData(0,0,width,height).data;
        let minX=width,minY=height,maxX=-1,maxY=-1;
        for(let y=0;y<height;y++){
          for(let x=0;x<width;x++){
            if(pixels[(y*width+x)*4+3]<18)continue;
            if(x<minX)minX=x;
            if(x>maxX)maxX=x;
            if(y<minY)minY=y;
            if(y>maxY)maxY=y;
          }
        }

        if(maxX<minX||maxY<minY){resolve(fallbackSceneCastArtworkBounds(probe));return}

        minX=Math.max(0,minX-1);
        minY=Math.max(0,minY-1);
        maxX=Math.min(width-1,maxX+1);
        maxY=Math.min(height-1,maxY+1);
        const bx=minX/width;
        const by=minY/height;
        const bw=Math.max(1/width,(maxX-minX+1)/width);
        const bh=Math.max(1/height,(maxY-minY+1)/height);
        const rawAspect=naturalWidth/naturalHeight;
        const ratio=Math.max(.08,Math.min(5,rawAspect*bw/bh));
        resolve({
          ratio,
          imageHeight:(100/bh).toFixed(3)+'%',
          imageTop:(-by/bh*100).toFixed(3)+'%',
          imageLeft:(-bx/bw*100).toFixed(3)+'%'
        });
      }catch(_){
        fallback();
      }
    };
    probe.onerror=fallback;
    probe.src=key;
  });

  sceneCastArtworkBoundsCache.set(key,promise);
  return promise;
}

function applySceneCastArtworkBounds(img,url){
  const wrapper=img?.closest('.scene-cast-art');
  if(!wrapper)return;
  sceneCastArtworkBounds(url,img).then(bounds=>{
    if(!wrapper.isConnected)return;
    wrapper.style.aspectRatio=String(bounds.ratio||.65);
    img.style.height=bounds.imageHeight||'100%';
    img.style.top=bounds.imageTop||'0%';
    img.style.left=bounds.imageLeft||'0%';
    wrapper.dataset.artworkBounds='ready';
  }).catch(()=>{
    const bounds=fallbackSceneCastArtworkBounds(img);
    wrapper.style.aspectRatio=String(bounds.ratio);
    img.style.height='100%';
    img.style.top='0%';
    img.style.left='0%';
  });
}

function currentSceneCastLayout(cast=normalizeSceneCast()){
  const sceneId=state?.active_scene_id||'';
  return sceneId&&cast.layouts?.[sceneId]&&typeof cast.layouts[sceneId]==='object'
    ? cast.layouts[sceneId]
    : {};
}

function sceneCastSlotMeta(key){
  return SCENE_CAST_SLOTS.find(slot=>slot.key===key)||null;
}

function sceneCastSlotReserved(key){
  return (key==='far-left'&&Boolean(state?.pinned_left_id))
    ||(key==='far-right'&&Boolean(state?.pinned_right_id));
}

function castAutoXs(count){
  return ({
    1:[50],
    2:[34,66],
    3:[23,50,77],
    4:[15,38,62,85],
    5:[10,30,50,70,90],
    6:[8,25,42,58,75,92]
  })[count]||[];
}

function compactRevealAnchor(cast=normalizeSceneCast()){
  const layout=currentSceneCastLayout(cast);
  let left=state?.pinned_left_id?2:0;
  let right=state?.pinned_right_id?2:0;
  for(const id of cast.ids){
    const slot=layout[id];
    const index=SCENE_CAST_SLOTS.findIndex(item=>item.key===slot);
    if(index>=0&&index<=2)left++;
    if(index>=3)right++;
  }
  if(left+1<right)return 'left';
  if(right+1<left)return 'right';
  return 'center';
}

function sceneCastMemberElement(asset){
  const el=document.createElement('article');
  el.className='scene-cast-member is-entering'+(asset.kind==='creature'?' is-creature':'');
  el.dataset.castId=asset.id;
  const art=document.createElement('div');
  art.className='scene-cast-art';
  const img=document.createElement('img');
  img.src=asset.image_url;
  img.alt=asset.name;
  img.decoding='async';
  img.fetchPriority='high';
  img.draggable=false;
  const name=document.createElement('strong');
  name.textContent=asset.name;
  art.appendChild(img);
  el.append(art,name);
  applySceneCastArtworkBounds(img,asset.image_url);
  el.addEventListener('dragstart',event=>{
    if(!sceneCastArrangeMode||!canGMControl()||state?.mode!=='scene'){
      event.preventDefault();
      return;
    }
    sceneCastDragId=el.dataset.castId||'';
    el.classList.add('dragging');
    if(event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',sceneCastDragId);
    }
  });
  el.addEventListener('dragend',()=>{
    sceneCastDragId='';
    el.classList.remove('dragging');
    els.sceneCastSlots?.querySelectorAll('.drag-over').forEach(slot=>slot.classList.remove('drag-over'));
  });
  requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.remove('is-entering')));
  return el;
}

function renderPlayerSceneCast(){
  const host=els.sceneCast;
  if(!host)return;
  const cast=normalizeSceneCast();
  const reveal=byId(state?.active_reveal_id);
  const compactReveal=state?.mode==='reveal'&&isCompactRevealAsset(reveal);
  const visible=(state?.mode==='scene'||compactReveal)&&cast.ids.length>0;
  const layout=currentSceneCastLayout(cast);
  const positioned=cast.ids.some(id=>SCENE_CAST_SLOT_KEYS.has(layout[id]));
  const arranging=sceneCastArrangeMode&&canGMControl()&&state?.mode==='scene'&&cast.ids.length>0;

  host.classList.toggle('hidden',!visible);
  host.classList.toggle('is-reveal-muted',compactReveal&&visible);
  host.classList.toggle('is-positioned',positioned);
  host.classList.toggle('is-arranging',arranging);
  host.classList.toggle('has-pin-left',Boolean(state?.pinned_left_id));
  host.classList.toggle('has-pin-right',Boolean(state?.pinned_right_id));
  host.setAttribute('aria-hidden',visible?'false':'true');
  host.dataset.count=String(cast.ids.length);
  host.classList.toggle('has-active',Boolean(cast.active_id));

  const desired=new Set(cast.ids);
  for(const existing of [...host.querySelectorAll('.scene-cast-member')]){
    const id=existing.dataset.castId;
    if(desired.has(id)){
      const timer=sceneCastLeaveTimers.get(id);
      if(timer){clearTimeout(timer);sceneCastLeaveTimers.delete(id)}
      existing.classList.remove('is-leaving');
      continue;
    }
    if(!visible){
      const timer=sceneCastLeaveTimers.get(id);
      if(timer)clearTimeout(timer);
      sceneCastLeaveTimers.delete(id);
      existing.remove();
      continue;
    }
    if(existing.classList.contains('is-leaving'))continue;
    existing.classList.add('is-leaving');
    const timer=setTimeout(()=>{
      if(existing.isConnected)existing.remove();
      sceneCastLeaveTimers.delete(id);
    },300);
    sceneCastLeaveTimers.set(id,timer);
  }

  const autoXs=castAutoXs(cast.ids.length);
  const customXs=cast.ids
    .map(id=>sceneCastSlotMeta(layout[id])?.x)
    .filter(value=>Number.isFinite(value));
  const usedAutoXs=[];

  for(const [index,id] of cast.ids.entries()){
    const asset=byId(id);
    if(!asset)continue;
    let el=host.querySelector('.scene-cast-member[data-cast-id="'+CSS.escape(id)+'"]');
    if(!el){
      el=sceneCastMemberElement(asset);
      host.appendChild(el);
    }else{
      const img=el.querySelector('img');
      const label=el.querySelector('strong');
      if(img){
        if(img.src!==asset.image_url)img.src=asset.image_url;
        applySceneCastArtworkBounds(img,asset.image_url);
      }
      if(label)label.textContent=asset.name;
      host.appendChild(el);
    }
    el.dataset.castSize=sceneCastSizeTier(cast,id);
    el.classList.toggle('is-active',cast.active_id===id);
    el.draggable=arranging;
    el.title=arranging?'Drag to a stage position':'';

    if(positioned){
      const custom=sceneCastSlotMeta(layout[id]);
      let x=custom?.x;
      if(!Number.isFinite(x)){
        const desiredX=autoXs[index]??50;
        const candidates=[desiredX,...SCENE_CAST_SLOTS
          .map(slot=>slot.x)
          .sort((a,b)=>Math.abs(a-desiredX)-Math.abs(b-desiredX))];
        x=candidates.find(candidate=>{
          if(state?.pinned_left_id&&candidate<16)return false;
          if(state?.pinned_right_id&&candidate>84)return false;
          return [...customXs,...usedAutoXs].every(other=>Math.abs(other-candidate)>10);
        });
        if(!Number.isFinite(x))x=desiredX;
        usedAutoXs.push(x);
      }
      el.style.setProperty('--cast-x',x+'%');
      el.dataset.castSlot=custom?.key||'auto';
    }else{
      el.style.removeProperty('--cast-x');
      delete el.dataset.castSlot;
    }
  }
}

function renderSceneCastSlots(){
  const host=els.sceneCastSlots;
  if(!host)return;
  const cast=normalizeSceneCast();
  const enabled=sceneCastArrangeMode&&canGMControl()&&state?.mode==='scene'&&cast.ids.length>0;
  host.classList.toggle('hidden',!enabled);
  host.setAttribute('aria-hidden',enabled?'false':'true');
  if(!enabled){
    host.innerHTML='';
    return;
  }

  const layout=currentSceneCastLayout(cast);
  host.innerHTML=SCENE_CAST_SLOTS.map(slot=>{
    const occupiedId=cast.ids.find(id=>layout[id]===slot.key);
    const occupied=byId(occupiedId);
    const reserved=sceneCastSlotReserved(slot.key);
    return '<button type="button" class="scene-cast-slot'+(occupied?' is-occupied':'')+(reserved?' is-reserved':'')+'" data-cast-slot="'+slot.key+'"'+(reserved?' disabled':'')+'>'+
      '<span>'+esc(slot.label)+'</span>'+
      '<strong>'+(reserved?'Pinned visual':occupied?esc(occupied.name):'Drop here')+'</strong>'+
    '</button>';
  }).join('');

}

function renderSceneCastTray(){
  if(!els.sceneCastTray)return;
  const cast=normalizeSceneCast();
  const layout=currentSceneCastLayout(cast);
  const hasLayout=cast.ids.some(id=>SCENE_CAST_SLOT_KEYS.has(layout[id]));
  if(sceneCastArrangeMode&&(state?.mode!=='scene'||!cast.ids.length))sceneCastArrangeMode=false;
  if(els.sceneCastCount)els.sceneCastCount.textContent=cast.ids.length+' / 6';
  if(els.clearSceneCastBtn)els.clearSceneCastBtn.disabled=!cast.ids.length;
  if(els.arrangeSceneCastBtn){
    els.arrangeSceneCastBtn.disabled=!cast.ids.length||state?.mode!=='scene';
    els.arrangeSceneCastBtn.classList.toggle('is-active',sceneCastArrangeMode);
    els.arrangeSceneCastBtn.textContent=sceneCastArrangeMode?'Done':'Arrange';
  }
  if(els.autoSceneCastBtn){
    els.autoSceneCastBtn.disabled=!hasLayout;
    els.autoSceneCastBtn.title=hasLayout?'Return this scene to automatic cast spacing':'This scene is already using automatic spacing';
  }

  if(!cast.ids.length){
    els.sceneCastTray.innerHTML='<p class="scene-cast-empty">No characters or creatures in the scene yet. Use ADD CAST in the library.</p>';
    return;
  }

  els.sceneCastTray.innerHTML=cast.ids.map((id,index)=>{
    const member=byId(id);
    if(!member)return '';
    const active=cast.active_id===id;
    const typeLabel=member.kind==='creature'?'Creature':'NPC';
    const slotLabel=sceneCastSlotMeta(layout[id])?.label||'Auto';
    const featureLabel=member.kind==='creature'?(active?'FEATURED':'FEATURE'):(active?'SPEAKING':'SPEAK');
    const sizeTier=sceneCastSizeTier(cast,id);
    return '<article class="scene-cast-chip'+(active?' is-active':'')+'" draggable="true" data-cast-chip="'+esc(id)+'">'+
      '<img src="'+esc(member.image_url)+'" alt="">'+
      '<div class="scene-cast-chip-main"><strong>'+esc(member.name)+'</strong><small>'+(active?'Featured now':typeLabel+' '+(index+1)+' · '+slotLabel)+'</small>'+
        '<label class="scene-cast-chip-size"><span>Size</span><select data-cast-size="'+esc(id)+'" aria-label="'+esc(member.name)+' size">'+sceneCastSizeOptions(sizeTier)+'</select></label></div>'+
      '<div class="scene-cast-chip-actions">'+
        '<button type="button" class="cast-speak'+(active?' is-active':'')+'" data-cast-speak="'+esc(id)+'">'+featureLabel+'</button>'+
        '<button type="button" class="cast-remove" data-cast-remove="'+esc(id)+'" title="Remove from scene">×</button>'+
      '</div>'+
    '</article>';
  }).join('');

}

function renderSceneCast(){
  renderPlayerSceneCast();
  renderSceneCastSlots();
  renderSceneCastTray();
}

function toggleSceneCastArrangeMode(){
  if(!canGMControl())return;
  const cast=normalizeSceneCast();
  if(state?.mode!=='scene'||!cast.ids.length)return;
  sceneCastArrangeMode=!sceneCastArrangeMode;
  renderSceneCast();
}

async function setSceneCastSlot(id,slotKey){
  if(!canGMControl()||state?.mode!=='scene'||!id||!SCENE_CAST_SLOT_KEYS.has(slotKey)||sceneCastSlotReserved(slotKey))return;
  const cast=normalizeSceneCast();
  if(!cast.ids.includes(id)||!state?.active_scene_id)return;
  const sceneId=state.active_scene_id;
  const layouts={...cast.layouts};
  const layout={...(layouts[sceneId]||{})};
  for(const [otherId,otherSlot] of Object.entries(layout)){
    if(otherId!==id&&otherSlot===slotKey)delete layout[otherId];
  }
  layout[id]=slotKey;
  layouts[sceneId]=layout;
  await patchState({scene_cast:{...cast,layouts}});
}

async function resetSceneCastLayout(){
  if(!canGMControl()||!state?.active_scene_id)return;
  const cast=normalizeSceneCast();
  const layouts={...cast.layouts};
  delete layouts[state.active_scene_id];
  await patchState({scene_cast:{...cast,layouts}});
}

async function addToSceneCast(id){
  if(!canGMControl())return;
  const asset=byId(id);
  if(!isSceneCastAsset(asset))return;
  const cast=normalizeSceneCast();
  if(cast.ids.includes(id)){
    await setSceneCastSpeaker(id);
    return;
  }
  if(cast.ids.length>=6){
    alert('Scene Cast can show up to 6 NPCs at once.');
    return;
  }
  const ids=[...cast.ids,id];
  await patchState({scene_cast:{...cast,ids,active_id:cast.active_id||id}});
}

async function removeNpcFromCast(id){
  if(!canGMControl())return;
  const cast=normalizeSceneCast();
  if(!cast.ids.includes(id))return;
  const ids=cast.ids.filter(item=>item!==id);
  await patchState({scene_cast:{...cast,ids,active_id:cast.active_id===id?null:cast.active_id}});
}

async function setSceneCastSpeaker(id){
  if(!canGMControl())return;
  const cast=normalizeSceneCast();
  if(!cast.ids.includes(id))return;
  await patchState({scene_cast:{...cast,active_id:cast.active_id===id?null:id}});
}

async function setSceneCastSize(id,tier){
  if(!canGMControl()||!SCENE_CAST_SIZE_KEYS.has(tier))return;
  const cast=normalizeSceneCast();
  if(!cast.ids.includes(id))return;
  const sizes={...cast.sizes,[id]:tier};
  await patchState({scene_cast:{...cast,sizes}});
}

async function clearSceneCast(){
  if(!canGMControl())return;
  sceneCastArrangeMode=false;
  const cast=normalizeSceneCast();
  await patchState({scene_cast:{...cast,ids:[],active_id:null}});
}

async function reorderSceneCast(sourceId,targetId,after=false){
  if(!canGMControl()||!sourceId||!targetId||sourceId===targetId)return;
  const cast=normalizeSceneCast();
  const from=cast.ids.indexOf(sourceId);
  const to=cast.ids.indexOf(targetId);
  if(from<0||to<0)return;
  const ids=cast.ids.slice();
  const [moved]=ids.splice(from,1);
  const targetIndex=ids.indexOf(targetId);
  ids.splice(Math.max(0,targetIndex+(after?1:0)),0,moved);
  await patchState({scene_cast:{...cast,ids}});
}

function revealCard(asset){
  const mapAction=asset.kind==='map'
    ? '<button type="button" data-map="'+asset.id+'">WORLD MAP</button>'
    : '<button type="button" data-pin="'+asset.id+'">PIN</button>';
  const cast=normalizeSceneCast();
  const castable=isSceneCastAsset(asset);
  const inCast=castable&&cast.ids.includes(asset.id);
  const speaking=inCast&&cast.active_id===asset.id;
  const castLabel=asset.kind==='creature'
    ? (speaking?'FEATURED':inCast?'FEATURE':'ADD CAST')
    : (speaking?'SPEAKING':inCast?'SPEAK':'ADD CAST');
  const castAction=castable
    ? '<button type="button" class="cast-action'+(inCast?' is-present':'')+'" data-cast-action="'+asset.id+'">'+castLabel+'</button>'
    : '';
  const introCfg=castable?majorIntroConfig(asset):null;
  const introAction=castable
    ? (introCfg
      ? '<button type="button" class="major-intro-action" data-major-intro="'+asset.id+'">INTRO</button><button type="button" data-major-intro-edit="'+asset.id+'">EDIT INTRO</button>'
      : '<button type="button" data-major-intro-edit="'+asset.id+'">SET INTRO</button>')
    : '';
  const showLabel=asset.kind==='creature'||asset.kind==='handout'?'FULL REVEAL':'SHOW';
  const thumb=isInteractiveMap(asset)
    ? '<div class="reveal-thumb interactive-map-thumb"><span>✦</span><b>INTERACTIVE ATLAS</b></div>'
    : '<div class="reveal-thumb"><img src="'+esc(assetThumbnailUrl(asset))+'" alt="" loading="lazy" decoding="async" fetchpriority="low"></div>';
  return '<article class="reveal-card" draggable="true" data-asset-id="'+asset.id+'" data-kind="'+esc(asset.kind)+'">'+thumb+
    '<strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||asset.kind.replace('_',' '))+'</small>'+
    '<div class="card-actions"><button type="button" data-show="'+asset.id+'">'+showLabel+'</button>'+mapAction+castAction+introAction+'<button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderRevealGrid(){
  const visualAssets=assets.filter(a=>a.kind!=='scene'&&(filterKind==='all'||a.kind===filterKind));
  if(filterKind!=='all'){
    els.revealGrid.innerHTML=renderFolderedLibrary(filterKind,visualAssets,revealCard);
    return;
  }
  const kinds=LIBRARY_FOLDER_KINDS.filter(kind=>kind!=='scene'&&visualAssets.some(asset=>asset.kind===kind));
  els.revealGrid.innerHTML=kinds.length?kinds.map(kind=>
    '<div class="library-kind-group"><div class="library-kind-title">'+esc(kind.replaceAll('_',' '))+'</div>'+
    renderFolderedLibrary(kind,visualAssets.filter(asset=>asset.kind===kind),revealCard)+'</div>'
  ).join(''):'<p class="muted">No visuals in the library yet.</p>';
}

function scenePresets(){
  return derivedStateValue('scenePresets',()=>{
    const raw=state?.scene_presets;
    if(!Array.isArray(raw))return [];
    return raw
      .filter(p=>p&&typeof p==='object'&&typeof p.id==='string'&&p.snapshot&&typeof p.snapshot==='object')
      .slice(0,36);
  });
}

function normalizedCueSequence(raw=state?.cue_sequence){
  if(!Array.isArray(raw))return [];
  return raw
    .filter(item=>item&&typeof item==='object'&&typeof item.id==='string'&&typeof item.preset_id==='string')
    .map(item=>({
      id:item.id,
      preset_id:item.preset_id,
      notes:typeof item.notes==='string'?item.notes.slice(0,240):''
    }))
    .slice(0,80);
}

function cueSequence(){
  return derivedStateValue('cueSequence',()=>normalizedCueSequence(state?.cue_sequence));
}

function cueSequenceIndex(){
  const seq=cueSequence();
  const raw=Number(state?.cue_sequence_index);
  if(!Number.isInteger(raw)||raw<0)return -1;
  return Math.min(raw,Math.max(-1,seq.length-1));
}

function cuePresetById(id){
  return scenePresets().find(p=>p.id===id)||null;
}

function cueItemPreset(item){
  return item?cuePresetById(item.preset_id):null;
}

function normalizeCueEffects(raw){
  const effects=Array.isArray(raw?.effects)
    ? [...new Set(raw.effects.filter(effect=>SCENE_EFFECT_KEYS.includes(effect)))]
    : [];
  return {
    effects,
    intensity:[1,2,3,4,5].includes(Number(raw?.intensity))?Number(raw.intensity):2,
    fade_ms:[350,900,1800].includes(Number(raw?.fade_ms))?Number(raw.fade_ms):900
  };
}

function captureCurrentCueSnapshot(){
  return {
    mode:['scene','map','reveal','title','blackout'].includes(state?.mode)?state.mode:'scene',
    active_scene_id:state?.active_scene_id||null,
    active_reveal_id:state?.active_reveal_id||null,
    map_asset_id:state?.map_asset_id||null,
    pinned_left_id:state?.pinned_left_id||null,
    pinned_right_id:state?.pinned_right_id||null,
    location_title:state?.location_title||'',
    location_subtitle:state?.location_subtitle||'',
    reveal_style:state?.reveal_style||'focus',
    hud_visible:state?.hud_visible!==false,
    scene_effects:normalizeCueEffects(state?.scene_effects),
    scene_cast:normalizeSceneCast(),
    audio:cueAudioSnapshot(),
    transition:transitionState()
  };
}

function cueSnapshotSignature(snapshot){
  const s=snapshot||{};
  return JSON.stringify({
    mode:s.mode||'scene',
    active_scene_id:s.active_scene_id||null,
    active_reveal_id:s.active_reveal_id||null,
    map_asset_id:s.map_asset_id||null,
    pinned_left_id:s.pinned_left_id||null,
    pinned_right_id:s.pinned_right_id||null,
    location_title:s.location_title||'',
    location_subtitle:s.location_subtitle||'',
    reveal_style:s.reveal_style||'focus',
    hud_visible:s.hud_visible!==false,
    scene_effects:normalizeCueEffects(s.scene_effects),
    scene_cast:normalizeSceneCast(s.scene_cast),
    audio:s.audio?normalizeCueAudio(s.audio):null,
    transition:normalizeTransition(s.transition)
  });
}

function cueModeLabel(mode){
  return ({scene:'Scene',map:'World Map',reveal:'Reveal',title:'Title',blackout:'Blackout'})[mode]||'Scene';
}

function cuePrimaryLabel(snapshot){
  const s=snapshot||{};
  if(s.mode==='scene')return byId(s.active_scene_id)?.name||s.location_title||'Scene';
  if(s.mode==='map')return byId(s.map_asset_id)?.name||'World Map';
  if(s.mode==='reveal')return byId(s.active_reveal_id)?.name||'Reveal';
  if(s.mode==='blackout')return 'Blackout';
  return 'Aestra Title';
}

function cueSummary(snapshot){
  const s=snapshot||{};
  const fx=normalizeCueEffects(s.scene_effects);
  const pieces=[cuePrimaryLabel(s)];
  if(s.mode==='scene')pieces.push(fx.effects.length?fx.effects.map(x=>x==='cold'?'Cold':x[0].toUpperCase()+x.slice(1)).join(' + '):'No atmosphere');
  pieces.push(s.hud_visible===false?'HUD off':'HUD on');
  const pinCount=[s.pinned_left_id,s.pinned_right_id].filter(Boolean).length;
  if(pinCount)pieces.push(pinCount+' pinned');
  const castCount=normalizeSceneCast(s.scene_cast).ids.length;
  if(castCount)pieces.push(castCount+' NPC'+(castCount===1?'':'s'));
  const cueAudio=normalizeCueAudio(s.audio);
  if(cueAudio){
    const music=audioById(cueAudio.music_id)?.name;
    const ambience=audioById(cueAudio.ambience_id)?.name;
    if(music)pieces.push('♫ '+music);
    if(ambience)pieces.push('≋ '+ambience);
    if(!music&&!ambience)pieces.push('Audio off');
  }
  pieces.push(transitionLabel(normalizeTransition(s.transition).style));
  return pieces.join(' · ');
}

function defaultCueName(){
  const snapshot=captureCurrentCueSnapshot();
  const primary=cuePrimaryLabel(snapshot);
  if(snapshot.mode==='blackout')return 'Blackout';
  if(snapshot.mode==='title')return 'Aestra Title';
  return primary||cueModeLabel(snapshot.mode)+' Cue';
}

function renderCuePresets(){
  if(!els.cuePresetList)return;
  const presets=scenePresets();
  if(els.cuePresetCount)els.cuePresetCount.textContent=String(presets.length);
  const currentSig=cueSnapshotSignature(captureCurrentCueSnapshot());
  if(!presets.length){
    els.cuePresetList.innerHTML='<p class="cue-preset-empty">Save the current presentation to create your first one-click cue.</p>';
    return;
  }
  els.cuePresetList.innerHTML=presets.map(p=>{
    const snapshot=p.snapshot||{};
    const isCurrent=cueSnapshotSignature(snapshot)===currentSig;
    return '<article class="cue-preset-card'+(isCurrent?' is-current':'')+'" data-cue-id="'+esc(p.id)+'">'+
      '<div class="cue-preset-top"><strong class="cue-preset-name">'+esc(p.name||'Untitled Cue')+'</strong><span class="cue-mode-badge">'+esc(cueModeLabel(snapshot.mode))+'</span></div>'+
      '<small class="cue-preset-summary">'+esc(cueSummary(snapshot))+'</small>'+
      '<div class="cue-preset-actions">'+
        '<button type="button" class="cue-go" data-cue-go="'+esc(p.id)+'">'+(isCurrent?'LIVE':'GO')+'</button>'+
        '<button type="button" class="cue-add-run" data-cue-add-run="'+esc(p.id)+'" title="Add this cue to Tonight\'s Session">ADD</button>'+
        '<button type="button" class="cue-update" data-cue-update="'+esc(p.id)+'" title="Replace this cue with the current Live Table setup">UPDATE</button>'+
        '<button type="button" class="cue-delete" data-cue-delete="'+esc(p.id)+'" title="Delete cue">×</button>'+
      '</div>'+
    '</article>';
  }).join('');
}

async function saveCuePreset(){
  if(!canGMControl())return;
  const name=(els.cuePresetName?.value||'').trim()||defaultCueName();
  const preset={
    id:crypto.randomUUID?crypto.randomUUID():'cue-'+Date.now().toString(36),
    name:name.slice(0,60),
    created_at:new Date().toISOString(),
    snapshot:captureCurrentCueSnapshot()
  };
  const next=[preset,...scenePresets()].slice(0,36);
  await patchState({scene_presets:next});
  if(els.cuePresetName)els.cuePresetName.value='';
}

async function updateCuePreset(id){
  if(!canGMControl())return;
  const presets=scenePresets();
  const existing=presets.find(p=>p.id===id);
  if(!existing)return;
  const next=presets.map(p=>p.id===id
    ? {...p,updated_at:new Date().toISOString(),snapshot:captureCurrentCueSnapshot()}
    : p);
  await patchState({scene_presets:next});
}

async function deleteCuePreset(id){
  if(!canGMControl())return;
  const preset=cuePresetById(id);
  if(!preset)return;
  if(!confirm('Delete cue "'+(preset.name||'Untitled Cue')+'"?'))return;
  const seq=cueSequence();
  const currentIndex=cueSequenceIndex();
  const currentItemId=currentIndex>=0?seq[currentIndex]?.id:null;
  const nextSeq=seq.filter(item=>item.preset_id!==id);
  const nextIndex=currentItemId?nextSeq.findIndex(item=>item.id===currentItemId):-1;
  await patchState({
    scene_presets:scenePresets().filter(p=>p.id!==id),
    cue_sequence:nextSeq,
    cue_sequence_index:nextIndex
  });
}

function buildCuePatch(snapshot){
  const s=snapshot||{};
  const assetId=idValue=>idValue&&byId(idValue)?idValue:null;
  const sceneId=assetId(s.active_scene_id);
  const revealId=assetId(s.active_reveal_id);
  const mapId=assetId(s.map_asset_id);
  let mode=['scene','map','reveal','title','blackout'].includes(s.mode)?s.mode:'scene';
  if(mode==='map'&&!mapId)mode=sceneId?'scene':'title';
  if(mode==='reveal'&&!revealId)mode=sceneId?'scene':'title';
  if(mode==='scene'&&s.active_scene_id&&!sceneId)mode='title';
  const patch={
    mode,
    active_scene_id:sceneId,
    active_reveal_id:revealId,
    map_asset_id:mapId,
    pinned_left_id:assetId(s.pinned_left_id),
    pinned_right_id:assetId(s.pinned_right_id),
    location_title:String(s.location_title||'').slice(0,120),
    location_subtitle:String(s.location_subtitle||'').slice(0,180),
    reveal_style:typeof s.reveal_style==='string'?s.reveal_style:'focus',
    hud_visible:s.hud_visible!==false,
    scene_effects:normalizeCueEffects(s.scene_effects),
    scene_cast:normalizeSceneCast(s.scene_cast)
  };
  patch.transition_state={...normalizeTransition(s.transition),nonce:nextTransitionNonce()};
  const cueAudio=normalizeCueAudio(s.audio);
  if(cueAudio){
    const current=normalizeAudioState(state?.audio_state);
    patch.audio_state={
      ...current,
      ...cueAudio,
      music_id:cueAudio.music_id&&audioById(cueAudio.music_id)?cueAudio.music_id:null,
      ambience_id:cueAudio.ambience_id&&audioById(cueAudio.ambience_id)?cueAudio.ambience_id:null,
      emergency:false
    };
  }
  return patch;
}

function preloadCueSnapshot(snapshot){
  const s=snapshot||{};
  const ids=[s.active_scene_id,s.active_reveal_id,s.pinned_left_id,s.pinned_right_id,...normalizeSceneCast(s.scene_cast).ids];
  for(const id of ids){
    const asset=byId(id);
    const url=asset?.image_url||'';
    if(!url||cuePreloadedUrls.has(url)||isInteractiveMap(asset))continue;
    cuePreloadedUrls.add(url);
    const img=new Image();
    img.decoding='async';
    img.src=url;
  }
  const cueAudio=normalizeCueAudio(s.audio);
  for(const audioId of [cueAudio?.music_id,cueAudio?.ambience_id]){
    const track=audioById(audioId);
    if(!track?.url||cuePreloadedAudioUrls.has(track.url))continue;
    cuePreloadedAudioUrls.add(track.url);
    const audio=new Audio();
    audio.preload='auto';
    audio.src=track.url;
    cueAudioPreloaders.set(track.url,audio);
    try{audio.load()}catch(_){}
  }
}

function preloadNextCueArtwork(){
  const seq=cueSequence();
  const index=cueSequenceIndex();
  const nextIndex=index<0?0:index+1;
  const preset=cueItemPreset(seq[nextIndex]);
  if(preset)preloadCueSnapshot(preset.snapshot);
}

async function applyCuePreset(id){
  if(!canGMControl())return;
  const preset=cuePresetById(id);
  if(!preset)return;
  preloadCueSnapshot(preset.snapshot);
  await patchState(buildCuePatch(preset.snapshot));
}

function audioTrackOptions(selectedId){
  const library=audioLibrary();
  const options=['<option value="">— None —</option>'];
  for(const track of library){
    options.push('<option value="'+esc(track.id)+'"'+(track.id===selectedId?' selected':'')+'>'+esc(track.name)+'</option>');
  }
  return options.join('');
}

function renderAudioControls(){
  if(!els.cueAudioPanel||!state)return;
  const cfg=normalizeAudioState(state.audio_state);
  const library=audioLibrary();

  if(els.musicTrackSelect)els.musicTrackSelect.innerHTML=audioTrackOptions(cfg.music_id);
  if(els.ambienceTrackSelect)els.ambienceTrackSelect.innerHTML=audioTrackOptions(cfg.ambience_id);
  if(els.musicVolume)els.musicVolume.value=String(Math.round(cfg.music_volume*100));
  if(els.ambienceVolume)els.ambienceVolume.value=String(Math.round(cfg.ambience_volume*100));
  if(els.audioMasterVolume)els.audioMasterVolume.value=String(Math.round(cfg.master_volume*100));
  if(els.audioFadeMs)els.audioFadeMs.value=String(cfg.fade_ms);
  if(els.audioMuteBtn)els.audioMuteBtn.textContent=cfg.muted?'Resume':'Mute';
  if(els.audioEmergencyBtn){
    els.audioEmergencyBtn.textContent=cfg.muted?'Audio Faded':'Fade Out';
    els.audioEmergencyBtn.disabled=cfg.muted;
  }

  const musicName=audioById(cfg.music_id)?.name||'None';
  const ambienceName=audioById(cfg.ambience_id)?.name||'None';
  if(els.audioStatus){
    els.audioStatus.textContent=(cfg.muted?'MUTED • ':'')+
      'Music: '+musicName+' • Ambience: '+ambienceName+' • '+(cfg.fade_ms/1000).toFixed(1)+'s crossfade';
  }

  if(!els.audioLibraryList)return;
  if(!library.length){
    els.audioLibraryList.innerHTML='<p class="audio-library-empty">Upload MP3, M4A, OGG or WAV tracks here. The same track can be used as Music or Ambience.</p>';
    return;
  }

  els.audioLibraryList.innerHTML=library.map(track=>
    '<article class="audio-library-item" data-audio-id="'+esc(track.id)+'">'+
      '<div class="audio-library-meta">'+
        '<input class="audio-library-name" data-audio-rename="'+esc(track.id)+'" maxlength="80" value="'+esc(track.name)+'" />'+
        '<small>'+esc((track.mime||'audio').replace('audio/','').toUpperCase())+'</small>'+
      '</div>'+
      '<div class="audio-library-actions">'+
        '<button type="button" data-audio-preview="'+esc(track.id)+'">TEST</button>'+
        '<button type="button" class="audio-delete" data-audio-delete="'+esc(track.id)+'">×</button>'+
      '</div>'+
    '</article>'
  ).join('');

}

async function setAudioStatePatch(patch){
  if(!canGMControl())return null;
  const current=normalizeAudioState(state?.audio_state);
  return patchState({audio_state:{...current,...patch,emergency:patch.emergency===true}});
}

async function setCueAudioChannel(channel,id){
  const key=channel==='ambience'?'ambience_id':'music_id';
  const value=id&&audioById(id)?id:null;
  await setAudioStatePatch({[key]:value,emergency:false});
}

async function setCueAudioVolume(channel,value){
  const key=channel==='ambience'?'ambience_volume':'music_volume';
  await setAudioStatePatch({[key]:clamp01(Number(value)/100),emergency:false});
}

async function setAudioMasterVolume(value){
  await setAudioStatePatch({master_volume:clamp01(Number(value)/100),emergency:false});
}

async function setAudioCrossfade(value){
  const fade=[800,1800,3000,5000].includes(Number(value))?Number(value):1800;
  await setAudioStatePatch({fade_ms:fade,emergency:false});
}

async function toggleAudioMute(){
  const cfg=normalizeAudioState(state?.audio_state);
  await setAudioStatePatch({muted:!cfg.muted,emergency:false});
}

async function emergencyAudioFade(){
  const cfg=normalizeAudioState(state?.audio_state);
  if(cfg.muted)return;
  await setAudioStatePatch({muted:true,emergency:true});
}

function audioMimeForFile(file){
  if(file?.type&&['audio/mpeg','audio/mp4','audio/ogg','audio/wav','audio/x-wav'].includes(file.type))return file.type;
  const ext=(file?.name?.split('.').pop()||'').toLowerCase();
  return ({mp3:'audio/mpeg',m4a:'audio/mp4',mp4:'audio/mp4',ogg:'audio/ogg',wav:'audio/wav'})[ext]||'audio/mpeg';
}

function audioNameFromFile(file){
  return String(file?.name||'Untitled Track')
    .replace(/\.[^.]+$/,'')
    .replace(/[_-]+/g,' ')
    .replace(/\s+/g,' ')
    .trim()
    .slice(0,80)||'Untitled Track';
}

async function uploadAudioTrack(){
  if(!canGMControl())return;
  const file=els.audioTrackFile?.files?.[0];
  if(els.audioTrackFile)els.audioTrackFile.value='';
  if(!file)return;
  if(file.size>20*1024*1024){
    alert('Audio tracks must be 20 MB or smaller.');
    return;
  }

  if(els.audioStatus)els.audioStatus.textContent='Uploading audio track…';
  if(els.addAudioTrackBtn)els.addAudioTrackBtn.disabled=true;
  const id=crypto.randomUUID?crypto.randomUUID():'audio-'+Date.now().toString(36);
  const ext=(file.name.split('.').pop()||'mp3').toLowerCase().replace(/[^a-z0-9]/g,'')||'mp3';
  const storagePath=CAMPAIGN_ID+'/live-table/'+id+'.'+ext;

  try{
    const mime=audioMimeForFile(file);
    const up=await supabase.storage.from('campaign-audio').upload(storagePath,file,{
      cacheControl:'3600',
      upsert:false,
      contentType:mime
    });
    if(up.error)throw up.error;

    const url=supabase.storage.from('campaign-audio').getPublicUrl(storagePath).data.publicUrl;
    const track={
      id,
      name:audioNameFromFile(file),
      url,
      storage_path:storagePath,
      mime,
      created_at:new Date().toISOString()
    };
    const saved=await patchState({audio_library:[track,...audioLibrary()].slice(0,60)});
    if(!saved){
      await supabase.storage.from('campaign-audio').remove([storagePath]);
      return;
    }
    if(els.audioStatus)els.audioStatus.textContent='Track uploaded. Choose it for Music or Ambience.';
  }catch(err){
    console.error('Live Table audio upload failed',err);
    alert(err?.message||'Could not upload the audio track.');
  }finally{
    if(els.addAudioTrackBtn)els.addAudioTrackBtn.disabled=false;
  }
}

async function renameAudioTrack(id,value){
  if(!canGMControl())return;
  const name=String(value||'').trim().slice(0,80);
  if(!name){renderAudioControls();return}
  const next=audioLibrary().map(track=>track.id===id?{...track,name}:track);
  await patchState({audio_library:next});
}

function previewAudioTrack(id){
  if(!canGMControl())return;
  const track=audioById(id);
  if(!track)return;
  if(gmAudioPreview){
    const same=gmAudioPreview.dataset?.trackId===id&&!gmAudioPreview.paused;
    gmAudioPreview.pause();
    gmAudioPreview.remove();
    gmAudioPreview=null;
    if(same)return;
  }
  const audio=new Audio(track.url);
  audio.dataset.trackId=id;
  audio.loop=true;
  audio.volume=.3;
  audio.preload='auto';
  document.body.appendChild(audio);
  gmAudioPreview=audio;
  audio.play().catch(err=>console.warn('GM audio preview blocked',err));
}

async function deleteAudioTrack(id){
  if(!canGMControl())return;
  const track=audioById(id);
  if(!track)return;
  if(!confirm('Delete audio track "'+track.name+'"? Saved cues using it will be changed to no track.'))return;

  if(gmAudioPreview?.dataset?.trackId===id){
    gmAudioPreview.pause();
    gmAudioPreview.remove();
    gmAudioPreview=null;
  }

  const current=normalizeAudioState(state?.audio_state);
  const nextState={
    ...current,
    music_id:current.music_id===id?null:current.music_id,
    ambience_id:current.ambience_id===id?null:current.ambience_id,
    emergency:false
  };

  const nextPresets=scenePresets().map(preset=>{
    const cueAudio=normalizeCueAudio(preset.snapshot?.audio);
    if(!cueAudio)return preset;
    const nextAudio={
      ...cueAudio,
      music_id:cueAudio.music_id===id?null:cueAudio.music_id,
      ambience_id:cueAudio.ambience_id===id?null:cueAudio.ambience_id
    };
    return {...preset,snapshot:{...preset.snapshot,audio:nextAudio}};
  });

  const saved=await patchState({
    audio_library:audioLibrary().filter(item=>item.id!==id),
    audio_state:nextState,
    scene_presets:nextPresets
  });
  if(!saved)return;

  if(track.storage_path){
    const removed=await supabase.storage.from('campaign-audio').remove([track.storage_path]);
    if(removed.error)console.warn('Could not remove audio storage object',removed.error);
  }
}

function cueRunName(item){
  const preset=cueItemPreset(item);
  return preset?.name||'Missing Cue';
}

function renderCueSequence(){
  if(!els.cueSequenceList)return;
  const seq=cueSequence();
  const index=cueSequenceIndex();
  const currentItem=index>=0?seq[index]:null;
  const nextItem=seq[index<0?0:index+1]||null;
  const liveName=currentItem?cueRunName(currentItem):'Not started';
  const nextName=nextItem?cueRunName(nextItem):(seq.length?'End of session run':'No cues queued');

  if(els.cueRunLive)els.cueRunLive.textContent=liveName;
  if(els.cueRunNext)els.cueRunNext.textContent=nextName;
  if(els.cueQuickLive)els.cueQuickLive.textContent=liveName;
  if(els.cueQuickNext)els.cueQuickNext.textContent=nextName;

  const canPrev=index>0;
  const canNext=seq.length>0&&(index<0||index<seq.length-1);
  const nextLabel=!seq.length?'NO CUES':index<0?'START SESSION ›':index<seq.length-1?'NEXT CUE ›':'END OF RUN';

  for(const button of [els.prevCueBtn,els.quickPrevCueBtn]){
    if(button)button.disabled=!canPrev;
  }
  for(const button of [els.nextCueBtn,els.quickNextCueBtn]){
    if(!button)continue;
    button.disabled=!canNext;
    button.textContent=nextLabel;
  }
  if(els.resetCueRunBtn)els.resetCueRunBtn.disabled=index<0;

  if(!seq.length){
    els.cueSequenceList.innerHTML='<p class="cue-sequence-empty">Use ADD on a cue below to build tonight\'s sequence.</p>';
    return;
  }

  els.cueSequenceList.innerHTML=seq.map((item,i)=>{
    const preset=cueItemPreset(item);
    const live=i===index;
    const next=i===(index<0?0:index+1);
    const mode=preset?.snapshot?.mode||'scene';
    return '<article class="cue-sequence-item'+(live?' is-live':'')+(next?' is-next':'')+'" draggable="true" data-sequence-id="'+esc(item.id)+'">'+
      '<div class="cue-sequence-handle" title="Drag to reorder">⋮⋮</div>'+
      '<div class="cue-sequence-main">'+
        '<div class="cue-sequence-title-row">'+
          '<span class="cue-sequence-number">'+String(i+1).padStart(2,'0')+'</span>'+
          '<strong class="cue-sequence-name">'+esc(preset?.name||'Missing Cue')+'</strong>'+
          '<span class="cue-mode-badge">'+esc(cueModeLabel(mode))+'</span>'+
          (live?'<span class="cue-sequence-state">LIVE</span>':'')+
        '</div>'+
        '<input class="cue-sequence-note" data-sequence-note="'+esc(item.id)+'" maxlength="240" value="'+esc(item.notes||'')+'" placeholder="GM note — e.g. read Iris letter after this" />'+
      '</div>'+
      '<div class="cue-sequence-actions">'+
        '<button type="button" class="cue-sequence-go" data-sequence-go="'+esc(item.id)+'">GO</button>'+
        '<button type="button" class="cue-sequence-remove" data-sequence-remove="'+esc(item.id)+'" title="Remove from session run">×</button>'+
      '</div>'+
    '</article>';
  }).join('');

  preloadNextCueArtwork();
}

async function addCueToSequence(presetId){
  if(!canGMControl()||!cuePresetById(presetId))return;
  const item={
    id:crypto.randomUUID?crypto.randomUUID():'run-'+Date.now().toString(36),
    preset_id:presetId,
    notes:''
  };
  await patchState({cue_sequence:[...cueSequence(),item].slice(0,80)});
}

async function removeCueFromSequence(itemId){
  if(!canGMControl())return;
  const seq=cueSequence();
  const removeIndex=seq.findIndex(item=>item.id===itemId);
  if(removeIndex<0)return;
  const currentIndex=cueSequenceIndex();
  const currentItemId=currentIndex>=0?seq[currentIndex]?.id:null;
  const nextSeq=seq.filter(item=>item.id!==itemId);
  let nextIndex=-1;
  if(currentItemId&&currentItemId!==itemId)nextIndex=nextSeq.findIndex(item=>item.id===currentItemId);
  await patchState({cue_sequence:nextSeq,cue_sequence_index:nextIndex});
}

async function saveCueSequenceNote(itemId,value){
  if(!canGMControl())return;
  const next=cueSequence().map(item=>item.id===itemId?{...item,notes:String(value||'').slice(0,240)}:item);
  await patchState({cue_sequence:next});
}

async function reorderCueSequence(sourceId,targetId,after=false){
  if(!canGMControl()||!sourceId||!targetId||sourceId===targetId)return;
  const seq=cueSequence();
  const from=seq.findIndex(item=>item.id===sourceId);
  const to=seq.findIndex(item=>item.id===targetId);
  if(from<0||to<0)return;
  const currentIndex=cueSequenceIndex();
  const currentItemId=currentIndex>=0?seq[currentIndex]?.id:null;
  const next=seq.slice();
  const [moved]=next.splice(from,1);
  const targetIndex=next.findIndex(item=>item.id===targetId);
  const insertAt=Math.max(0,targetIndex+(after?1:0));
  next.splice(insertAt,0,moved);
  const nextIndex=currentItemId?next.findIndex(item=>item.id===currentItemId):-1;
  await patchState({cue_sequence:next,cue_sequence_index:nextIndex});
}

async function runCueSequenceAt(index){
  if(!canGMControl())return;
  const seq=cueSequence();
  if(index<0||index>=seq.length)return;
  const preset=cueItemPreset(seq[index]);
  if(!preset){
    alert('That cue no longer exists in the Cue Library.');
    return;
  }
  preloadCueSnapshot(preset.snapshot);
  await patchState({...buildCuePatch(preset.snapshot),cue_sequence_index:index});
}

async function runCueSequenceItem(itemId){
  if(!canGMControl())return;
  await loadState();
  const index=cueSequence().findIndex(item=>item.id===itemId);
  if(index>=0)await runCueSequenceAt(index);
}

async function nextCueInSequence(){
  if(!canGMControl())return;
  await loadState();
  const seq=cueSequence();
  if(!seq.length)return;
  const current=cueSequenceIndex();
  const next=current<0?0:current+1;
  if(next<seq.length)await runCueSequenceAt(next);
}

async function previousCueInSequence(){
  if(!canGMControl())return;
  await loadState();
  const current=cueSequenceIndex();
  if(current>0)await runCueSequenceAt(current-1);
}

async function resetCueRun(){
  if(!canGMControl()||cueSequenceIndex()<0)return;
  await patchState({cue_sequence_index:-1});
}

function renderRecent(){
  const found=recent.map(byId).filter(Boolean).slice(0,8);
  els.recentList.innerHTML=found.length?found.map(a=>'<button class="recent-chip" type="button" data-recent="'+a.id+'">'+esc(a.name)+'</button>').join(''):'<p class="muted">Things you show will appear here.</p>';
}


let sceneInspectorSceneId=null;

const SCENE_EFFECT_LABELS={
  rain:'Rain',storm:'Storm',mist:'Mist',wind:'Wind',snow:'Snow',ash:'Ashfall',
  heat:'Heat',magic:'Magic',cold:'Cold Grade',spores:'Spores',crystal:'Crystal Resonance',
  rays:'God Rays',dream:'Dream Distortion',relic:'Relic Instability',clouds:'Cloud Shadows',
  petals:'Leaves / Petals',fireflies:'Fireflies',underwater:'Underwater',moon:'Moonlight Pulse',
  blackpetals:'Black Petals',rainglass:'Rain on Glass'
};

function sceneInspectorAsset(){
  return sceneInspectorSceneId?byId(sceneInspectorSceneId):null;
}

function openSceneInspector(id){
  const asset=byId(id);
  if(!asset||asset.kind!=='scene'||!els.sceneInspector)return;
  sceneInspectorSceneId=id;
  els.sceneInspector.classList.remove('hidden');
  els.sceneInspector.setAttribute('aria-hidden','false');
  document.body.classList.add('scene-inspector-open');
  renderSceneInspector();
  requestAnimationFrame(()=>els.sceneInspectorClose?.focus());
}

function closeSceneInspector(){
  sceneInspectorSceneId=null;
  if(!els.sceneInspector)return;
  els.sceneInspector.classList.add('hidden');
  els.sceneInspector.setAttribute('aria-hidden','true');
  document.body.classList.remove('scene-inspector-open');
}

function sceneInspectorIsCurrent(asset=sceneInspectorAsset()){
  return Boolean(asset&&state?.active_scene_id===asset.id);
}

function sceneInspectorLiveEditable(asset=sceneInspectorAsset()){
  return Boolean(sceneInspectorIsCurrent(asset)&&state?.mode==='scene'&&canGMControl());
}

function sceneInspectorEffectButtons(cfg,enabled){
  return SCENE_EFFECT_KEYS.map(effect=>{
    const active=cfg.effects.includes(effect);
    return '<button type="button" data-inspector-fx="'+esc(effect)+'" class="'+(active?'active':'')+'"'+(enabled?'':' disabled')+'>'+esc(SCENE_EFFECT_LABELS[effect]||effect)+'</button>';
  }).join('');
}

function sceneInspectorCastMarkup(enabled){
  const cast=normalizeSceneCast();
  if(!enabled)return '<p class="scene-inspector-empty">Put this scene live to view and manage its current cast.</p>';
  if(!cast.ids.length)return '<p class="scene-inspector-empty">No NPCs or creatures are currently in the scene.</p>';
  return cast.ids.map(id=>{
    const member=byId(id);
    if(!member)return '';
    const active=cast.active_id===id;
    const sizeTier=sceneCastSizeTier(cast,id);
    return '<article class="scene-inspector-cast-chip'+(active?' active':'')+'">'+
      '<img src="'+esc(member.image_url)+'" alt="">'+
      '<div><strong>'+esc(member.name)+'</strong><small>'+(active?'Featured now':esc(member.kind==='creature'?'Creature':'NPC'))+' · '+sceneCastSizeLabel(sizeTier)+'</small></div>'+
      '<button type="button" data-inspector-cast-remove="'+esc(id)+'" title="Remove from scene">×</button>'+
      '<div class="scene-inspector-cast-size" role="group" aria-label="'+esc(member.name)+' size">'+
        SCENE_CAST_SIZE_TIERS.map(tier=>'<button type="button" data-inspector-cast-size="'+esc(id)+'" data-size-tier="'+tier+'" class="'+(tier===sizeTier?'active':'')+'">'+sceneCastSizeLabel(tier)+'</button>').join('')+
      '</div>'+
    '</article>';
  }).join('');
}

function sceneInspectorPinsMarkup(enabled){
  if(!enabled)return '<p class="scene-inspector-empty">Put this scene live to inspect its reveals and pinned visuals.</p>';
  const items=[];
  const left=byId(state?.pinned_left_id);
  const right=byId(state?.pinned_right_id);
  const reveal=byId(state?.active_reveal_id);
  if(left)items.push('<span><b>Left Pin</b>'+esc(left.name)+'</span>');
  if(right)items.push('<span><b>Right Pin</b>'+esc(right.name)+'</span>');
  if(reveal)items.push('<span><b>Reveal</b>'+esc(reveal.name)+'</span>');
  return items.length?items.join(''):'<p class="scene-inspector-empty">Nothing is currently pinned or revealed.</p>';
}

function renderSceneInspector(){
  if(!els.sceneInspector||els.sceneInspector.classList.contains('hidden'))return;
  const asset=sceneInspectorAsset();
  if(!asset){closeSceneInspector();return}

  const current=sceneInspectorIsCurrent(asset);
  const sceneMode=current&&state?.mode==='scene';
  const liveControl=current&&canGMControl();
  const atmosphereEditable=sceneMode&&canGMControl();
  const cfg=sceneEffectState();
  const audio=normalizeAudioState(state?.audio_state);
  const transition=transitionState();
  const cueCount=scenePresets().filter(p=>p.snapshot?.active_scene_id===asset.id).length;
  const cast=normalizeSceneCast();
  const audioCount=[audio.music_id,audio.ambience_id].filter(Boolean).length;
  const revealCount=current
    ? [state?.pinned_left_id,state?.pinned_right_id,state?.active_reveal_id].filter(Boolean).length
    : 0;

  const setStatus=(element,text,tone='off')=>{
    if(!element)return;
    element.textContent=text;
    element.dataset.tone=tone;
  };

  const liveTone=current?'on':'locked';
  const fxText=!current?'LOCKED':cfg.effects.length
    ? cfg.effects.length+' '+(sceneMode?'ACTIVE':'READY')
    : 'OFF';
  const castText=!current?'LOCKED':cast.ids.length?cast.ids.length+' ON STAGE':'EMPTY';
  const audioText=!current?'LOCKED':audio.muted?'MUTED':audioCount?audioCount+' PLAYING':'OFF';
  const revealText=!current?'LOCKED':revealCount?revealCount+' VISIBLE':'CLEAR';
  const cueText=cueCount?cueCount+' SAVED':'0 SAVED';

  setStatus(els.sceneInspectorSummaryFx,fxText,!current?'locked':cfg.effects.length?'on':'off');
  setStatus(els.sceneInspectorSummaryCast,castText,!current?'locked':cast.ids.length?'on':'off');
  setStatus(els.sceneInspectorSummaryAudio,audioText,!current?'locked':audio.muted?'warn':audioCount?'on':'off');
  setStatus(els.sceneInspectorSummaryReveals,revealText,!current?'locked':revealCount?'on':'off');
  setStatus(els.sceneInspectorSummaryCues,cueText,cueCount?'ready':'off');

  setStatus(els.sceneInspectorFxState,fxText,!current?'locked':cfg.effects.length?'on':'off');
  setStatus(els.sceneInspectorCastState,castText,!current?'locked':cast.ids.length?'on':'off');
  setStatus(els.sceneInspectorAudioState,audioText,!current?'locked':audio.muted?'warn':audioCount?'on':'off');
  setStatus(els.sceneInspectorTransitionState,!current?'LOCKED':transitionLabel(transition.style).toUpperCase(),liveTone);
  setStatus(els.sceneInspectorRevealState,revealText,!current?'locked':revealCount?'on':'off');
  setStatus(els.sceneInspectorCueState,cueText,cueCount?'ready':'off');

  if(els.sceneInspectorTitle)els.sceneInspectorTitle.textContent=asset.name||'Scene';
  if(els.sceneInspectorImage){
    els.sceneInspectorImage.src=asset.image_url||'';
    els.sceneInspectorImage.alt=asset.name||'Scene backdrop';
  }
  if(els.sceneInspectorLiveBadge){
    els.sceneInspectorLiveBadge.textContent=current?(sceneMode?'LIVE SCENE':'CURRENT SCENE · '+String(state?.mode||'scene').toUpperCase()):'NOT LIVE';
    els.sceneInspectorLiveBadge.classList.toggle('live',current);
  }
  if(els.sceneInspectorName&&document.activeElement!==els.sceneInspectorName)els.sceneInspectorName.value=asset.name||'';
  if(els.sceneInspectorSubtitle&&document.activeElement!==els.sceneInspectorSubtitle)els.sceneInspectorSubtitle.value=asset.subtitle||'';

  if(els.sceneInspectorGo){
    els.sceneInspectorGo.disabled=sceneMode;
    els.sceneInspectorGo.textContent=sceneMode?'LIVE NOW':current?'RETURN TO SCENE':'GO LIVE';
  }
  if(els.sceneInspectorRemove)els.sceneInspectorRemove.disabled=!current;
  if(els.sceneInspectorNotice){
    els.sceneInspectorNotice.textContent=!current
      ? 'Live controls are locked so inspecting this scene cannot accidentally change the scene your players are currently seeing.'
      : !sceneMode
        ? 'This is the current scene, but another display layer is active. Return to Scene to edit atmosphere.'
        : 'Editing the controls below updates the live scene immediately.';
    els.sceneInspectorNotice.classList.toggle('live',sceneMode);
  }

  if(els.sceneInspectorFxGrid){
    els.sceneInspectorFxGrid.innerHTML=sceneInspectorEffectButtons(cfg,atmosphereEditable);
  }
  if(els.sceneInspectorFxIntensity){
    els.sceneInspectorFxIntensity.value=String(cfg.intensity);
    els.sceneInspectorFxIntensity.disabled=!atmosphereEditable;
  }
  if(els.sceneInspectorFxFade){
    els.sceneInspectorFxFade.value=String(cfg.fade_ms);
    els.sceneInspectorFxFade.disabled=!atmosphereEditable;
  }
  if(els.sceneInspectorClearFx)els.sceneInspectorClearFx.disabled=!atmosphereEditable||!cfg.effects.length;

  if(els.sceneInspectorCastList){
    els.sceneInspectorCastList.innerHTML=sceneInspectorCastMarkup(liveControl);
    els.sceneInspectorCastList.querySelectorAll('[data-inspector-cast-remove]').forEach(button=>button.addEventListener('click',()=>removeNpcFromCast(button.dataset.inspectorCastRemove)));
    els.sceneInspectorCastList.querySelectorAll('[data-inspector-cast-size]').forEach(button=>button.addEventListener('click',()=>setSceneCastSize(button.dataset.inspectorCastSize,button.dataset.sizeTier)));
  }
  if(els.sceneInspectorManageCast)els.sceneInspectorManageCast.disabled=!current;

  if(els.sceneInspectorMusic){
    els.sceneInspectorMusic.innerHTML=audioTrackOptions(audio.music_id);
    els.sceneInspectorMusic.disabled=!liveControl;
  }
  if(els.sceneInspectorAmbience){
    els.sceneInspectorAmbience.innerHTML=audioTrackOptions(audio.ambience_id);
    els.sceneInspectorAmbience.disabled=!liveControl;
  }

  if(els.sceneInspectorTransitionStyle){
    els.sceneInspectorTransitionStyle.value=transition.style;
    els.sceneInspectorTransitionStyle.disabled=!liveControl;
  }
  if(els.sceneInspectorTransitionDuration){
    els.sceneInspectorTransitionDuration.value=String(transition.duration_ms);
    els.sceneInspectorTransitionDuration.disabled=!liveControl;
  }

  if(els.sceneInspectorPinned)els.sceneInspectorPinned.innerHTML=sceneInspectorPinsMarkup(liveControl);
  if(els.sceneInspectorClearPins)els.sceneInspectorClearPins.disabled=!liveControl||(!state?.pinned_left_id&&!state?.pinned_right_id);
  if(els.sceneInspectorManageReveals)els.sceneInspectorManageReveals.disabled=!current;

  if(els.sceneInspectorCueSummary){
    els.sceneInspectorCueSummary.textContent=cueCount
      ? cueCount+' saved cue'+(cueCount===1?' uses ':'s use ')+'this scene.'
      : 'No saved cues use this scene.';
  }
}

async function saveSceneInspectorDetails(){
  if(!canGMControl())return;
  const asset=sceneInspectorAsset();
  if(!asset)return;
  const name=String(els.sceneInspectorName?.value||'').trim().slice(0,80);
  const subtitle=String(els.sceneInspectorSubtitle?.value||'').trim().slice(0,120);
  if(!name){els.sceneInspectorName?.focus();return}

  if(els.sceneInspectorSaveDetails)els.sceneInspectorSaveDetails.disabled=true;
  try{
    const update={name,subtitle,updated_at:new Date().toISOString()};
    const result=await supabase.from('live_table_assets').update(update).eq('id',asset.id).select().single();
    if(result.error)throw result.error;
    assets=assets.map(item=>item.id===asset.id?result.data:item);
    if(state?.active_scene_id===asset.id){
      await patchState({location_title:name,location_subtitle:subtitle});
    }else{
      renderAll();
    }
  }catch(err){
    alert(err?.message||'Could not update the scene.');
  }finally{
    if(els.sceneInspectorSaveDetails)els.sceneInspectorSaveDetails.disabled=false;
  }
}

function wireSceneInspector(){
  els.sceneInspectorClose?.addEventListener('click',closeSceneInspector);
  els.sceneInspectorBackdrop?.addEventListener('click',closeSceneInspector);
  els.sceneInspectorGo?.addEventListener('click',async()=>{
    const asset=sceneInspectorAsset();
    if(asset)await activateScene(asset.id);
  });
  els.sceneInspectorRemove?.addEventListener('click',async()=>{
    const asset=sceneInspectorAsset();
    if(asset)await removeAssetFromDisplay(asset.id);
  });
  els.sceneInspectorDelete?.addEventListener('click',async()=>{
    const asset=sceneInspectorAsset();
    if(!asset)return;
    await deleteAsset(asset.id);
    if(!byId(asset.id))closeSceneInspector();
  });
  els.sceneInspectorSaveDetails?.addEventListener('click',saveSceneInspectorDetails);

  els.sceneInspectorFxIntensity?.addEventListener('change',()=>setSceneEffectSetting('intensity',els.sceneInspectorFxIntensity.value));
  els.sceneInspectorFxFade?.addEventListener('change',()=>setSceneEffectSetting('fade_ms',els.sceneInspectorFxFade.value));
  els.sceneInspectorClearFx?.addEventListener('click',async()=>{
    if(!sceneInspectorLiveEditable())return;
    const cfg=sceneEffectState();
    await patchState({scene_effects:{...cfg,effects:[]}});
  });

  els.sceneInspectorMusic?.addEventListener('change',()=>setCueAudioChannel('music',els.sceneInspectorMusic.value));
  els.sceneInspectorAmbience?.addEventListener('change',()=>setCueAudioChannel('ambience',els.sceneInspectorAmbience.value));
  els.sceneInspectorTransitionStyle?.addEventListener('change',()=>setTransitionSetting('style',els.sceneInspectorTransitionStyle.value));
  els.sceneInspectorTransitionDuration?.addEventListener('change',()=>setTransitionSetting('duration_ms',els.sceneInspectorTransitionDuration.value));

  els.sceneInspectorManageCast?.addEventListener('click',()=>{
    closeSceneInspector();
    setGmWorkspaceTab('reveals',{scroll:true});
  });
  els.sceneInspectorManageReveals?.addEventListener('click',()=>{
    closeSceneInspector();
    setGmWorkspaceTab('reveals',{scroll:true});
  });
  els.sceneInspectorOpenSession?.addEventListener('click',()=>{
    closeSceneInspector();
    setGmWorkspaceTab('session',{scroll:true});
  });
  els.sceneInspectorClearPins?.addEventListener('click',()=>patchState({pinned_left_id:null,pinned_right_id:null}));

  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&els.sceneInspector&&!els.sceneInspector.classList.contains('hidden')){
      event.preventDefault();
      closeSceneInspector();
    }
  });
}

const DISPLAY_STATE_KEYS=new Set([
  'mode','active_scene_id','active_reveal_id','map_asset_id','pinned_left_id','pinned_right_id',
  'hud_visible','location_title','location_subtitle','reveal_style','transition_state'
]);
const CAST_STATE_KEYS=new Set(['mode','active_scene_id','active_reveal_id','pinned_left_id','pinned_right_id','scene_cast']);
const CUE_SNAPSHOT_KEYS=new Set([
  'mode','active_scene_id','active_reveal_id','map_asset_id','pinned_left_id','pinned_right_id',
  'location_title','location_subtitle','reveal_style','hud_visible','scene_effects','scene_cast','audio_state','transition_state'
]);

function anyStateKey(keys,set){
  return keys.some(key=>set.has(key));
}

function renderStateChanges(keys=[]){
  if(!keys.length)return;
  const changed=new Set(keys);

  if(anyStateKey(keys,DISPLAY_STATE_KEYS))renderDisplay();
  if(changed.has('scene_effects'))renderSceneEffects(state?.mode||'scene');
  if(changed.has('active_scene_id'))renderScenes();
  if(anyStateKey(keys,CAST_STATE_KEYS)){
    renderSceneCast();
    if(changed.has('scene_cast')&&state?.mode==='reveal'){
      const reveal=byId(state?.active_reveal_id);
      if(isCompactRevealAsset(reveal)&&els.revealLayer){
        els.revealLayer.dataset.anchor=compactRevealAnchor(normalizeSceneCast());
      }
    }
  }
  if(changed.has('audio_state')||changed.has('audio_library')){
    renderAudioControls();
    syncLiveAudio();
  }
  if(changed.has('transition_state')||changed.has('mode'))renderTransitionControls();
  if(changed.has('transition_state'))renderMajorIntro();
  if(changed.has('cue_sequence')||changed.has('cue_sequence_index')||changed.has('scene_presets'))renderCueSequence();
  if(changed.has('scene_presets')||changed.has('audio_library')||anyStateKey(keys,CUE_SNAPSHOT_KEYS))renderCuePresets();
  if(changed.has('scene_cast'))renderRevealGrid();
  // Folder definitions live in live_table_state. Re-render both library views whenever
  // they change (including realtime updates from another GM tab/device), otherwise the
  // DOM can keep an older folder layout until an unrelated render makes folders seem
  // to randomly disappear/reappear.
  if(changed.has('asset_folders')){
    renderScenes();
    renderRevealGrid();
  }
  if(changed.has('party_sprite_settings')){renderPartySpriteEditor();renderParty();}
  if(changed.has('party_animation_state')){renderParty();renderPartyAnimationControls();}
  if(changed.has('mode'))syncBackgroundTasks();
  renderSceneInspector();
}

function renderAll(){
  renderDisplay();
  renderScenes();
  renderSceneCast();
  renderAudioControls();
  renderTransitionControls();
  renderCueSequence();
  renderCuePresets();
  renderRevealGrid();
  renderRecent();
  renderSceneInspector();
  renderMajorIntro();
  renderPartySpriteEditor();
  renderPartyAnimationControls();
  syncLiveAudio();
}

async function patchState(patch){
  if(!canGMControl())return null;
  const effective={};
  for(const [key,value] of Object.entries(patch||{})){
    if(!valueEqual(state?.[key],value))effective[key]=value;
  }
  const requestedKeys=Object.keys(effective);
  if(!requestedKeys.length)return state;

  const previous=state;
  const payload={...effective,updated_by:user.id,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from('live_table_state').update(payload).eq('campaign_id',CAMPAIGN_ID).select().single();
  if(error){alert(error.message);return null}
  if(acceptLiveState(data)){
    const keys=changedKeys(previous,state);
    renderStateChanges(keys.length?keys:requestedKeys);
  }
  return data;
}

async function activateScene(id){
  const asset=byId(id);if(!asset)return;
  await patchState({mode:'scene',active_scene_id:id,active_reveal_id:null,location_title:asset.name,location_subtitle:asset.subtitle||''});
}

async function showReveal(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  renderRecent();
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
  if(!state||!canGMControl())return;
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
  const cast=normalizeSceneCast();
  if(cast.ids.includes(id)){
    patch.scene_cast={
      ...cast,
      ids:cast.ids.filter(item=>item!==id),
      active_id:cast.active_id===id?null:cast.active_id
    };
  }
  if(Object.keys(patch).length)await patchState(patch);
}

async function deleteAsset(id){
  if(!canGMControl())return;
  const asset=byId(id);
  if(!asset)return;
  if(!confirm('Delete "'+asset.name+'" permanently? This removes it from the Live Table library and deletes its uploaded file.'))return;
  await removeAssetFromDisplay(id);
  const del=await supabase.from('live_table_assets').delete().eq('id',id);
  if(del.error){alert(del.error.message);return}
  const storagePaths=[asset.storage_path,assetMetadata(asset).thumbnail_path].filter(Boolean);
  if(storagePaths.length){
    const storageDelete=await supabase.storage.from('live-table').remove([...new Set(storagePaths)]);
    if(storageDelete.error)console.warn('Could not remove storage file',storageDelete.error);
  }
  assets=assets.filter(a=>a.id!==id);
  recent=recent.filter(x=>x!==id);
  renderAll();
}

async function setWorldMap(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  renderRecent();
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
  if(!canGMControl())return;
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
    interactiveMapCache.clear();
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

async function openMapEditor(){
  const selected=byId(state?.map_asset_id);
  const map=isInteractiveMap(selected)?selected:assets.find(isInteractiveMap);
  if(!map){els.interactiveMapFile.click();return}
  const popup=window.open('about:blank','aestra-world-map-editor');
  if(!popup){alert('Your browser blocked the map editor window. Allow pop-ups for this site and try again.');return}
  try{
    popup.document.write('<!doctype html><title>Loading Aestra Map…</title><body style="margin:0;background:#05080b;color:#d8c58b;font-family:Georgia,serif;display:grid;place-items:center;height:100vh">Loading Aestra world map…</body>');
    popup.document.close();
    const source=await fetchInteractiveMapSource(map);
    const blob=new Blob([source],{type:'text/html'});
    const url=URL.createObjectURL(blob);
    popup.location.replace(url);
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(err){
    popup.document.open();
    popup.document.write('<!doctype html><body style="margin:0;background:#05080b;color:#eee;font-family:system-ui,sans-serif;padding:40px"><h2>Could not open map editor</h2><p>'+esc(err?.message||'Unknown error')+'</p></body>');
    popup.document.close();
  }
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
  if(!canGMControl())return;
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
    let thumbMeta={};
    try{
      els.assetMessage.textContent='Creating library thumbnail…';
      thumbMeta=await uploadThumbnailBlob(file);
    }catch(err){
      console.warn('Thumbnail generation failed; original artwork will still be saved.',err);
    }
    const ins=await supabase.from('live_table_assets').insert({
      campaign_id:CAMPAIGN_ID,
      kind,
      name,
      subtitle,
      image_url:imageUrl,
      storage_path:storagePath,
      metadata:thumbMeta,
      created_by:user.id
    }).select().single();
    if(ins.error){
      await supabase.storage.from('live-table').remove([storagePath,thumbMeta.thumbnail_path].filter(Boolean));
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

function aiFunctionError(error,fallback='Generation failed.'){
  let message=error?.message||fallback;
  try{
    const context=error?.context;
    if(context&&typeof context.json==='function'){
      return context.json().then(details=>details?.error||message).catch(()=>message);
    }
  }catch(_){}
  return Promise.resolve(message);
}

function renderAiBackdropPreviews(){
  if(!els.aiPreviewGrid)return;
  const previews=aiBackdropPreviewState?.previews||[];
  if(!previews.length){
    els.aiPreviewGrid.innerHTML='';
    els.aiPreviewGrid.classList.add('hidden');
    closeAiBackdropPreview();
    return;
  }

  els.aiPreviewGrid.classList.remove('hidden');
  els.aiPreviewGrid.innerHTML=previews.map((preview,index)=>
    '<article class="ai-preview-card">'+
      '<button type="button" class="ai-preview-art" data-ai-preview-open="'+index+'" aria-label="Preview backdrop variation '+(index+1)+'">'+
        '<img src="'+esc(preview.url)+'" alt="Generated Aestra backdrop variation '+(index+1)+'" loading="lazy">'+
        '<span>VARIATION '+(index+1)+'</span>'+
      '</button>'+
      '<button type="button" class="ai-preview-open-btn" data-ai-preview-open="'+index+'">PREVIEW</button>'+
    '</article>'
  ).join('');

  els.aiPreviewGrid.querySelectorAll('[data-ai-preview-open]').forEach(button=>
    button.addEventListener('click',()=>openAiBackdropPreview(Number(button.dataset.aiPreviewOpen)))
  );
}

function openAiBackdropPreview(index=0){
  const previews=aiBackdropPreviewState?.previews||[];
  if(!previews.length||!els.aiPreviewModal)return;

  const safeIndex=Math.max(0,Math.min(previews.length-1,Number(index)||0));
  aiBackdropPreviewState.selectedIndex=safeIndex;
  const preview=previews[safeIndex];

  if(els.aiPreviewImage){
    els.aiPreviewImage.src=preview.url;
    els.aiPreviewImage.alt='Generated Aestra backdrop variation '+(safeIndex+1);
  }
  if(els.aiPreviewTitle)els.aiPreviewTitle.textContent='Variation '+(safeIndex+1);
  if(els.aiPreviewCounter)els.aiPreviewCounter.textContent=(safeIndex+1)+' / '+previews.length;
  if(els.aiPreviewPrevBtn)els.aiPreviewPrevBtn.disabled=previews.length<2;
  if(els.aiPreviewNextBtn)els.aiPreviewNextBtn.disabled=previews.length<2;

  els.aiPreviewModal.classList.remove('hidden');
  els.aiPreviewModal.setAttribute('aria-hidden','false');
  document.body.classList.add('ai-preview-open');
}

function closeAiBackdropPreview(){
  if(!els.aiPreviewModal)return;
  els.aiPreviewModal.classList.add('hidden');
  els.aiPreviewModal.setAttribute('aria-hidden','true');
  document.body.classList.remove('ai-preview-open');
}

function shiftAiBackdropPreview(direction){
  const previews=aiBackdropPreviewState?.previews||[];
  if(previews.length<2)return;
  const current=Number(aiBackdropPreviewState?.selectedIndex)||0;
  const next=(current+direction+previews.length)%previews.length;
  openAiBackdropPreview(next);
}

async function confirmAiBackdropPreview(){
  const index=Number(aiBackdropPreviewState?.selectedIndex);
  if(!Number.isInteger(index))return;
  closeAiBackdropPreview();
  await saveAiBackdropChoice(index);
}

async function generateAiBackdrop(){
  if(!canGMControl())return;
  const name=els.aiSceneName.value.trim();
  const subtitle=els.aiSceneSubtitle.value.trim();
  const prompt=els.aiPrompt.value.trim();
  const quality=els.aiQuality.value;
  const style=els.aiStyle?.value||'storybook';
  const aestraDetails=document.getElementById('aiAestraDetails')?.value||'subtle';
  const variations=Math.max(2,Math.min(4,Number(els.aiVariations?.value||4)));
  if(!name){els.aiStatus.textContent='Give the scene a name first.';els.aiSceneName.focus();return}
  if(!prompt){els.aiStatus.textContent='Describe the backdrop you want first.';els.aiPrompt.focus();return}

  const oldPreviewPaths=(aiBackdropPreviewState?.previews||[]).map(item=>item.path).filter(Boolean);
  els.generateBackdropBtn.disabled=true;
  els.aiPreviewGrid?.querySelectorAll('button').forEach(button=>button.disabled=true);
  els.aiStatus.textContent='Painting '+variations+' Aestra backdrop variations…';

  try{
    const {data,error}=await supabase.functions.invoke('generate-live-table-backdrop',{
      body:{
        action:'generate',
        campaignId:CAMPAIGN_ID,
        name,
        subtitle,
        prompt,
        quality,
        style,
        aestraDetails,
        variations,
        cleanupPaths:oldPreviewPaths
      }
    });
    if(error)throw new Error(await aiFunctionError(error));
    if(data?.error)throw new Error(data.error);
    if(!Array.isArray(data?.previews)||!data.previews.length)throw new Error('The image generator returned no previews.');

    aiBackdropPreviewState={
      name,
      subtitle,
      prompt,
      quality,
      style,
      aestraDetails,
      generationId:data.generationId||'',
      expandedPrompt:data.expandedPrompt||'',
      previews:data.previews,
      selectedIndex:0
    };
    renderAiBackdropPreviews();
    const failed=Number(data.failed||0);
    els.aiStatus.textContent=failed
      ? data.previews.length+' variation'+(data.previews.length===1?'':'s')+' ready · '+failed+' failed. Choose one to save.'
      : 'Choose your favourite. Only the backdrop you select will be kept.';
  }catch(err){
    console.error(err);
    const msg=err?.message||'Could not generate the backdrop.';
    els.aiStatus.textContent=msg.includes('CLOUDFLARE_')
      ? 'Cloudflare is wired in, but the two Cloudflare credentials still need to be added to Supabase secrets.'
      : msg;
    renderAiBackdropPreviews();
  }finally{
    els.generateBackdropBtn.disabled=false;
    els.aiPreviewGrid?.querySelectorAll('button').forEach(button=>button.disabled=false);
  }
}

async function saveAiBackdropChoice(index){
  if(!canGMControl())return;
  closeAiBackdropPreview();
  const previewState=aiBackdropPreviewState;
  const chosen=previewState?.previews?.[index];
  if(!previewState||!chosen)return;

  els.generateBackdropBtn.disabled=true;
  els.aiPreviewGrid?.querySelectorAll('button').forEach(button=>button.disabled=true);
  els.aiPreviewGrid?.querySelectorAll('.ai-preview-card').forEach((card,i)=>card.classList.toggle('is-selected',i===index));
  els.aiStatus.textContent='Saving chosen backdrop and clearing the unused variations…';

  try{
    const {data,error}=await supabase.functions.invoke('generate-live-table-backdrop',{
      body:{
        action:'save',
        campaignId:CAMPAIGN_ID,
        name:previewState.name,
        subtitle:previewState.subtitle,
        prompt:previewState.prompt,
        quality:previewState.quality,
        style:previewState.style,
        aestraDetails:previewState.aestraDetails||'subtle',
        generationId:previewState.generationId,
        selectedPath:chosen.path,
        previewPaths:previewState.previews.map(item=>item.path)
      }
    });
    if(error)throw new Error(await aiFunctionError(error,'Save failed.'));
    if(data?.error)throw new Error(data.error);
    if(!data?.asset)throw new Error('The selected backdrop could not be saved.');

    assets=[data.asset,...assets.filter(asset=>asset.id!==data.asset.id)];
    scheduleThumbnailBackfill(180);
    aiBackdropPreviewState=null;
    renderAiBackdropPreviews();
    els.aiStatus.textContent='Backdrop saved. Putting it live now…';
    await activateScene(data.asset.id);
    els.aiStatus.textContent='Backdrop saved and live.';
    els.aiSceneName.value='';
    els.aiSceneSubtitle.value='';
    els.aiPrompt.value='';
    renderAll();
  }catch(err){
    console.error(err);
    els.aiStatus.textContent=err?.message||'Could not save the chosen backdrop.';
    els.aiPreviewGrid?.querySelectorAll('.ai-preview-card').forEach(card=>card.classList.remove('is-selected'));
  }finally{
    els.generateBackdropBtn.disabled=false;
    els.aiPreviewGrid?.querySelectorAll('button').forEach(button=>button.disabled=false);
  }
}

function addAiPromptChip(value){
  const current=els.aiPrompt.value.trim();
  els.aiPrompt.value=current?current.replace(/[,. ]*$/,'')+', '+value:value;
  els.aiPrompt.focus();
}

async function pollPlayerMapState(){
  if(!IS_PLAYER_DISPLAY||state?.mode!=='map'||!supabase||document.hidden)return;
  try{
    const {data,error}=await supabase
      .from('live_table_map_state')
      .select('state,updated_at')
      .eq('campaign_id',CAMPAIGN_ID)
      .maybeSingle();
    if(error||!data?.state)return;
    if(data.updated_at===lastPlayerMapStateUpdatedAt)return;
    mapState={
      campaign_id:CAMPAIGN_ID,
      state:data.state,
      updated_at:data.updated_at
    };
    const applied=applyMapMirrorToPlayer(data.state);
    if(!applied)return;
    lastPlayerMapStateUpdatedAt=data.updated_at||'';
    if(els.mapImportStatus)els.mapImportStatus.textContent='Player Display receiving live GM map.';
  }catch(err){
    console.warn('Player map poll failed',err);
  }
}

function startPlayerMapStatePolling(){
  runtimeLifecycle.stop('player-map-fallback');
  if(!IS_PLAYER_DISPLAY||state?.mode!=='map'||document.hidden)return;
  runtimeLifecycle.interval('player-map-fallback',pollPlayerMapState,300);
}

function publishMapJourneyMotion(){
  if(!canGMControl()||state?.mode!=='map'||document.hidden)return;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return;
  try{
    const bridge=win.AestraLiveBridge;
    if(!bridge?.collectJourney||bridge.role!=='gm')return;
    const payload=bridge.collectJourney();
    if(!payload)return;
    const p=payload.party;
    const t=payload.travel;
    const signature=[
      p?Number(p.x).toFixed(2):'',
      p?Number(p.y).toFixed(2):'',
      p?.visible===false?'0':'1',
      t?.active?'1':'0',
      t?.arrived?'1':'0',
      t?.routeName||'',
      t?.destination||'',
      t?.totalDays??'',
      t?.currentDay??'',
      Number(t?.progress||0).toFixed(4)
    ].join('|');
    if(signature===lastPolledMapJourneySignature)return;
    lastPolledMapJourneySignature=signature;
    sendJourneyMotion(payload);
  }catch(_){
    // iframe may be between srcdoc reloads; next animation frame retries.
  }
}

function publishMapCameraMotion(){
  if(!canGMControl()||state?.mode!=='map'||document.hidden)return;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return;
  try{
    const bridge=win.AestraLiveBridge;
    if(!bridge?.collectView||bridge.role!=='gm')return;
    const view=bridge.collectView();
    if(!view)return;
    const signature=[
      Number(view.centerX).toFixed(3),
      Number(view.centerY).toFixed(3),
      Number(view.zoom).toFixed(5)
    ].join('|');
    if(signature===lastPolledMapCameraSignature)return;
    lastPolledMapCameraSignature=signature;
    sendMapCameraMotion(view);
  }catch(_){
    // iframe may be between srcdoc reloads; next animation frame retries.
  }
}

function publishMapMirror(){
  if(!canGMControl()||state?.mode!=='map'||document.hidden)return;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return;
  try{
    const bridge=win.AestraLiveBridge;
    if(!bridge?.collect||bridge.role!=='gm')return;
    const mirror=bridge.collect();
    if(!mirror)return;
    // Camera and journey use their own lightweight paths.
    const signature=JSON.stringify({...mirror,view:null,liveParty:null,travel:null});
    if(signature===lastPolledMapMirrorSignature)return;
    lastPolledMapMirrorSignature=signature;
    sendMapMirror(mirror);
  }catch(_){
    // iframe may be between srcdoc reloads; the next poll retries.
  }
}

function startMapMirrorPolling(){
  runtimeLifecycle.stopPrefix('gm-map-');
  if(!canGMControl()||state?.mode!=='map'||document.hidden)return;

  // One browser-synchronised loop replaces two independent 32ms timers.
  runtimeLifecycle.raf('gm-map-motion',()=>{
    publishMapJourneyMotion();
    publishMapCameraMotion();
  },{fps:30});

  // Structural map changes do not need frame-rate polling.
  runtimeLifecycle.interval('gm-map-heavy',publishMapMirror,180);
}

function syncBackgroundTasks(){
  if(document.hidden){
    runtimeLifecycle.stopPrefix('gm-map-');
    runtimeLifecycle.stop('player-map-fallback');
    return;
  }
  startMapMirrorPolling();
  startPlayerMapStatePolling();
}

function cleanupRealtimeConnections(){
  runtimeLifecycle.stopAll();
  clearTimeout(mapStateSaveTimer);
  clearTimeout(mapCameraPersistTimer);
  clearTimeout(displayTransitionTimer);
  mapStateSaveTimer=null;
  mapCameraPersistTimer=null;
  displayTransitionTimer=null;

  try{browserMapMotionChannel?.close()}catch(_){}
  browserMapMotionChannel=null;

  for(const channel of realtimeChannels){
    try{supabase?.removeChannel(channel)}catch(_){}
  }
  realtimeChannels=[];
  mapMotionChannel=null;
  mapMotionReady=false;

  if(gmAudioPreview){
    try{gmAudioPreview.pause();gmAudioPreview.remove()}catch(_){}
    gmAudioPreview=null;
  }
}

async function subscribeRealtime(){
  for(const channel of realtimeChannels){
    try{supabase?.removeChannel(channel)}catch(_){}
  }
  realtimeChannels=[];
  if('BroadcastChannel' in window){
    try{
      browserMapMotionChannel=new BroadcastChannel('aestra-map-motion-'+CAMPAIGN_ID);
      browserMapMotionChannel.addEventListener('message',event=>{
        const p=event.data||{};
        if(p.kind==='mirror'&&p.mirror)applyMapMirrorToPlayer(p.mirror);
        else if(p.kind==='camera-motion'&&p.view)applyMapCameraToPlayer(p.view);
        else if(p.kind==='journey-motion'&&p.payload)applyJourneyMotionToPlayer(p.payload);
        else if(p.kind==='party-motion')applyPartyMotionToPlayer(p.x,p.y);
        else if(Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)))applyPartyMotionToPlayer(p.x,p.y);
      });
    }catch(err){
      console.warn('Browser map mirror channel unavailable',err);
    }
  }

  await supabase.realtime.setAuth();
  mapMotionChannel=supabase.channel('aestra-map-motion:'+CAMPAIGN_ID,{config:{private:true}});
  mapMotionChannel
    .on('broadcast',{event:'camera-motion'},payload=>{
      const p=payload?.payload||{};
      if(p.view)applyMapCameraToPlayer(p.view);
    })
    .on('broadcast',{event:'journey-motion'},payload=>{
      const p=payload?.payload||{};
      applyJourneyMotionToPlayer(p);
    })
    .on('broadcast',{event:'party-motion'},payload=>{
      const p=payload?.payload||{};
      applyPartyMotionToPlayer(p.x,p.y);
    })
    .on('broadcast',{event:'map-mirror'},payload=>{
      const p=payload?.payload||{};
      if(p.mirror)applyMapMirrorToPlayer(p.mirror);
    })
    .subscribe((status,err)=>{
      mapMotionReady=status==='SUBSCRIBED';
      if(err)console.warn('Realtime map mirror channel error',err);
    });
  const stateChannel=supabase.channel('aestra-live-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{
      const previous=state;
      if(acceptLiveState(payload.new))renderStateChanges(changedKeys(previous,state));
    })
    .subscribe();
  const assetsChannel=supabase.channel('aestra-live-assets')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_assets',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{
      const oldRow=payload.old||{};
      const newRow=payload.new||{};
      const id=newRow.id||oldRow.id;
      const previous=id?byId(id):null;

      if(payload.eventType==='DELETE'){
        assets=assets.filter(asset=>asset.id!==id);
        recent=recent.filter(item=>item!==id);
        renderAll();
        return;
      }

      if(newRow?.id){
        assets=assets.some(asset=>asset.id===newRow.id)
          ? assets.map(asset=>asset.id===newRow.id?newRow:asset)
          : [newRow,...assets];
      }

      renderScenes();
      renderRevealGrid();
      renderRecent();
      renderSceneInspector();

      const visibleIds=new Set([
        state?.active_scene_id,
        state?.active_reveal_id,
        state?.map_asset_id,
        state?.pinned_left_id,
        state?.pinned_right_id,
        ...normalizeSceneCast().ids
      ].filter(Boolean));
      const presentationChanged=!previous||['name','subtitle','image_url','kind'].some(key=>!valueEqual(previous?.[key],newRow?.[key]));
      if(id&&visibleIds.has(id)&&presentationChanged){
        renderDisplay();
        renderSceneCast();
      }
    })
    .subscribe();
  const partyChannel=supabase.channel('aestra-live-party')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_party',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadParty();renderParty();renderPartySpriteEditor()})
    .subscribe();
  const mapStateChannel=supabase.channel('aestra-live-map-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_map_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{
      if(!payload.new)return;
      mapState=payload.new;
      if(shouldReceivePlayerMap())sendMapStateToFrame();
    })
    .subscribe();
  realtimeChannels=[mapMotionChannel,stateChannel,assetsChannel,partyChannel,mapStateChannel].filter(Boolean);

}


const GM_WORKSPACE_TABS=new Set(['scenes','reveals','session','audio','tools']);
let gmWorkspaceMounted=false;

function gmStoredTab(){
  try{
    const value=localStorage.getItem('aestra-live-gm-tab');
    return GM_WORKSPACE_TABS.has(value)?value:'scenes';
  }catch(_){
    return 'scenes';
  }
}

function setGmWorkspaceTab(tab,{remember=true,scroll=false}={}){
  if(!GM_WORKSPACE_TABS.has(tab))tab='scenes';

  document.querySelectorAll('[data-gm-tab]').forEach(button=>{
    const active=button.dataset.gmTab===tab;
    button.classList.toggle('active',active);
    button.setAttribute('aria-selected',active?'true':'false');
  });

  document.querySelectorAll('[data-gm-panel]').forEach(panel=>{
    const active=panel.dataset.gmPanel===tab;
    panel.classList.toggle('active',active);
    panel.hidden=!active;
  });

  if(remember){
    try{localStorage.setItem('aestra-live-gm-tab',tab)}catch(_){}
  }

  if(scroll&&els.gmWorkspaceShell){
    const top=els.gmWorkspaceShell.getBoundingClientRect().top+window.scrollY-82;
    if(window.scrollY>top+120||window.scrollY<top-420){
      window.scrollTo({top:Math.max(0,top),behavior:'smooth'});
    }
  }
}

function setGmCompactPreview(enabled,{remember=true}={}){
  const compact=enabled===true;
  document.body.classList.toggle('gm-preview-compact',compact);
  if(els.gmCompactPreviewBtn){
    els.gmCompactPreviewBtn.classList.toggle('active',compact);
    els.gmCompactPreviewBtn.setAttribute('aria-pressed',compact?'true':'false');
    const label=els.gmCompactPreviewBtn.querySelector('span:last-child');
    if(label)label.textContent=compact?'Expand Preview':'Compact Preview';
  }
  if(remember){
    try{localStorage.setItem('aestra-live-compact-preview',compact?'1':'0')}catch(_){}
  }
  requestAnimationFrame(()=>{
    getSceneAtmosphereRenderer()?.resize();
    getTransitionCanvasRenderer()?.resize?.();
  });
}

function gmModule(className,label){
  const el=document.createElement('section');
  el.className='gm-dashboard-module '+className;
  if(label)el.dataset.moduleLabel=label;
  return el;
}

function setupGmWorkspace(){
  if(gmWorkspaceMounted||!canGMControl()||!els.gmWorkspaceShell)return;

  const scenesColumn=document.querySelector('.scenes-column');
  const revealColumn=document.querySelector('.reveal-column');
  const recentColumn=document.querySelector('.recent-column');
  if(!scenesColumn||!revealColumn||!recentColumn)return;

  const scenesPanel=els.gmPanelScenes;
  const revealsPanel=els.gmPanelReveals;
  const sessionPanel=els.gmPanelSession;
  const audioPanel=els.gmPanelAudio;
  const toolsPanel=els.gmPanelTools;
  if(!scenesPanel||!revealsPanel||!sessionPanel||!audioPanel||!toolsPanel)return;

  const sceneCore=gmModule('gm-scenes-core','Scenes');
  const sceneHeader=scenesColumn.querySelector(':scope > .section-head');
  if(sceneHeader)sceneCore.append(sceneHeader);
  if(els.sceneStrip)sceneCore.append(els.sceneStrip);
  scenesPanel.append(sceneCore);

  if(els.sceneEffectsPanel)scenesPanel.append(els.sceneEffectsPanel);

  const aiBox=recentColumn.querySelector('.ai-box');
  if(aiBox){
    aiBox.classList.add('gm-ai-module');
    scenesPanel.append(aiBox);
  }

  if(els.sceneCastPanel)revealsPanel.append(els.sceneCastPanel);
  revealColumn.classList.add('gm-reveal-module');
  revealsPanel.append(revealColumn);
  setupPartySpriteEditor();

  if(els.cueSequencePanel)sessionPanel.append(els.cueSequencePanel);
  if(els.cuePresetsPanel)sessionPanel.append(els.cuePresetsPanel);

  const recentModule=gmModule('gm-recent-module','Recent');
  const recentHeader=recentColumn.querySelector(':scope > .section-head');
  if(recentHeader)recentModule.append(recentHeader);
  if(els.recentList)recentModule.append(els.recentList);
  sessionPanel.append(recentModule);

  if(els.cueAudioPanel)audioPanel.append(els.cueAudioPanel);
  if(els.cueTransitionPanel)audioPanel.append(els.cueTransitionPanel);

  const mapTools=scenesColumn.querySelector('.map-tool-stack');
  if(mapTools){
    const mapModule=gmModule('gm-map-module','Map');
    const mapHead=document.createElement('div');
    mapHead.className='section-head compact gm-generated-head';
    mapHead.innerHTML='<div><p class="eyebrow">World Map</p><h2>Map & Tools</h2></div>';
    mapModule.append(mapHead,mapTools);
    toolsPanel.append(mapModule);
  }

  els.gmControls?.classList.add('gm-controls-mounted');
  recentColumn.classList.add('gm-source-empty');
  scenesColumn.classList.add('gm-source-empty');

  const storedTab=gmStoredTab();
  setGmWorkspaceTab(storedTab,{remember:false});

  let compact=false;
  try{compact=localStorage.getItem('aestra-live-compact-preview')==='1'}catch(_){}
  setGmCompactPreview(compact,{remember:false});

  gmWorkspaceMounted=true;
}

function wireDelegatedControls(){
  wireLibraryFolders(els.sceneStrip);
  wireLibraryFolders(els.revealGrid);
  delegate(els.sceneStrip,'click','[data-scene-inspect],[data-scene-go],[data-remove],[data-delete],.scene-thumb',(event,target)=>{
    if(target.dataset.sceneInspect){openSceneInspector(target.dataset.sceneInspect);return}
    if(target.classList.contains('scene-thumb')){
      const id=target.closest('[data-scene-id]')?.dataset.sceneId;
      if(id)openSceneInspector(id);
      return;
    }
    if(target.dataset.sceneGo){activateScene(target.dataset.sceneGo);return}
    if(target.dataset.remove){removeAssetFromDisplay(target.dataset.remove);return}
    if(target.dataset.delete)deleteAsset(target.dataset.delete);
  });

  delegate(els.revealGrid,'click','[data-show],[data-pin],[data-map],[data-cast-action],[data-major-intro],[data-major-intro-edit],[data-remove],[data-delete]',(event,target)=>{
    if(target.dataset.show){showReveal(target.dataset.show);return}
    if(target.dataset.pin){pinAsset(target.dataset.pin);return}
    if(target.dataset.map){setWorldMap(target.dataset.map);return}
    if(target.dataset.castAction){addToSceneCast(target.dataset.castAction);return}
    if(target.dataset.majorIntro){triggerMajorIntro(target.dataset.majorIntro);return}
    if(target.dataset.majorIntroEdit){openMajorIntroDialog(target.dataset.majorIntroEdit);return}
    if(target.dataset.remove){removeAssetFromDisplay(target.dataset.remove);return}
    if(target.dataset.delete)deleteAsset(target.dataset.delete);
  });

  delegate(els.audioLibraryList,'click','[data-audio-preview],[data-audio-delete]',(event,target)=>{
    if(target.dataset.audioPreview){previewAudioTrack(target.dataset.audioPreview);return}
    if(target.dataset.audioDelete)deleteAudioTrack(target.dataset.audioDelete);
  });
  delegate(els.audioLibraryList,'change','[data-audio-rename]',(event,target)=>{
    renameAudioTrack(target.dataset.audioRename,target.value);
  });

  delegate(els.cuePresetList,'click','[data-cue-go],[data-cue-add-run],[data-cue-update],[data-cue-delete]',(event,target)=>{
    if(target.dataset.cueGo){applyCuePreset(target.dataset.cueGo);return}
    if(target.dataset.cueAddRun){addCueToSequence(target.dataset.cueAddRun);return}
    if(target.dataset.cueUpdate){updateCuePreset(target.dataset.cueUpdate);return}
    if(target.dataset.cueDelete)deleteCuePreset(target.dataset.cueDelete);
  });

  delegate(els.cueSequenceList,'click','[data-sequence-go],[data-sequence-remove]',(event,target)=>{
    if(target.dataset.sequenceGo){runCueSequenceItem(target.dataset.sequenceGo);return}
    if(target.dataset.sequenceRemove)removeCueFromSequence(target.dataset.sequenceRemove);
  });
  delegate(els.cueSequenceList,'change','[data-sequence-note]',(event,target)=>{
    saveCueSequenceNote(target.dataset.sequenceNote,target.value);
  });
  delegate(els.cueSequenceList,'dragstart','.cue-sequence-item',(event,item)=>{
    cueSequenceDragId=item.dataset.sequenceId||'';
    item.classList.add('dragging');
    if(event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',cueSequenceDragId);
    }
  });
  delegate(els.cueSequenceList,'dragend','.cue-sequence-item',(event,item)=>{
    cueSequenceDragId='';
    item.classList.remove('dragging');
    els.cueSequenceList?.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
  });
  delegate(els.cueSequenceList,'dragover','.cue-sequence-item',(event,item)=>{
    event.preventDefault();
    if(cueSequenceDragId&&cueSequenceDragId!==item.dataset.sequenceId)item.classList.add('drag-over');
  });
  delegate(els.cueSequenceList,'dragleave','.cue-sequence-item',(event,item)=>item.classList.remove('drag-over'));
  delegate(els.cueSequenceList,'drop','.cue-sequence-item',(event,item)=>{
    event.preventDefault();
    item.classList.remove('drag-over');
    const source=cueSequenceDragId||event.dataTransfer?.getData('text/plain')||'';
    const rect=item.getBoundingClientRect();
    reorderCueSequence(source,item.dataset.sequenceId||'',event.clientY>rect.top+rect.height/2);
  });

  delegate(els.sceneCastTray,'click','[data-cast-speak],[data-cast-remove]',(event,target)=>{
    if(target.dataset.castSpeak){setSceneCastSpeaker(target.dataset.castSpeak);return}
    if(target.dataset.castRemove)removeNpcFromCast(target.dataset.castRemove);
  });
  delegate(els.sceneCastTray,'change','[data-cast-size]',(event,target)=>{
    setSceneCastSize(target.dataset.castSize,target.value);
  });
  delegate(els.sceneCastTray,'dragstart','[data-cast-chip]',(event,chip)=>{
    sceneCastDragId=chip.dataset.castChip||'';
    chip.classList.add('dragging');
    if(event.dataTransfer){
      event.dataTransfer.effectAllowed='move';
      event.dataTransfer.setData('text/plain',sceneCastDragId);
    }
  });
  delegate(els.sceneCastTray,'dragend','[data-cast-chip]',(event,chip)=>{
    sceneCastDragId='';
    chip.classList.remove('dragging');
    els.sceneCastTray?.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
  });
  delegate(els.sceneCastTray,'dragover','[data-cast-chip]',(event,chip)=>{
    event.preventDefault();
    if(sceneCastDragId&&sceneCastDragId!==chip.dataset.castChip)chip.classList.add('drag-over');
  });
  delegate(els.sceneCastTray,'dragleave','[data-cast-chip]',(event,chip)=>chip.classList.remove('drag-over'));
  delegate(els.sceneCastTray,'drop','[data-cast-chip]',(event,chip)=>{
    event.preventDefault();
    chip.classList.remove('drag-over');
    const source=sceneCastDragId||event.dataTransfer?.getData('text/plain')||'';
    const rect=chip.getBoundingClientRect();
    reorderSceneCast(source,chip.dataset.castChip||'',event.clientY>rect.top+rect.height/2);
  });

  delegate(els.sceneCastSlots,'dragover','[data-cast-slot]',(event,slot)=>{
    if(slot.disabled)return;
    event.preventDefault();
    slot.classList.add('drag-over');
    if(event.dataTransfer)event.dataTransfer.dropEffect='move';
  });
  delegate(els.sceneCastSlots,'dragleave','[data-cast-slot]',(event,slot)=>slot.classList.remove('drag-over'));
  delegate(els.sceneCastSlots,'drop','[data-cast-slot]',(event,slot)=>{
    event.preventDefault();
    slot.classList.remove('drag-over');
    if(slot.disabled)return;
    const id=sceneCastDragId||event.dataTransfer?.getData('text/plain')||'';
    setSceneCastSlot(id,slot.dataset.castSlot||'');
  });

  delegate(els.recentList,'click','[data-recent]',(event,target)=>showReveal(target.dataset.recent));
  delegate(els.sceneInspectorFxGrid,'click','[data-inspector-fx]',(event,target)=>toggleSceneEffect(target.dataset.inspectorFx));
}

function wire(){
  window.addEventListener('message',handleMapBridgeMessage);
  document.addEventListener('visibilitychange',()=>{
    syncBackgroundTasks();
    if(!document.hidden&&state)renderSceneEffects(state.mode||'scene');
  });
  window.addEventListener('pagehide',event=>{
    runtimeLifecycle.stopAll();
    if(!event.persisted)cleanupRealtimeConnections();
  });
  window.addEventListener('pageshow',()=>syncBackgroundTasks());
  wireSceneInspector();
  wireDelegatedControls();
  els.majorIntroForm?.addEventListener('submit',event=>event.preventDefault());
  els.majorIntroCloseBtn?.addEventListener('click',closeMajorIntroDialog);
  els.majorIntroCancelBtn?.addEventListener('click',closeMajorIntroDialog);
  els.majorIntroSaveBtn?.addEventListener('click',()=>saveMajorIntroConfig(false));
  els.majorIntroSavePlayBtn?.addEventListener('click',()=>saveMajorIntroConfig(true));
  document.querySelectorAll('[data-gm-tab]').forEach(button=>button.addEventListener('click',()=>{
    setGmWorkspaceTab(button.dataset.gmTab,{scroll:true});
  }));
  els.gmCompactPreviewBtn?.addEventListener('click',()=>{
    setGmCompactPreview(!document.body.classList.contains('gm-preview-compact'));
  });
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
  els.clearSceneCastBtn?.addEventListener('click',clearSceneCast);
  els.aiPreviewCloseBtn?.addEventListener('click',closeAiBackdropPreview);
  els.aiPreviewBackBtn?.addEventListener('click',closeAiBackdropPreview);
  els.aiPreviewPrevBtn?.addEventListener('click',()=>shiftAiBackdropPreview(-1));
  els.aiPreviewNextBtn?.addEventListener('click',()=>shiftAiBackdropPreview(1));
  els.aiPreviewConfirmBtn?.addEventListener('click',confirmAiBackdropPreview);
  els.aiPreviewModal?.querySelectorAll('[data-ai-preview-close]').forEach(el=>el.addEventListener('click',closeAiBackdropPreview));
  els.arrangeSceneCastBtn?.addEventListener('click',toggleSceneCastArrangeMode);
  els.autoSceneCastBtn?.addEventListener('click',resetSceneCastLayout);
  els.hudToggle.addEventListener('change',()=>patchState({hud_visible:els.hudToggle.checked}));
  els.partyAnimationControls?.addEventListener('click',event=>{
    const button=event.target.closest('[data-party-animation]');
    if(!button)return;
    const next=button.dataset.partyAnimation;
    if(!PARTY_SPRITE_STATES.includes(next))return;
    patchState({party_animation_state:next});
  });
  document.querySelectorAll('[data-scene-fx]').forEach(button=>button.addEventListener('click',()=>toggleSceneEffect(button.dataset.sceneFx)));
  els.sceneFxIntensity?.addEventListener('change',()=>setSceneEffectSetting('intensity',els.sceneFxIntensity.value));
  els.sceneFxFade?.addEventListener('change',()=>setSceneEffectSetting('fade_ms',els.sceneFxFade.value));
  els.clearSceneFxBtn?.addEventListener('click',async()=>{
    if(!canGMControl()||state?.mode!=='scene')return;
    const cfg=sceneEffectState();
    await patchState({scene_effects:{...cfg,effects:[]}});
  });
  els.audioUnlockBtn?.addEventListener('click',()=>getLiveAudioEngine().unlock());
  els.addAudioTrackBtn?.addEventListener('click',()=>els.audioTrackFile?.click());
  els.audioTrackFile?.addEventListener('change',uploadAudioTrack);
  els.musicTrackSelect?.addEventListener('change',()=>setCueAudioChannel('music',els.musicTrackSelect.value));
  els.ambienceTrackSelect?.addEventListener('change',()=>setCueAudioChannel('ambience',els.ambienceTrackSelect.value));
  els.musicVolume?.addEventListener('change',()=>setCueAudioVolume('music',els.musicVolume.value));
  els.ambienceVolume?.addEventListener('change',()=>setCueAudioVolume('ambience',els.ambienceVolume.value));
  els.audioMasterVolume?.addEventListener('change',()=>setAudioMasterVolume(els.audioMasterVolume.value));
  els.audioFadeMs?.addEventListener('change',()=>setAudioCrossfade(els.audioFadeMs.value));
  els.audioMuteBtn?.addEventListener('click',toggleAudioMute);
  els.audioEmergencyBtn?.addEventListener('click',emergencyAudioFade);
  els.transitionStyle?.addEventListener('change',()=>setTransitionSetting('style',els.transitionStyle.value));
  els.transitionDuration?.addEventListener('change',()=>setTransitionSetting('duration_ms',els.transitionDuration.value));
  els.previewTransitionBtn?.addEventListener('click',previewTransition);
  els.saveCuePresetBtn?.addEventListener('click',saveCuePreset);
  els.nextCueBtn?.addEventListener('click',nextCueInSequence);
  els.quickNextCueBtn?.addEventListener('click',nextCueInSequence);
  els.prevCueBtn?.addEventListener('click',previousCueInSequence);
  els.quickPrevCueBtn?.addEventListener('click',previousCueInSequence);
  els.resetCueRunBtn?.addEventListener('click',resetCueRun);
  els.cuePresetName?.addEventListener('keydown',event=>{
    if(event.key!=='Enter')return;
    event.preventDefault();
    saveCuePreset();
  });
  els.modeSwitch.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    const mode=b.dataset.mode;
    if(mode==='map'&&!state?.map_asset_id){els.setMapAssetBtn.click();return}
    patchState({mode,active_reveal_id:mode==='reveal'?state?.active_reveal_id:null});
  }));
  document.addEventListener('keydown',event=>{
    if(els.aiPreviewModal?.classList.contains('hidden'))return;
    if(event.key==='Escape'){
      event.preventDefault();
      closeAiBackdropPreview();
    }else if(event.key==='ArrowLeft'){
      event.preventDefault();
      shiftAiBackdropPreview(-1);
    }else if(event.key==='ArrowRight'){
      event.preventDefault();
      shiftAiBackdropPreview(1);
    }
  });
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
  setupGmWorkspace();
  await Promise.all([loadState(),loadAssets(),loadParty(),loadMapState()]);
  renderAll();

  // Background work only runs while its display mode is actually active.
  syncBackgroundTasks();

  try{
    await subscribeRealtime();
  }catch(err){
    console.warn('Realtime unavailable; map polling remains active.',err);
  }

  scheduleThumbnailBackfill(850);
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
