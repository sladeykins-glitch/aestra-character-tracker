/* GM shared Player access UI v1 */
(function(){
  const PLAYER_URL='https://sladeykins-glitch.github.io/aestra-character-tracker/aestran-language/player.html';

  function copyText(text){
    if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(text);
    const ta=document.createElement('textarea');ta.value=text;ta.style.position='fixed';ta.style.opacity='0';
    document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();return Promise.resolve();
  }

  function apply(){
    const invite=document.getElementById('createPlayerInvite');
    const copy=document.getElementById('copyPlayerInvite');
    const output=document.getElementById('playerInviteOutput');
    if(!invite&&!copy&&!output)return;

    [invite,copy,output].forEach(el=>{if(el)el.style.display='none'});

    const card=(invite||copy||output)?.closest('.live-sync-card');
    if(!card)return;
    const copies=[...card.querySelectorAll('.player-safe-copy')];
    const inviteCopy=copies.find(el=>(el.textContent||'').includes('Create an invite link'));
    if(inviteCopy){
      inviteCopy.innerHTML='<b>Players do not need accounts.</b> Share the Player site once and everyone at the table can open it. It reads only the published player-safe Aestra snapshot, and new releases arrive automatically.';
    }

    if(!card.querySelector('#sharedPlayerAccess')){
      const block=document.createElement('div');
      block.id='sharedPlayerAccess';
      block.className='live-sync-actions';
      block.innerHTML='<button class="btn primary" id="copySharedPlayerLink">Copy Player link</button><a class="btn ghost" href="'+PLAYER_URL+'" target="_blank" rel="noopener" style="text-align:center;text-decoration:none">Open Player site</a>';
      (inviteCopy||card).insertAdjacentElement('afterend',block);
      block.querySelector('#copySharedPlayerLink').onclick=async()=>{
        const btn=block.querySelector('#copySharedPlayerLink');
        try{await copyText(PLAYER_URL);btn.textContent='Copied';setTimeout(()=>btn.textContent='Copy Player link',1300)}
        catch(_){btn.textContent='Copy failed';setTimeout(()=>btn.textContent='Copy Player link',1300)}
      };
    }
  }

  try{
    if(typeof renderPublish==='function'){
      const prev=renderPublish;
      renderPublish=function(){const r=prev.apply(this,arguments);queueMicrotask(apply);return r};
    }
  }catch(_){}
  try{
    if(typeof renderAll==='function'){
      const prev=renderAll;
      renderAll=function(){const r=prev.apply(this,arguments);queueMicrotask(apply);return r};
    }
  }catch(_){}
  document.addEventListener('click',()=>setTimeout(apply,0),true);
  apply();
})();