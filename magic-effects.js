// Lightweight magical presentation effects for the Aestra header and pointer/touch movement.
(function(){
  if(document.getElementById('aestraMagicFxStyles')) return;

  const style=document.createElement('style');
  style.id='aestraMagicFxStyles';
  style.textContent=`
    .aestra-wordmark{
      animation:aestraTitleGlow 9s ease-in-out infinite;
      will-change:text-shadow,filter;
    }
    @keyframes aestraTitleGlow{
      0%,100%{text-shadow:0 2px 0 #60441f,0 0 16px rgba(221,173,88,.16);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1)}
      38%{text-shadow:0 2px 0 #60441f,0 0 25px rgba(235,192,104,.27),0 0 48px rgba(111,174,255,.08);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.05)}
      43%{text-shadow:0 2px 0 #60441f,0 0 13px rgba(221,173,88,.12);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(.98)}
      46%{text-shadow:0 2px 0 #60441f,0 0 29px rgba(241,199,111,.3),0 0 52px rgba(108,177,255,.09);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.06)}
      70%{text-shadow:0 2px 0 #60441f,0 0 20px rgba(221,173,88,.21);filter:drop-shadow(0 7px 8px rgba(0,0,0,.45)) brightness(1.02)}
    }
    .aestra-wisps{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1}
    .aestra-wisp{position:absolute;bottom:28px;width:3px;height:3px;border-radius:50%;background:rgba(220,240,255,.72);box-shadow:0 0 8px rgba(111,181,255,.7),0 0 16px rgba(163,99,214,.28);opacity:0;animation:aestraWispRise var(--dur,7s) ease-in infinite;animation-delay:var(--delay,0s)}
    @keyframes aestraWispRise{0%{transform:translate3d(0,0,0) scale(.7);opacity:0}18%{opacity:.38}70%{opacity:.18}100%{transform:translate3d(var(--drift,10px),-105px,0) scale(1.35);opacity:0}}
    .magic-trail-dot{position:fixed;left:0;top:0;width:6px;height:6px;border-radius:50%;pointer-events:none;z-index:9999;background:radial-gradient(circle,#f2e1aa 0 18%,rgba(129,199,255,.72) 42%,rgba(147,91,204,.2) 72%,transparent 76%);box-shadow:0 0 8px rgba(114,185,255,.35);transform:translate(-50%,-50%);animation:trailFade .7s ease-out forwards}
    .magic-trail-dot.touch{width:9px;height:9px;animation-duration:.85s}
    @keyframes trailFade{to{opacity:0;transform:translate(-50%,-68%) scale(.25)}}
    @media(prefers-reduced-motion:reduce){.aestra-wordmark{animation:none}.aestra-wisps{display:none}.magic-trail-dot{display:none}}
  `;
  document.head.appendChild(style);

  const hero=document.getElementById('aestraHero');
  if(hero&&!hero.querySelector('.aestra-wisps')){
    const wisps=document.createElement('div');
    wisps.className='aestra-wisps';
    wisps.setAttribute('aria-hidden','true');
    for(let i=0;i<7;i++){
      const w=document.createElement('i');
      w.className='aestra-wisp';
      w.style.left=`${27+i*8}%`;
      w.style.setProperty('--dur',`${6.2+(i%3)*1.5}s`);
      w.style.setProperty('--delay',`${-(i*1.25)}s`);
      w.style.setProperty('--drift',`${(i%2?1:-1)*(7+i)}px`);
      wisps.appendChild(w);
    }
    hero.appendChild(wisps);
  }

  const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(reduced) return;
  let last=0, active=0;
  const spawn=(x,y,touch=false)=>{
    const now=performance.now();
    if(now-last<(touch?38:28)||active>28) return;
    last=now;active++;
    const d=document.createElement('i');d.className=`magic-trail-dot${touch?' touch':''}`;d.style.left=`${x}px`;d.style.top=`${y}px`;document.body.appendChild(d);
    setTimeout(()=>{d.remove();active=Math.max(0,active-1)},900);
  };
  window.addEventListener('pointermove',e=>{if(e.pointerType==='mouse')spawn(e.clientX,e.clientY,false)},{passive:true});
  window.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')spawn(e.clientX,e.clientY,true)},{passive:true});
  window.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'&&e.buttons)spawn(e.clientX,e.clientY,true)},{passive:true});
})();
