// Campaign-wide sourcebook settings for Aestra.
(function(){
  const CONFIG=window.AESTRA_CONFIG||{};
  const DEFAULT={
    sources:{'core-1.02':true,'high-fantasy-1.03':true,'natural-fantasy-1.0':true,'techno-fantasy-1.0':true},
    options:{quirks:false,zero_powers:false,technospheres:false}
  };
  const LABELS={
    'core-1.02':'Core','high-fantasy-1.03':'High Fantasy','natural-fantasy-1.0':'Natural Fantasy','techno-fantasy-1.0':'Techno Fantasy'
  };
  let current=structuredClone(DEFAULT),sb=null,loaded=false,loading=null;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isGM=()=>{const tab=document.querySelector('[data-view="gm"]');return !!tab&&!tab.classList.contains('hidden')};
  async function client(){if(sb)return sb;const m=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');sb=m.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);return sb}
  function normalize(row){return{sources:{...DEFAULT.sources,...(row?.enabled_sources||{})},options:{...DEFAULT.options,...(row?.enabled_options||{})}}}
  async function load(force=false){
    if(loaded&&!force)return current;if(loading&&!force)return loading;
    loading=(async()=>{try{const c=await client(),{data:{session}}=await c.auth.getSession();if(!session){current=structuredClone(DEFAULT);return current}const {data,error}=await c.from('campaign_rules_settings').select('*').eq('campaign_id',CONFIG.campaignId).maybeSingle();if(error)throw error;current=normalize(data);loaded=true;applyPickerVisibility();renderGMPanel();document.dispatchEvent(new CustomEvent('aestra:source-settings-changed',{detail:current}));return current}catch(e){console.warn('Campaign source settings unavailable; using defaults.',e);current=structuredClone(DEFAULT);return current}finally{loading=null}})();return loading
  }
  async function save(){if(!isGM())return;try{const c=await client();const {error}=await c.from('campaign_rules_settings').upsert({campaign_id:CONFIG.campaignId,enabled_sources:current.sources,enabled_options:current.options,updated_at:new Date().toISOString()},{onConflict:'campaign_id'});if(error)throw error;loaded=true;applyPickerVisibility();document.dispatchEvent(new CustomEvent('aestra:source-settings-changed',{detail:current}))}catch(e){console.warn('Could not save campaign source settings.',e)}}
  function enabled(id){return current.sources[id]!==false}
  function optionEnabled(id){return current.options[id]===true}
  function sourceIdFromLabel(t){t=String(t||'').trim().toLowerCase();if(t==='core')return'core-1.02';if(t.includes('high fantasy'))return'high-fantasy-1.03';if(t.includes('natural fantasy'))return'natural-fantasy-1.0';if(t.includes('techno fantasy'))return'techno-fantasy-1.0';return null}
  function applyPickerVisibility(){
    document.querySelectorAll('#ubpTabs button').forEach(b=>{const id=sourceIdFromLabel(b.textContent);if(id)b.style.display=enabled(id)?'':'none'});
    const active=document.querySelector('#ubpTabs button.active');if(active&&active.style.display==='none'){document.querySelector('#ubpTabs button:not([style*="display: none"])')?.click()}
  }
  function renderGMPanel(){
    const gm=document.getElementById('gmView');if(!gm||!isGM())return;
    let panel=document.getElementById('campaignSourceSettings');if(!panel){panel=document.createElement('article');panel.id='campaignSourceSettings';panel.className='panel campaign-source-settings';const head=gm.querySelector('.gm-head');head?.after(panel)||gm.prepend(panel)}
    panel.innerHTML=`<div class="css-head"><div><p class="eyebrow">CAMPAIGN RULES</p><h3>Enabled Sourcebooks</h3><small>These choices feed Character Creation, Build pickers and the Rules Compendium.</small></div><span class="css-saved">Aestra ruleset</span></div><div class="css-grid">${Object.entries(LABELS).map(([id,label])=>`<label class="css-source ${id==='core-1.02'?'locked':''}"><input type="checkbox" data-source-id="${id}" ${enabled(id)?'checked':''} ${id==='core-1.02'?'disabled':''}><span><strong>${esc(label)}</strong><small>${id==='core-1.02'?'Required base rules':'Allow character options and rules'}</small></span></label>`).join('')}</div><div class="css-excluded"><span>Excluded optional systems</span><b>Quirks</b><b>Zero Powers</b><b>Technospheres</b></div>`;
    panel.querySelectorAll('[data-source-id]:not(:disabled)').forEach(x=>x.onchange=async()=>{current.sources[x.dataset.sourceId]=x.checked;await save();renderGMPanel()});
  }
  function installStyles(){if(document.getElementById('campaignSettingsStyles'))return;const s=document.createElement('style');s.id='campaignSettingsStyles';s.textContent=`.campaign-source-settings{margin-top:12px}.css-head{display:flex;justify-content:space-between;gap:12px;align-items:start}.css-head h3{margin:2px 0 2px;color:#e6d3a6}.css-head small{font-size:.68rem;color:#8f877a}.css-saved{font-size:.58rem;letter-spacing:.11em;text-transform:uppercase;color:#7dbddd;border:1px solid rgba(94,174,216,.2);padding:5px 8px;border-radius:999px}.css-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-top:11px}.css-source{display:flex!important;align-items:center;gap:8px;padding:10px;border:1px solid rgba(211,171,91,.15);border-radius:11px;background:rgba(255,255,255,.02)}.css-source input{width:17px;height:17px}.css-source span{display:grid;gap:2px}.css-source strong{color:#ddcca6;font-size:.77rem}.css-source small{color:#8f877a;font-size:.58rem}.css-source.locked{opacity:.75}.css-excluded{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:9px;padding-top:9px;border-top:1px solid rgba(211,171,91,.09);font-size:.6rem;color:#857d70}.css-excluded b{padding:4px 7px;border-radius:999px;border:1px solid rgba(182,86,76,.18);background:rgba(124,48,43,.08);color:#c98d84;font-weight:600}@media(max-width:720px){.css-grid{grid-template-columns:1fr 1fr}.css-head{display:grid}}@media(max-width:430px){.css-grid{grid-template-columns:1fr}}`;document.head.appendChild(s)}
  function boot(){installStyles();const body=new MutationObserver(()=>{applyPickerVisibility();renderGMPanel()});body.observe(document.body,{childList:true,subtree:true});load();setTimeout(()=>load(true),900)}
  window.AESTRA_SOURCE_SETTINGS={load,get:()=>current,enabled,optionEnabled,reload:()=>load(true),save};
  boot();
})();