const CONFIG = window.AESTRA_CONFIG || {};
const STATUS_OPTIONS = ["Slow", "Dazed", "Weak", "Shaken", "Enraged", "Poisoned"];
const DEMO_KEY = "aestra-character-demo-v1";
const els = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
let supabase = null, currentUser = null, currentCharacterId = null, isDemo = false, isGM = false;
let gmCharacters = [], gmEditingCharacter = null, gmEditingStatuses = [];

const state = {
  name:"Iris", player_name:"Player", identity:"Princess of Rübenberg", theme:"Duty", origin:"Rübenberg", level:5,
  portrait_url:"", mig:"d8", dex:"d10", ins:"d8", wlp:"d10",
  hp_current:31, hp_max:38, mp_current:42, mp_max:55, ip_current:4, ip_max:6, fabula_points:3,
  initiative:2, defence:10, magic_defence:11, crisis:19,
  statuses:[], classes:"", skills:"", equipment:"", spells:"", bonds:"", notes:""
};

const configured = () => Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);
const clamp = (n,min,max) => { n=Number(n); return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min; };
const escapeHtml = v => String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
function setMessage(t){ els.authMessage.textContent=t||""; }
function setSaveStatus(t){ els.saveStatus.textContent=t; }

async function initSupabase(){
  if(!configured()) return;
  try{
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data } = await supabase.auth.getSession();
    if(data.session){ currentUser=data.session.user; await enterApp(); }
    else els.connectionBadge.textContent="Supabase ready";
  }catch(err){ console.error(err); els.connectionBadge.textContent="Supabase unavailable"; }
}

function wireStatusChips(){
  els.statuses.innerHTML="";
  STATUS_OPTIONS.forEach(name=>{
    const b=document.createElement('button'); b.type='button'; b.className='status-chip'; b.textContent=name;
    b.addEventListener('click',()=>{ const s=new Set(state.statuses); s.has(name)?s.delete(name):s.add(name); state.statuses=[...s]; renderStatuses(); markDirty(); });
    els.statuses.appendChild(b);
  });
  renderStatuses();
}
function renderStatuses(){ [...els.statuses.children].forEach(b=>b.classList.toggle('active',state.statuses.includes(b.textContent))); }
function renderResources(){
  [['hp','hp_current','hp_max'],['mp','mp_current','mp_max'],['ip','ip_current','ip_max']].forEach(([short,nowKey,maxKey])=>{
    state[nowKey]=clamp(state[nowKey],0,Math.max(0,state[maxKey]));
    els[`${short}Now`].textContent=state[nowKey]; els[`${short}MaxText`].textContent=state[maxKey];
    els[`${short}Bar`].style.width=`${state[maxKey]?(state[nowKey]/state[maxKey])*100:0}%`;
  });
  els.fpText.textContent=state.fabula_points;
}
function renderPortrait(){
  const url=state.portrait_url.trim(); els.portraitUrl.value=url;
  if(url){ els.portraitImg.src=url; els.portraitImg.classList.remove('hidden'); els.portraitFallback.classList.add('hidden'); }
  else { els.portraitImg.removeAttribute('src'); els.portraitImg.classList.add('hidden'); els.portraitFallback.classList.remove('hidden'); els.portraitFallback.textContent=(state.name||'?').slice(0,1).toUpperCase(); }
}
function renderForm(){
  const map={charName:'name',playerName:'player_name',identity:'identity',theme:'theme',origin:'origin',level:'level',mig:'mig',dex:'dex',ins:'ins',wlp:'wlp',hpMax:'hp_max',mpMax:'mp_max',ipMax:'ip_max',initiative:'initiative',defence:'defence',magicDefence:'magic_defence',crisis:'crisis',classes:'classes',skills:'skills',equipment:'equipment',spells:'spells',bonds:'bonds',notes:'notes'};
  Object.entries(map).forEach(([id,key])=>els[id].value=state[key]??''); renderResources(); renderPortrait(); renderStatuses();
}
function pullForm(){
  const textMap={charName:'name',playerName:'player_name',identity:'identity',theme:'theme',origin:'origin',mig:'mig',dex:'dex',ins:'ins',wlp:'wlp',classes:'classes',skills:'skills',equipment:'equipment',spells:'spells',bonds:'bonds',notes:'notes'};
  Object.entries(textMap).forEach(([id,key])=>state[key]=els[id].value.trim());
  const numMap={level:'level',hpMax:'hp_max',mpMax:'mp_max',ipMax:'ip_max',initiative:'initiative',defence:'defence',magicDefence:'magic_defence',crisis:'crisis'};
  Object.entries(numMap).forEach(([id,key])=>state[key]=Number(els[id].value)||0); state.portrait_url=els.portraitUrl.value.trim();
}
function markDirty(){ setSaveStatus("Unsaved changes"); }
function showApp(){ els.authView.classList.add('hidden'); els.appView.classList.remove('hidden'); els.logoutBtn.classList.toggle('hidden',isDemo); }
function showAuth(){ els.appView.classList.add('hidden'); els.authView.classList.remove('hidden'); els.logoutBtn.classList.add('hidden'); }

async function enterDemo(){ isDemo=true; isGM=true; currentUser={id:'demo-user',email:'demo@local'}; els.connectionBadge.textContent='Local demo'; const saved=localStorage.getItem(DEMO_KEY); if(saved){try{Object.assign(state,JSON.parse(saved));}catch{}} showApp(); renderForm(); await loadGMDashboard(); }

async function enterApp(){
  isDemo=false; showApp();
  const {data:profile,error:profileError}=await supabase.from('profiles').select('id,is_gm,display_name').eq('id',currentUser.id).maybeSingle();
  if(profileError) console.error(profileError);
  isGM=profile?.is_gm===true;
  document.querySelector('[data-view="gm"]').classList.toggle('hidden',!isGM);
  els.connectionBadge.textContent=isGM?`GM · ${currentUser.email}`:currentUser.email;
  const {data,error}=await supabase.from('characters').select('*').eq('owner_id',currentUser.id).eq('campaign_id',CONFIG.campaignId).maybeSingle();
  if(error) console.error(error); if(data){ currentCharacterId=data.id; Object.assign(state,data); }
  renderForm(); if(isGM) await loadGMDashboard();
}

async function saveCharacter(){
  pullForm(); renderResources(); renderPortrait();
  if(isDemo){ localStorage.setItem(DEMO_KEY,JSON.stringify(state)); setSaveStatus('Saved locally'); await loadGMDashboard(); return; }
  if(!supabase||!currentUser){ setSaveStatus('Not connected'); return; }
  setSaveStatus('Saving…');
  const payload={...state,owner_id:currentUser.id,campaign_id:CONFIG.campaignId,updated_at:new Date().toISOString()}; delete payload.id; delete payload.created_at;
  const result=currentCharacterId?await supabase.from('characters').update(payload).eq('id',currentCharacterId).select().single():await supabase.from('characters').insert(payload).select().single();
  if(result.error){ setSaveStatus(`Save failed: ${result.error.message}`); return; }
  currentCharacterId=result.data.id; Object.assign(state,result.data); setSaveStatus('Saved'); if(isGM) await loadGMDashboard();
}

function gmCard(c){
  const statuses=(c.statuses||[]).map(s=>`<span class="badge">${escapeHtml(s)}</span>`).join('')||'<span class="muted">No statuses</span>';
  return `<article class="panel gm-card" data-char-id="${c.id}">
    <div class="gm-name"><div><p class="eyebrow">${escapeHtml(c.player_name||'Player')}</p><h3>${escapeHtml(c.name||'Unnamed')}</h3></div><span class="badge">Lv ${Number(c.level)||1}</span></div>
    <div class="mini-resources"><div class="mini"><span>HP</span><strong>${Number(c.hp_current)||0}/${Number(c.hp_max)||0}</strong></div><div class="mini"><span>MP</span><strong>${Number(c.mp_current)||0}/${Number(c.mp_max)||0}</strong></div><div class="mini"><span>IP</span><strong>${Number(c.ip_current)||0}/${Number(c.ip_max)||0}</strong></div><div class="mini"><span>FP</span><strong>${Number(c.fabula_points)||0}</strong></div></div>
    <div class="chips">${statuses}</div>
    <div class="gm-quick"><button type="button" data-quick="hp" data-delta="-1">HP −1</button><button type="button" data-quick="hp" data-delta="1">HP +1</button><button type="button" data-quick="fp" data-delta="1">FP +1</button></div>
    <button class="secondary gm-open" type="button">Open sheet</button>
  </article>`;
}

async function loadGMDashboard(){
  els.gmCards.innerHTML='<p class="muted">Loading characters…</p>';
  if(isDemo){ gmCharacters=[{...state,id:'demo-character'}]; els.gmCards.innerHTML=gmCharacters.map(gmCard).join(''); wireGmCards(); return; }
  if(!isGM){ els.gmCards.innerHTML='<p class="muted">GM access required.</p>'; return; }
  const {data,error}=await supabase.from('characters').select('*').eq('campaign_id',CONFIG.campaignId).order('name');
  if(error){ els.gmCards.innerHTML=`<p class="message">${escapeHtml(error.message)}</p>`; return; }
  gmCharacters=data||[];
  els.gmCards.innerHTML=gmCharacters.length?gmCharacters.map(gmCard).join(''):'<article class="panel"><p class="muted">No saved characters yet. Once a player saves their sheet, it will appear here.</p></article>';
  wireGmCards();
}

function wireGmCards(){
  els.gmCards.querySelectorAll('.gm-card').forEach(card=>{
    const id=card.dataset.charId;
    card.querySelector('.gm-open').addEventListener('click',()=>openGmEditor(id));
    card.querySelectorAll('[data-quick]').forEach(btn=>btn.addEventListener('click',()=>quickGmAdjust(id,btn.dataset.quick,Number(btn.dataset.delta))));
  });
}
async function quickGmAdjust(id,kind,delta){
  const c=gmCharacters.find(x=>x.id===id); if(!c) return;
  let patch={updated_at:new Date().toISOString()};
  if(kind==='hp') patch.hp_current=clamp((Number(c.hp_current)||0)+delta,0,Number(c.hp_max)||0);
  if(kind==='fp') patch.fabula_points=Math.max(0,(Number(c.fabula_points)||0)+delta);
  if(isDemo){ Object.assign(c,patch); Object.assign(state,c); await loadGMDashboard(); return; }
  const {error}=await supabase.from('characters').update(patch).eq('id',id); if(error){alert(error.message);return;} await loadGMDashboard();
}

function renderGmStatusChips(){
  els.gmStatuses.innerHTML='';
  STATUS_OPTIONS.forEach(name=>{
    const b=document.createElement('button'); b.type='button'; b.className='status-chip'; b.textContent=name; b.classList.toggle('active',gmEditingStatuses.includes(name));
    b.addEventListener('click',()=>{ const s=new Set(gmEditingStatuses); s.has(name)?s.delete(name):s.add(name); gmEditingStatuses=[...s]; renderGmStatusChips(); });
    els.gmStatuses.appendChild(b);
  });
}
function openGmEditor(id){
  const c=gmCharacters.find(x=>x.id===id); if(!c) return; gmEditingCharacter={...c}; gmEditingStatuses=[...(c.statuses||[])];
  els.gmEditTitle.textContent=c.name||'Unnamed'; els.gmEditPlayer.textContent=`Player: ${c.player_name||'Unknown'}`;
  const map={gmName:'name',gmLevel:'level',gmIdentity:'identity',gmTheme:'theme',gmOrigin:'origin',gmPlayerName:'player_name',gmHpCurrent:'hp_current',gmHpMax:'hp_max',gmMpCurrent:'mp_current',gmMpMax:'mp_max',gmIpCurrent:'ip_current',gmIpMax:'ip_max',gmFabulaPoints:'fabula_points',gmClasses:'classes',gmSkills:'skills',gmEquipment:'equipment',gmSpells:'spells',gmBonds:'bonds',gmNotes:'notes'};
  Object.entries(map).forEach(([id,key])=>els[id].value=c[key]??''); renderGmStatusChips(); els.gmSaveStatus.textContent=''; els.gmEditor.classList.remove('hidden'); els.gmEditor.scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveGmCharacter(){
  if(!gmEditingCharacter) return; els.gmSaveStatus.textContent='Saving…';
  const t=id=>els[id].value.trim(), n=id=>Number(els[id].value)||0;
  const patch={name:t('gmName'),level:n('gmLevel'),identity:t('gmIdentity'),theme:t('gmTheme'),origin:t('gmOrigin'),player_name:t('gmPlayerName'),hp_current:n('gmHpCurrent'),hp_max:n('gmHpMax'),mp_current:n('gmMpCurrent'),mp_max:n('gmMpMax'),ip_current:n('gmIpCurrent'),ip_max:n('gmIpMax'),fabula_points:n('gmFabulaPoints'),classes:t('gmClasses'),skills:t('gmSkills'),equipment:t('gmEquipment'),spells:t('gmSpells'),bonds:t('gmBonds'),notes:t('gmNotes'),statuses:gmEditingStatuses,updated_at:new Date().toISOString()};
  patch.hp_current=clamp(patch.hp_current,0,Math.max(0,patch.hp_max)); patch.mp_current=clamp(patch.mp_current,0,Math.max(0,patch.mp_max)); patch.ip_current=clamp(patch.ip_current,0,Math.max(0,patch.ip_max));
  if(isDemo){ Object.assign(state,patch); gmEditingCharacter={...gmEditingCharacter,...patch}; els.gmSaveStatus.textContent='Saved locally'; await loadGMDashboard(); return; }
  const {data,error}=await supabase.from('characters').update(patch).eq('id',gmEditingCharacter.id).select().single();
  if(error){ els.gmSaveStatus.textContent=`Save failed: ${error.message}`; return; }
  gmEditingCharacter=data; els.gmSaveStatus.textContent='Saved'; await loadGMDashboard();
}

els.authForm.addEventListener('submit',async e=>{e.preventDefault();if(!configured()){setMessage('Supabase is not configured yet.');return;}setMessage('Signing in…');const {data,error}=await supabase.auth.signInWithPassword({email:els.emailInput.value.trim(),password:els.passwordInput.value});if(error){setMessage(error.message);return;}currentUser=data.user;setMessage('');await enterApp();});
els.signUpBtn.addEventListener('click',async()=>{const redirectTo='https://sladeykins-glitch.github.io/aestra-character-tracker/';const {error}=await supabase.auth.signUp({email:els.emailInput.value.trim(),password:els.passwordInput.value,options:{emailRedirectTo:redirectTo}});setMessage(error?error.message:'Account created. Check your email, confirm it, then return here and sign in.');});
els.demoBtn.addEventListener('click',enterDemo); els.logoutBtn.addEventListener('click',async()=>{if(supabase)await supabase.auth.signOut();currentUser=null;currentCharacterId=null;showAuth();});
els.saveBtn.addEventListener('click',saveCharacter); els.refreshGmBtn.addEventListener('click',loadGMDashboard); els.gmCloseEditor.addEventListener('click',()=>els.gmEditor.classList.add('hidden')); els.gmSaveBtn.addEventListener('click',saveGmCharacter);
els.fpMinus.addEventListener('click',()=>{state.fabula_points=Math.max(0,state.fabula_points-1);renderResources();markDirty();}); els.fpPlus.addEventListener('click',()=>{state.fabula_points+=1;renderResources();markDirty();});
els.portraitUrl.addEventListener('change',()=>{state.portrait_url=els.portraitUrl.value.trim();renderPortrait();markDirty();}); els.portraitImg.addEventListener('error',()=>{els.portraitImg.classList.add('hidden');els.portraitFallback.classList.remove('hidden');});
document.querySelectorAll('.resource-card').forEach(card=>card.querySelectorAll('[data-delta]').forEach(btn=>btn.addEventListener('click',()=>{const short=card.dataset.resource,key=`${short}_current`,maxKey=`${short}_max`;pullForm();state[key]=clamp(state[key]+Number(btn.dataset.delta),0,state[maxKey]);renderResources();markDirty();})));
['hpMax','mpMax','ipMax'].forEach(id=>els[id].addEventListener('change',()=>{pullForm();renderResources();markDirty();}));
[...document.querySelectorAll('#sheetView input,#sheetView select,#sheetView textarea')].forEach(el=>{if(!['portraitUrl','hpMax','mpMax','ipMax'].includes(el.id))el.addEventListener('input',markDirty);});
document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',async()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');const view=tab.dataset.view;els.sheetView.classList.toggle('hidden',view!=='sheet');els.gmView.classList.toggle('hidden',view!=='gm');if(view==='gm')await loadGMDashboard();}));
wireStatusChips(); renderForm(); initSupabase();
