// Refined Aestra campaign masthead. Presentation only; intentionally animation-free.
(function(){
  const hero=document.getElementById('aestraHero');
  if(!hero)return;

  // Load one display face only for the campaign wordmark. The rest of the UI keeps its existing fonts.
  if(!document.getElementById('aestraArchaicFont')){
    const preconnect=document.createElement('link');
    preconnect.rel='preconnect';
    preconnect.href='https://fonts.gstatic.com';
    preconnect.crossOrigin='anonymous';
    document.head.appendChild(preconnect);
    const font=document.createElement('link');
    font.id='aestraArchaicFont';
    font.rel='stylesheet';
    font.href='https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&display=swap';
    document.head.appendChild(font);
  }

  hero.classList.add('aestra-hero-v2');
  const word=hero.querySelector('.aestra-wordmark');
  const subtitle=hero.querySelector('.aestra-subtitle');
  const emblem=hero.querySelector('.aestra-emblem');
  if(word){
    word.setAttribute('data-title','AESTRA');
    word.setAttribute('aria-label','Aestra');
    word.innerHTML='<span class="aestra-title-a">A</span><span>ESTR</span><span class="aestra-title-a">A</span>';
  }
  if(subtitle){subtitle.innerHTML='<span></span><i>✦</i><b>FABULA ULTIMA</b><i>✦</i><span></span>'}
  if(emblem&&!hero.querySelector('.aestra-crest-ring')){emblem.insertAdjacentHTML('afterend','<div class="aestra-crest-ring" aria-hidden="true"><i></i><i></i><i></i><i></i></div>')}
  const style=document.createElement('style');
  style.id='aestraTitleV2Styles';
  style.textContent=`
  .aestra-hero-v2{min-height:184px;overflow:visible!important;padding-top:8px}
  .aestra-hero-v2:before{content:'';position:absolute;left:50%;top:45%;width:min(650px,70vw);height:128px;transform:translate(-50%,-50%);background:radial-gradient(ellipse,rgba(213,166,83,.115),rgba(94,71,145,.045) 42%,transparent 72%);pointer-events:none;z-index:-1}
  .aestra-hero-v2 .aestra-wordmark{display:flex;align-items:center;justify-content:center;gap:.005em;font-family:'Cinzel Decorative','Palatino Linotype','Book Antiqua',Georgia,serif;font-size:clamp(3rem,8.1vw,5.85rem);font-weight:900;letter-spacing:.075em;line-height:.92;color:transparent;background:linear-gradient(180deg,#fff4ca 0%,#efdba0 34%,#d0a15a 61%,#9a642b 79%,#ead39a 100%);-webkit-background-clip:text;background-clip:text;text-shadow:none;filter:drop-shadow(0 1px 0 #fff0c2) drop-shadow(0 3px 0 rgba(80,48,15,.92)) drop-shadow(0 8px 12px rgba(0,0,0,.62));isolation:isolate;-webkit-text-stroke:.35px rgba(255,232,179,.32)}
  .aestra-hero-v2 .aestra-wordmark:before{content:'';position:absolute;left:7%;right:7%;top:52%;height:42%;z-index:-1;background:radial-gradient(ellipse,rgba(220,171,85,.15),transparent 72%);filter:blur(7px)}
  .aestra-hero-v2 .aestra-wordmark:after{content:attr(data-title);position:absolute;inset:1px 0 -1px 0;display:flex;align-items:center;justify-content:center;font-family:'Cinzel Decorative','Palatino Linotype','Book Antiqua',Georgia,serif;font-weight:900;color:transparent;-webkit-text-stroke:1px rgba(86,51,18,.52);letter-spacing:.075em;pointer-events:none;z-index:-1;transform:translateY(1px)}
  .aestra-hero-v2 .aestra-title-a{font-size:1.075em;position:relative}.aestra-hero-v2 .aestra-title-a:after{content:'';position:absolute;width:.08em;height:.08em;border:1px solid rgba(236,199,126,.5);transform:rotate(45deg);bottom:.08em;left:50%;margin-left:-.04em}
  .aestra-hero-v2 .aestra-title-a:first-child{margin-right:-.025em}.aestra-hero-v2 .aestra-title-a:last-child{margin-left:-.025em}
  .aestra-hero-v2 .aestra-emblem{width:64px;height:36px;margin-bottom:10px;filter:drop-shadow(0 0 7px rgba(114,201,255,.35)) drop-shadow(0 0 14px rgba(143,86,210,.22))}
  .aestra-hero-v2 .aestra-emblem span:nth-child(1){width:24px;height:36px}.aestra-hero-v2 .aestra-emblem span:nth-child(2),.aestra-hero-v2 .aestra-emblem span:nth-child(3){width:15px;height:27px}
  .aestra-crest-ring{position:absolute;left:50%;top:12px;width:112px;height:58px;transform:translateX(-50%);border-top:1px solid rgba(213,172,100,.28);border-radius:50%;pointer-events:none}
  .aestra-crest-ring:before,.aestra-crest-ring:after{content:'◇';position:absolute;top:14px;color:rgba(218,180,110,.48);font-size:.58rem}.aestra-crest-ring:before{left:5px}.aestra-crest-ring:after{right:5px}
  .aestra-crest-ring i{position:absolute;width:3px;height:3px;border:1px solid rgba(234,204,139,.45);transform:rotate(45deg)}.aestra-crest-ring i:nth-child(1){left:29px;top:5px}.aestra-crest-ring i:nth-child(2){right:29px;top:5px}.aestra-crest-ring i:nth-child(3){left:16px;top:20px}.aestra-crest-ring i:nth-child(4){right:16px;top:20px}
  .aestra-hero-v2 .aestra-subtitle{gap:10px;margin-top:14px;font-size:.68rem;letter-spacing:.36em;color:#d7ad63;text-shadow:0 0 8px rgba(215,173,99,.16)}
  .aestra-hero-v2 .aestra-subtitle span{width:92px;background:linear-gradient(90deg,transparent,rgba(215,173,99,.35),#d7ad63)}
  .aestra-hero-v2 .aestra-subtitle span:last-child{transform:scaleX(-1)}
  .aestra-hero-v2 .aestra-subtitle span:after{display:none}.aestra-hero-v2 .aestra-subtitle i{font-style:normal;font-size:.55rem;color:#e6c57e;letter-spacing:0}
  .aestra-hero-v2 .hero-arc-a{width:560px;height:150px;top:21px;border-color:rgba(199,149,77,.23)}
  .aestra-hero-v2 .hero-arc-b{width:720px;height:188px;top:-11px;border-color:rgba(122,91,145,.16)}
  .aestra-hero-v2 .hero-crystals{bottom:9px;opacity:.35;transform:scale(.82);transform-origin:bottom left}.aestra-hero-v2 .hero-crystals-right{transform:scaleX(-1) scale(.82);transform-origin:bottom right}
  .aestra-hero-v2:after{left:11%;right:11%;background:linear-gradient(90deg,transparent,rgba(150,105,51,.35) 16%,#d7ad63 47%,#f2d796 50%,#d7ad63 53%,rgba(150,105,51,.35) 84%,transparent)}
  @media(max-width:760px){.aestra-hero-v2{min-height:148px;padding-top:4px}.aestra-hero-v2 .aestra-wordmark{font-size:clamp(2.75rem,14.2vw,4.5rem);letter-spacing:.05em}.aestra-hero-v2 .aestra-wordmark:after{letter-spacing:.05em}.aestra-hero-v2 .aestra-subtitle span{width:48px}.aestra-crest-ring{top:4px;transform:translateX(-50%) scale(.82)}.aestra-hero-v2 .hero-arc-a{width:76vw}.aestra-hero-v2 .hero-arc-b{width:92vw}}
  @media(max-width:440px){.aestra-hero-v2{min-height:132px}.aestra-hero-v2 .aestra-wordmark{font-size:clamp(2.35rem,13.5vw,3.7rem);letter-spacing:.035em}.aestra-hero-v2 .aestra-wordmark:after{letter-spacing:.035em}.aestra-hero-v2 .aestra-subtitle{font-size:.58rem;letter-spacing:.26em;gap:7px}.aestra-hero-v2 .aestra-subtitle span{width:27px}.aestra-hero-v2 .aestra-emblem{transform:scale(.78);margin-bottom:3px}.aestra-crest-ring{display:none}}
  `;
  document.head.appendChild(style);
})();