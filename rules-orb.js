// Compact floating rules-conflict orb. Reuses rules-aware.js detection and content.
function installRulesOrb(){
  const alert=document.getElementById('rulesAwareAlert');
  if(!alert||alert.dataset.rulesOrb==='1')return;
  const head=alert.querySelector('.rules-alert-head');
  const body=alert.querySelector('#rulesAlertBody');
  const dismiss=alert.querySelector('#rulesAlertDismiss');
  const count=alert.querySelector('#rulesAlertCount');
  if(!head||!body||!dismiss||!count)return;
  alert.dataset.rulesOrb='1';
  alert.classList.add('rules-orb');

  const badge=document.createElement('span');
  badge.id='rulesOrbBadge';
  badge.className='rules-orb-badge';
  badge.setAttribute('aria-hidden','true');
  head.appendChild(badge);

  const pop=document.createElement('div');
  pop.className='rules-orb-popover';
  body.parentNode.insertBefore(pop,body);
  pop.append(body,dismiss);

  const syncBadge=()=>{
    const text=count.textContent||'';
    const match=text.match(/(\d+)/);
    badge.textContent=match?match[1]:'!';
    head.setAttribute('aria-label',text||'Rules conflict');
    head.setAttribute('title',text||'Rules conflict');
  };
  new MutationObserver(syncBadge).observe(count,{childList:true,subtree:true,characterData:true});
  syncBadge();
}
function installRulesOrbStyles(){
  if(document.getElementById('rulesOrbStyles'))return;
  const s=document.createElement('style');
  s.id='rulesOrbStyles';
  s.textContent=`
  #rulesAwareAlert.rules-orb{position:fixed!important;z-index:9991!important;left:max(14px,env(safe-area-inset-left))!important;right:auto!important;top:auto!important;bottom:max(14px,calc(env(safe-area-inset-bottom) + 10px))!important;transform:none!important;width:54px!important;height:54px!important;overflow:visible!important;border:0!important;border-radius:50%!important;background:transparent!important;box-shadow:none!important;color:#f5d88c!important}
  #rulesAwareAlert.rules-orb.hidden{display:none!important}
  #rulesAwareAlert.rules-orb .rules-alert-head{position:relative!important;width:54px!important;height:54px!important;min-width:54px!important;min-height:54px!important;padding:0!important;display:grid!important;place-items:center!important;border-radius:50%!important;border:2px solid rgba(232,175,72,.86)!important;background:radial-gradient(circle at 35% 28%,rgba(255,255,255,.14),rgba(145,83,28,.96) 43%,rgba(69,38,18,.99) 100%)!important;box-shadow:0 7px 22px rgba(0,0,0,.45),0 0 0 4px rgba(222,151,66,.08),0 0 18px rgba(222,134,48,.18)!important;color:#ffe09a!important;transition:transform .16s ease,box-shadow .2s ease!important}
  #rulesAwareAlert.rules-orb .rules-alert-head:active{transform:scale(.93)}
  #rulesAwareAlert.rules-orb .rules-alert-symbol{width:auto!important;height:auto!important;border:0!important;background:transparent!important;box-shadow:none!important;font-family:Georgia,serif!important;font-size:1.65rem!important;line-height:1!important;color:#ffe09a!important;text-shadow:0 0 9px rgba(255,177,67,.35)!important}
  #rulesAwareAlert.rules-orb .rules-alert-head>span:nth-child(2),#rulesAwareAlert.rules-orb .rules-alert-chevron{display:none!important}
  #rulesAwareAlert.rules-orb .rules-orb-badge{position:absolute;right:-5px;top:-5px;min-width:22px;height:22px;padding:0 5px;border-radius:999px;display:grid;place-items:center;background:#20140d;border:2px solid #e1a94f;color:#ffe3a1;font:800 .68rem/1 system-ui,sans-serif;box-shadow:0 3px 9px rgba(0,0,0,.4)}
  #rulesAwareAlert.rules-orb .rules-orb-popover{display:none;position:absolute;left:0;bottom:64px;width:min(370px,calc(100vw - 28px));max-height:min(430px,65vh);overflow:auto;border:1px solid rgba(224,172,70,.68);border-radius:15px;background:rgba(16,14,17,.98);box-shadow:0 12px 34px rgba(0,0,0,.58),0 0 20px rgba(211,145,39,.1);padding:10px;color:#eee0bd}
  #rulesAwareAlert.rules-orb.expanded .rules-orb-popover{display:block}
  #rulesAwareAlert.rules-orb .rules-alert-body{display:block!important;padding:0!important;border:0!important}
  #rulesAwareAlert.rules-orb .rules-alert-body:before{content:'Rules conflicts';display:block;margin:1px 3px 9px;font-family:Georgia,serif;font-size:1rem;font-weight:700;color:#f1cf86}
  #rulesAwareAlert.rules-orb .rules-alert-body p{display:flex;gap:8px;margin:7px 2px;padding:8px 9px;border-radius:9px;background:rgba(85,54,25,.22);border:1px solid rgba(203,151,65,.16);font-size:.8rem;line-height:1.35}
  #rulesAwareAlert.rules-orb .rules-alert-body p span{color:#e6a94d;font-weight:900}
  #rulesAwareAlert.rules-orb .rules-alert-dismiss{display:block!important;width:100%!important;margin:9px 0 0!important;padding:8px!important;font-size:.72rem!important;background:rgba(82,61,31,.34)!important;border-color:rgba(190,145,66,.34)!important}
  @media(max-width:520px){#rulesAwareAlert.rules-orb{width:50px!important;height:50px!important}#rulesAwareAlert.rules-orb .rules-alert-head{width:50px!important;height:50px!important;min-width:50px!important;min-height:50px!important}#rulesAwareAlert.rules-orb .rules-alert-symbol{font-size:1.5rem!important}#rulesAwareAlert.rules-orb .rules-orb-popover{bottom:60px}}
  @media(prefers-reduced-motion:reduce){#rulesAwareAlert.rules-orb .rules-alert-head{transition:none!important}}
  `;
  document.head.appendChild(s);
}
installRulesOrbStyles();
installRulesOrb();