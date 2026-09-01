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
  let sb=null,audio=null,button=null,floatingButton=null,fileInput=null,hasTrack=false,isGM=false,userInteracted=false,visibilityPaused=false,fadeFrame=0;

  function muted(){return localStorage.getItem(MUTED_KEY)==='1'}
  function setMuted(value){
    localStorage.setItem(MUTED_KEY,value?'1':'0');
    if(audio)audio.muted=value;
    renderButton();
    if(!value)tryPlay();
  }
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
      @media(min-width:701px){.top-actions{position:relative}.aestra-music-toggle:not(.aestra-music-floating){position:absolute!important;right:67px;bottom:calc(100% + 3px)}}
      @media(max-width:700px){.aestra-music-toggle{opacity:.7}}
      .aestra-music-floating{position:fixed!important;z-index:71050!important;right:max(16px,env(safe-area-inset-right))!important;top:max(50px,calc(env(safe-area-inset-top) + 48px))!important;min-width:30px!important;min-height:28px!important;padding:5px 8px!important;border:1px solid rgba(218,203,164,.16)!important;border-radius:999px!important;background:rgba(4,8,12,.30)!important;color:rgba(224,218,196,.62)!important;backdrop-filter:blur(6px);box-shadow:0 4px 18px rgba(0,0,0,.18)!important;opacity:.6!important}
      .aestra-music-floating:hover,.aestra-music-floating:focus-visible{opacity:1!important;color:#efe2bb!important;border-color:rgba(218,203,164,.34)!important;background:rgba(7,12,17,.58)!important}
      .aestra-music-floating .aestra-music-label{font-size:.47rem;letter-spacing:.08em;text-transform:uppercase}
      @media(max-width:600px){.aestra-music-floating{top:max(48px,calc(env(safe-area-inset-top) + 46px))!important;right:max(12px,env(safe-area-inset-right))!important}.aestra-music-floating .aestra-music-label{display:none}}
    `;
    document.head.appendChild(s);
  }

  function prepareAudio(cacheBust=false){
    const a=ensureAudio();
    const url=publicUrl(cacheBust);
    if(url&&(!a.src||cacheBust)){
      a.src=url;
      try{a.load()}catch{}
    }
    return a;
  }

  function ensureAudio(){
    if(audio)return audio;
    audio=document.createElement('audio');
    audio.id='aestraAmbientAudio';
    audio.loop=true;
    // Preload the actual audio so the login tap can start it immediately.
    audio.preload='auto';
    audio.volume=BASE_VOLUME;
    audio.muted=muted();
    audio.setAttribute('playsinline','');
    audio.addEventListener('error',()=>{if(!hasTrack)renderButton()});
    document.body.appendChild(audio);
    return audio;
  }

  async function toggleMusic(){
    userInteracted=true;
    if(!hasTrack&&isGM){fileInput?.click();return}
    if(!hasTrack)return;
    const next=!muted();
    setMuted(next);
    if(!next)await tryPlay();
  }

  function installControl(){
    styles();
    if(!button){
      const top=document.querySelector('.top-actions');
      if(top){
        button=document.createElement('button');
        button.id='aestraMusicToggle';
        button.type='button';
        button.className='ghost aestra-music-toggle hidden';
        button.addEventListener('click',toggleMusic);
        const replay=$('aestraReplayOpening');
        const logout=$('logoutBtn');
        if(replay&&replay.parentElement===top)top.insertBefore(button,replay);
        else if(logout&&logout.parentElement===top)top.insertBefore(button,logout);
        else top.appendChild(button);
      }
    }

    if(!floatingButton){
      floatingButton=document.createElement('button');
      floatingButton.id='aestraMusicFloatingToggle';
      floatingButton.type='button';
      floatingButton.className='ghost aestra-music-toggle aestra-music-floating hidden';
      floatingButton.addEventListener('click',toggleMusic);
      document.body.appendChild(floatingButton);
    }

    if(!fileInput){
      fileInput=document.createElement('input');
      fileInput.type='file';
      fileInput.accept='audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav';
      fileInput.hidden=true;
      fileInput.addEventListener('change',uploadTrack);
      document.body.appendChild(fileInput);
    }
    renderButton();
  }

  function cinematicActive(){
    const o=$('aestraOpeningCinematic');
    return !!o&&(o.classList.contains('show')||o.classList.contains('closing')||o.classList.contains('skipping'));
  }
  function creatorActive(){
    const c=$('characterCreatorV2');
    return !!c&&!c.classList.contains('hidden');
  }

  function buttonMarkup(){
    return `<span class="aestra-music-symbol">♫</span><span class="aestra-music-label">${muted()?'Off':'On'}</span>`;
  }
  function applyButtonState(b){
    if(!b)return;
    b.classList.toggle('muted',muted());
    b.innerHTML=buttonMarkup();
    b.title=muted()?'Turn background music on':'Mute background music';
    b.setAttribute('aria-label',muted()?'Turn background music on':'Mute background music');
    b.setAttribute('aria-pressed',muted()?'true':'false');
  }

  function renderButton(){
    // The normal control belongs to the logged-in tracker header.
    if(button){
      const appVisible=!$('appView')?.classList.contains('hidden');
      button.classList.toggle('hidden',!appVisible||(!hasTrack&&!isGM));
      button.classList.toggle('muted',muted());
      if(!hasTrack&&isGM){
        button.innerHTML='<span class="aestra-music-symbol">♫</span>Add Track';
        button.title='Upload the campaign background soundtrack';
        button.setAttribute('aria-label','Upload campaign background music');
      }else applyButtonState(button);
    }

    // During the dream and first-time creation the tracker header may be hidden
    // or covered, so expose a tiny unobtrusive mute control above those layers.
    if(floatingButton){
      const showFloating=hasTrack&&(cinematicActive()||creatorActive());
      floatingButton.classList.toggle('hidden',!showFloating);
      applyButtonState(floatingButton);
    }
  }

  async function tryPlay(){
    if(muted()||document.hidden)return;
    const a=prepareAudio();
    try{await a.play()}catch{}
  }

  // Called directly inside pointer/key events. It intentionally does NOT wait
  // for the asynchronous HEAD check: delaying play until after that check can
  // lose the browser's short user-activation window. Calling play() here lets
  // the login click/tap unlock audio for the opening cinematic.
  function playFromGesture(e){
    if(e?.target?.closest?.('#aestraMusicToggle,#aestraMusicFloatingToggle'))return;
    userInteracted=true;
    if(muted()||document.hidden)return;
    const a=prepareAudio();
    try{
      const p=a.play();
      if(p?.catch)p.catch(()=>{});
    }catch{}
  }

  async function detectTrack(){
    const url=publicUrl();
    if(!url)return false;
    // Prepare the source before the first login interaction occurs.
    prepareAudio();
    try{
      const r=await fetch(url,{method:'HEAD',cache:'no-store'});
      hasTrack=r.ok;
    }catch{hasTrack=false}
    renderButton();
    if(hasTrack&&userInteracted)tryPlay();
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
      const a=prepareAudio(true);
      a.pause();
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

  function observeSpecialScreens(){
    const observed=new WeakSet();
    const sync=()=>{
      const active=cinematicActive();
      fadeTo(active?CINEMATIC_VOLUME:BASE_VOLUME,active?1200:1500);
      renderButton();
      // If autoplay is already permitted (installed PWA/media engagement/etc.),
      // start even when the screen opened without a fresh click.
      if((active||creatorActive())&&!muted())tryPlay();
    };
    const attach=()=>{
      for(const id of ['aestraOpeningCinematic','characterCreatorV2']){
        const el=$(id);
        if(!el||observed.has(el))continue;
        observed.add(el);
        new MutationObserver(sync).observe(el,{attributes:true,attributeFilter:['class']});
      }
      sync();
    };
    new MutationObserver(attach).observe(document.body,{childList:true,subtree:false});
    attach();
  }

  function bindFirstInteraction(){
    document.addEventListener('pointerdown',playFromGesture,{capture:true,passive:true});
    document.addEventListener('keydown',playFromGesture,{capture:true});
    // click is a useful fallback for older keyboard/touch implementations.
    document.addEventListener('click',e=>{if(!userInteracted)playFromGesture(e)},{capture:true});
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
    styles();
    ensureAudio();
    // Set the public source immediately, before auth/onboarding transitions.
    prepareAudio();
    installControl();
    bindFirstInteraction();
    observeSpecialScreens();
    await Promise.all([detectGM(),detectTrack()]);
    // Try regardless of interaction; browsers that already permit autoplay can
    // begin immediately, while blocked browsers will be unlocked by the next tap.
    if(hasTrack)tryPlay();
  }

  boot();
  window.AESTRA_MUSIC={
    play:tryPlay,
    mute:()=>setMuted(true),
    unmute:()=>{setMuted(false);return tryPlay()},
    isMuted:muted
  };
})();
