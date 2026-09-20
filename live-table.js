const CONFIG=window.AESTRA_CONFIG||{};
const CAMPAIGN_ID=CONFIG.campaignId;
const DISPLAY_QUERY=new URLSearchParams(location.search).get('display')==='1';
const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
let supabase=null,user=null,isGM=false,state=null,assets=[],party=[],recent=[],filterKind='all',previewUrl='';
const IS_PLAYER_DISPLAY=DISPLAY_QUERY;
const canGMControl=()=>isGM&&!IS_PLAYER_DISPLAY;
const shouldReceivePlayerMap=()=>IS_PLAYER_DISPLAY||!isGM;
let displayInitialized=false,lastDisplaySignature='',displayTransitionTimer=null,lastDisplayMode='scene',lastRenderedSceneId='',lastRenderedTransitionNonce=0;
const interactiveMapCache=new Map();
let interactiveMapLoadToken=0;
let mapState=null,mapStateSaveTimer=null,mapBridgeReady=false;
let mapMotionChannel=null,mapMotionReady=false,lastMapMotionSentAt=0,lastMapCameraSentAt=0,lastMapJourneySentAt=0;
let browserMapMotionChannel=null;
let mapMirrorPollTimer=null,mapCameraPollTimer=null,mapJourneyPollTimer=null,lastPolledMapMirrorSignature='',lastPolledMapCameraSignature='',lastPolledMapJourneySignature='';
let mapCameraPersistTimer=null;
let playerMapStatePollTimer=null,lastPlayerMapStateUpdatedAt='';
let mapStatePersistBusy=false,mapStatePersistPending=null,lastMapStatePersistAt=0;
let cueSequenceDragId='';
let sceneCastDragId='';
const sceneCastLeaveTimers=new Map();
const cuePreloadedUrls=new Set();
const cuePreloadedAudioUrls=new Set();
const cueAudioPreloaders=new Map();
let liveAudioEngine=null;
let gmAudioPreview=null;

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId=id=>assets.find(a=>a.id===id)||null;
const pct=(a,b)=>Math.max(0,Math.min(100,b?Number(a||0)/Number(b)*100:0));
const configured=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&CAMPAIGN_ID);
const isInteractiveMap=asset=>asset?.kind==='map'&&asset?.metadata?.interactive===true;
const withMapRole=(url,role)=>url+(url.includes('?')?'&':'?')+'aestraRole='+encodeURIComponent(role);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));

function audioLibrary(){
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
}

function audioById(id){
  return id?audioLibrary().find(item=>item.id===id)||null:null;
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

async function loadState(){
  const {data,error}=await supabase.from('live_table_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  state=data;
  if(!state&&canGMControl()){
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

async function loadMapState(){
  const {data,error}=await supabase.from('live_table_map_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  mapState=data||null;
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

const TRANSITION_STYLE_KEYS=['soft-fade','dream','crystal-flash','relic-glitch','darkness','memory','impact'];
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
    impact:'Impact'
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

    if(this.hasSnapshot&&oldAlpha>0){
      const strip=7;
      ctx.save();
      ctx.globalAlpha=oldAlpha*.72;
      ctx.filter='blur('+(2+swell*5).toFixed(1)+'px) saturate(1.08)';
      for(let y=0;y<h;y+=strip){
        const shift=Math.sin(y*.035+now*.0021)*swell*9;
        const sy=Math.floor(y*this.pixelRatio);
        const sh=Math.max(1,Math.ceil(strip*this.pixelRatio));
        ctx.drawImage(this.snapshot,0,sy,this.snapshot.width,sh,shift,y,w,strip+1);
      }
      ctx.restore();
    }

    const wash=ctx.createRadialGradient(w*.5,h*.44,0,w*.5,h*.44,Math.max(w,h)*.78);
    wash.addColorStop(0,'rgba(236,249,255,'+(.22+swell*.38)+')');
    wash.addColorStop(.35,'rgba(125,190,224,'+(swell*.22)+')');
    wash.addColorStop(.72,'rgba(74,72,126,'+(swell*.27)+')');
    wash.addColorStop(1,'rgba(4,7,15,'+(swell*.66)+')');
    ctx.fillStyle=wash;
    ctx.fillRect(0,0,w,h);

    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const m of this.motes){
      const y=(m.y-(p*m.drift*2.1)+h)%h;
      const x=m.x+Math.sin(m.phase+now*.0012)*14*swell;
      const r=m.r*(1+swell*.9);
      const g=ctx.createRadialGradient(x,y,0,x,y,r*4.5);
      g.addColorStop(0,'rgba(235,252,255,'+(m.alpha*swell)+')');
      g.addColorStop(.38,'rgba(142,212,239,'+(m.alpha*swell*.55)+')');
      g.addColorStop(1,'rgba(120,145,224,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(x,y,r*4.5,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();

    const vignette=ctx.createRadialGradient(w*.5,h*.5,Math.min(w,h)*.18,w*.5,h*.5,Math.max(w,h)*.74);
    vignette.addColorStop(0,'rgba(0,0,0,0)');
    vignette.addColorStop(1,'rgba(1,4,12,'+(swell*.48)+')');
    ctx.fillStyle=vignette;
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

const SCENE_EFFECT_KEYS=['rain','storm','mist','wind','snow','ash','heat','magic','cold'];

function sceneEffectState(){
  const raw=state?.scene_effects&&typeof state.scene_effects==='object'?state.scene_effects:{};
  const effects=Array.isArray(raw.effects)
    ? [...new Set(raw.effects.filter(effect=>SCENE_EFFECT_KEYS.includes(effect)))]
    : [];
  const intensity=[1,2,3].includes(Number(raw.intensity))?Number(raw.intensity):2;
  const fadeMs=[350,900,1800].includes(Number(raw.fade_ms))?Number(raw.fade_ms):900;
  return {effects,intensity,fade_ms:fadeMs};
}

let sceneAtmosphereRenderer=null;

function drawImageCover(ctx,img,dx,dy,dw,dh){
  const iw=img?.naturalWidth||img?.width||0;
  const ih=img?.naturalHeight||img?.height||0;
  if(!iw||!ih||!dw||!dh)return;
  const scale=Math.max(dw/iw,dh/ih);
  const sw=dw/scale;
  const sh=dh/scale;
  const sx=(iw-sw)/2;
  const sy=(ih-sh)/2;
  ctx.drawImage(img,sx,sy,sw,sh,dx,dy,dw,dh);
}

class SceneAtmosphereRenderer{
  constructor(canvas,host){
    this.canvas=canvas;
    this.host=host;
    this.ctx=canvas?.getContext('2d',{alpha:true,desynchronized:true})||null;
    this.cfg={effects:[],intensity:2,fade_ms:900};
    this.particles=new Map();
    this.running=false;
    this.raf=0;
    this.last=0;
    this.width=0;
    this.height=0;
    this.pixelRatio=1;
    this.quality=1;
    this.frameSamples=[];
    this.recoverFrames=0;
    this.lightningAt=0;
    this.flash=0;
    this.backdropSrc='';
    this.backdropReady=false;
    this.backdropImg=new Image();
    this.backdropImg.crossOrigin='anonymous';
    this.backdropImg.onload=()=>{
      this.backdropReady=true;
      this.refreshHeatBuffer();
    };
    this.backdropImg.onerror=()=>{
      this.backdropReady=false;
      this.clearHeatBuffer();
    };
    this.heatBuffer=document.createElement('canvas');
    this.heatCtx=this.heatBuffer.getContext('2d',{alpha:true});
    this.prefersReduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
    this.resizeObserver=new ResizeObserver(()=>this.resize());
    if(this.host)this.resizeObserver.observe(this.host);
    document.addEventListener('visibilitychange',()=>{
      if(document.hidden)this.stop();
      else if(this.cfg.effects.length)this.start();
    });
    this.resize();
  }

  resize(){
    if(!this.canvas||!this.host)return;
    const rect=this.host.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    this.width=rect.width;
    this.height=rect.height;
    const dpr=Math.min(window.devicePixelRatio||1,1.35);
    const qualityScale=this.quality>=.95?1:this.quality>=.68?.82:.66;
    this.pixelRatio=dpr*qualityScale;
    const w=Math.max(1,Math.round(this.width*this.pixelRatio));
    const h=Math.max(1,Math.round(this.height*this.pixelRatio));
    if(this.canvas.width!==w||this.canvas.height!==h){
      this.canvas.width=w;
      this.canvas.height=h;
      this.canvas.style.width=this.width+'px';
      this.canvas.style.height=this.height+'px';
    }
    if(this.heatBuffer&&(this.heatBuffer.width!==w||this.heatBuffer.height!==h)){
      this.heatBuffer.width=w;
      this.heatBuffer.height=h;
      this.refreshHeatBuffer();
    }
  }

  setBackdropSource(src){
    const next=src||'';
    if(next===this.backdropSrc)return;
    this.backdropSrc=next;
    this.backdropReady=false;
    if(!next){
      this.backdropImg.removeAttribute('src');
      this.clearHeatBuffer();
      return;
    }
    this.backdropImg.src=next;
  }

  clearHeatBuffer(){
    if(!this.heatCtx||!this.heatBuffer)return;
    this.heatCtx.setTransform(1,0,0,1,0,0);
    this.heatCtx.clearRect(0,0,this.heatBuffer.width,this.heatBuffer.height);
  }

  refreshHeatBuffer(){
    if(!this.heatCtx||!this.heatBuffer)return;
    this.clearHeatBuffer();
    if(!this.backdropReady||!this.backdropImg?.naturalWidth)return;
    drawImageCover(
      this.heatCtx,
      this.backdropImg,
      0,
      0,
      this.heatBuffer.width,
      this.heatBuffer.height
    );
  }

  setConfig(cfg){
    this.cfg={
      effects:Array.isArray(cfg?.effects)?cfg.effects.slice():[],
      intensity:[1,2,3].includes(Number(cfg?.intensity))?Number(cfg.intensity):2,
      fade_ms:Number(cfg?.fade_ms)||900
    };
    this.syncParticles();
    if(this.cfg.effects.length&&!document.hidden&&!this.prefersReduced)this.start();
    else{
      this.stop();
      this.drawStatic();
    }
  }

  targetCount(type){
    const intensity=[0,.85,1.3,1.85][this.cfg.intensity]||1;
    const base={
      rain:190,
      snow:120,
      ash:95,
      wind:40,
      mist:16,
      magic:42
    }[type]||0;
    const stormBoost=type==='rain'&&this.cfg.effects.includes('storm')?1.7:1;
    return Math.round(base*intensity*stormBoost*this.quality);
  }

  syncParticles(){
    const active=new Set(this.cfg.effects);
    if(active.has('storm'))active.add('rain');
    const particleTypes=['rain','snow','ash','wind','mist','magic'];
    for(const type of particleTypes){
      if(!active.has(type)){
        this.particles.set(type,[]);
        continue;
      }
      const arr=this.particles.get(type)||[];
      const target=this.targetCount(type);
      while(arr.length<target)arr.push(this.makeParticle(type,true));
      if(arr.length>target)arr.length=target;
      this.particles.set(type,arr);
    }
  }

  makeParticle(type,initial=false){
    const w=Math.max(1,this.width),h=Math.max(1,this.height);
    const p={
      type,
      x:Math.random()*w,
      y:initial?Math.random()*h:-20-Math.random()*80,
      z:.35+Math.random()*.65,
      vx:0,
      vy:0,
      size:1,
      phase:Math.random()*Math.PI*2,
      life:Math.random()
    };
    if(type==='rain'){
      p.vx=70+Math.random()*75;
      p.vy=650+Math.random()*720;
      p.size=8+Math.random()*18;
    }else if(type==='snow'){
      p.vx=-18+Math.random()*36;
      p.vy=32+Math.random()*72;
      p.size=1.1+Math.random()*2.4;
    }else if(type==='ash'){
      p.vx=-12+Math.random()*24;
      p.vy=18+Math.random()*48;
      p.size=.7+Math.random()*2;
      p.ember=Math.random()<.07;
    }else if(type==='wind'){
      p.x=initial?Math.random()*w:-60;
      // Wind should always recycle at a visible height. The generic recycled
      // particle Y starts above the canvas, which made streaks disappear after
      // their first pass across the screen.
      p.y=Math.random()*h;
      p.vx=170+Math.random()*280;
      p.vy=-14+Math.random()*28;
      p.size=16+Math.random()*42;
    }else if(type==='mist'){
      p.x=Math.random()*w;
      p.y=h*(.25+Math.random()*.65);
      p.vx=6+Math.random()*16;
      p.vy=-2+Math.random()*4;
      p.size=90+Math.random()*210;
      p.life=.15+Math.random()*.38;
    }else if(type==='magic'){
      p.vx=-9+Math.random()*18;
      p.vy=-15-Math.random()*35;
      p.size=1.4+Math.random()*4.4;
    }
    return p;
  }

  recycle(p){
    const replacement=this.makeParticle(p.type,false);
    Object.assign(p,replacement);
  }

  start(){
    if(this.running||!this.ctx)return;
    this.running=true;
    this.last=performance.now();
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  stop(){
    this.running=false;
    if(this.raf)cancelAnimationFrame(this.raf);
    this.raf=0;
    this.last=0;
  }

  frame(now){
    if(!this.running||!this.ctx)return;
    const dt=Math.min(.05,Math.max(.001,(now-this.last)/1000));
    this.last=now;
    this.trackPerformance(dt);
    this.draw(dt,now);
    this.raf=requestAnimationFrame(t=>this.frame(t));
  }

  trackPerformance(dt){
    this.frameSamples.push(dt);
    if(this.frameSamples.length<90)return;
    const avg=this.frameSamples.reduce((a,b)=>a+b,0)/this.frameSamples.length;
    this.frameSamples.length=0;
    if(avg>.027&&this.quality>.5){
      this.quality=this.quality>.8?.72:.5;
      this.recoverFrames=0;
      this.resize();
      this.syncParticles();
    }else if(avg<.019&&this.quality<1){
      this.recoverFrames++;
      if(this.recoverFrames>=3){
        this.quality=this.quality<.7?.72:1;
        this.recoverFrames=0;
        this.resize();
        this.syncParticles();
      }
    }else{
      this.recoverFrames=0;
    }
  }

  clear(){
    if(!this.ctx)return;
    this.ctx.setTransform(1,0,0,1,0,0);
    this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    this.ctx.setTransform(this.pixelRatio,0,0,this.pixelRatio,0,0);
  }

  drawStatic(){
    this.clear();
  }

  draw(dt,now){
    this.clear();
    const ctx=this.ctx;
    const w=this.width,h=this.height;
    const intensity=this.cfg.intensity/3;
    const effects=new Set(this.cfg.effects);
    if(effects.has('storm'))effects.add('rain');

    if(effects.has('heat'))this.drawHeatHaze(ctx,w,h,now);
    if(effects.has('mist'))this.drawMist(ctx,dt,w,h);
    if(effects.has('wind'))this.drawWind(ctx,dt,w,h);
    if(effects.has('rain'))this.drawRain(ctx,dt,w,h,effects.has('storm'));
    if(effects.has('snow'))this.drawSnow(ctx,dt,w,h);
    if(effects.has('ash'))this.drawAsh(ctx,dt,w,h);
    if(effects.has('magic'))this.drawMagic(ctx,dt,w,h,now);

    if(effects.has('storm'))this.drawLightning(now,intensity);
    else this.setFlash(0);
  }

  drawRain(ctx,dt,w,h,storm){
    const arr=this.particles.get('rain')||[];
    ctx.save();
    ctx.lineCap='round';
    for(const p of arr){
      p.x+=p.vx*p.z*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y>h+50||p.x>w+70)this.recycle(p);
      const alpha=(storm?.48:.34)*p.z;
      ctx.strokeStyle='rgba(205,225,235,'+alpha+')';
      ctx.lineWidth=Math.max(.7,p.z*1.45);
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x-p.size*.22,p.y-p.size);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSnow(ctx,dt,w,h){
    const arr=this.particles.get('snow')||[];
    ctx.save();
    for(const p of arr){
      p.phase+=dt*(.7+p.z);
      p.x+=(p.vx+Math.sin(p.phase)*16)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y>h+12||p.x<-20||p.x>w+20)this.recycle(p);
      ctx.globalAlpha=.48+.5*p.z;
      ctx.fillStyle='rgba(245,249,250,.92)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size*p.z,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawAsh(ctx,dt,w,h){
    const arr=this.particles.get('ash')||[];
    ctx.save();
    for(const p of arr){
      p.phase+=dt*(.4+p.z);
      p.x+=(p.vx+Math.sin(p.phase)*10)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y>h+16||p.x<-20||p.x>w+20)this.recycle(p);
      ctx.globalAlpha=.34+.48*p.z;
      ctx.fillStyle=p.ember?'rgba(242,132,58,.88)':'rgba(190,184,170,.72)';
      ctx.beginPath();
      ctx.arc(p.x,p.y,p.size*p.z,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWind(ctx,dt,w,h){
    const arr=this.particles.get('wind')||[];
    ctx.save();
    ctx.lineCap='round';
    for(const p of arr){
      p.x+=p.vx*p.z*dt;
      p.phase+=dt*(.35+p.z*.35);
      p.y+=p.vy*dt+Math.sin(p.phase+p.x*.01)*3*dt;
      if(p.x>w+80||p.y<-40||p.y>h+40)this.recycle(p);
      ctx.strokeStyle='rgba(226,218,193,'+(.055+.12*p.z)+')';
      ctx.lineWidth=.75+p.z*.9;
      ctx.beginPath();
      ctx.moveTo(p.x,p.y);
      ctx.lineTo(p.x-p.size,p.y+2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawMist(ctx,dt,w,h){
    const arr=this.particles.get('mist')||[];
    ctx.save();
    ctx.filter='blur(22px)';
    for(const p of arr){
      p.x+=p.vx*dt;
      p.y+=p.vy*dt;
      if(p.x>w+p.size)this.recycle(p);
      const alpha=.03+p.life*.085;
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,p.size);
      g.addColorStop(0,'rgba(224,234,230,'+Math.min(.22,alpha*1.18)+')');
      g.addColorStop(.55,'rgba(211,226,224,'+(alpha*.82)+')');
      g.addColorStop(1,'rgba(211,226,224,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.ellipse(p.x,p.y,p.size,p.size*.42,0,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawMagic(ctx,dt,w,h,now){
    const arr=this.particles.get('magic')||[];
    ctx.save();
    ctx.globalCompositeOperation='lighter';
    for(const p of arr){
      p.phase+=dt*(.8+p.z);
      p.x+=(p.vx+Math.sin(p.phase)*10)*dt;
      p.y+=p.vy*p.z*dt;
      if(p.y<-30||p.x<-30||p.x>w+30)this.recycle(p);
      const pulse=.55+.45*Math.sin(now*.0015+p.phase);
      const r=p.size*(2.5+p.z*2);
      const g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
      g.addColorStop(0,'rgba(153,224,239,'+(.36*pulse)+')');
      g.addColorStop(.45,'rgba(171,115,221,'+(.22*pulse)+')');
      g.addColorStop(1,'rgba(171,115,221,0)');
      ctx.fillStyle=g;
      ctx.beginPath();
      ctx.arc(p.x,p.y,r,0,Math.PI*2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawHeatHaze(ctx,w,h,now){
    if(!this.backdropReady||!this.heatBuffer?.width||!this.heatBuffer?.height)return;

    const intensity=this.cfg.intensity||2;
    const strength={1:2.2,2:4.8,3:8.2}[intensity]||4.8;
    const maxShift=strength*(.84+.16*this.quality);
    const startY=Math.floor(h*.34);
    const stripH=this.quality>=.95?4:this.quality>=.68?6:9;
    const sourceScale=this.pixelRatio;

    ctx.save();
    ctx.globalAlpha={1:.58,2:.72,3:.86}[intensity]||.72;
    ctx.imageSmoothingEnabled=true;

    for(let y=startY;y<h;y+=stripH){
      const depth=(y-startY)/Math.max(1,h-startY);
      const weight=.12+Math.pow(depth,1.42)*.88;

      // Several asynchronous waves stop the image looking like one simple sine wobble.
      const waveA=Math.sin(y*.041+now*.00225);
      const waveB=Math.sin(y*.017-now*.00137+1.7);
      const waveC=Math.sin(y*.073+now*.00091+4.1);
      const slow=Math.sin(now*.00047+y*.006);
      const offset=(waveA+waveB*.68+waveC*.31+slow*.24)*maxShift*weight;

      // Tiny vertical refraction helps sell rising hot air without making the image swim.
      const rise=Math.sin(y*.027-now*.00162)*1.25*weight*intensity;

      const sy=Math.max(0,Math.floor(y*sourceScale));
      const sh=Math.max(1,Math.min(
        this.heatBuffer.height-sy,
        Math.ceil((stripH+2)*sourceScale)
      ));
      if(sh<=0)continue;

      ctx.drawImage(
        this.heatBuffer,
        0,sy,this.heatBuffer.width,sh,
        offset,y+rise,w,stripH+2
      );
    }

    // A softer second pass over the lowest part creates the turbulent ground shimmer.
    const lowerY=Math.floor(h*.64);
    ctx.globalAlpha={1:.12,2:.19,3:.28}[intensity]||.19;
    for(let y=lowerY;y<h;y+=stripH*2){
      const depth=(y-lowerY)/Math.max(1,h-lowerY);
      const offset=Math.sin(y*.029-now*.0031)*maxShift*(.45+depth*.8);
      const sy=Math.max(0,Math.floor(y*sourceScale));
      const sh=Math.max(1,Math.min(
        this.heatBuffer.height-sy,
        Math.ceil((stripH*2+3)*sourceScale)
      ));
      if(sh<=0)continue;
      ctx.drawImage(
        this.heatBuffer,
        0,sy,this.heatBuffer.width,sh,
        offset,y,w,stripH*2+3
      );
    }
    ctx.restore();
  }

  drawLightning(now,intensity){
    if(!this.lightningAt)this.lightningAt=now+2600+Math.random()*6200;
    if(now>=this.lightningAt){
      this.flash=.42+.42*intensity;
      this.lightningAt=now+3300+Math.random()*7600;
    }
    if(this.flash>0){
      this.flash*=.76;
      if(this.flash<.015)this.flash=0;
      this.setFlash(this.flash);
    }else{
      this.setFlash(0);
    }
  }

  setFlash(value){
    if(!this.host)return;
    this.host.style.setProperty('--scene-fx-flash',String(Math.max(0,Math.min(.75,value))));
  }
}

function getSceneAtmosphereRenderer(){
  if(!sceneAtmosphereRenderer&&els.sceneFxCanvas&&els.sceneEffects){
    sceneAtmosphereRenderer=new SceneAtmosphereRenderer(els.sceneFxCanvas,els.sceneEffects);
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
  const cfg=sceneEffectState();
  if(key==='intensity')cfg.intensity=Math.max(1,Math.min(3,Number(value)||2));
  if(key==='fade_ms')cfg.fade_ms=[350,900,1800].includes(Number(value))?Number(value):900;
  await patchState({scene_effects:cfg});
}

function renderPinned(host,id){
  const asset=byId(id);
  if(!asset){host.classList.add('hidden');host.innerHTML='';delete host.dataset.kind;return}
  host.dataset.kind=asset.kind||'other';
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
  }else if(els.revealLayer){
    delete els.revealLayer.dataset.kind;
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
  lastDisplaySignature=signature;
  lastDisplayMode=mode;
  lastRenderedSceneId=currentSceneId;
  lastRenderedTransitionNonce=currentTransitionNonce;
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

function isSceneCastAsset(asset){
  return Boolean(asset&&(asset.kind==='npc'||asset.kind==='creature'));
}

function isCompactRevealAsset(asset){
  return Boolean(asset&&(asset.kind==='item'||asset.kind==='clue'));
}

function normalizeSceneCast(raw=state?.scene_cast){
  const source=raw&&typeof raw==='object'?raw:{};
  const ids=Array.isArray(source.ids)
    ? [...new Set(source.ids.filter(id=>typeof id==='string'&&isSceneCastAsset(byId(id))))].slice(0,6)
    : [];
  const active_id=ids.includes(source.active_id)?source.active_id:null;
  return {ids,active_id};
}

function sceneCastMemberElement(asset){
  const el=document.createElement('article');
  el.className='scene-cast-member is-entering'+(asset.kind==='creature'?' is-creature':'');
  el.dataset.castId=asset.id;
  const img=document.createElement('img');
  img.src=asset.image_url;
  img.alt=asset.name;
  const name=document.createElement('strong');
  name.textContent=asset.name;
  el.append(img,name);
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
  host.classList.toggle('hidden',!visible);
  host.classList.toggle('is-reveal-muted',compactReveal&&visible);
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

  for(const id of cast.ids){
    const asset=byId(id);
    if(!asset)continue;
    let el=host.querySelector('.scene-cast-member[data-cast-id="'+CSS.escape(id)+'"]');
    if(!el){
      el=sceneCastMemberElement(asset);
      host.appendChild(el);
    }else{
      const img=el.querySelector('img');
      const label=el.querySelector('strong');
      if(img&&img.src!==asset.image_url)img.src=asset.image_url;
      if(label)label.textContent=asset.name;
      host.appendChild(el);
    }
    el.classList.toggle('is-active',cast.active_id===id);
  }
}

function renderSceneCastTray(){
  if(!els.sceneCastTray)return;
  const cast=normalizeSceneCast();
  if(els.sceneCastCount)els.sceneCastCount.textContent=cast.ids.length+' / 6';
  if(els.clearSceneCastBtn)els.clearSceneCastBtn.disabled=!cast.ids.length;

  if(!cast.ids.length){
    els.sceneCastTray.innerHTML='<p class="scene-cast-empty">No characters or creatures in the scene yet. Use ADD CAST in the library.</p>';
    return;
  }

  els.sceneCastTray.innerHTML=cast.ids.map((id,index)=>{
    const member=byId(id);
    if(!member)return '';
    const active=cast.active_id===id;
    const typeLabel=member.kind==='creature'?'Creature':'NPC';
    const featureLabel=member.kind==='creature'?(active?'FEATURED':'FEATURE'):(active?'SPEAKING':'SPEAK');
    return '<article class="scene-cast-chip'+(active?' is-active':'')+'" draggable="true" data-cast-chip="'+esc(id)+'">'+
      '<img src="'+esc(member.image_url)+'" alt="">'+
      '<div class="scene-cast-chip-main"><strong>'+esc(member.name)+'</strong><small>'+(active?'Featured now':typeLabel+' '+(index+1))+'</small></div>'+
      '<div class="scene-cast-chip-actions">'+
        '<button type="button" class="cast-speak'+(active?' is-active':'')+'" data-cast-speak="'+esc(id)+'">'+featureLabel+'</button>'+
        '<button type="button" class="cast-remove" data-cast-remove="'+esc(id)+'" title="Remove from scene">×</button>'+
      '</div>'+
    '</article>';
  }).join('');

  els.sceneCastTray.querySelectorAll('[data-cast-speak]').forEach(button=>
    button.addEventListener('click',()=>setSceneCastSpeaker(button.dataset.castSpeak))
  );
  els.sceneCastTray.querySelectorAll('[data-cast-remove]').forEach(button=>
    button.addEventListener('click',()=>removeNpcFromCast(button.dataset.castRemove))
  );

  els.sceneCastTray.querySelectorAll('[data-cast-chip]').forEach(chip=>{
    chip.addEventListener('dragstart',event=>{
      sceneCastDragId=chip.dataset.castChip||'';
      chip.classList.add('dragging');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',sceneCastDragId);
      }
    });
    chip.addEventListener('dragend',()=>{
      sceneCastDragId='';
      chip.classList.remove('dragging');
      els.sceneCastTray.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    });
    chip.addEventListener('dragover',event=>{
      event.preventDefault();
      if(sceneCastDragId&&sceneCastDragId!==chip.dataset.castChip)chip.classList.add('drag-over');
    });
    chip.addEventListener('dragleave',()=>chip.classList.remove('drag-over'));
    chip.addEventListener('drop',event=>{
      event.preventDefault();
      chip.classList.remove('drag-over');
      const source=sceneCastDragId||event.dataTransfer?.getData('text/plain')||'';
      const rect=chip.getBoundingClientRect();
      const after=event.clientY>rect.top+rect.height/2;
      reorderSceneCast(source,chip.dataset.castChip||'',after);
    });
  });
}

function renderSceneCast(){
  renderPlayerSceneCast();
  renderSceneCastTray();
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
  await patchState({scene_cast:{ids,active_id:cast.active_id||id}});
}

async function removeNpcFromCast(id){
  if(!canGMControl())return;
  const cast=normalizeSceneCast();
  if(!cast.ids.includes(id))return;
  const ids=cast.ids.filter(item=>item!==id);
  await patchState({scene_cast:{ids,active_id:cast.active_id===id?null:cast.active_id}});
}

async function setSceneCastSpeaker(id){
  if(!canGMControl())return;
  const cast=normalizeSceneCast();
  if(!cast.ids.includes(id))return;
  await patchState({scene_cast:{ids:cast.ids,active_id:cast.active_id===id?null:id}});
}

async function clearSceneCast(){
  if(!canGMControl())return;
  await patchState({scene_cast:{ids:[],active_id:null}});
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
  await patchState({scene_cast:{ids,active_id:cast.active_id}});
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
  const showLabel=asset.kind==='creature'||asset.kind==='handout'?'FULL REVEAL':'SHOW';
  const thumb=isInteractiveMap(asset)
    ? '<div class="reveal-thumb interactive-map-thumb"><span>✦</span><b>INTERACTIVE ATLAS</b></div>'
    : '<div class="reveal-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>';
  return '<article class="reveal-card" data-kind="'+esc(asset.kind)+'">'+thumb+
    '<strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||asset.kind.replace('_',' '))+'</small>'+
    '<div class="card-actions"><button type="button" data-show="'+asset.id+'">'+showLabel+'</button>'+mapAction+castAction+'<button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderRevealGrid(){
  const visualAssets=assets.filter(a=>a.kind!=='scene'&&(filterKind==='all'||a.kind===filterKind));
  els.revealGrid.innerHTML=visualAssets.length?visualAssets.map(revealCard).join(''):'<p class="muted">No visuals in this category yet.</p>';
  els.revealGrid.querySelectorAll('[data-show]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.show)));
  els.revealGrid.querySelectorAll('[data-pin]').forEach(b=>b.addEventListener('click',()=>pinAsset(b.dataset.pin)));
  els.revealGrid.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>setWorldMap(b.dataset.map)));
  els.revealGrid.querySelectorAll('[data-cast-action]').forEach(b=>b.addEventListener('click',()=>addToSceneCast(b.dataset.castAction)));
  els.revealGrid.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeAssetFromDisplay(b.dataset.remove)));
  els.revealGrid.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteAsset(b.dataset.delete)));
}

function scenePresets(){
  const raw=state?.scene_presets;
  if(!Array.isArray(raw))return [];
  return raw
    .filter(p=>p&&typeof p==='object'&&typeof p.id==='string'&&p.snapshot&&typeof p.snapshot==='object')
    .slice(0,36);
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
  const validPresetIds=new Set(scenePresets().map(preset=>preset.id));
  return normalizedCueSequence().filter(item=>validPresetIds.has(item.preset_id));
}

function cueSequenceIndex(){
  const rawSequence=normalizedCueSequence();
  const raw=Number(state?.cue_sequence_index);
  if(!Number.isInteger(raw)||raw<0||raw>=rawSequence.length)return -1;
  const currentItemId=rawSequence[raw]?.id;
  return currentItemId?cueSequence().findIndex(item=>item.id===currentItemId):-1;
}

function cuePresetById(id){
  return scenePresets().find(p=>p.id===id)||null;
}

function cueItemPreset(item){
  return item?cuePresetById(item.preset_id):null;
}

async function cleanStaleCueSequence(){
  if(!canGMControl())return false;
  const source=Array.isArray(state?.cue_sequence)?state.cue_sequence:[];
  const normalized=normalizedCueSequence(source);
  const validPresetIds=new Set(scenePresets().map(preset=>preset.id));
  const cleaned=normalized.filter(item=>validPresetIds.has(item.preset_id));
  const rawIndex=Number(state?.cue_sequence_index);
  const currentItemId=Number.isInteger(rawIndex)&&rawIndex>=0?normalized[rawIndex]?.id:null;
  const nextIndex=currentItemId?cleaned.findIndex(item=>item.id===currentItemId):-1;
  const changed=source.length!==cleaned.length
    ||normalized.length!==cleaned.length
    ||(Number.isInteger(rawIndex)?rawIndex:-1)!==nextIndex;
  if(!changed)return false;
  await patchState({cue_sequence:cleaned,cue_sequence_index:nextIndex});
  return true;
}

function normalizeCueEffects(raw){
  const effects=Array.isArray(raw?.effects)
    ? [...new Set(raw.effects.filter(effect=>SCENE_EFFECT_KEYS.includes(effect)))]
    : [];
  return {
    effects,
    intensity:[1,2,3].includes(Number(raw?.intensity))?Number(raw.intensity):2,
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
  els.cuePresetList.querySelectorAll('[data-cue-go]').forEach(b=>b.addEventListener('click',()=>applyCuePreset(b.dataset.cueGo)));
  els.cuePresetList.querySelectorAll('[data-cue-add-run]').forEach(b=>b.addEventListener('click',()=>addCueToSequence(b.dataset.cueAddRun)));
  els.cuePresetList.querySelectorAll('[data-cue-update]').forEach(b=>b.addEventListener('click',()=>updateCuePreset(b.dataset.cueUpdate)));
  els.cuePresetList.querySelectorAll('[data-cue-delete]').forEach(b=>b.addEventListener('click',()=>deleteCuePreset(b.dataset.cueDelete)));
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

  els.audioLibraryList.querySelectorAll('[data-audio-rename]').forEach(input=>
    input.addEventListener('change',()=>renameAudioTrack(input.dataset.audioRename,input.value))
  );
  els.audioLibraryList.querySelectorAll('[data-audio-preview]').forEach(button=>
    button.addEventListener('click',()=>previewAudioTrack(button.dataset.audioPreview))
  );
  els.audioLibraryList.querySelectorAll('[data-audio-delete]').forEach(button=>
    button.addEventListener('click',()=>deleteAudioTrack(button.dataset.audioDelete))
  );
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

  els.cueSequenceList.querySelectorAll('[data-sequence-go]').forEach(button=>
    button.addEventListener('click',()=>runCueSequenceItem(button.dataset.sequenceGo))
  );
  els.cueSequenceList.querySelectorAll('[data-sequence-remove]').forEach(button=>
    button.addEventListener('click',()=>removeCueFromSequence(button.dataset.sequenceRemove))
  );
  els.cueSequenceList.querySelectorAll('[data-sequence-note]').forEach(input=>
    input.addEventListener('change',()=>saveCueSequenceNote(input.dataset.sequenceNote,input.value))
  );

  els.cueSequenceList.querySelectorAll('.cue-sequence-item').forEach(item=>{
    item.addEventListener('dragstart',event=>{
      cueSequenceDragId=item.dataset.sequenceId||'';
      item.classList.add('dragging');
      if(event.dataTransfer){
        event.dataTransfer.effectAllowed='move';
        event.dataTransfer.setData('text/plain',cueSequenceDragId);
      }
    });
    item.addEventListener('dragend',()=>{
      cueSequenceDragId='';
      item.classList.remove('dragging');
      els.cueSequenceList.querySelectorAll('.drag-over').forEach(el=>el.classList.remove('drag-over'));
    });
    item.addEventListener('dragover',event=>{
      event.preventDefault();
      if(cueSequenceDragId&&cueSequenceDragId!==item.dataset.sequenceId)item.classList.add('drag-over');
    });
    item.addEventListener('dragleave',()=>item.classList.remove('drag-over'));
    item.addEventListener('drop',event=>{
      event.preventDefault();
      item.classList.remove('drag-over');
      const source=cueSequenceDragId||event.dataTransfer?.getData('text/plain')||'';
      const rect=item.getBoundingClientRect();
      const after=event.clientY>rect.top+rect.height/2;
      reorderCueSequence(source,item.dataset.sequenceId||'',after);
    });
  });

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
  const index=cueSequence().findIndex(item=>item.id===itemId);
  if(index>=0)await runCueSequenceAt(index);
}

async function nextCueInSequence(){
  const seq=cueSequence();
  if(!seq.length)return;
  const current=cueSequenceIndex();
  const next=current<0?0:current+1;
  if(next<seq.length)await runCueSequenceAt(next);
}

async function previousCueInSequence(){
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
  els.recentList.querySelectorAll('[data-recent]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.recent)));
}

function renderAll(){renderDisplay();renderScenes();renderSceneCast();renderAudioControls();renderTransitionControls();renderCueSequence();renderCuePresets();renderRevealGrid();renderRecent();syncLiveAudio()}

async function patchState(patch){
  if(!canGMControl())return null;
  const payload={...patch,updated_by:user.id,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from('live_table_state').update(payload).eq('campaign_id',CAMPAIGN_ID).select().single();
  if(error){alert(error.message);return null}
  state=data;
  renderAll();
  return data;
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
  if(!canGMControl())return;
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

function startPlayerMapStatePolling(){
  clearInterval(playerMapStatePollTimer);
  if(!IS_PLAYER_DISPLAY)return;
  playerMapStatePollTimer=setInterval(async()=>{
    if(state?.mode!=='map'||!supabase)return;
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
  },220);
}

function startMapMirrorPolling(){
  clearInterval(mapMirrorPollTimer);
  clearInterval(mapCameraPollTimer);
  clearInterval(mapJourneyPollTimer);

  // Journey path: caravan position + cinematic HUD only, with no full map render.
  mapJourneyPollTimer=setInterval(()=>{
    if(!canGMControl()||state?.mode!=='map')return;
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
    }catch(err){
      // iframe may be between srcdoc reloads; the next poll will retry.
    }
  },32);

  // Camera path: tiny view-only updates at ~30 fps. No full map render on player.
  mapCameraPollTimer=setInterval(()=>{
    if(!canGMControl()||state?.mode!=='map')return;
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
    }catch(err){
      // iframe may be between srcdoc reloads; the next poll will retry.
    }
  },32);

  // Heavy path: only broadcast when actual map content/layers change.
  mapMirrorPollTimer=setInterval(()=>{
    if(!canGMControl()||state?.mode!=='map')return;
    const win=els.worldMapFrame?.contentWindow;
    if(!win)return;
    try{
      const bridge=win.AestraLiveBridge;
      if(!bridge?.collect||bridge.role!=='gm')return;
      const mirror=bridge.collect();
      if(!mirror)return;
      // Camera and journey animation have their own lightweight channels.
      const signature=JSON.stringify({...mirror,view:null,liveParty:null,travel:null});
      if(signature===lastPolledMapMirrorSignature)return;
      lastPolledMapMirrorSignature=signature;
      sendMapMirror(mirror);
    }catch(err){
      // iframe may be between srcdoc reloads; the next poll will retry.
    }
  },110);
}

async function subscribeRealtime(){
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
  supabase.channel('aestra-live-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{if(payload.new){state=payload.new;renderAll()}})
    .subscribe();
  supabase.channel('aestra-live-assets')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_assets',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadAssets();renderAll()})
    .subscribe();
  supabase.channel('aestra-live-party')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_party',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadParty();renderParty()})
    .subscribe();
  supabase.channel('aestra-live-map-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_map_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{
      if(!payload.new)return;
      mapState=payload.new;
      if(shouldReceivePlayerMap())sendMapStateToFrame();
    })
    .subscribe();
}

function wire(){
  window.addEventListener('message',handleMapBridgeMessage);
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
  els.hudToggle.addEventListener('change',()=>patchState({hud_visible:els.hudToggle.checked}));
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
  await Promise.all([loadState(),loadAssets(),loadParty(),loadMapState()]);
  await cleanStaleCueSequence();
  renderAll();

  // Full map state remains the durable fallback; camera and journey motion
  // use lightweight realtime paths when available.
  startMapMirrorPolling();
  startPlayerMapStatePolling();

  try{
    await subscribeRealtime();
  }catch(err){
    console.warn('Realtime unavailable; map polling remains active.',err);
  }
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
