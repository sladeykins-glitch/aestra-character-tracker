const CONFIG = window.AESTRA_CONFIG || {};
const STATUS_OPTIONS = ["Slow", "Dazed", "Weak", "Shaken", "Enraged", "Poisoned"];
const DEMO_KEY = "aestra-character-demo-v1";

const els = Object.fromEntries([...document.querySelectorAll('[id]')].map(el => [el.id, el]));
let supabase = null;
let currentUser = null;
let currentCharacterId = null;
let isDemo = false;
let isGM = false;

const state = {
  name: "Iris", player_name: "Player", identity: "Princess of Rübenberg", theme: "Duty", origin: "Rübenberg", level: 5,
  portrait_url: "", mig: "d8", dex: "d10", ins: "d8", wlp: "d10",
  hp_current: 31, hp_max: 38, mp_current: 42, mp_max: 55, ip_current: 4, ip_max: 6, fabula_points: 3,
  initiative: 2, defence: 10, magic_defence: 11, crisis: 19,
  statuses: [], classes: "", skills: "", equipment: "", spells: "", bonds: "", notes: ""
};

function configured() { return Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey); }
function clamp(n,min,max){ n=Number(n); return Number.isFinite(n) ? Math.min(max,Math.max(min,n)) : min; }
function setMessage(text){ els.authMessage.textContent=text || ""; }
function setSaveStatus(text){ els.saveStatus.textContent=text; }

async function initSupabase(){
  if(!configured()) return;
  try{
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey);
    const { data } = await supabase.auth.getSession();
    if(data.session){ currentUser = data.session.user; await enterApp(); }
    els.connectionBadge.textContent = "Supabase ready";
  }catch(err){
    console.error(err); els.connectionBadge.textContent = "Supabase unavailable";
  }
}

function wireStatusChips(){
  els.statuses.innerHTML = "";
  STATUS_OPTIONS.forEach(name => {
    const b=document.createElement('button'); b.type='button'; b.className='status-chip'; b.textContent=name;
    b.addEventListener('click',()=>{ const set=new Set(state.statuses); set.has(name)?set.delete(name):set.add(name); state.statuses=[...set]; renderStatuses(); markDirty(); });
    els.statuses.appendChild(b);
  });
  renderStatuses();
}
function renderStatuses(){
  [...els.statuses.children].forEach(b=>b.classList.toggle('active',state.statuses.includes(b.textContent)));
}

function renderResources(){
  [['hp','hp_current','hp_max'],['mp','mp_current','mp_max'],['ip','ip_current','ip_max']].forEach(([short,nowKey,maxKey])=>{
    state[nowKey]=clamp(state[nowKey],0,Math.max(0,state[maxKey]));
    els[`${short}Now`].textContent=state[nowKey]; els[`${short}MaxText`].textContent=state[maxKey];
    els[`${short}Bar`].style.width = `${state[maxKey] ? (state[nowKey]/state[maxKey])*100 : 0}%`;
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
  Object.entries(map).forEach(([id,key])=>{ els[id].value=state[key] ?? ''; });
  renderResources(); renderPortrait(); renderStatuses();
}
function pullForm(){
  const textMap={charName:'name',playerName:'player_name',identity:'identity',theme:'theme',origin:'origin',mig:'mig',dex:'dex',ins:'ins',wlp:'wlp',classes:'classes',skills:'skills',equipment:'equipment',spells:'spells',bonds:'bonds',notes:'notes'};
  Object.entries(textMap).forEach(([id,key])=>state[key]=els[id].value.trim());
  const numMap={level:'level',hpMax:'hp_max',mpMax:'mp_max',ipMax:'ip_max',initiative:'initiative',defence:'defence',magicDefence:'magic_defence',crisis:'crisis'};
  Object.entries(numMap).forEach(([id,key])=>state[key]=Number(els[id].value)||0);
  state.portrait_url=els.portraitUrl.value.trim();
}
function markDirty(){ setSaveStatus("Unsaved changes"); }

function showApp(){ els.authView.classList.add('hidden'); els.appView.classList.remove('hidden'); els.logoutBtn.classList.toggle('hidden',isDemo); }
function showAuth(){ els.appView.classList.add('hidden'); els.authView.classList.remove('hidden'); els.logoutBtn.classList.add('hidden'); }

async function enterDemo(){
  isDemo=true; isGM=true; currentUser={id:'demo-user',email:'demo@local'}; els.connectionBadge.textContent='Local demo';
  const saved=localStorage.getItem(DEMO_KEY); if(saved){ try{Object.assign(state,JSON.parse(saved));}catch{} }
  showApp(); renderForm(); await loadGMDashboard();
}

async function enterApp(){
  isDemo=false; showApp(); els.connectionBadge.textContent=currentUser?.email || 'Connected';
  const { data: profile } = await supabase.from('profiles').select('is_gm').eq('id',currentUser.id).maybeSingle();
  isGM=Boolean(profile?.is_gm); document.querySelector('[data-view="gm"]').classList.toggle('hidden',!isGM);
  const { data, error } = await supabase.from('characters').select('*').eq('owner_id',currentUser.id).eq('campaign_id',CONFIG.campaignId).maybeSingle();
  if(error) console.error(error);
  if(data){ currentCharacterId=data.id; Object.assign(state,data); }
  renderForm(); if(isGM) await loadGMDashboard();
}

async function saveCharacter(){
  pullForm(); renderResources(); renderPortrait();
  if(isDemo){ localStorage.setItem(DEMO_KEY,JSON.stringify(state)); setSaveStatus('Saved locally'); await loadGMDashboard(); return; }
  if(!supabase || !currentUser){ setSaveStatus('Not connected'); return; }
  setSaveStatus('Saving…');
  const payload={...state,owner_id:currentUser.id,campaign_id:CONFIG.campaignId,updated_at:new Date().toISOString()};
  delete payload.id; delete payload.created_at;
  let result;
  if(currentCharacterId) result=await supabase.from('characters').update(payload).eq('id',currentCharacterId).select().single();
  else result=await supabase.from('characters').insert(payload).select().single();
  if(result.error){ console.error(result.error); setSaveStatus(`Save failed: ${result.error.message}`); return; }
  currentCharacterId=result.data.id; Object.assign(state,result.data); setSaveStatus('Saved'); if(isGM) await loadGMDashboard();
}

function gmCard(c){
  const statuses=(c.statuses||[]).map(s=>`<span class="badge">${escapeHtml(s)}</span>`).join('') || '<span class="muted">No statuses</span>';
  return `<article class="panel gm-card"><div class="gm-name"><div><p class="eyebrow">${escapeHtml(c.player_name||'Player')}</p><h3>${escapeHtml(c.name||'Unnamed')}</h3></div><span class="badge">Lv ${Number(c.level)||1}</span></div><div class="mini-resources"><div class="mini"><span>HP</span><strong>${Number(c.hp_current)||0}/${Number(c.hp_max)||0}</strong></div><div class="mini"><span>MP</span><strong>${Number(c.mp_current)||0}/${Number(c.mp_max)||0}</strong></div><div class="mini"><span>IP</span><strong>${Number(c.ip_current)||0}/${Number(c.ip_max)||0}</strong></div></div><div class="chips">${statuses}</div></article>`;
}
function escapeHtml(v){ return String(v??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch])); }

async function loadGMDashboard(){
  els.gmCards.innerHTML='<p class="muted">Loading characters…</p>';
  if(isDemo){ els.gmCards.innerHTML=gmCard(state); return; }
  if(!isGM){ els.gmCards.innerHTML='<p class="muted">GM access required.</p>'; return; }
  const { data,error }=await supabase.from('characters').select('*').eq('campaign_id',CONFIG.campaignId).order('name');
  if(error){ els.gmCards.innerHTML=`<p class="message">${escapeHtml(error.message)}</p>`; return; }
  els.gmCards.innerHTML=data?.length ? data.map(gmCard).join('') : '<p class="muted">No characters yet.</p>';
}

els.authForm.addEventListener('submit',async e=>{ e.preventDefault(); if(!configured()){setMessage('Supabase is not configured yet. Use the local demo, or follow README.md.');return;} setMessage('Signing in…'); const {data,error}=await supabase.auth.signInWithPassword({email:els.emailInput.value.trim(),password:els.passwordInput.value}); if(error){setMessage(error.message);return;} currentUser=data.user; setMessage(''); await enterApp(); });
els.signUpBtn.addEventListener('click',async()=>{ if(!configured()){setMessage('Supabase is not configured yet.');return;} const redirectTo='https://sladeykins-glitch.github.io/aestra-character-tracker/'; const {error}=await supabase.auth.signUp({email:els.emailInput.value.trim(),password:els.passwordInput.value,options:{emailRedirectTo:redirectTo}}); setMessage(error?error.message:'Account created. Check your email, confirm it, then return here and sign in.'); });
els.demoBtn.addEventListener('click',enterDemo);
els.logoutBtn.addEventListener('click',async()=>{ if(supabase) await supabase.auth.signOut(); currentUser=null; currentCharacterId=null; showAuth(); });
els.saveBtn.addEventListener('click',saveCharacter);
els.refreshGmBtn.addEventListener('click',loadGMDashboard);
els.fpMinus.addEventListener('click',()=>{state.fabula_points=Math.max(0,state.fabula_points-1);renderResources();markDirty();});
els.fpPlus.addEventListener('click',()=>{state.fabula_points+=1;renderResources();markDirty();});
els.portraitUrl.addEventListener('change',()=>{state.portrait_url=els.portraitUrl.value.trim();renderPortrait();markDirty();});
els.portraitImg.addEventListener('error',()=>{els.portraitImg.classList.add('hidden');els.portraitFallback.classList.remove('hidden');});

document.querySelectorAll('.resource-card').forEach(card=>card.querySelectorAll('[data-delta]').forEach(btn=>btn.addEventListener('click',()=>{const short=card.dataset.resource,key=`${short}_current`,maxKey=`${short}_max`;pullForm();state[key]=clamp(state[key]+Number(btn.dataset.delta),0,state[maxKey]);renderResources();markDirty();})));
['hpMax','mpMax','ipMax'].forEach(id=>els[id].addEventListener('change',()=>{pullForm();renderResources();markDirty();}));
[...document.querySelectorAll('#sheetView input,#sheetView select,#sheetView textarea')].forEach(el=>{if(!['portraitUrl','hpMax','mpMax','ipMax'].includes(el.id)) el.addEventListener('input',markDirty);});

document.querySelectorAll('.tab').forEach(tab=>tab.addEventListener('click',async()=>{document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));tab.classList.add('active');const view=tab.dataset.view;els.sheetView.classList.toggle('hidden',view!=='sheet');els.gmView.classList.toggle('hidden',view!=='gm');if(view==='gm')await loadGMDashboard();}));

wireStatusChips(); renderForm(); initSupabase();
