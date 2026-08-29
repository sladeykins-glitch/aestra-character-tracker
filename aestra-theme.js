// Decorative Aestra theme layer. Pure presentation; does not alter character state or rules.
function makeCrystal(className=''){
  const c=document.createElement('span');
  c.className=`crystal-mark ${className}`.trim();
  c.innerHTML='<i></i><i></i><i></i>';
  return c;
}

function installHero(){
  if(document.getElementById('aestraHero')) return;
  const shell=document.querySelector('.app-shell');
  const topbar=document.querySelector('.topbar');
  if(!shell||!topbar) return;

  const hero=document.createElement('section');
  hero.id='aestraHero';
  hero.className='aestra-hero';
  hero.innerHTML=`
    <div class="hero-arc hero-arc-a"></div>
    <div class="hero-arc hero-arc-b"></div>
    <div class="hero-crystals hero-crystals-left"></div>
    <div class="hero-crystals hero-crystals-right"></div>
    <div class="aestra-emblem" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="aestra-wordmark">AESTRA</div>
    <div class="aestra-subtitle"><span></span><b>FABULA ULTIMA</b><span></span></div>
  `;
  shell.insertBefore(hero, topbar);
  topbar.classList.add('aestra-topbar');
}

function decoratePanels(){
  document.querySelectorAll('.panel').forEach((panel,index)=>{
    if(panel.dataset.crystalDecorated) return;
    panel.dataset.crystalDecorated='1';
    if(index%3===0){panel.appendChild(makeCrystal('panel-crystal'))}
  });
}

function installBackdrop(){
  if(document.getElementById('magicBackdrop')) return;
  const bg=document.createElement('div');
  bg.id='magicBackdrop';
  bg.className='magic-backdrop';
  bg.setAttribute('aria-hidden','true');
  for(let i=0;i<18;i++){
    const mote=document.createElement('i');
    mote.style.setProperty('--x',`${(i*37)%97}%`);
    mote.style.setProperty('--y',`${(i*53)%100}%`);
    mote.style.setProperty('--delay',`${-(i%11)*1.9}s`);
    mote.style.setProperty('--dur',`${15+(i%7)*3}s`);
    mote.style.setProperty('--size',`${1+(i%3)}px`);
    bg.appendChild(mote);
  }
  document.body.prepend(bg);
}

function installStyles(){
  if(document.getElementById('aestraThemeStyles')) return;
  const style=document.createElement('style');
  style.id='aestraThemeStyles';
  style.textContent=`
  :root{
    --aestra-gold:#d7ad63;
    --aestra-gold-soft:#8e6a36;
    --aestra-blue:#69a9d8;
    --aestra-violet:#9c70d1;
    --aestra-cyan:#7ee7ff;
  }
  html{background:#07080b}
  body{
    background:
      radial-gradient(circle at 50% -10%,rgba(70,46,95,.34),transparent 32rem),
      radial-gradient(circle at 12% 32%,rgba(23,66,96,.20),transparent 26rem),
      radial-gradient(circle at 88% 42%,rgba(80,35,103,.17),transparent 28rem),
      linear-gradient(#08090d,#0b0b0e 44%,#08080b);
    min-height:100vh;
  }
  body:before{
    content:'';position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;
    background-image:
      linear-gradient(rgba(255,255,255,.018) 1px,transparent 1px),
      linear-gradient(90deg,rgba(255,255,255,.014) 1px,transparent 1px);
    background-size:56px 56px;mask-image:linear-gradient(to bottom,black,transparent 72%);
  }
  .magic-backdrop{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
  .magic-backdrop:before,.magic-backdrop:after{content:'';position:absolute;border-radius:50%;filter:blur(70px);opacity:.15;animation:auroraFloat 14s ease-in-out infinite alternate}
  .magic-backdrop:before{width:38vw;height:38vw;left:-8vw;top:20vh;background:radial-gradient(circle,rgba(63,126,177,.75),transparent 70%)}
  .magic-backdrop:after{width:34vw;height:34vw;right:-5vw;top:9vh;background:radial-gradient(circle,rgba(139,69,173,.65),transparent 72%);animation-delay:-6s}
  .magic-backdrop i{position:absolute;left:var(--x);top:var(--y);width:var(--size);height:var(--size);border-radius:50%;background:#fff4c4;box-shadow:0 0 7px #e7bb72,0 0 16px rgba(121,175,255,.5);opacity:.25;animation:magicMote var(--dur) linear infinite;animation-delay:var(--delay)}
  @keyframes magicMote{0%{transform:translate3d(0,20px,0) scale(.7);opacity:0}12%{opacity:.55}55%{transform:translate3d(12px,-70px,0) scale(1)}100%{transform:translate3d(-8px,-155px,0) scale(.6);opacity:0}}
  @keyframes auroraFloat{to{transform:translate3d(40px,-24px,0) scale(1.08)}}
  .app-shell{position:relative;z-index:1;width:min(1180px,100%)}

  .aestra-hero{position:relative;min-height:176px;margin:4px 0 2px;display:grid;place-items:center;align-content:center;overflow:hidden;isolation:isolate}
  .aestra-hero:after{content:'';position:absolute;left:7%;right:7%;bottom:9px;height:1px;background:linear-gradient(90deg,transparent,var(--aestra-gold-soft),var(--aestra-gold),var(--aestra-gold-soft),transparent);box-shadow:0 0 10px rgba(215,173,99,.18)}
  .aestra-wordmark{position:relative;z-index:2;font-family:Georgia,'Times New Roman',serif;font-size:clamp(3rem,9vw,6.2rem);letter-spacing:.11em;line-height:.88;color:#ead7a8;text-shadow:0 2px 0 #60441f,0 0 22px rgba(221,173,88,.2);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45))}
  .aestra-wordmark:before{content:'';position:absolute;inset:50% -3% auto;height:42%;z-index:-1;background:radial-gradient(ellipse,rgba(217,171,92,.12),transparent 70%);filter:blur(6px)}
  .aestra-subtitle{display:flex;align-items:center;gap:14px;margin-top:11px;color:var(--aestra-gold);font-family:Georgia,serif;letter-spacing:.32em;font-size:.76rem;z-index:2}
  .aestra-subtitle span{display:block;width:70px;height:1px;background:linear-gradient(90deg,transparent,var(--aestra-gold));position:relative}.aestra-subtitle span:last-child{transform:scaleX(-1)}
  .aestra-subtitle span:after{content:'◇';position:absolute;right:-7px;top:-8px;font-size:.75rem}
  .aestra-emblem{position:relative;z-index:3;width:72px;height:42px;margin-bottom:6px;filter:drop-shadow(0 0 11px rgba(111,171,255,.25))}
  .aestra-emblem span{position:absolute;left:50%;bottom:0;clip-path:polygon(50% 0,100% 36%,75% 100%,25% 100%,0 36%);background:linear-gradient(135deg,#d8f6ff 2%,#6cb5dc 28%,#7655bb 60%,#f0c66e 100%);border:1px solid rgba(255,255,255,.4)}
  .aestra-emblem span:nth-child(1){width:28px;height:42px;transform:translateX(-50%)}.aestra-emblem span:nth-child(2){width:18px;height:31px;transform:translateX(-33px) rotate(-18deg)}.aestra-emblem span:nth-child(3){width:18px;height:31px;transform:translateX(15px) rotate(18deg)}
  .hero-arc{position:absolute;width:520px;height:160px;border:1px solid rgba(186,137,65,.2);border-bottom:0;border-radius:50% 50% 0 0;top:12px;left:50%;transform:translateX(-50%);z-index:-1}.hero-arc-b{width:670px;height:190px;top:-15px;opacity:.45}
  .hero-crystals{position:absolute;bottom:8px;width:150px;height:95px;opacity:.52;filter:drop-shadow(0 0 8px rgba(111,173,255,.18))}.hero-crystals-left{left:1%}.hero-crystals-right{right:1%;transform:scaleX(-1)}
  .hero-crystals:before,.hero-crystals:after{content:'';position:absolute;bottom:0;clip-path:polygon(48% 0,100% 67%,73% 100%,20% 100%,0 66%);background:linear-gradient(135deg,rgba(218,246,255,.7),rgba(82,139,198,.55) 38%,rgba(125,67,170,.5) 75%,rgba(240,188,93,.4));border:1px solid rgba(215,173,99,.35)}
  .hero-crystals:before{width:33px;height:91px;left:18px}.hero-crystals:after{width:24px;height:64px;left:54px;transform:rotate(8deg)}

  .aestra-topbar{padding-top:4px;border-bottom:1px solid rgba(174,128,64,.2);margin-bottom:12px}.aestra-topbar h1{font-family:Georgia,serif;font-weight:600;letter-spacing:.025em}.aestra-topbar .eyebrow{color:#b99863}
  .tabs{padding-top:2px}.tab.active,.primary{box-shadow:0 0 20px rgba(212,165,85,.12)}

  .panel{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.025),transparent 22%),linear-gradient(135deg,rgba(32,28,26,.98),rgba(14,14,17,.98));border-color:rgba(143,103,55,.48);box-shadow:inset 0 1px rgba(255,255,255,.025),0 12px 26px rgba(0,0,0,.16)}
  .panel:before{content:'';position:absolute;inset:7px;border:1px solid rgba(199,153,78,.055);border-radius:12px;pointer-events:none}
  .panel:hover{border-color:rgba(178,130,63,.58)}
  .panel-crystal{position:absolute;right:-9px;bottom:-8px;width:42px;height:54px;opacity:.13;pointer-events:none;filter:drop-shadow(0 0 8px rgba(106,170,226,.35))}
  .panel-crystal i{position:absolute;bottom:0;clip-path:polygon(50% 0,100% 65%,70% 100%,25% 100%,0 65%);background:linear-gradient(145deg,#9fd9f2,#5e6dae 58%,#925a9f)}
  .panel-crystal i:nth-child(1){width:16px;height:48px;left:12px}.panel-crystal i:nth-child(2){width:13px;height:34px;left:2px;transform:rotate(-13deg)}.panel-crystal i:nth-child(3){width:13px;height:31px;right:1px;transform:rotate(13deg)}
  .eyebrow{color:#d1a65f}.section-title h3,.resource-head span:first-child{font-family:Georgia,serif;letter-spacing:.02em}

  .attr-card{background:radial-gradient(circle at 50% 42%,rgba(64,88,103,.13),transparent 55%),linear-gradient(180deg,rgba(255,255,255,.025),transparent),#151419}.attr-card:nth-child(1){background:radial-gradient(circle at 50% 42%,rgba(72,130,91,.14),transparent 58%),#151419}.attr-card:nth-child(2){background:radial-gradient(circle at 50% 42%,rgba(72,119,173,.15),transparent 58%),#151419}.attr-card:nth-child(3){background:radial-gradient(circle at 50% 42%,rgba(126,75,156,.15),transparent 58%),#151419}.attr-card:nth-child(4){background:radial-gradient(circle at 50% 42%,rgba(177,128,57,.14),transparent 58%),#151419}
  .die-visual{position:relative;overflow:visible}.die-visual:before{content:'';position:absolute;width:68px;height:68px;left:50%;top:50%;transform:translate(-50%,-50%) rotate(45deg);border:1px solid rgba(210,170,98,.22);box-shadow:inset 0 0 14px rgba(101,152,211,.07),0 0 16px rgba(122,76,167,.06);clip-path:polygon(50% 0,100% 28%,92% 82%,50% 100%,8% 82%,0 28%);pointer-events:none}.die-current{position:relative;z-index:2}

  input,select,textarea{background:rgba(8,9,12,.82);border-color:rgba(128,95,54,.5)}
  input:focus,select:focus,textarea:focus,button:focus-visible{border-color:#cda45e;box-shadow:0 0 0 3px rgba(200,155,91,.12),0 0 17px rgba(111,151,207,.08)}
  .bar{background:#08090b;border-color:rgba(111,81,46,.65)}.resource-hp .bar span{background:linear-gradient(90deg,#713335,#d45d55,#f2a069)}.resource-mp .bar span{background:linear-gradient(90deg,#284d78,#4a92d2,#8fc8f0)}.resource-ip .bar span{background:linear-gradient(90deg,#705018,#c28a2c,#e9c060)}
  .resource-hp,.resource-mp,.resource-ip{background-image:linear-gradient(135deg,rgba(255,255,255,.02),transparent 25%),radial-gradient(circle at 12% 15%,rgba(255,255,255,.025),transparent 25%)}
  .resource-hp .resource-head span:first-child{color:#e88a7b}.resource-mp .resource-head span:first-child{color:#8bbbe8}.resource-ip .resource-head span:first-child{color:#e8bf67}
  .save-dock{border-color:rgba(161,115,55,.58);background:rgba(9,9,12,.88)}

  @media(max-width:760px){.aestra-hero{min-height:142px}.aestra-wordmark{font-size:clamp(2.8rem,16vw,5rem)}.hero-crystals{opacity:.32}.aestra-subtitle span{width:38px}.panel-crystal{opacity:.09}}
  @media(max-width:440px){.aestra-hero{min-height:126px}.aestra-wordmark{letter-spacing:.07em}.aestra-subtitle{letter-spacing:.22em;font-size:.63rem}.hero-crystals{display:none}.aestra-emblem{transform:scale(.86);margin-bottom:0}}
  @media(prefers-reduced-motion:reduce){.magic-backdrop i,.magic-backdrop:before,.magic-backdrop:after{animation:none}}
  `;
  document.head.appendChild(style);
}

installStyles();
installBackdrop();
installHero();
decoratePanels();

// Panels can be created later by the GM dashboard/library; decorate them without observing attributes.
const panelObserver=new MutationObserver(records=>{
  if(records.some(r=>r.addedNodes.length)) decoratePanels();
});
panelObserver.observe(document.body,{childList:true,subtree:true});
