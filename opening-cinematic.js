// Aestra opening cinematic — first-login onboarding for players without a character.
(function(){
  if(window.__AESTRA_OPENING_CINEMATIC__)return;
  window.__AESTRA_OPENING_CINEMATIC__=true;

  const CONFIG=window.AESTRA_CONFIG||{};
  const autoShownFor=new Set();
  const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches===true;
  let sb=null,overlay=null,runToken=0,currentMode='replay';

  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const appVisible=()=>!document.getElementById('appView')?.classList.contains('hidden');

  async function client(){
    if(sb)return sb;
    if(!CONFIG.supabaseUrl||!CONFIG.supabaseAnonKey)throw new Error('Supabase is not configured.');
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    sb=mod.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
    return sb;
  }

  function styles(){
    if(document.getElementById('aestraOpeningStyles'))return;
    const s=document.createElement('style');
    s.id='aestraOpeningStyles';
    s.textContent=`
      body.aestra-cinematic-open{overflow:hidden!important}
      .aestra-opening-replay{font-size:.49rem!important;line-height:1!important;letter-spacing:.06em!important;text-transform:uppercase!important;min-height:24px!important;padding:4px 7px!important;opacity:.56;transition:opacity .18s,border-color .18s,color .18s}
      .aestra-opening-replay:hover,.aestra-opening-replay:focus-visible{opacity:1;color:#d9c48e!important;border-color:rgba(211,171,91,.38)!important}
      .top-actions{position:relative}
      @media(min-width:701px){.aestra-opening-replay{position:absolute!important;right:0;bottom:calc(100% + 3px);white-space:nowrap}}
      @media(max-width:700px){.aestra-opening-replay{opacity:.7}}

      .aestra-opening{position:fixed;inset:0;z-index:70000;display:grid;place-items:center;overflow:hidden;background:
        radial-gradient(circle at 28% 18%,rgba(116,163,190,.12),transparent 24%),
        radial-gradient(circle at 72% 22%,rgba(195,211,218,.08),transparent 18%),
        radial-gradient(ellipse at 50% 82%,rgba(32,72,91,.26),transparent 42%),
        linear-gradient(180deg,#020509 0%,#050a10 46%,#071019 100%);
        opacity:0;transition:opacity .65s ease}
      .aestra-opening.show{opacity:1}
      .aestra-opening::before{content:"";position:absolute;inset:-20%;background:
        repeating-radial-gradient(ellipse at 50% 105%,transparent 0 34px,rgba(117,171,196,.025) 35px 36px,transparent 37px 68px);
        transform:scaleY(.38);filter:blur(.3px);animation:aestraWaterDrift 14s linear infinite;opacity:.75}
      .aestra-opening::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 0 47%,rgba(111,169,197,.035) 50%,transparent 53%);mix-blend-mode:screen;animation:aestraWaterBand 7s ease-in-out infinite}
      .aestra-dream-stars{position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(circle,rgba(211,225,232,.32) 0 1px,transparent 1.3px);background-size:91px 83px;opacity:.16;mask-image:linear-gradient(to bottom,#000,transparent 72%)}
      .aestra-dream-stage{position:relative;z-index:2;width:min(900px,90vw);height:min(520px,72vh);display:grid;place-items:center;text-align:center;perspective:900px}
      .aestra-dream-line{position:absolute;max-width:min(780px,88vw);padding:18px 22px;margin:0;color:#e9e5d8;font:500 clamp(1.25rem,3.2vw,2.45rem)/1.35 Georgia,'Times New Roman',serif;letter-spacing:.025em;text-shadow:0 0 20px rgba(155,203,225,.16),0 4px 28px rgba(0,0,0,.75);opacity:0;filter:blur(11px);transform:translateY(11px) scale(.985) rotateX(4deg);transition:opacity .72s ease,filter .9s ease,transform 1s cubic-bezier(.2,.7,.2,1)}
      .aestra-dream-line.show{opacity:1;filter:blur(0);transform:translateY(0) scale(1) rotateX(0)}
      .aestra-dream-line.disturb{animation:aestraTextRipple 1.15s ease-out}
      .aestra-ripple{position:absolute;left:50%;top:50%;width:24px;height:10px;border:1px solid rgba(161,207,228,.34);border-radius:50%;transform:translate(-50%,-50%) scale(.2);box-shadow:0 0 18px rgba(99,172,207,.12);pointer-events:none;opacity:0;animation:aestraRipple 2.5s ease-out forwards}
      .aestra-ripple.secondary{animation-delay:.18s;border-color:rgba(211,197,151,.2)}
      .aestra-awaken-wrap{position:absolute;left:50%;top:64%;transform:translate(-50%,20px);display:grid;place-items:center;gap:9px;opacity:0;transition:opacity .8s ease,transform .8s ease;pointer-events:none}
      .aestra-awaken-wrap.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
      .aestra-awaken{min-width:152px!important;min-height:48px!important;padding:10px 24px!important;border-radius:999px!important;border:1px solid rgba(210,189,129,.52)!important;background:radial-gradient(circle at 50% 20%,rgba(230,204,133,.22),rgba(75,61,39,.12))!important;color:#ead9a7!important;font:700 .82rem Georgia,serif!important;letter-spacing:.14em!important;text-transform:uppercase!important;box-shadow:0 0 34px rgba(182,157,93,.08)!important;animation:aestraAwakenPulse 3.4s ease-in-out infinite}
      .aestra-awaken-note{font-size:.55rem;letter-spacing:.14em;text-transform:uppercase;color:rgba(203,211,211,.45)}
      .aestra-opening-skip{position:absolute;z-index:4;right:max(18px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top));border:0!important;background:transparent!important;color:rgba(216,220,216,.42)!important;font-size:.58rem!important;letter-spacing:.1em!important;text-transform:uppercase!important;padding:8px!important;min-height:0!important}
      .aestra-opening-skip:hover,.aestra-opening-skip:focus-visible{color:rgba(235,231,216,.9)!important}
      .aestra-opening-mark{position:absolute;z-index:3;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);font-size:.49rem;letter-spacing:.24em;text-transform:uppercase;color:rgba(141,181,198,.28);white-space:nowrap}
      .aestra-opening.closing{opacity:0;transition-duration:.7s}
      @keyframes aestraRipple{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}12%{opacity:.8}100%{opacity:0;transform:translate(-50%,-50%) scale(28,16)}}
      @keyframes aestraTextRipple{0%,100%{transform:translateY(0) skewX(0);filter:blur(0)}28%{transform:translateY(1px) skewX(-.7deg);filter:blur(.35px)}55%{transform:translateY(-1px) skewX(.45deg);filter:blur(.15px)}}
      @keyframes aestraWaterDrift{from{transform:translate3d(-2%,0,0) scaleY(.38)}50%{transform:translate3d(2%,1%,0) scaleY(.4)}to{transform:translate3d(-2%,0,0) scaleY(.38)}}
      @keyframes aestraWaterBand{0%,100%{transform:translateY(-18vh);opacity:.2}50%{transform:translateY(18vh);opacity:.65}}
      @keyframes aestraAwakenPulse{0%,100%{box-shadow:0 0 25px rgba(184,159,95,.08)}50%{box-shadow:0 0 46px rgba(184,159,95,.18)}}
      @media(max-width:600px){.aestra-dream-stage{height:66vh}.aestra-dream-line{font-size:clamp(1.18rem,7vw,1.8rem);padding:16px}.aestra-awaken-wrap{top:68%}.aestra-opening-mark{font-size:.42rem;letter-spacing:.18em}}
      @media(prefers-reduced-motion:reduce){.aestra-opening::before,.aestra-opening::after,.aestra-awaken{animation:none!important}.aestra-ripple{animation-duration:.7s!important}.aestra-dream-line{transition-duration:.18s!important;filter:none!important}.aestra-dream-line.disturb{animation:none!important}}
    `;
    document.head.appendChild(s);
  }

  function installReplayButton(){
    const top=document.querySelector('.top-actions');
    const logout=document.getElementById('logoutBtn');
    if(!top||document.getElementById('aestraReplayOpening'))return;
    const b=document.createElement('button');
    b.id='aestraReplayOpening';
    b.type='button';
    b.className='ghost aestra-opening-replay hidden';
    b.textContent='↻ Opening';
    b.title='Replay the Aestra opening cinematic';
    b.setAttribute('aria-label','Replay opening cinematic');
    b.onclick=()=>play({createAfter:false});
    if(logout&&logout.parentElement===top)top.insertBefore(b,logout);else top.appendChild(b);
    syncReplayButton();
  }

  function syncReplayButton(){
    const b=document.getElementById('aestraReplayOpening');
    if(b)b.classList.toggle('hidden',!appVisible());
  }

  function ensureOverlay(){
    if(overlay)return overlay;
    overlay=document.createElement('div');
    overlay.id='aestraOpeningCinematic';
    overlay.className='aestra-opening';
    overlay.setAttribute('role','dialog');
    overlay.setAttribute('aria-modal','true');
    overlay.setAttribute('aria-label','Aestra opening cinematic');
    overlay.innerHTML=`<div class="aestra-dream-stars"></div><button type="button" class="aestra-opening-skip">Skip</button><div class="aestra-dream-stage"><p class="aestra-dream-line" aria-live="polite"></p><div class="aestra-awaken-wrap"><button type="button" class="aestra-awaken">Awaken</button><span class="aestra-awaken-note">The dream is ending</span></div></div><div class="aestra-opening-mark">Aestra · Age of Fading Light</div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.aestra-opening-skip').onclick=()=>revealFinal();
    overlay.querySelector('.aestra-awaken').onclick=finish;
    return overlay;
  }

  function spawnRipple(){
    const o=ensureOverlay();
    for(const secondary of [false,true]){
      const r=document.createElement('span');
      r.className=`aestra-ripple${secondary?' secondary':''}`;
      o.querySelector('.aestra-dream-stage').appendChild(r);
      setTimeout(()=>r.remove(),3000);
    }
    const line=o.querySelector('.aestra-dream-line');
    line.classList.remove('disturb');
    void line.offsetWidth;
    line.classList.add('disturb');
  }

  async function showLine(text,hold,token){
    if(token!==runToken)return false;
    const line=ensureOverlay().querySelector('.aestra-dream-line');
    line.classList.remove('show','disturb');
    await sleep(reducedMotion?35:240);
    if(token!==runToken)return false;
    line.textContent=text;
    line.classList.add('show');
    setTimeout(()=>{if(token===runToken)spawnRipple()},reducedMotion?40:260);
    await sleep(reducedMotion?450:hold);
    if(token!==runToken)return false;
    line.classList.remove('show');
    await sleep(reducedMotion?60:420);
    return token===runToken;
  }

  async function play({createAfter=false}={}){
    styles();installReplayButton();
    currentMode=createAfter?'first':'replay';
    const token=++runToken;
    const o=ensureOverlay();
    o.classList.remove('closing');
    o.querySelector('.aestra-awaken-wrap').classList.remove('show');
    o.querySelector('.aestra-dream-line').classList.remove('show');
    o.querySelector('.aestra-opening-skip').textContent='Skip';
    document.body.classList.add('aestra-cinematic-open');
    requestAnimationFrame(()=>o.classList.add('show'));
    await sleep(reducedMotion?80:520);
    const sequence=[
      ['Somewhere, you are dreaming.',1450],
      ['You do not yet remember your name.',1500],
      ['You do not remember where you came from.',1550],
      ['But the world remembers you.',1550],
      ['It has been waiting.',1450]
    ];
    for(const [text,hold] of sequence){
      if(!(await showLine(text,hold,token)))return;
    }
    if(token!==runToken)return;
    await finalLine(token);
  }

  async function finalLine(token){
    if(token!==runToken)return;
    const o=ensureOverlay(),line=o.querySelector('.aestra-dream-line');
    line.textContent='Who will you become?';
    line.classList.add('show');
    spawnRipple();
    await sleep(reducedMotion?120:900);
    if(token!==runToken)return;
    o.querySelector('.aestra-awaken-wrap').classList.add('show');
    o.querySelector('.aestra-awaken').focus({preventScroll:true});
  }

  function revealFinal(){
    const token=++runToken;
    finalLine(token);
  }

  function openCreator(){
    let attempts=0;
    const tryOpen=()=>{
      const b=document.getElementById('characterCreatorBtn');
      if(b){b.click();return}
      if(++attempts<25)setTimeout(tryOpen,100);
    };
    tryOpen();
  }

  function finish(){
    ++runToken;
    const shouldCreate=currentMode==='first';
    const o=ensureOverlay();
    o.classList.add('closing');
    setTimeout(()=>{
      o.classList.remove('show','closing');
      o.querySelector('.aestra-awaken-wrap').classList.remove('show');
      o.querySelector('.aestra-dream-line').classList.remove('show');
      document.body.classList.remove('aestra-cinematic-open');
      if(shouldCreate)openCreator();
    },reducedMotion?100:700);
  }

  async function maybeAutoStart(){
    syncReplayButton();
    if(!appVisible()||!CONFIG.campaignId)return;
    try{
      const c=await client();
      const {data:{session}}=await c.auth.getSession();
      const user=session?.user;
      if(!user||autoShownFor.has(user.id))return;
      autoShownFor.add(user.id);
      const [profile,char]=await Promise.all([
        c.from('profiles').select('is_gm').eq('id',user.id).maybeSingle(),
        c.from('characters').select('id').eq('owner_id',user.id).eq('campaign_id',CONFIG.campaignId).limit(1)
      ]);
      if(profile.error||char.error){console.warn('Opening cinematic account check failed',profile.error||char.error);return}
      if(profile.data?.is_gm===true)return;
      if(!(char.data||[]).length)play({createAfter:true});
    }catch(e){console.warn('Opening cinematic could not check first-login state',e)}
  }

  function observeApp(){
    const app=document.getElementById('appView');
    if(!app)return;
    const observer=new MutationObserver(()=>{
      syncReplayButton();
      if(appVisible())setTimeout(maybeAutoStart,120);
    });
    observer.observe(app,{attributes:true,attributeFilter:['class']});
    if(appVisible())setTimeout(maybeAutoStart,120);
  }

  document.addEventListener('keydown',e=>{
    if(e.key!=='Escape'||!overlay?.classList.contains('show'))return;
    e.preventDefault();
    if(currentMode==='first')revealFinal();else finish();
  });

  styles();
  installReplayButton();
  observeApp();
  window.AESTRA_OPENING={play:()=>play({createAfter:false})};
})();
