// Persistent ambient soundtrack + GM-only soundtrack upload.
(function(){
  if(window.__AESTRA_AMBIENT_MUSIC__)return;
  window.__AESTRA_AMBIENT_MUSIC__=true;

  const CONFIG=window.AESTRA_CONFIG||{};
  const BUCKET='campaign-audio';
  const TRACK='ambient.mp3';
  const MUTED_KEY='aestra_music_muted_v1';
  const BASE_VOLUME=.22;
  const CINEMATIC_VOLUME=.30;
  const $=id=>document.getElementById(id);
  let sb=null,audio=null,button=null,fileInput=null,hasTrack=false,isGM=false,userInteracted=false,visibilityPaused=false,fadeFrame=0;

  function muted(){return localStorage.getItem(MUTED_KEY)==='1'}
  function setMuted(value){localStorage.setItem(MUTED_KEY,value?'1':'0');if(audio)audio.muted=value;renderButton()}
  function publicUrl(cacheBust=false){
    if(!CONFIG.supabaseUrl)return'';
    return `${CONFIG.supabaseUrl}/storage/v1/object/public/${BUCKET}/${TRACK}${cacheBust?`?v=${Date.now()}`:''}`;
  }
  async function client(){
    if(sb)return sb;
    if(!CONFIG.supabaseUrl||!CONFIG.supabaseAnonKey)throw new Error('Supabase is not configured.');
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb=mod.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
    return sb;
  }

  function styles(){
    if($('aestraAmbientMusicStyles'))return;
    const s=document.createElement('style');
    s.id='aestraAmbientMusicStyles';
    s.textContent=`
      .aestra-music-toggle{font-size:.49rem!important;line-height:1!important;letter-spacing:.05em!important;min-height:24px!important;padding:4px 7px!important;opacity:.58;transition:opacity .18s,border-color .18s,color .18s;white-space:nowrap}
      .aestra-music-toggle:hover,.aestra-music-toggle:focus-visible{opacity:1;color:#d9c48e!important;border-color:rgba(211,171,91,.38)!important}
      .aestra-music-toggle .aestra-music-symbol{font-size:.72rem;margin-right:3px;vertical-align:-.03em}
      .aestra-music-toggle.muted{opacity:.42}
      .aestra-music-toggle.uploading{pointer-events:none;opacity:.38}
      @media(min-width:701px){.top-actions{position:relative}.aestra-music-toggle{position:absolute!important;right:67px;bottom:calc(100% + 3px)}}
      @media(max-width:700px){.aestra-music-toggle{opacity:.7}}
    `;
    document.head.appendChild(s);
  }

  function ensureAudio(){
    if(audio)return audio;
    audio=document.createElement('audio');
    audio.id='aestraAmbientAudio';
    audio.loop=true;
    audio.preload='metadata';
    audio.volume=BASE_VOLUME;
    audio.muted=muted();
    audio.setAttribute('playsinline','');
    audio.addEventListener('error',()=>{if(!hasTrack){renderButton()}});
    document.body.appendChild(audio);
    return audio;
  }

  function installControl(){
    styles();
    if(button)return;
    const top=document.querySelector('.top-actions');
    if(!top)return;
    button=document.createElement('button');
    button.id='aestraMusicToggle';
    button.type='button';
    button.className='ghost aestra-music-toggle hidden';
    button.addEventListener('click',async()=>{
      userInteracted=true;
      if(!hasTrack&&isGM){fileInput?.click();return}
      if(!hasTrack)return;
      const next=!muted();
      setMuted(next);
      if(!next)await tryPlay();
    });
    const replay=$('aestraReplayOpening');
    const logout=$('logoutBtn');
    if(replay&&replay.parentElement===top)top.insertBefore(button,replay);
    else if(logout&&logout.parentElement===top)top.insertBefore(button,logout);
    else top.appendChild(button);

    fileInput=document.createElement('input');
    fileInput.type='file';
    fileInput.accept='audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav';
    fileInput.hidden=true;
    fileInput.addEventListener('change',uploadTrack);
    document.body.appendChild(fileInput);
    renderButton();
  }

  function renderButton(){
    if(!button)return;
    const appVisible=!$('appView')?.classList.contains('hidden');
    button.classList.toggle('hidden',!appVisible||(!hasTrack&&!isGM));
    button.classList.toggle('muted',muted());
    if(!hasTrack&&isGM){
      button.innerHTML='<span class="aestra-music-symbol">♫</span>Add Track';
      button.title='Upload the campaign background soundtrack';
      button.setAttribute('aria-label','Upload campaign background music');
      return;
    }
    button.innerHTML=`<span class="aestra-music-symbol">♫</span>${muted()?'Off':'On'}`;
    button.title=muted()?'Turn background music on':'Mute background music';
    button.setAttribute('aria-label',muted()?'Turn background music on':'Mute background music');
    button.setAttribute('aria-pressed',muted()?'true':'false');
  }

  async function tryPlay(){
    if(!hasTrack||muted()||document.hidden)return;
    const a=ensureAudio();
    if(!a.src)a.src=publicUrl();
    try{await a.play()}catch{}
  }

  async function detectTrack(){
    const url=publicUrl();
    if(!url)return false;
    try{
      const r=await fetch(url,{method:'HEAD',cache:'no-store'});
      hasTrack=r.ok;
    }catch{hasTrack=false}
    if(hasTrack){const a=ensureAudio();if(!a.src)a.src=url}
    renderButton();
    return hasTrack;
  }

  async function detectGM(){
    try{
      const c=await client();
      const {data:{session}}=await c.auth.getSession();
      const uid=session?.user?.id;
      if(!uid){isGM=false;renderButton();return}
      const {data}=await c.from('profiles').select('is_gm').eq('id',uid).maybeSingle();
      isGM=data?.is_gm===true;
    }catch{isGM=false}
    renderButton();
  }

  async function uploadTrack(e){
    const file=e.target.files?.[0];
    e.target.value='';
    if(!file||!isGM)return;
    if(file.size>20*1024*1024){alert('Please choose an audio file under 20 MB.');return}
    button?.classList.add('uploading');
    if(button)button.textContent='Uploading…';
    try{
      const c=await client();
      const {error}=await c.storage.from(BUCKET).upload(TRACK,file,{upsert:true,cacheControl:'3600',contentType:file.type||'audio/mpeg'});
      if(error)throw error;
      hasTrack=true;
      const a=ensureAudio();
      a.pause();
      a.src=publicUrl(true);
      a.load();
      setMuted(false);
      await tryPlay();
    }catch(err){
      console.error('Aestra soundtrack upload failed',err);
      alert('The soundtrack could not be uploaded. Please try again.');
    }finally{
      button?.classList.remove('uploading');
      renderButton();
    }
  }

  function fadeTo(target,duration=900){
    if(!audio)return;
    cancelAnimationFrame(fadeFrame);
    const start=audio.volume,delta=target-start,t0=performance.now();
    const tick=now=>{
      const p=Math.min(1,(now-t0)/duration);
      audio.volume=start+delta*(1-Math.pow(1-p,2));
      if(p<1)fadeFrame=requestAnimationFrame(tick);
    };
    fadeFrame=requestAnimationFrame(tick);
  }

  function observeCinematic(){
    const sync=()=>{
      const o=$('aestraOpeningCinematic');
      const active=!!o&&(o.classList.contains('show')||o.classList.contains('closing'));
      fadeTo(active?CINEMATIC_VOLUME:BASE_VOLUME,active?1200:1500);
    };
    const bodyObserver=new MutationObserver(()=>{
      const o=$('aestraOpeningCinematic');
      if(!o||o.dataset.musicObserved==='1')return;
      o.dataset.musicObserved='1';
      new MutationObserver(sync).observe(o,{attributes:true,attributeFilter:['class']});
      sync();
    });
    bodyObserver.observe(document.body,{childList:true,subtree:false});
    sync();
  }

  function bindFirstInteraction(){
    const start=()=>{userInteracted=true;tryPlay()};
    document.addEventListener('pointerdown',start,{capture:true,passive:true});
    document.addEventListener('keydown',start,{capture:true});
  }

  document.addEventListener('visibilitychange',()=>{
    if(!audio)return;
    if(document.hidden){
      visibilityPaused=!audio.paused;
      if(visibilityPaused)audio.pause();
    }else if(visibilityPaused&&!muted()){
      visibilityPaused=false;
      tryPlay();
    }
  });

  const app=$('appView');
  if(app)new MutationObserver(renderButton).observe(app,{attributes:true,attributeFilter:['class']});

  async function boot(){
    installControl();
    ensureAudio();
    bindFirstInteraction();
    observeCinematic();
    await Promise.all([detectGM(),detectTrack()]);
    if(userInteracted)tryPlay();
  }

  boot();
  window.AESTRA_MUSIC={
    play:tryPlay,
    mute:()=>setMuted(true),
    unmute:()=>{setMuted(false);return tryPlay()},
    isMuted:muted
  };
})();
