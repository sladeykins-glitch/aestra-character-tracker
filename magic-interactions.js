// Lightweight magical interaction layer for Aestra. Presentation only.
const reducedMotion=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

function installMagicStyles(){
  if(document.getElementById('magicInteractionStyles')) return;
  const style=document.createElement('style');
  style.id='magicInteractionStyles';
  style.textContent=`
  .aestra-wordmark{
    animation:aestraTitleGlow 6.8s ease-in-out infinite;
    will-change:filter,text-shadow;
  }
  @keyframes aestraTitleGlow{
    0%,100%{text-shadow:0 2px 0 #60441f,0 0 12px rgba(233,190,105,.12),0 0 24px rgba(111,171,255,.05);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1)}
    18%{text-shadow:0 2px 0 #60441f,0 0 19px rgba(239,197,112,.24),0 0 38px rgba(125,166,231,.09);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.04)}
    21%{text-shadow:0 2px 0 #60441f,0 0 11px rgba(233,190,105,.13),0 0 23px rgba(111,171,255,.05);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(.99)}
    24%{text-shadow:0 2px 0 #60441f,0 0 23px rgba(244,205,126,.29),0 0 42px rgba(128,176,244,.11);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.055)}
    52%{text-shadow:0 2px 0 #60441f,0 0 15px rgba(233,190,105,.18),0 0 31px rgba(119,164,226,.08);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.02)}
    73%{text-shadow:0 2px 0 #60441f,0 0 25px rgba(244,205,126,.3),0 0 45px rgba(135,181,246,.12);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.06)}
    77%{text-shadow:0 2px 0 #60441f,0 0 14px rgba(233,190,105,.16),0 0 27px rgba(111,171,255,.06);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.01)}
  }
  .hero-wisps{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
  .hero-wisp{position:absolute;left:var(--x);bottom:10px;width:var(--w);height:var(--h);border-radius:50%;opacity:0;background:radial-gradient(ellipse at center,rgba(210,236,255,.34),rgba(132,103,209,.16) 38%,transparent 72%);filter:blur(5px);animation:heroWispRise var(--dur) ease-in-out infinite;animation-delay:var(--delay);mix-blend-mode:screen}
  .hero-wisp:after{content:'';position:absolute;left:45%;bottom:4%;width:24%;height:70%;border-radius:50%;background:linear-gradient(to top,rgba(250,211,127,.16),rgba(125,182,235,.2),transparent);filter:blur(3px)}
  @keyframes heroWispRise{0%{transform:translate3d(0,24px,0) scale(.7);opacity:0}18%{opacity:.26}50%{transform:translate3d(10px,-45px,0) scale(1);opacity:.18}78%{opacity:.12}100%{transform:translate3d(-7px,-112px,0) scale(1.15);opacity:0}}

  .magic-trail-dot{position:fixed;left:0;top:0;z-index:9999;pointer-events:none;width:var(--trail-size,8px);height:var(--trail-size,8px);border-radius:50%;transform:translate(-50%,-50%);background:radial-gradient(circle,rgba(255,239,190,.78) 0 14%,rgba(136,197,255,.42) 32%,rgba(151,102,221,.2) 54%,transparent 72%);box-shadow:0 0 8px rgba(238,197,108,.34),0 0 16px rgba(111,174,238,.22);mix-blend-mode:screen;animation:trailFade .72s ease-out forwards}
  .magic-trail-dot.touch{animation-duration:.9s;box-shadow:0 0 10px rgba(238,197,108,.38),0 0 22px rgba(121,177,241,.27)}
  @keyframes trailFade{0%{opacity:.72;transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(calc(-50% + var(--drift-x,0px)),calc(-50% - 15px)) scale(.22)}}

  @media(prefers-reduced-motion:reduce){
    .aestra-wordmark{animation:none!important}
    .hero-wisps,.magic-trail-dot{display:none!important}
  }
  `;
  document.head.appendChild(style);
}

function installWisps(){
  if(reducedMotion) return;
  const hero=document.getElementById('aestraHero');
  if(!hero||hero.querySelector('.hero-wisps')) return;
  const wrap=document.createElement('div');
  wrap.className='hero-wisps';
  const settings=[
    ['12%','30px','78px','7.5s','-1.1s'],['27%','22px','60px','9s','-5s'],['43%','34px','88px','8.4s','-3.2s'],
    ['58%','25px','66px','10s','-7.1s'],['73%','31px','82px','8.8s','-4.4s'],['88%','21px','58px','9.6s','-2.2s']
  ];
  settings.forEach(([x,w,h,dur,delay])=>{
    const wisp=document.createElement('i');
    wisp.className='hero-wisp';
    wisp.style.setProperty('--x',x);wisp.style.setProperty('--w',w);wisp.style.setProperty('--h',h);wisp.style.setProperty('--dur',dur);wisp.style.setProperty('--delay',delay);
    wrap.appendChild(wisp);
  });
  hero.appendChild(wrap);
}

function installPointerTrail(){
  if(reducedMotion) return;
  let lastX=-999,lastY=-999,lastTime=0;
  let raf=0,pending=null;
  const maxDots=28;

  function spawn(x,y,isTouch=false){
    const now=performance.now();
    const dx=x-lastX,dy=y-lastY,dist=Math.hypot(dx,dy);
    const minDist=isTouch?12:8;
    const minTime=isTouch?34:22;
    if(dist<minDist && now-lastTime<minTime) return;
    lastX=x;lastY=y;lastTime=now;
    const dot=document.createElement('i');
    dot.className=`magic-trail-dot${isTouch?' touch':''}`;
    dot.style.left=`${x}px`;dot.style.top=`${y}px`;
    dot.style.setProperty('--trail-size',`${isTouch?10:6+(Math.random()*3)}px`);
    dot.style.setProperty('--drift-x',`${(Math.random()-.5)*12}px`);
    document.body.appendChild(dot);
    const dots=document.querySelectorAll('.magic-trail-dot');
    if(dots.length>maxDots) dots[0].remove();
    dot.addEventListener('animationend',()=>dot.remove(),{once:true});
  }

  function schedule(e){
    pending={x:e.clientX,y:e.clientY,touch:e.pointerType==='touch'};
    if(raf) return;
    raf=requestAnimationFrame(()=>{
      raf=0;
      if(pending){spawn(pending.x,pending.y,pending.touch);pending=null}
    });
  }

  window.addEventListener('pointermove',schedule,{passive:true});
  window.addEventListener('pointerdown',e=>spawn(e.clientX,e.clientY,e.pointerType==='touch'),{passive:true});
}

installMagicStyles();
installWisps();
installPointerTrail();
