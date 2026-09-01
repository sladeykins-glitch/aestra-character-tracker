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

      .aestra-opening{position:fixed;inset:0;z-index:70000;display:grid;place-items:center;overflow:hidden;pointer-events:none;visibility:hidden;background:
        radial-gradient(ellipse at 50% 88%,rgba(38,68,82,.18) 0%,rgba(11,24,32,.08) 30%,transparent 58%),
        linear-gradient(180deg,#020406 0%,#04080c 48%,#071017 74%,#050a0e 100%);
        opacity:0;transition:opacity .8s ease,visibility 0s linear .8s}
      .aestra-opening.show{opacity:1;visibility:visible;pointer-events:auto;transition:opacity .8s ease}
      .aestra-opening.closing{opacity:0;pointer-events:auto;visibility:visible;transition:opacity .75s ease}

      .aestra-water-horizon{position:absolute;left:-10%;right:-10%;top:57%;height:1px;background:linear-gradient(90deg,transparent,rgba(163,194,207,.08) 28%,rgba(205,218,220,.13) 50%,rgba(163,194,207,.08) 72%,transparent);filter:blur(.15px);opacity:.72}
      .aestra-water-glow{position:absolute;left:50%;top:57%;width:min(70vw,760px);height:30vh;transform:translateX(-50%);background:radial-gradient(ellipse at 50% 0%,rgba(171,202,215,.08),rgba(90,132,150,.025) 28%,transparent 67%);filter:blur(16px);opacity:.72;pointer-events:none}
      .aestra-water-sheen{position:absolute;left:50%;top:58%;width:min(82vw,980px);height:34vh;transform:translateX(-50%) perspective(420px) rotateX(70deg);transform-origin:top center;background:repeating-linear-gradient(180deg,rgba(179,207,218,.035) 0 1px,transparent 1px 17px);mask-image:linear-gradient(to bottom,rgba(0,0,0,.75),transparent 86%);opacity:.42;animation:aestraSheen 12s ease-in-out infinite;pointer-events:none}
      .aestra-mist{position:absolute;left:-25%;width:150%;height:24vh;border-radius:50%;filter:blur(34px);opacity:.08;pointer-events:none;background:radial-gradient(ellipse,rgba(176,198,204,.75),rgba(80,108,117,.22) 42%,transparent 70%)}
      .aestra-mist.one{top:25%;animation:aestraMistOne 18s ease-in-out infinite alternate}
      .aestra-mist.two{top:64%;opacity:.055;animation:aestraMistTwo 22s ease-in-out infinite alternate-reverse}
      .aestra-motes{position:absolute;inset:0;pointer-events:none;opacity:.13;background-image:
        radial-gradient(circle at 18% 31%,rgba(226,232,229,.8) 0 .7px,transparent .9px),
        radial-gradient(circle at 73% 23%,rgba(226,232,229,.7) 0 .6px,transparent .8px),
        radial-gradient(circle at 82% 67%,rgba(202,218,222,.65) 0 .7px,transparent .9px),
        radial-gradient(circle at 31% 75%,rgba(202,218,222,.55) 0 .65px,transparent .85px),
        radial-gradient(circle at 57% 38%,rgba(226,232,229,.5) 0 .55px,transparent .75px);
        animation:aestraMotes 16s ease-in-out infinite alternate}

      .aestra-dream-stage{position:relative;z-index:2;width:min(900px,92vw);height:min(520px,72vh);display:grid;place-items:center;text-align:center}
      .aestra-dream-line{position:absolute;max-width:min(760px,88vw);padding:18px 22px;margin:0;color:rgba(237,239,233,.94);font:400 clamp(1.22rem,3vw,2.3rem)/1.42 Georgia,'Times New Roman',serif;letter-spacing:.018em;text-shadow:0 0 22px rgba(177,207,218,.09),0 3px 22px rgba(0,0,0,.72);opacity:0;filter:blur(8px);transform:translateY(7px);transition:opacity .95s ease,filter 1.15s ease,transform 1.15s ease}
      .aestra-dream-line.show{opacity:1;filter:blur(0);transform:translateY(0)}
      .aestra-dream-line.disturb{animation:aestraTextBreath 1.4s ease-out}

      .aestra-ripple{position:absolute;left:50%;top:57%;width:44px;height:13px;border:1px solid rgba(181,209,220,.18);border-radius:50%;transform:translate(-50%,-50%) scale(.25);pointer-events:none;opacity:0;animation:aestraRipple 3.1s cubic-bezier(.12,.58,.2,1) forwards}
      .aestra-ripple.secondary{display:none}

      .aestra-awaken-wrap{position:absolute;left:50%;top:66%;transform:translate(-50%,12px);display:grid;place-items:center;gap:10px;opacity:0;transition:opacity 1s ease,transform 1s ease;pointer-events:none}
      .aestra-awaken-wrap.show{opacity:1;transform:translate(-50%,0);pointer-events:auto}
      .aestra-awaken{min-width:138px!important;min-height:44px!important;padding:9px 22px!important;border-radius:999px!important;border:1px solid rgba(215,218,204,.22)!important;background:rgba(8,13,17,.22)!important;color:rgba(237,235,218,.9)!important;font:600 .76rem Georgia,serif!important;letter-spacing:.17em!important;text-transform:uppercase!important;box-shadow:0 0 0 1px rgba(160,188,199,.025),0 0 28px rgba(157,191,204,.035)!important;backdrop-filter:blur(3px);transition:border-color .25s,color .25s,background .25s,box-shadow .25s!important}
      .aestra-awaken:hover,.aestra-awaken:focus-visible{border-color:rgba(226,220,184,.48)!important;color:#f0e7c9!important;background:rgba(18,25,29,.38)!important;box-shadow:0 0 32px rgba(190,206,201,.08)!important}
      .aestra-awaken-note{font-size:.5rem;letter-spacing:.16em;text-transform:uppercase;color:rgba(203,211,211,.32)}
      .aestra-opening-skip{position:absolute;z-index:4;right:max(18px,env(safe-area-inset-right));top:max(16px,env(safe-area-inset-top));border:0!important;background:transparent!important;color:rgba(216,220,216,.32)!important;font-size:.56rem!important;letter-spacing:.12em!important;text-transform:uppercase!important;padding:8px!important;min-height:0!important}
      .aestra-opening-skip:hover,.aestra-opening-skip:focus-visible{color:rgba(235,231,216,.82)!important}
      .aestra-opening-mark{position:absolute;z-index:3;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);font-size:.44rem;letter-spacing:.23em;text-transform:uppercase;color:rgba(159,179,185,.18);white-space:nowrap}

      @keyframes aestraRipple{0%{opacity:0;transform:translate(-50%,-50%) scale(.25)}14%{opacity:.45}55%{opacity:.17}100%{opacity:0;transform:translate(-50%,-50%) scale(18,8)}}
      @keyframes aestraTextBreath{0%,100%{letter-spacing:.018em;filter:blur(0)}45%{letter-spacing:.024em;filter:blur(.18px)}}
      @keyframes aestraSheen{0%,100%{opacity:.32;transform:translateX(-50%) perspective(420px) rotateX(70deg) translateY(0)}50%{opacity:.47;transform:translateX(-50%) perspective(420px) rotateX(70deg) translateY(5px)}}
      @keyframes aestraMistOne{from{transform:translate3d(-3%,0,0) scaleX(1)}to{transform:translate3d(4%,2%,0) scaleX(1.06)}}
      @keyframes aestraMistTwo{from{transform:translate3d(3%,0,0) scaleX(1.05)}to{transform:translate3d(-4%,-1%,0) scaleX(.98)}}
      @keyframes aestraMotes{from{transform:translateY(0);opacity:.09}to{transform:translateY(-7px);opacity:.15}}

      @media(max-width:600px){.aestra-dream-stage{height:66vh}.aestra-dream-line{font-size:clamp(1.14rem,6.6vw,1.72rem);padding:16px}.aestra-awaken-wrap{top:70%}.aestra-opening-mark{font-size:.4rem;letter-spacing:.18em}.aestra-water-horizon,.aestra-ripple{top:59%}.aestra-water-glow,.aestra-water-sheen{top:59%}}
      @media(prefers-reduced-motion:reduce){.aestra-water-sheen,.aestra-mist,.aestra-motes{animation:none!important}.aestra-ripple{animation-duration:.8s!important}.aestra-dream-line{transition-duration:.22s!important;filter:none!important}.aestra-dream-line.disturb{animation:none!important}}
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
    overlay.innerHTML=`<div class="aestra-water-horizon"></div><div class="aestra-water-glow"></div><div class="aestra-water-sheen"></div><div class="aestra-mist one"></div><div class="aestra-mist two"></div><div class="aestra-motes"></div><button type="button" class="aestra-opening-skip">Skip</button><div class="aestra-dream-stage"><p class="aestra-dream-line" aria-live="polite"></p><div class="aestra-awaken-wrap"><button type="button" class="aestra-awaken">Awaken</button><span class="aestra-awaken-note">The dream is ending</span></div></div><div class="aestra-opening-mark">Aestra · Age of Fading Light</div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.aestra-opening-skip').onclick=()=>revealFinal();
    overlay.querySelector('.aestra-awaken').onclick=finish;
    return overlay;
  }

  function spawnRipple(){
    const o=ensureOverlay();
    const r=document.createElement('span');
    r.className='aestra-ripple';
    o.querySelector('.aestra-dream-stage').appendChild(r);
    setTimeout(()=>r.remove(),3400);
    const line=o.querySelector('.aestra-dream-line');
    line.classList.remove('disturb');
    void line.offsetWidth;
    line.classList.add('disturb');
  }

  async function showLine(text,hold,token){
    if(token!==runToken)return false;
    const line=ensureOverlay().querySelector('.aestra-dream-line');
    line.classList.remove('show','disturb');
    await sleep(reducedMotion?35:320);
    if(token!==runToken)return false;
    line.textContent=text;
    line.classList.add('show');
    setTimeout(()=>{if(token===runToken)spawnRipple()},reducedMotion?40:420);
    await sleep(reducedMotion?450:hold);
    if(token!==runToken)return false;
    line.classList.remove('show');
    await sleep(reducedMotion?60:520);
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
    await sleep(reducedMotion?80:650);
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
    await sleep(reducedMotion?120:1050);
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
    },reducedMotion?100:760);
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