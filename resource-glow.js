// Videogame-style resource glow effects for HP and MP bars.
if(!document.getElementById('resourceGlowStyles')){
  const style=document.createElement('style');
  style.id='resourceGlowStyles';
  style.textContent=`
    .resource-card .bar{
      position:relative;
      overflow:visible;
      height:13px;
      border-radius:999px;
      isolation:isolate;
    }
    .resource-card .bar:before{
      content:'';
      position:absolute;
      inset:-4px;
      border-radius:999px;
      pointer-events:none;
      opacity:.5;
      z-index:-1;
    }
    .resource-card .bar span{
      position:relative;
      border-radius:999px;
      overflow:hidden;
      transition:width .24s ease,filter .24s ease,box-shadow .24s ease;
    }
    .resource-card .bar span:before{
      content:'';
      position:absolute;
      inset:1px 0 auto 0;
      height:42%;
      border-radius:999px;
      background:linear-gradient(180deg,rgba(255,255,255,.72),rgba(255,255,255,.08));
      opacity:.6;
      pointer-events:none;
    }
    .resource-card .bar span:after{
      content:'';
      position:absolute;
      top:-1px;
      bottom:-1px;
      width:42px;
      right:-12px;
      border-radius:50%;
      pointer-events:none;
      opacity:.85;
      animation:resourceEndPulse 1.65s ease-in-out infinite;
    }

    .resource-hp .bar:before{
      background:radial-gradient(ellipse at center,rgba(255,77,67,.48),transparent 70%);
      box-shadow:0 0 17px rgba(255,57,47,.24);
    }
    .resource-hp .bar span{
      background:linear-gradient(90deg,#741f26 0%,#c93439 34%,#ff4d45 72%,#ff9b6d 100%)!important;
      box-shadow:
        0 0 5px rgba(255,78,67,.95),
        0 0 12px rgba(255,52,45,.72),
        0 0 25px rgba(255,45,38,.42),
        inset 0 0 7px rgba(255,255,255,.34)!important;
      filter:saturate(1.18) brightness(1.08);
    }
    .resource-hp .bar span:after{
      background:radial-gradient(circle,rgba(255,241,222,.98) 0%,rgba(255,110,80,.76) 27%,rgba(255,54,45,.25) 55%,transparent 72%);
      box-shadow:0 0 15px rgba(255,64,55,.9);
    }

    .resource-mp .bar:before{
      background:radial-gradient(ellipse at center,rgba(70,165,255,.5),transparent 70%);
      box-shadow:0 0 18px rgba(53,139,255,.28);
    }
    .resource-mp .bar span{
      background:linear-gradient(90deg,#163f73 0%,#1e76c9 36%,#37b9ff 74%,#9beaff 100%)!important;
      box-shadow:
        0 0 5px rgba(74,184,255,.95),
        0 0 13px rgba(52,158,255,.75),
        0 0 27px rgba(48,135,255,.45),
        inset 0 0 7px rgba(255,255,255,.38)!important;
      filter:saturate(1.2) brightness(1.1);
    }
    .resource-mp .bar span:after{
      background:radial-gradient(circle,rgba(235,252,255,.98) 0%,rgba(111,213,255,.82) 25%,rgba(55,156,255,.28) 55%,transparent 72%);
      box-shadow:0 0 16px rgba(68,174,255,.95);
    }

    .resource-hp .bar span,.resource-mp .bar span{
      background-size:180% 100%!important;
      animation:resourceFlow 3.4s linear infinite;
    }
    .resource-hp .resource-head strong{
      color:#ffc0b6;
      text-shadow:0 0 8px rgba(255,74,64,.32);
    }
    .resource-mp .resource-head strong{
      color:#c9efff;
      text-shadow:0 0 8px rgba(73,171,255,.34);
    }

    @keyframes resourceFlow{
      0%{background-position:0 0}
      100%{background-position:180% 0}
    }
    @keyframes resourceEndPulse{
      0%,100%{transform:scale(.82);opacity:.55}
      50%{transform:scale(1.18);opacity:1}
    }
    @media(prefers-reduced-motion:reduce){
      .resource-hp .bar span,.resource-mp .bar span,.resource-card .bar span:after{animation:none}
    }
  `;
  document.head.appendChild(style);
}
