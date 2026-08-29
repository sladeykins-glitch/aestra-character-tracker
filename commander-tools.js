// High Fantasy Commander support — tactical reference, rank-scaled effects, and Actions integration.
(function(){
  const norm=v=>String(v||'').trim().toLowerCase().replace(/[’‘]/g,"'");
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const rows=id=>[...(document.getElementById(id)?.querySelectorAll('.entry-row')||[])];
  const vals=r=>[...r.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());
  const commanderPresent=()=>rows('classesEditor').some(r=>norm(vals(r)[0])==='commander');
  const commanderSkills=()=>rows('skillsEditor').map(r=>{const v=vals(r);return{name:v[0],rank:Math.max(1,Number(v[1])||1),source:v[2],effect:v[3]}}).filter(s=>norm(s.source)==='commander');
  const byName=name=>commanderSkills().find(s=>norm(s.name)===norm(name));

  function derivedText(s){
    const n=norm(s.name),sl=s.rank;
    if(n==="bishop's edict")return `Action · 10 MP\nChoose one until the start of your next turn:\n• All MP costs are doubled.\n• All sources of damage deal ${sl*3} extra damage.`;
    if(n==='charging cavalry')return `Action · 10 MP\nChoose one ally who can hear you. They immediately perform a free attack with an equipped weapon (or a basic attack if an NPC), gaining +${sl} to the Accuracy Check. Their High Roll is treated as 0 when calculating damage.`;
    if(n==='crushing chariot')return `After you use Bishop's Edict, Charging Cavalry, or King's Castle, choose another Player Character who can hear you and has not yet taken a turn this round. They may take their turn immediately after yours.`;
    if(n==="king's castle")return `Action · 10 MP\nChoose one until the start of your next turn:\n• No creature can recover HP or MP.\n• All effects that restore MP restore ${sl*5} additional MP.`;
    if(n==="queen's gambit")return `Action · Free weapon attack\nTreat your High Roll as 0 when calculating damage. After resolving it, choose one:\n• One ally who can hear you recovers ${5+sl*5} HP.\n• Immediately use Bishop's Edict, Charging Cavalry, or King's Castle for free as an action, still paying its MP cost.`;
    return s.effect||'No additional tactical calculation.';
  }

  function modal(){
    let m=document.getElementById('commanderModal');if(m)return m;
    m=document.createElement('div');m.id='commanderModal';m.className='cmd-modal hidden';
    m.innerHTML='<div class="cmd-dialog"><button class="cmd-close" type="button">×</button><div id="cmdBody"></div></div>';
    document.body.appendChild(m);m.querySelector('.cmd-close').onclick=()=>m.classList.add('hidden');m.onclick=e=>{if(e.target===m)m.classList.add('hidden')};return m;
  }
  function openReference(){
    const m=modal(),b=document.getElementById('cmdBody'),skills=commanderSkills();
    b.innerHTML=`<p class="eyebrow">High Fantasy · Commander</p><h2>Tactical Reference</h2><p class="cmd-help">Your learned Commander Skills with their current Skill Level values already calculated.</p>${skills.length?`<div class="cmd-list">${skills.map(s=>`<article><div><strong>${esc(s.name)}</strong><small>SL ${s.rank}</small></div><p>${esc(derivedText(s)).replace(/\n/g,'<br>')}</p></article>`).join('')}</div>`:'<p class="muted">You have not learned any Commander Skills yet.</p>'}`;
    m.classList.remove('hidden');
  }

  function buildPanel(){
    const old=document.querySelector('.commander-build-tools');
    if(!commanderPresent()){old?.remove();return}
    const body=document.getElementById('buildMenuBody');if(!body)return;
    const section=document.querySelector('.build-tab.active')?.dataset.build;if(section!=='classes'&&section!=='skills'){old?.remove();return}
    const hierarchy=document.getElementById('classHierarchy'),actions=body.querySelector('.build-actions');if(!hierarchy&&!actions)return;
    let box=old;
    const skills=commanderSkills(),sig=skills.map(s=>`${s.name}:${s.rank}`).join('|');
    if(!box){box=document.createElement('section');box.className='commander-build-tools';(hierarchy||actions)?.insertAdjacentElement(hierarchy?'beforebegin':'afterend',box)}
    if(box.dataset.sig===sig)return;box.dataset.sig=sig;
    box.innerHTML=`<div><p class="eyebrow">Commander</p><strong>Tactical Reference</strong><small>${skills.length?`${skills.length} learned Commander skill${skills.length===1?'':'s'}`:'No Commander Skills learned yet'}</small></div><button type="button" class="secondary cmd-open-ref">Open tactics</button>`;
    box.querySelector('.cmd-open-ref').onclick=openReference;
  }

  function injectAction(){
    const host=document.getElementById('sessionActionBody');if(!host)return;
    const mode=host.dataset.mode;if(!commanderPresent()||!commanderSkills().length||!['skills','favourites'].includes(mode)){host.querySelector('[data-commander-action]')?.remove();return}
    if(host.querySelector('[data-commander-action]'))return;
    const card=document.createElement('article');card.className='a2-card commander-action-card';card.dataset.commanderAction='1';
    card.innerHTML='<button class="a2-open" type="button"><span class="a2-kind">♜ SKILL · COMMANDER</span><strong>Commander Tactics</strong><small>High Fantasy · Tactical reference</small><p>View your learned orders and their current rank-scaled effects.</p><span class="a2-more">Open tactics ›</span></button>';
    card.querySelector('button').onclick=e=>{e.stopPropagation();openReference()};host.prepend(card);
  }

  const style=document.createElement('style');style.textContent=`
  .commander-build-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 10px;padding:11px 13px;border:1px solid rgba(206,157,84,.3);border-radius:11px;background:linear-gradient(110deg,rgba(114,74,31,.10),rgba(77,94,122,.07))}.commander-build-tools>div{display:grid;gap:2px}.commander-build-tools .eyebrow{margin:0}.commander-build-tools small{opacity:.68}.cmd-modal{position:fixed;inset:0;z-index:2300;display:grid;place-items:center;padding:14px;background:rgba(2,4,8,.87)}.cmd-modal.hidden{display:none!important}.cmd-dialog{position:relative;width:min(760px,96vw);max-height:90vh;overflow:auto;padding:25px 22px;border:1px solid rgba(211,171,91,.4);border-radius:18px;background:linear-gradient(145deg,#11151d,#1a141b);box-shadow:0 28px 90px rgba(0,0,0,.62)}.cmd-close{position:absolute!important;right:11px;top:11px;width:36px!important;height:36px!important;min-height:0!important;padding:0!important;border-radius:50%!important}.cmd-dialog h2{margin:.15rem 42px .45rem 0;color:#ead9ad}.cmd-help{opacity:.72;line-height:1.45}.cmd-list{display:grid;gap:9px;margin-top:14px}.cmd-list article{padding:13px;border:1px solid rgba(211,171,91,.2);border-radius:12px;background:rgba(255,255,255,.025)}.cmd-list article>div{display:flex;justify-content:space-between;gap:12px;align-items:center}.cmd-list strong{color:#e7d5a9}.cmd-list small{color:#caa85f}.cmd-list p{margin:8px 0 0;font-size:.8rem;line-height:1.5;color:#c5bbab}.commander-action-card{border-color:rgba(206,157,84,.34)!important}@media(max-width:640px){.commander-build-tools{align-items:stretch;flex-direction:column}.commander-build-tools button{width:100%}}
  `;document.head.appendChild(style);

  function queue(){requestAnimationFrame(()=>{buildPanel();injectAction()})}
  function boot(){
    const body=document.getElementById('buildMenuBody');if(!body){setTimeout(boot,100);return}
    ['classesEditor','skillsEditor'].forEach(id=>{const el=document.getElementById(id);if(el){el.addEventListener('input',queue);el.addEventListener('change',queue);new MutationObserver(queue).observe(el,{childList:true})}});
    new MutationObserver(queue).observe(body,{childList:true,subtree:false});
    const actions=document.getElementById('sessionActionBody');if(actions)new MutationObserver(()=>requestAnimationFrame(injectAction)).observe(actions,{childList:true});
    document.addEventListener('click',e=>{if(e.target.closest?.('.build-tab,.build-cycle,[data-action-tab]'))setTimeout(queue,0)},true);
    queue();
  }
  boot();
})();