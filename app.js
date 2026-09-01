const __aestraBootStarted=performance.now();

// Keep the existing execution order, but let the browser fetch the files in
// parallel up-front. This removes the long network waterfall without changing
// which enhancement layer wins when several layers touch the same UI.
const AESTRA_MAIN_LAYERS=[
  './ambient-music.js?v=5','./app-core.js?v=1','./gm-structured.js?v=1','./enhancements.js?v=2','./status-fix.js?v=2',
  './core-library.js?v=6','./high-fantasy-library.js?v=2','./rules-aware.js?v=4','./aestra-visuals.js?v=2',
  './aestra-theme.js?v=1','./aestra-title-v2.js?v=2','./resource-glow.js?v=1','./compact-attributes.js?v=2',
  './compact-ip.js?v=1','./build-menu.js?v=3','./build-remove-force.js?v=2','./ui-icons.js?v=2',
  './remove-controls.js?v=3','./skill-levels.js?v=2','./class-mastery.js?v=1','./picker-icons.js?v=2',
  './build-entry-icons.js?v=2','./point-orbs.js?v=3','./sheet-polish.js?v=1','./conditions-collapse.js?v=3',
  './combat-ui-polish.js?v=1','./save-orb.js?v=1','./rules-orb.js?v=3','./grand-ui.js?v=1',
  './mobile-pages.js?v=1','./status-label-polish.js?v=1','./portrait-upload.js?v=1','./mobile-character-polish.js?v=1',
  './final-experience.js?v=1','./final-fixes.js?v=2','./final-refinement.js?v=2','./performance-lite.js?v=2',
  './equipment-workbench.js?v=2','./equipment-purchase.js?v=1','./custom-weapons-v2.js?v=1','./trait-source-of-truth.js?v=1',
  './session-tools.js?v=1','./character-ux-suite.js?v=1','./automatic-resources.js?v=4','./actions-v2.js?v=3',
  './chanter-tools-v2.js?v=1','./commander-tools.js?v=1','./dancer-tools.js?v=1','./symbolist-tools-v2.js?v=1',
  './floralist-tools-v2.js?v=1','./floralist-petal-spacing-fix.js?v=1','./gourmet-tools.js?v=1','./invoker-tools.js?v=1',
  './invoker-benefit-choice.js?v=1','./merchant-tools.js?v=1','./gm-magiseed-library.js?v=1','./build-hierarchy.js?v=1',
  './unified-build-picker.js?v=2','./natural-fantasy-picker.js?v=1','./natural-heroic-picker-v2.js?v=1','./natural-heroic-tools-v2.js?v=1',
  './build-picker-normalize.js?v=2','./level-up-v2.js?v=1','./core-library-readability.js?v=2','./smart-rules.js?v=1',
  './gm-session-dashboard.js?v=1','./equipment-selling-v2.js?v=1','./system-defaults.js?v=1','./gm-session-v2.js?v=1',
  './bonds-v2.js?v=3','./character-creation.js?v=1','./character-creation-fix.js?v=1','./character-creation-polish.js?v=1',
  './character-creation-progress-fix.js?v=1'
];

// These are loaded by techno-bootstrap/completion-sweep after the legacy chain.
// Preloading them now means those follow-up loaders normally find warm modules.
const AESTRA_FOLLOWUP_LAYERS=[
  './rules-aware.js?v=5','./automatic-resources.js?v=5','./techno-custom-weapons.js?v=1','./esper-tools.js?v=1',
  './mutant-tools.js?v=1','./pilot-tools.js?v=1','./techno-fantasy-picker.js?v=2','./techno-heroic-picker.js?v=1',
  './completion-sweep.js?v=5','./campaign-settings.js?v=2','./rules-compendium-v2.js?v=1','./character-creation-v2.js?v=1',
  './aestra-session-suite.js?v=1','./build122-stabilization.js?v=1','./hero-console-v2.js?v=1','./compact-header.js?v=2',
  './pwa-register.js?v=6'
];

(function preloadAestraModules(){
  const seen=new Set();
  for(const path of [...AESTRA_MAIN_LAYERS,...AESTRA_FOLLOWUP_LAYERS]){
    const href=new URL(path,import.meta.url).href;
    if(seen.has(href))continue;
    seen.add(href);
    const link=document.createElement('link');
    link.rel='modulepreload';
    link.href=href;
    document.head.appendChild(link);
  }
})();

(function installAestraBootScreen(){
  document.documentElement.classList.add('aestra-booting');
  const style=document.createElement('style');
  style.id='aestraBootStyles';
  style.textContent=`
    html.aestra-booting,html.aestra-booting body{overflow:hidden!important;background:#05070b!important}
    html.aestra-booting body>.app-shell{opacity:0!important;visibility:hidden!important;pointer-events:none!important}
    #aestraBoot{position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;box-sizing:border-box;padding:max(18px,env(safe-area-inset-top)) max(18px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(18px,env(safe-area-inset-left));overflow:hidden;background:radial-gradient(circle at 50% 42%,rgba(85,166,215,.12),transparent 26%),radial-gradient(circle at 50% 48%,rgba(214,174,88,.08),transparent 43%),linear-gradient(155deg,#05070b 0%,#080a0f 48%,#0b080d 100%);color:#eee1bd;opacity:1;transition:opacity .32s ease,visibility .32s ease}
    #aestraBoot:before{content:'';position:absolute;inset:-20%;background:linear-gradient(115deg,transparent 45%,rgba(107,192,235,.035) 49.5%,rgba(107,192,235,.08) 50%,rgba(107,192,235,.035) 50.5%,transparent 55%),linear-gradient(25deg,transparent 46%,rgba(215,178,93,.025) 49.8%,rgba(215,178,93,.06) 50%,transparent 54%);animation:aestraVeil 8s linear infinite;pointer-events:none}
    #aestraBoot.ready{opacity:0;visibility:hidden;pointer-events:none}
    .ab-wrap{position:relative;width:min(460px,100%);display:grid;justify-items:center;text-align:center;gap:16px;margin:0 auto;transform:translateY(-1.5vh);isolation:isolate}
    .ab-halo{position:absolute;left:50%;top:14px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,rgba(95,187,236,.12),rgba(92,152,203,.04) 43%,transparent 70%);filter:blur(4px);transform:translateX(-50%);animation:abHalo 2.8s ease-in-out infinite;z-index:-1}
    .ab-crystal{position:relative;width:92px;height:126px;margin-inline:auto;filter:drop-shadow(0 0 16px rgba(97,195,240,.33)) drop-shadow(0 0 38px rgba(211,171,91,.13));animation:abFloat 2.7s ease-in-out infinite}
    .ab-crystal .facet{position:absolute;inset:0;clip-path:polygon(50% 0,84% 28%,72% 78%,50% 100%,28% 78%,16% 28%);background:linear-gradient(128deg,rgba(224,193,118,.82) 0 16%,rgba(106,192,231,.78) 36%,rgba(35,80,115,.65) 61%,rgba(183,139,78,.7) 100%);border:1px solid rgba(231,211,159,.42)}
    .ab-crystal .facet:before,.ab-crystal .facet:after{content:'';position:absolute;inset:0;clip-path:polygon(50% 0,50% 100%,16% 28%);background:linear-gradient(145deg,rgba(255,240,191,.35),rgba(37,111,152,.09) 55%,rgba(0,0,0,.15))}
    .ab-crystal .facet:after{clip-path:polygon(50% 0,84% 28%,72% 78%,50% 100%);background:linear-gradient(205deg,rgba(125,214,255,.38),rgba(38,90,127,.08) 58%,rgba(222,171,83,.16))}
    .ab-crystal .core{position:absolute;left:50%;top:49%;width:16px;height:16px;transform:translate(-50%,-50%) rotate(45deg);border:1px solid rgba(255,232,168,.8);background:rgba(229,188,95,.5);box-shadow:0 0 14px rgba(240,196,99,.72),0 0 32px rgba(92,191,239,.34);animation:abCore 1.65s ease-in-out infinite}
    .ab-shards{position:absolute;left:50%;top:-23px;width:170px;height:170px;transform:translateX(-50%);pointer-events:none;animation:abSpin 14s linear infinite}
    .ab-shards i{position:absolute;left:50%;top:50%;width:7px;height:14px;clip-path:polygon(50% 0,100% 100%,0 72%);background:linear-gradient(#d8b365,#5cb5df);opacity:.42;transform-origin:0 0}
    .ab-shards i:nth-child(1){transform:rotate(12deg) translateY(-79px) scale(.8)}.ab-shards i:nth-child(2){transform:rotate(72deg) translateY(-73px) scale(.52)}.ab-shards i:nth-child(3){transform:rotate(131deg) translateY(-82px) scale(.72)}.ab-shards i:nth-child(4){transform:rotate(204deg) translateY(-76px) scale(.48)}.ab-shards i:nth-child(5){transform:rotate(267deg) translateY(-82px) scale(.64)}.ab-shards i:nth-child(6){transform:rotate(327deg) translateY(-71px) scale(.46)}
    .ab-kicker{margin-top:2px;font:600 .62rem/1.2 Georgia,serif;letter-spacing:.32em;color:#c8a65c;text-transform:uppercase;opacity:.78}.ab-title{margin:0;font:700 clamp(1.8rem,7vw,3rem)/.95 Georgia,'Times New Roman',serif;letter-spacing:.055em;color:#f2e5c4}.ab-rule{width:min(260px,70vw);height:1px;background:linear-gradient(90deg,transparent,rgba(211,171,91,.56),rgba(103,187,226,.58),rgba(211,171,91,.56),transparent);position:relative}.ab-rule:after{content:'✦';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);padding:0 9px;background:#07090d;color:#d7b260;font-size:.72rem}.ab-status{width:100%;min-height:1.3em;font-size:.72rem;letter-spacing:.13em;color:#a79c8a;text-transform:uppercase;transition:opacity .18s ease,transform .18s ease}.ab-status.swap{opacity:0;transform:translateY(4px)}.ab-progress{width:min(260px,70vw);height:3px;border-radius:999px;background:rgba(255,255,255,.045);overflow:hidden}.ab-progress span{display:block;height:100%;width:34%;border-radius:inherit;background:linear-gradient(90deg,rgba(211,171,91,.15),#d4ad5b,#70c1e7,rgba(211,171,91,.15));animation:abSweep 1.25s ease-in-out infinite}.ab-ready .ab-status{color:#d9bd78}
    @keyframes abFloat{0%,100%{transform:translateY(0) rotate(-.7deg)}50%{transform:translateY(-8px) rotate(.8deg)}}@keyframes abCore{0%,100%{opacity:.62;transform:translate(-50%,-50%) rotate(45deg) scale(.78)}50%{opacity:1;transform:translate(-50%,-50%) rotate(45deg) scale(1.15)}}@keyframes abHalo{0%,100%{opacity:.5;transform:translateX(-50%) scale(.9)}50%{opacity:1;transform:translateX(-50%) scale(1.08)}}@keyframes abSpin{from{transform:translateX(-50%) rotate(0)}to{transform:translateX(-50%) rotate(360deg)}}@keyframes abSweep{0%{transform:translateX(-120%)}55%,100%{transform:translateX(300%)}}@keyframes aestraVeil{to{transform:translate3d(7%,3%,0)}}
    @media(max-width:480px){.ab-wrap{gap:14px;transform:translateY(-1vh)}.ab-title{font-size:clamp(1.7rem,8vw,2.2rem);letter-spacing:.035em}.ab-kicker{letter-spacing:.26em}.ab-rule,.ab-progress{width:min(260px,78vw)}}
    @media(prefers-reduced-motion:reduce){#aestraBoot:before,.ab-crystal,.ab-halo,.ab-shards,.ab-core,.ab-progress span{animation:none!important}#aestraBoot{transition:opacity .1s ease}}
  `;
  document.head.appendChild(style);
  const boot=document.createElement('div');boot.id='aestraBoot';boot.setAttribute('role','status');boot.setAttribute('aria-live','polite');boot.innerHTML=`<div class="ab-wrap"><div class="ab-halo"></div><div class="ab-crystal"><div class="facet"></div><div class="core"></div><div class="ab-shards"><i></i><i></i><i></i><i></i><i></i><i></i></div></div><div class="ab-kicker">Fabula Ultima · Aestra</div><h1 class="ab-title">Character Tracker</h1><div class="ab-rule"></div><div class="ab-status" id="aestraBootStatus">Awakening the crystal…</div><div class="ab-progress"><span></span></div></div>`;
  document.body.prepend(boot);
  const phrases=['Awakening the crystal…','Reading character echoes…','Binding abilities…','Preparing the journey…'];let i=0;
  window.__aestraBootTimer=setInterval(()=>{const s=document.getElementById('aestraBootStatus');if(!s)return;s.classList.add('swap');setTimeout(()=>{i=(i+1)%phrases.length;s.textContent=phrases[i];s.classList.remove('swap')},150)},700);
})();

if(!document.getElementById('gmSaveBtn')){const legacy=document.createElement('button');legacy.id='gmSaveBtn';legacy.type='button';legacy.className='hidden';document.body.appendChild(legacy)}
if(!document.getElementById('gmMpOther')){const host=document.getElementById('gmMpCurrent')?.closest('.gm-resource-edit > div');if(host){const label=document.createElement('label');label.textContent='Other';const input=document.createElement('input');input.id='gmMpOther';input.type='number';label.appendChild(input);host.appendChild(label)}}

async function loadLayer(path){try{return await import(path)}catch(err){console.error(`Aestra layer failed: ${path}`,err);return null}}
for(const path of AESTRA_MAIN_LAYERS)await loadLayer(path);

(function finishAestraBoot(){
  // The old loader deliberately held the splash for at least 1.1 seconds even
  // when everything was already cached. Keep a tiny polish window only.
  const minMs=250,elapsed=performance.now()-__aestraBootStarted,wait=Math.max(0,minMs-elapsed);
  setTimeout(()=>{
    clearInterval(window.__aestraBootTimer);
    const boot=document.getElementById('aestraBoot'),status=document.getElementById('aestraBootStatus');
    if(status){status.classList.remove('swap');status.textContent='Crystal attuned · Ready';boot?.querySelector('.ab-wrap')?.classList.add('ab-ready')}
    setTimeout(()=>{document.documentElement.classList.remove('aestra-booting');if(boot){boot.classList.add('ready');setTimeout(()=>boot.remove(),360)}},80);
  },wait);
})();