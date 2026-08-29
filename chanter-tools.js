// High Fantasy Chanter support — learned keys/tones + verse composer.
(function(){
  const KEYS={
    Flame:{type:'fire',status:'shaken',attr:'Might',recovery:'Hit Points'},
    Frost:{type:'ice',status:'weak',attr:'Willpower',recovery:'Mind Points'},
    Iron:{type:'physical',status:'slow',attr:'Willpower',recovery:'Mind Points'},
    Radiance:{type:'light',status:'dazed',attr:'Insight',recovery:'Hit Points'},
    Shadow:{type:'dark',status:'weak',attr:'Dexterity',recovery:'Mind Points'},
    Stone:{type:'earth',status:'dazed',attr:'Might',recovery:'Hit Points'},
    Thunder:{type:'bolt',status:'shaken',attr:'Dexterity',recovery:'Hit Points'},
    Wind:{type:'air',status:'slow',attr:'Insight',recovery:'Mind Points'}
  };
  const TONES=['Calm','Energetic','Frantic','Haunting','Lively','Menacing','Solemn'];
  const VOLUMES={Low:{mp:10,targets:'Yourself or another creature you can see who can hear you.'},Medium:{mp:20,targets:'Every ally who can hear you.'},High:{mp:30,targets:'Every enemy who can hear you.'}};
  const MARK='[CHANTER LOADOUT]';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=v=>String(v||'').trim().toLowerCase();
  const fire=el=>{el?.dispatchEvent(new Event('input',{bubbles:true}));el?.dispatchEvent(new Event('change',{bubbles:true}))};
  const rows=id=>[...(document.getElementById(id)?.querySelectorAll('.entry-row')||[])];
  const vals=r=>[...r.querySelectorAll('input,textarea,select')].map(x=>String(x.value||'').trim());
  function magichantRow(){return rows('skillsEditor').find(r=>norm(vals(r)[0])==='magichant')||null}
  function chanterPresent(){return rows('classesEditor').some(r=>norm(vals(r)[0])==='chanter')}
  function rank(){const r=magichantRow();return Math.max(1,Math.min(10,Number(vals(r)[1])||1))}
  function effectField(row){return row?.querySelectorAll('input,textarea,select')?.[3]||null}
  function parse(){
    const r=magichantRow(),field=effectField(r);if(!field)return {keys:[],tones:[],base:''};
    const full=String(field.value||''),parts=full.split(MARK),base=parts[0].trimEnd(),tail=parts.slice(1).join(MARK);
    const k=(tail.match(/Keys:\s*([^\n]*)/i)?.[1]||'').split(',').map(x=>x.trim()).filter(x=>KEYS[x]);
    const t=(tail.match(/Tones:\s*([^\n]*)/i)?.[1]||'').split(',').map(x=>x.trim()).filter(x=>TONES.includes(x));
    return {keys:[...new Set(k)],tones:[...new Set(t)],base};
  }
  function write(state){
    const r=magichantRow(),field=effectField(r);if(!field)return;
    const clean=state.base||String(field.value||'').split(MARK)[0].trimEnd();
    field.value=`${clean}\n\n${MARK}\nKeys: ${state.keys.join(', ')}\nTones: ${state.tones.join(', ')}`;
    fire(field);renderSurface();injectAction();
  }
  function learnedSummary(){const s=parse();return {state:s,complete:s.keys.length>=1&&s.tones.length>=1&&(s.keys.length+s.tones.length)<=rank()+1,used:s.keys.length+s.tones.length,max:rank()+1}}
  function modal(){
    let m=document.getElementById('chanterModal');if(m)return m;
    m=document.createElement('div');m.id='chanterModal';m.className='chanter-modal hidden';m.innerHTML='<div class="chanter-dialog"><button class="chanter-close" type="button">×</button><div id="chanterModalBody"></div></div>';document.body.appendChild(m);
    m.querySelector('.chanter-close').onclick=()=>m.classList.add('hidden');m.onclick=e=>{if(e.target===m)m.classList.add('hidden')};return m;
  }
  function openConfig(){
    const m=modal(),b=document.getElementById('chanterModalBody'),cur=parse(),r=rank(),max=r+1;
    b.innerHTML=`<p class="eyebrow">High Fantasy · Chanter</p><h2>Magichant Repertoire</h2><p class="chanter-help">At Skill Level ${r}, you know all three volumes and may know ${max} total keys/tones, with at least one of each. Rank 1 grants one key and one tone; every later rank grants one additional key or tone.</p><div class="chanter-count" id="chanterCount"></div><h3>Keys</h3><div class="chanter-choice-grid" id="chanterKeys">${Object.keys(KEYS).map(x=>`<label><input type="checkbox" value="${x}" ${cur.keys.includes(x)?'checked':''}> <span><strong>${x}</strong><small>${KEYS[x].type} · ${KEYS[x].status} · ${KEYS[x].attr} · ${KEYS[x].recovery}</small></span></label>`).join('')}</div><h3>Tones</h3><div class="chanter-choice-grid" id="chanterTones">${TONES.map(x=>`<label><input type="checkbox" value="${x}" ${cur.tones.includes(x)?'checked':''}> <span><strong>${x}</strong></span></label>`).join('')}</div><div class="chanter-actions"><button class="primary" id="saveChanterLoadout" type="button">Save repertoire</button></div>`;
    const check=()=>{const ks=[...b.querySelectorAll('#chanterKeys input:checked')],ts=[...b.querySelectorAll('#chanterTones input:checked')],n=ks.length+ts.length,ok=ks.length>=1&&ts.length>=1&&n<=max;b.querySelector('#chanterCount').textContent=`${n} / ${max} choices used${!ks.length?' · choose a key':''}${!ts.length?' · choose a tone':''}${n>max?' · too many choices':''}`;b.querySelector('#saveChanterLoadout').disabled=!ok};
    b.querySelectorAll('input[type=checkbox]').forEach(i=>i.onchange=check);check();
    b.querySelector('#saveChanterLoadout').onclick=()=>{const keys=[...b.querySelectorAll('#chanterKeys input:checked')].map(x=>x.value),tones=[...b.querySelectorAll('#chanterTones input:checked')].map(x=>x.value);write({base:cur.base,keys,tones});m.classList.add('hidden')};m.classList.remove('hidden');
  }
  function wlpSize(){const v=String(document.getElementById('wlp')?.value||document.getElementById('wlpBase')?.value||'d6');return Number(v.replace(/\D/g,''))||6}
  function level(){return Number(document.getElementById('level')?.value)||1}
  function toneEffect(tone,key){const k=KEYS[key],w=wlpSize(),lvl=level(),bonus=lvl>=40?20:lvl>=20?10:0;if(!k)return '';
    if(tone==='Calm')return `Each target recovers ${k.recovery} equal to ${10+2*w+bonus}. ${k.recovery==='Mind Points'?'This has no effect on the singer.':''}`.trim();
    if(tone==='Energetic')return `Until the start of your next turn, when a target succeeds on a Check including ${k.attr} and that Check can advance or turn back a Clock, they may fill or erase one additional section.`;
    if(tone==='Frantic')return `Each target suffers ${2*w+(lvl>=40?10:lvl>=20?5:0)} ${k.type} damage.`;
    if(tone==='Haunting')return `Each target suffers ${k.status}. Each target also loses Resistance to ${k.type} damage, if they have it, until the start of your next turn.`;
    if(tone==='Lively')return `Each target treats their ${k.attr} as one die size higher, up to d12, until the start of your next turn.`;
    if(tone==='Menacing')return `The first time each target suffers damage before the start of your next turn, that damage becomes ${k.type}. This triggers separately for each target.`;
    if(tone==='Solemn')return `Each target recovers from ${k.status}. Each target also gains Resistance to ${k.type} damage until the start of your next turn.`;
    return '';
  }
  function openComposer(){
    const info=learnedSummary();if(!info.state.keys.length||!info.state.tones.length){openConfig();return}
    const m=modal(),b=document.getElementById('chanterModalBody');
    b.innerHTML=`<p class="eyebrow">Chanter · Magichant</p><h2>Sing a Verse</h2><p class="chanter-help">Combine one learned volume, key and tone. You can sing only one verse per turn.</p><div class="chanter-compose"><label>Volume<select id="chantVolume">${Object.keys(VOLUMES).map(x=>`<option>${x}</option>`).join('')}</select></label><label>Key<select id="chantKey">${info.state.keys.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Tone<select id="chantTone">${info.state.tones.map(x=>`<option>${x}</option>`).join('')}</select></label></div><article class="chanter-result" id="chantResult"></article><div class="chanter-actions"><button class="secondary" id="editChanterRep" type="button">Edit repertoire</button></div>`;
    const recalc=()=>{const v=b.querySelector('#chantVolume').value,k=b.querySelector('#chantKey').value,t=b.querySelector('#chantTone').value,vol=VOLUMES[v];b.querySelector('#chantResult').innerHTML=`<div><strong>${esc(v)} · ${esc(k)} · ${esc(t)}</strong><b>${vol.mp} MP</b></div><small>Targets</small><p>${esc(vol.targets)}</p><small>Effect</small><p>${esc(toneEffect(t,k))}</p>`};
    b.querySelectorAll('select').forEach(s=>s.onchange=recalc);b.querySelector('#editChanterRep').onclick=openConfig;recalc();m.classList.remove('hidden');
  }
  function renderSurface(){
    document.querySelector('.chanter-build-tools')?.remove();if(!chanterPresent()||!magichantRow())return;
    const active=document.querySelector('.build-tab.active')?.dataset.build;if(active!=='skills'&&active!=='classes')return;
    const actions=document.querySelector('#buildMenuBody .build-actions');if(!actions)return;
    const info=learnedSummary(),box=document.createElement('section');box.className='chanter-build-tools';
    box.innerHTML=`<div><p class="eyebrow">Chanter · Magichant</p><strong>Verse Repertoire</strong><small>All volumes · ${info.state.keys.length?info.state.keys.join(', '):'No key chosen'} · ${info.state.tones.length?info.state.tones.join(', '):'No tone chosen'}</small></div><div><button class="secondary chanter-config" type="button">Configure</button><button class="primary chanter-compose-btn" type="button" ${info.state.keys.length&&info.state.tones.length?'':'disabled'}>Compose Verse</button></div>`;
    actions.insertAdjacentElement('afterend',box);box.querySelector('.chanter-config').onclick=openConfig;box.querySelector('.chanter-compose-btn').onclick=openComposer;
  }
  function injectAction(){
    const host=document.getElementById('sessionActionBody');if(!host||!chanterPresent()||!magichantRow())return;const mode=host.dataset.mode;if(mode!=='skills'&&mode!=='favourites')return;if(host.querySelector('[data-chanter-action]'))return;
    const card=document.createElement('article');card.className='a2-card chanter-action-card';card.dataset.chanterAction='1';card.innerHTML='<button class="a2-open" type="button"><span class="a2-kind">♫ SKILL · CHANTER</span><strong>Sing Verse</strong><small>Magichant · Action</small><p>Combine a learned volume, key and tone.</p><span class="a2-more">Compose verse ›</span></button>';card.querySelector('button').onclick=e=>{e.stopPropagation();openComposer()};host.prepend(card);
  }
  const style=document.createElement('style');style.textContent=`
  .chanter-build-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 12px;padding:12px 14px;border:1px solid rgba(183,127,225,.3);border-radius:12px;background:linear-gradient(120deg,rgba(99,57,133,.12),rgba(216,177,96,.06))}.chanter-build-tools>div:first-child{display:grid;gap:3px}.chanter-build-tools .eyebrow{margin:0}.chanter-build-tools small{opacity:.68}.chanter-build-tools>div:last-child{display:flex;gap:7px}.chanter-modal{position:fixed;inset:0;z-index:2100;display:grid;place-items:center;padding:14px;background:rgba(2,4,8,.88);backdrop-filter:blur(7px)}.chanter-modal.hidden{display:none!important}.chanter-dialog{position:relative;width:min(760px,96vw);max-height:90vh;overflow:auto;padding:26px;border:1px solid rgba(211,171,91,.4);border-radius:18px;background:linear-gradient(145deg,#11151d,#1a141d);box-shadow:0 25px 80px rgba(0,0,0,.65)}.chanter-close{position:absolute!important;right:12px;top:12px;width:38px;height:38px;padding:0!important;border-radius:50%!important}.chanter-help{max-width:660px;line-height:1.55;opacity:.78}.chanter-count{margin:12px 0;padding:9px 11px;border-radius:9px;background:rgba(216,177,96,.08);color:#e2c783}.chanter-choice-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin:8px 0 18px}.chanter-choice-grid label{display:flex;gap:8px;align-items:flex-start;padding:10px;border:1px solid rgba(216,177,96,.18);border-radius:9px;background:rgba(255,255,255,.02)}.chanter-choice-grid small{display:block;margin-top:2px;font-size:.7rem;opacity:.65}.chanter-actions{display:flex;gap:8px;justify-content:flex-end;margin-top:18px}.chanter-compose{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0}.chanter-compose label{display:grid;gap:5px}.chanter-result{padding:16px;border:1px solid rgba(183,127,225,.3);border-radius:12px;background:rgba(105,69,130,.08)}.chanter-result>div{display:flex;justify-content:space-between;gap:12px;align-items:center}.chanter-result b{color:#8bc7e9}.chanter-result small{display:block;margin-top:12px;text-transform:uppercase;letter-spacing:.12em;color:#d8b160;font-size:.62rem}.chanter-result p{margin:5px 0 0;line-height:1.55}.chanter-action-card{border-color:rgba(183,127,225,.32)!important}
  @media(max-width:640px){.chanter-build-tools{align-items:stretch;flex-direction:column}.chanter-build-tools>div:last-child{display:grid;grid-template-columns:1fr 1fr}.chanter-choice-grid{grid-template-columns:1fr}.chanter-compose{grid-template-columns:1fr}.chanter-dialog{padding:22px 17px}}
  `;document.head.appendChild(style);
  function boot(){const body=document.getElementById('buildMenuBody');if(!body){setTimeout(boot,100);return}renderSurface();new MutationObserver(()=>requestAnimationFrame(()=>{renderSurface();injectAction()})).observe(body,{childList:true,subtree:false});document.addEventListener('click',e=>{if(e.target.closest?.('.build-tab,[data-action-tab]'))setTimeout(()=>{renderSurface();injectAction()},30)},true);document.getElementById('skillsEditor')?.addEventListener('input',()=>setTimeout(()=>{renderSurface();injectAction()},0));document.getElementById('classesEditor')?.addEventListener('input',()=>setTimeout(()=>{renderSurface();injectAction()},0));const a=document.getElementById('sessionActionBody');if(a)new MutationObserver(()=>requestAnimationFrame(injectAction)).observe(a,{childList:true});setInterval(injectAction,700)}
  boot();
})();