const CONFIG=window.AESTRA_CONFIG||{};
const CAMPAIGN_ID=CONFIG.campaignId;
const DISPLAY_QUERY=new URLSearchParams(location.search).get('display')==='1';
const els=Object.fromEntries([...document.querySelectorAll('[id]')].map(el=>[el.id,el]));
let supabase=null,user=null,isGM=false,state=null,assets=[],party=[],recent=[],filterKind='all',previewUrl='';
const IS_PLAYER_DISPLAY=DISPLAY_QUERY;
const canGMControl=()=>isGM&&!IS_PLAYER_DISPLAY;
const shouldReceivePlayerMap=()=>IS_PLAYER_DISPLAY||!isGM;
let displayInitialized=false,lastDisplaySignature='',displayTransitionTimer=null;
const interactiveMapCache=new Map();
let interactiveMapLoadToken=0;
let mapState=null,mapStateSaveTimer=null,mapBridgeReady=false;
let mapMotionChannel=null,mapMotionReady=false,lastMapMotionSentAt=0;
let browserMapMotionChannel=null;
let mapMirrorPollTimer=null,lastPolledMapMirrorSignature='';
let playerMapStatePollTimer=null,lastPlayerMapStateUpdatedAt='';
let mapStatePersistBusy=false,mapStatePersistPending=null,lastMapStatePersistAt=0;

const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const byId=id=>assets.find(a=>a.id===id)||null;
const pct=(a,b)=>Math.max(0,Math.min(100,b?Number(a||0)/Number(b)*100:0));
const configured=()=>Boolean(CONFIG.supabaseUrl&&CONFIG.supabaseAnonKey&&CAMPAIGN_ID);
const isInteractiveMap=asset=>asset?.kind==='map'&&asset?.metadata?.interactive===true;
const withMapRole=(url,role)=>url+(url.includes('?')?'&':'?')+'aestraRole='+encodeURIComponent(role);

async function ensureSupabase(){
  if(supabase)return supabase;
  if(!configured())throw new Error('Aestra Supabase configuration is missing.');
  const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabase=mod.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey);
  return supabase;
}

function setAuthMessage(message){els.authMessage.textContent=message||''}
function showApp(){els.authGate.classList.add('hidden');els.app.classList.remove('hidden')}
function showAuth(){els.app.classList.add('hidden');els.authGate.classList.remove('hidden')}

async function checkRole(){
  const {data,error}=await supabase.from('profiles').select('is_gm').eq('id',user.id).maybeSingle();
  if(error)throw error;
  isGM=data?.is_gm===true;
  const displayOnly=IS_PLAYER_DISPLAY||!isGM;
  document.body.classList.toggle('display-only',displayOnly);
  if(displayOnly){
    els.gmControls?.classList.add('hidden');
    els.gmQuickControls?.classList.add('hidden');
    els.gmHeader?.classList.add('hidden');
  }
}

async function loadState(){
  const {data,error}=await supabase.from('live_table_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  state=data;
  if(!state&&canGMControl()){
    const fresh={campaign_id:CAMPAIGN_ID,mode:'scene',hud_visible:true,updated_by:user.id};
    const r=await supabase.from('live_table_state').insert(fresh).select().single();
    if(r.error)throw r.error;
    state=r.data;
  }
}

async function loadAssets(){
  const {data,error}=await supabase.from('live_table_assets').select('*').eq('campaign_id',CAMPAIGN_ID).order('created_at',{ascending:false});
  if(error)throw error;
  assets=data||[];
}

async function loadParty(){
  const {data,error}=await supabase.from('live_table_party').select('*').eq('campaign_id',CAMPAIGN_ID).order('name');
  if(error)throw error;
  party=data||[];
}

async function loadMapState(){
  const {data,error}=await supabase.from('live_table_map_state').select('*').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
  if(error)throw error;
  mapState=data||null;
}

function renderParty(){
  if(!state?.hud_visible){els.partyHud.classList.add('hidden');return}
  els.partyHud.classList.remove('hidden');
  if(!party.length){
    els.partyHud.innerHTML='<div class="party-card"><div class="party-portrait">✦</div><div><div class="party-name">PARTY</div><div class="muted" style="font-size:9px">Character sheets will appear here.</div></div></div>';
    return;
  }
  els.partyHud.innerHTML=party.map(c=>{
    const portrait=c.portrait_url
      ? '<img class="party-portrait" src="'+esc(c.portrait_url)+'" alt="'+esc(c.name)+' portrait">'
      : '<div class="party-portrait">'+esc((c.name||'?')[0].toUpperCase())+'</div>';
    const statuses=(c.statuses||[]).map(s=>'<span class="status-pill">'+esc(s)+'</span>').join('');
    return '<article class="party-card">'+portrait+'<div><div class="party-name">'+esc(c.name||'Unnamed')+'</div>'+
      '<div class="resource"><span>HP</span><div class="resource-bar"><i style="width:'+pct(c.hp_current,c.hp_max)+'%"></i></div><b>'+Number(c.hp_current||0)+'/'+Number(c.hp_max||0)+'</b></div>'+
      '<div class="resource mp"><span>MP</span><div class="resource-bar"><i style="width:'+pct(c.mp_current,c.mp_max)+'%"></i></div><b>'+Number(c.mp_current||0)+'/'+Number(c.mp_max||0)+'</b></div>'+
      '<div class="resource ip"><span>IP</span><div class="resource-bar"><i style="width:'+pct(c.ip_current,c.ip_max)+'%"></i></div><b>'+Number(c.ip_current||0)+'/'+Number(c.ip_max||0)+'</b></div>'+
      (statuses?'<div class="status-row">'+statuses+'</div>':'')+'</div></article>';
  }).join('');
}

function setBackdrop(asset){
  els.backdrop.style.backgroundImage=asset?.image_url?'url("'+asset.image_url.replace(/"/g,'%22')+'")':'';
}

function displaySignature(s){
  if(!s)return '';
  return [
    s.mode||'scene',
    s.active_scene_id||'',
    s.map_asset_id||'',
    s.active_reveal_id||'',
    s.pinned_left_id||'',
    s.pinned_right_id||'',
    s.location_title||'',
    s.location_subtitle||'',
    s.hud_visible===false?'hud-off':'hud-on'
  ].join('|');
}

function playDisplayTransition(){
  if(!displayInitialized)return;
  const display=els.playerDisplay;
  if(!display)return;
  if(displayTransitionTimer)clearTimeout(displayTransitionTimer);
  display.classList.remove('display-transitioning');
  void display.offsetWidth;
  display.classList.add('display-transitioning');
  displayTransitionTimer=setTimeout(()=>{
    display.classList.remove('display-transitioning');
    displayTransitionTimer=null;
  },1250);
}

async function fetchInteractiveMapSource(asset){
  if(!asset?.id||!asset?.image_url)throw new Error('Interactive map file is missing.');
  if(interactiveMapCache.has(asset.id))return interactiveMapCache.get(asset.id);
  const response=await fetch(asset.image_url,{cache:'no-store'});
  if(!response.ok)throw new Error('Could not load the interactive map file.');
  const source=await response.text();
  if(!/<html[\s>]/i.test(source)||!/<body[\s>]/i.test(source)){
    throw new Error('The stored world map is not valid HTML.');
  }
  interactiveMapCache.set(asset.id,source);
  return source;
}

function mapSourceForRole(source,role){
  let preparedSource=source;

  const oldPartyMarkup="core.innerHTML='<span class=\"party-symbol\">✦</span><span class=\"party-label\">Party</span>';";
  const caravanMarkup="core.innerHTML='<span class=\"party-symbol party-caravan\" aria-hidden=\"true\"><svg viewBox=\"0 0 72 52\" xmlns=\"http://www.w3.org/2000/svg\"><path class=\"caravan-canopy\" d=\"M17 24c1-9 7-15 18-15 12 0 20 6 21 15H17Z\"/><path class=\"caravan-body\" d=\"M13 23h47l-4 17H18l-5-17Z\"/><path class=\"caravan-trim\" d=\"M18 25h37M26 11v27M44 11v27\"/><path class=\"caravan-tongue\" d=\"M59 32h9l3 4\"/><circle class=\"caravan-wheel\" cx=\"25\" cy=\"42\" r=\"6\"/><circle class=\"caravan-wheel\" cx=\"50\" cy=\"42\" r=\"6\"/><circle class=\"caravan-hub\" cx=\"25\" cy=\"42\" r=\"2\"/><circle class=\"caravan-hub\" cx=\"50\" cy=\"42\" r=\"2\"/><circle class=\"caravan-lantern\" cx=\"62\" cy=\"28\" r=\"2.4\"/></svg></span><span class=\"party-label\">Party Caravan</span>';";
  if(preparedSource.includes(oldPartyMarkup))preparedSource=preparedSource.replace(oldPartyMarkup,caravanMarkup);

  const caravanStyle='<style id="aestra-party-caravan-style">'+
    '#partyToken .party-core{width:34px!important;height:28px!important;border-radius:10px!important;border:1px solid rgba(244,210,132,.36)!important;background:radial-gradient(circle at 50% 45%,rgba(22,28,31,.94),rgba(8,11,14,.96) 72%)!important;box-shadow:0 0 0 2px rgba(31,23,13,.62),0 0 13px rgba(228,178,76,.28),0 0 22px rgba(94,183,215,.10)!important;padding:2px!important}'+
    '#partyToken .party-symbol.party-caravan{display:block;width:30px;height:23px;line-height:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.7)) drop-shadow(0 0 4px rgba(231,190,97,.24));pointer-events:none}'+
    '#partyToken .party-symbol.party-caravan svg{display:block;width:100%;height:100%;overflow:visible}'+
    '#partyToken .caravan-canopy{fill:#d8c28e;stroke:#4a3518;stroke-width:2;stroke-linejoin:round}'+
    '#partyToken .caravan-body{fill:#9a642c;stroke:#3c2814;stroke-width:2;stroke-linejoin:round}'+
    '#partyToken .caravan-trim{fill:none;stroke:#f0d68f;stroke-width:1.6;stroke-linecap:round;opacity:.8}'+
    '#partyToken .caravan-tongue{fill:none;stroke:#d8b46a;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}'+
    '#partyToken .caravan-wheel{fill:#2e241b;stroke:#d8b46a;stroke-width:2}'+
    '#partyToken .caravan-hub{fill:#ecd18a}'+
    '#partyToken .caravan-lantern{fill:#9ee8f2;stroke:#e5ffff;stroke-width:.8;filter:drop-shadow(0 0 3px #73d8e8)}'+
    '#app.party-token-active #partyToken .party-core,#app.party-token-dragging #partyToken .party-core{width:58px!important;height:47px!important;border-radius:14px!important;box-shadow:0 0 0 3px rgba(31,23,13,.72),0 0 25px rgba(228,178,76,.42),0 0 40px rgba(94,183,215,.18),0 10px 24px rgba(0,0,0,.4)!important}'+
    '#app.party-token-active #partyToken .party-symbol.party-caravan,#app.party-token-dragging #partyToken .party-symbol.party-caravan{width:52px;height:40px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.78)) drop-shadow(0 0 7px rgba(231,190,97,.35))}'+
    '#app.party-token-active #partyToken .party-core .party-label,#app.party-token-dragging #partyToken .party-core .party-label{top:54px!important}'+
    '</style>';
  preparedSource=preparedSource.includes('</head>')?preparedSource.replace('</head>',caravanStyle+'</head>'):caravanStyle+preparedSource;

  // Install a live mirror inside the atlas' own script scope. This has access
  // to transient route/drawing state as well as the persisted map data.
  const mirrorAnchor="  const saveKey = 'aestraMapDataV78';";
  const mirrorHelpers=`
  const aLiveMirrorLayerIds = [
    'showTerrain','showMarkers','showRegions','showLabels','showDrawings','showHex',
    'showFog','showWeather','showInfluence','showThreats','showCrystals','showNPCs',
    'showParty','showCamps','subtleCamps','showHudScene','showHudObjectives','showHudClocks'
  ];
  let aLiveMirrorTimer = null;
  let aLiveMirrorLastSentAt = 0;
  let aLiveMirrorLastSignature = '';

  function aCollectLiveMirror() {
    const r = wrap.getBoundingClientRect();
    const fitScale = Math.max(.0001, Math.min(r.width / W, r.height / H));
    const layers = {};
    for (const id of aLiveMirrorLayerIds) {
      const el = document.getElementById(id);
      if (!el) continue;
      layers[id] = el.type === 'checkbox' ? !!el.checked : el.value;
    }
    const liveParty = journeyDisplayPos || (data.travel && data.travel.party) || null;
    return {
      version: 2,
      data: JSON.parse(JSON.stringify(data)),
      layers,
      view: {
        centerX: (r.width / 2 - tx) / Math.max(scale, .0001),
        centerY: (r.height / 2 - ty) / Math.max(scale, .0001),
        zoom: scale / fitScale
      },
      liveParty: liveParty ? {
        x: Number(liveParty.x) || 0,
        y: Number(liveParty.y) || 0,
        visible: liveParty.visible !== false
      } : null
    };
  }

  function aEmitLiveMirrorNow() {
    if (!gmMode) return;
    try {
      const mirror = aCollectLiveMirror();
      const signature = JSON.stringify(mirror);
      if (signature === aLiveMirrorLastSignature) return;
      aLiveMirrorLastSignature = signature;
      aLiveMirrorLastSentAt = performance.now();
      parent.postMessage({type:'aestra-map-mirror', mirror}, '*');
    } catch (err) {
      console.warn('Aestra live mirror failed', err);
    }
  }

  function aScheduleLiveMirror(minGap = 65) {
    if (!gmMode) return;
    if (aLiveMirrorTimer) return;
    const elapsed = performance.now() - aLiveMirrorLastSentAt;
    const wait = Math.max(0, minGap - elapsed);
    aLiveMirrorTimer = setTimeout(() => {
      aLiveMirrorTimer = null;
      aEmitLiveMirrorNow();
    }, wait);
  }

  document.addEventListener('input', () => aScheduleLiveMirror(20));
  document.addEventListener('change', () => aScheduleLiveMirror(20));
  document.addEventListener('click', () => aScheduleLiveMirror(35));
  window.addEventListener('pointermove', () => {
    if (pointerDown || draggingPartyToken || markerDirectDrag || regionLabelDrag ||
        labelDirectDrag || labelTransformDrag || worldPinDrag) {
      aScheduleLiveMirror(55);
    }
  });
  window.addEventListener('pointerup', () => aScheduleLiveMirror(15), true);
  window.addEventListener('pointercancel', () => aScheduleLiveMirror(15), true);
  window.addEventListener('wheel', () => aScheduleLiveMirror(55), {passive:true});
  setInterval(() => {
    if (gmMode && journeyActive) aScheduleLiveMirror(55);
  }, 55);

`;
  if(preparedSource.includes(mirrorAnchor)){
    preparedSource=preparedSource.replace(mirrorAnchor,mirrorHelpers+mirrorAnchor);
  }

  // Programmatic camera moves (focus/centre/animated zoom) also need to be mirrored.
  if(role==='gm'){
    const transformMarker="    renderMarkers();\n\n    // Interior tint fades as the player zooms in.";
    const transformLive="    renderMarkers();\n    if (typeof aScheduleLiveMirror === 'function') aScheduleLiveMirror(55);\n\n    // Interior tint fades as the player zooms in.";
    if(preparedSource.includes(transformMarker))preparedSource=preparedSource.replace(transformMarker,transformLive);
  }

  // Inject a direct bridge immediately before the atlas IIFE closes.
  // Use character codes for newlines so this match cannot be broken by escaping.
  const lf=String.fromCharCode(10);
  const iifeClose=lf+'})();'+lf;
  const directBridgeCode=[
    "  window.AestraLiveBridge={",
    "    version:3,",
    "    role:"+JSON.stringify(role)+",",
    "    collect:function(){",
    "      try{return aCollectLiveMirror()}catch(err){console.warn('Aestra collect failed',err);return null}",
    "    },",
    "    apply:function(mirror){",
    "      if(!mirror)return false;",
    "      try{",
    "        const payload=(mirror.version===2&&mirror.data)?mirror:{version:1,data:mirror};",
    "        if(payload.data){data=JSON.parse(JSON.stringify(payload.data));normalizeData()}",
    "        if(payload.layers){for(const [id,value] of Object.entries(payload.layers)){const el=document.getElementById(id);if(!el)continue;if(el.type==='checkbox')el.checked=!!value;else el.value=value}}",
    "        if(payload.liveParty&&data.travel&&data.travel.party){data.travel.party.x=Number(payload.liveParty.x)||0;data.travel.party.y=Number(payload.liveParty.y)||0;data.travel.party.visible=payload.liveParty.visible!==false}",
    "        const fog=document.getElementById('fogOpacity');if(fog&&data.fog)fog.value=data.fog.opacity||82;",
    "        renderAll();",
    "        if(typeof syncLegendFilters==='function')syncLegendFilters();",
    "        if(payload.view){const r=wrap.getBoundingClientRect();const fitScale=Math.max(.0001,Math.min(r.width/W,r.height/H));const zoom=Math.max(.12,Math.min(8,Number(payload.view.zoom)||1));scale=fitScale*zoom;tx=r.width/2-(Number(payload.view.centerX)||W/2)*scale;ty=r.height/2-(Number(payload.view.centerY)||H/2)*scale;applyTransform()}",
    "        if("+JSON.stringify(role)+"==='player'){setPresentation(true);const exit=document.getElementById('presentationExit');if(exit)exit.style.display='none';const toggle=document.getElementById('presentationToggle');if(toggle)toggle.style.display='none'}",
    "        return true;",
    "      }catch(err){console.warn('Aestra direct apply failed',err);return false}",
    "    },",
    "    applyParty:function(x,y){",
    "      try{if(!data.travel||!data.travel.party)return false;data.travel.party.x=Number(x)||0;data.travel.party.y=Number(y)||0;data.travel.party.visible=true;renderTravel();return true}catch(err){return false}",
    "    },",
    "    present:function(){",
    "      try{setPresentation(true);const exit=document.getElementById('presentationExit');if(exit)exit.style.display='none';const toggle=document.getElementById('presentationToggle');if(toggle)toggle.style.display='none';return true}catch(err){return false}",
    "    }",
    "  };"
  ].join(lf)+lf;
  const closeIndex=preparedSource.lastIndexOf(iifeClose);
  if(closeIndex>=0){
    preparedSource=preparedSource.slice(0,closeIndex)+lf+directBridgeCode+preparedSource.slice(closeIndex);
  }else{
    console.warn('Aestra live bridge injection point was not found');
  }

  // Presentation mode lives inside the atlas' own DOMContentLoaded scope, so
  // force it from inside that scope for player displays.
  if(role==='player'){
    const initMarker="  setTool('pan');\n  renderAll();\n  fit();\n  applyAmbientParallax();";
    const playerInit="  setTool('pan');\n  renderAll();\n  fit();\n  applyAmbientParallax();\n  setTimeout(() => {\n    try {\n      setPresentation(true);\n      const exit=document.getElementById('presentationExit');\n      if(exit) exit.style.display='none';\n      const toggle=document.getElementById('presentationToggle');\n      if(toggle) toggle.style.display='none';\n    } catch (err) {\n      const app=document.getElementById('app');\n      if(app) app.classList.add('presentation');\n    }\n  }, 140);";
    if(preparedSource.includes(initMarker))preparedSource=preparedSource.replace(initMarker,playerInit);
  }

  const playerStyle=role==='player'
    ? '<style id="aestra-live-table-runtime-style">#app.presentation #presentationExit{display:none!important}#app.presentation #presentationToggle{display:none!important}body.aestra-live-embedded{background:#05080b!important}</style>'
    : '<style id="aestra-live-table-runtime-style">body.aestra-live-embedded{background:#05080b!important}</style>';

  const bridge='<script id="aestra-live-table-runtime-bridge">(function(){'+
    'var role='+JSON.stringify(role)+';var applyingRemote=false;'+
    'function sendState(){if(role!=="gm"||applyingRemote)return;try{parent.postMessage({type:"aestra-map-state",state:JSON.parse(JSON.stringify(data))},"*")}catch(e){console.warn("Aestra map sync send failed",e)}}'+
    'function applyState(next){if(!next)return;try{applyingRemote=true;data=JSON.parse(JSON.stringify(next));if(typeof normalizeData==="function")normalizeData();var fog=document.getElementById("fogOpacity");if(fog&&data.fog)fog.value=data.fog.opacity||82;if(typeof renderAll==="function")renderAll()}catch(e){console.warn("Aestra map sync apply failed",e)}finally{setTimeout(function(){applyingRemote=false},180)}}'+
    'function applyMirror(mirror){if(!mirror)return;try{applyingRemote=true;var payload=(mirror.version===2&&mirror.data)?mirror:{version:1,data:mirror};if(payload.data){data=JSON.parse(JSON.stringify(payload.data));if(typeof normalizeData==="function")normalizeData()}if(payload.layers){Object.keys(payload.layers).forEach(function(id){var el=document.getElementById(id);if(!el)return;if(el.type==="checkbox")el.checked=!!payload.layers[id];else el.value=payload.layers[id]})}if(payload.liveParty&&data&&data.travel&&data.travel.party){data.travel.party.x=Number(payload.liveParty.x)||0;data.travel.party.y=Number(payload.liveParty.y)||0;data.travel.party.visible=payload.liveParty.visible!==false}var fog=document.getElementById("fogOpacity");if(fog&&data.fog)fog.value=data.fog.opacity||82;if(typeof renderAll==="function")renderAll();if(typeof syncLegendFilters==="function")syncLegendFilters();if(payload.view&&typeof wrap!=="undefined"){var r=wrap.getBoundingClientRect();var fitScale=Math.max(.0001,Math.min(r.width/W,r.height/H));var zoom=Math.max(.12,Math.min(8,Number(payload.view.zoom)||1));scale=fitScale*zoom;tx=r.width/2-(Number(payload.view.centerX)||W/2)*scale;ty=r.height/2-(Number(payload.view.centerY)||H/2)*scale;if(typeof applyTransform==="function")applyTransform()}}catch(e){console.warn("Aestra live mirror apply failed",e)}finally{setTimeout(function(){applyingRemote=false},120)}}'+
    'function enforcePlayerPresentation(){if(role!=="player")return;var app=document.getElementById("app");if(app)app.classList.add("presentation");var exit=document.getElementById("presentationExit");if(exit)exit.style.display="none";var toggle=document.getElementById("presentationToggle");if(toggle)toggle.style.display="none"}'+
    'function configure(){document.body.classList.add("aestra-live-embedded");try{if(role==="player"){enforcePlayerPresentation();setTimeout(enforcePlayerPresentation,300);setTimeout(enforcePlayerPresentation,900)}else{var app=document.getElementById("app");if(app)app.classList.remove("presentation");if(typeof gmMode!=="undefined"){gmMode=true;if(typeof syncModeLabels==="function")syncModeLabels()}if(typeof renderAll==="function")renderAll()}}catch(e){console.warn("Aestra bridge configure failed",e)}'+
    'try{var originalSave=saveLocal;saveLocal=function(silent){originalSave(silent);sendState()}}catch(e){console.warn("Aestra bridge save hook failed",e)}'+
    'window.addEventListener("message",function(ev){var m=ev.data||{};if(m.type==="aestra-map-mirror-apply"){applyMirror(m.mirror);if(role==="player")setTimeout(enforcePlayerPresentation,25)}else if(m.type==="aestra-map-state-apply"){applyState(m.state);if(role==="player")setTimeout(enforcePlayerPresentation,40)}else if(m.type==="aestra-map-party-motion-apply"&&role==="player"){try{data.travel.party.x=Number(m.x);data.travel.party.y=Number(m.y);data.travel.party.visible=true;if(typeof renderTravel==="function")renderTravel()}catch(e){}}});'+
    'parent.postMessage({type:"aestra-map-ready",role:role},"*");if(role==="gm")setTimeout(function(){try{if(typeof aEmitLiveMirrorNow==="function")aEmitLiveMirrorNow();else sendState()}catch(e){sendState()}},220)}'+
    'if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(configure,120)});else setTimeout(configure,120)})();<\/script>';

  const addition=playerStyle+bridge;
  return preparedSource.includes('</body>')?preparedSource.replace('</body>',addition+'</body>'):preparedSource+addition;
}

async function mountInteractiveMap(asset,role='player'){
  const frame=els.worldMapFrame;
  const token=++interactiveMapLoadToken;
  frame.classList.remove('hidden');
  els.playerDisplay.classList.add('map-live','map-loading');
  try{
    const source=await fetchInteractiveMapSource(asset);
    if(token!==interactiveMapLoadToken)return;
    if(frame.dataset.assetId===asset.id&&frame.dataset.role===role&&frame.srcdoc){
      if(mapState?.state)sendMapStateToFrame();
      return;
    }
    mapBridgeReady=false;
    frame.removeAttribute('src');
    frame.onload=()=>{
      setTimeout(async()=>{
        try{
          const bridge=frame.contentWindow?.AestraLiveBridge;
          if(els.mapImportStatus&&bridge){
            els.mapImportStatus.textContent=(role==='gm')
              ? 'GM atlas bridge connected — full live mirroring active.'
              : 'Player atlas bridge connected — waiting for GM mirror…';
          }
        }catch(_){}
        if(mapState?.state)sendMapStateToFrame();
        if(role==='player'&&supabase){
          try{
            const {data}=await supabase.from('live_table_map_state').select('state,updated_at').eq('campaign_id',CAMPAIGN_ID).maybeSingle();
            if(data?.state){
              lastPlayerMapStateUpdatedAt=data.updated_at||'';
              applyMapMirrorToPlayer(data.state);
            }
          }catch(_){}
        }
      },180);
    };
    frame.srcdoc=mapSourceForRole(source,role);
    frame.dataset.assetId=asset.id;
    frame.dataset.role=role;
  }catch(err){
    console.error(err);
    if(token!==interactiveMapLoadToken)return;
    frame.removeAttribute('src');
    frame.srcdoc='<!doctype html><html><body style="margin:0;background:#05080b;color:#d8c58b;font-family:Georgia,serif;display:grid;place-items:center;height:100vh;text-align:center"><div><div style="font-size:34px">✦</div><h2>World map could not be loaded</h2><p style="color:#9aa3ad;font-family:system-ui,sans-serif">'+esc(err?.message||'Unknown map error')+'</p></div></body></html>';
    frame.dataset.assetId=asset?.id||'error';
    frame.dataset.role=role;
  }finally{
    if(token===interactiveMapLoadToken)els.playerDisplay.classList.remove('map-loading');
  }
}

function sendMapStateToFrame(){
  if(!mapState?.state||!els.worldMapFrame?.contentWindow)return;
  const stored=mapState.state;
  const win=els.worldMapFrame.contentWindow;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.apply&&bridge.apply(stored))return;
  }catch(err){
    console.warn('Direct player map state apply failed',err);
  }
  if(stored?.version===2&&stored?.data){
    win.postMessage({type:'aestra-map-mirror-apply',mirror:stored},'*');
  }else{
    win.postMessage({type:'aestra-map-state-apply',state:stored},'*');
  }
}

async function persistMapState(nextState){
  if(!canGMControl()||!nextState)return;
  if(mapStatePersistBusy){
    mapStatePersistPending=nextState;
    return;
  }
  mapStatePersistBusy=true;
  try{
    const payload={
      campaign_id:CAMPAIGN_ID,
      state:nextState,
      updated_by:user.id,
      updated_at:new Date().toISOString()
    };
    const {data,error}=await supabase.from('live_table_map_state').upsert(payload,{onConflict:'campaign_id'}).select().single();
    if(error){console.error('Map sync save failed',error);return}
    mapState=data;
    lastMapStatePersistAt=performance.now();
    if(els.mapImportStatus)els.mapImportStatus.textContent='Full GM map mirror is live — player display synced.';
  }finally{
    mapStatePersistBusy=false;
    if(mapStatePersistPending){
      const pending=mapStatePersistPending;
      mapStatePersistPending=null;
      const wait=Math.max(0,170-(performance.now()-lastMapStatePersistAt));
      clearTimeout(mapStateSaveTimer);
      mapStateSaveTimer=setTimeout(()=>persistMapState(pending),wait);
    }
  }
}

function queueMapStateSave(nextState){
  if(!canGMControl()||!nextState)return;
  mapStatePersistPending=nextState;
  if(mapStatePersistBusy)return;
  const wait=Math.max(0,170-(performance.now()-lastMapStatePersistAt));
  clearTimeout(mapStateSaveTimer);
  mapStateSaveTimer=setTimeout(()=>{
    const pending=mapStatePersistPending;
    mapStatePersistPending=null;
    if(pending)persistMapState(pending);
  },wait);
}

function applyMapMirrorToPlayer(mirror){
  if(!shouldReceivePlayerMap()||!mirror)return;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.apply&&bridge.apply(mirror))return;
  }catch(err){
    console.warn('Direct live mirror apply failed',err);
  }
  win.postMessage({type:'aestra-map-mirror-apply',mirror},'*');
}

function sendMapMirror(mirror){
  if(!canGMControl()||!mirror)return;

  mapState={
    campaign_id:CAMPAIGN_ID,
    state:mirror,
    updated_by:user.id,
    updated_at:new Date().toISOString()
  };

  // Same-browser/tabletop path: no server round-trip.
  try{
    browserMapMotionChannel?.postMessage({kind:'mirror',mirror});
  }catch(err){
    console.warn('Local map mirror failed',err);
  }

  // Cross-device path. Keep large mirrors off Broadcast if they approach
  // lower-plan payload limits; the persisted state remains the fallback.
  if(mapMotionReady&&mapMotionChannel){
    try{
      const serialized=JSON.stringify(mirror);
      if(serialized.length<230000){
        mapMotionChannel.send({
          type:'broadcast',
          event:'map-mirror',
          payload:{mirror}
        }).catch(err=>console.warn('Realtime map mirror failed',err));
      }
    }catch(err){
      console.warn('Could not serialize map mirror',err);
    }
  }

  queueMapStateSave(mirror);
}

function applyPartyMotionToPlayer(x,y){
  if(!shouldReceivePlayerMap())return;
  const nx=Number(x),ny=Number(y);
  if(!Number.isFinite(nx)||!Number.isFinite(ny))return;
  const win=els.worldMapFrame?.contentWindow;
  if(!win)return;
  try{
    const bridge=win.AestraLiveBridge;
    if(bridge?.applyParty&&bridge.applyParty(nx,ny))return;
  }catch(err){
    console.warn('Direct party motion apply failed',err);
  }
  win.postMessage({type:'aestra-map-party-motion-apply',x:nx,y:ny},'*');
}

function sendPartyMotion(x,y){
  if(!canGMControl())return;
  const nx=Number(x),ny=Number(y);
  if(!Number.isFinite(nx)||!Number.isFinite(ny))return;
  const now=performance.now();
  if(now-lastMapMotionSentAt<35)return;
  lastMapMotionSentAt=now;
  try{
    browserMapMotionChannel?.postMessage({kind:'party-motion',x:nx,y:ny});
  }catch(err){
    console.warn('Local party motion broadcast failed',err);
  }
  if(mapMotionReady&&mapMotionChannel){
    mapMotionChannel.send({
      type:'broadcast',
      event:'party-motion',
      payload:{x:nx,y:ny}
    }).catch(err=>console.warn('Party motion broadcast failed',err));
  }
}

function handleMapBridgeMessage(event){
  if(event.source!==els.worldMapFrame?.contentWindow)return;
  const message=event.data||{};
  if(message.type==='aestra-map-ready'){
    mapBridgeReady=true;
    if(mapState?.state)sendMapStateToFrame();
    if(els.mapImportStatus&&state?.mode==='map'){
      els.mapImportStatus.textContent=shouldReceivePlayerMap()
        ? 'Player map connected.'
        : 'Full GM map mirror is live — drawings, layers, routes and view sync to players.';
    }
    return;
  }
  if(message.type==='aestra-map-mirror'&&canGMControl()&&message.mirror){
    sendMapMirror(message.mirror);
    return;
  }
  if(message.type==='aestra-map-party-motion'&&canGMControl()){
    sendPartyMotion(message.x,message.y);
    return;
  }
  if(message.type==='aestra-map-state'&&canGMControl()&&message.state){
    mapState={campaign_id:CAMPAIGN_ID,state:message.state,updated_by:user.id,updated_at:new Date().toISOString()};
    queueMapStateSave(message.state);
  }
}

function renderPinned(host,id){
  const asset=byId(id);
  if(!asset){host.classList.add('hidden');host.innerHTML='';return}
  host.innerHTML='<img src="'+esc(asset.image_url)+'" alt="'+esc(asset.name)+'"><strong>'+esc(asset.name)+'</strong>';
  host.classList.remove('hidden');
}

function renderDisplay(){
  if(!state)return;
  const scene=byId(state.active_scene_id);
  const map=byId(state.map_asset_id);
  const reveal=byId(state.active_reveal_id);
  const mode=state.mode||'scene';
  const signature=displaySignature(state);
  if(displayInitialized&&signature!==lastDisplaySignature)playDisplayTransition();
  els.previewHeading.textContent=mode==='map'?'World Map':mode==='reveal'?'Reveal':mode==='title'?'Title Screen':mode==='blackout'?'Blackout':'Scene View';
  document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));

  const interactiveMapLive=mode==='map'&&isInteractiveMap(map);
  const backdropAsset=mode==='map'?(interactiveMapLive?scene:(map||scene)):scene;
  setBackdrop(backdropAsset);
  if(interactiveMapLive){
    const mapRole=shouldReceivePlayerMap()?'player':'gm';
    mountInteractiveMap(map,mapRole);
  }else{
    interactiveMapLoadToken++;
    els.worldMapFrame.classList.add('hidden');
    els.playerDisplay.classList.remove('map-live','map-loading');
  }
  const name=mode==='map'?(map?.name||'WORLD MAP'):(state.location_title||scene?.name||'AESTRA');
  const sub=mode==='map'?(map?.subtitle||'Aestra'):(state.location_subtitle||scene?.subtitle||'');
  els.locationName.textContent=String(name).toUpperCase();
  els.locationSubtitle.textContent=sub;
  els.locationTitle.classList.toggle('hidden',interactiveMapLive||mode==='title'||mode==='blackout');

  els.revealLayer.classList.toggle('hidden',mode!=='reveal'||!reveal);
  if(mode==='reveal'&&reveal){
    els.revealImage.src=reveal.image_url;
    els.revealImage.alt=reveal.name;
    els.revealKind.textContent=reveal.kind.replace('_',' ');
    els.revealName.textContent=reveal.name;
    els.revealSubtitle.textContent=reveal.subtitle||'';
  }

  els.titleLayer.classList.toggle('hidden',mode!=='title');
  els.blackoutLayer.classList.toggle('hidden',mode!=='blackout');
  renderPinned(els.pinLeft,state.pinned_left_id);
  renderPinned(els.pinRight,state.pinned_right_id);
  els.hudToggle.checked=state.hud_visible!==false;
  renderParty();
  lastDisplaySignature=signature;
  displayInitialized=true;
}

function sceneCard(asset){
  const active=state?.active_scene_id===asset.id;
  return '<article class="scene-card'+(active?' active':'')+'" data-scene-id="'+asset.id+'">'+
    '<div class="scene-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>'+
    '<div><strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||'Scene backdrop')+'</small></div>'+
    '<div class="scene-actions"><button type="button" data-scene-go="'+asset.id+'">'+(active?'LIVE':'GO')+'</button><button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderScenes(){
  const scenes=assets.filter(a=>a.kind==='scene');
  els.sceneStrip.innerHTML=scenes.length?scenes.map(sceneCard).join(''):'<p class="muted">No scene backdrops yet. Press + to upload one.</p>';
  els.sceneStrip.querySelectorAll('[data-scene-go]').forEach(b=>b.addEventListener('click',()=>activateScene(b.dataset.sceneGo)));
  els.sceneStrip.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeAssetFromDisplay(b.dataset.remove)));
  els.sceneStrip.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteAsset(b.dataset.delete)));
}

function revealCard(asset){
  const mapAction=asset.kind==='map'
    ? '<button type="button" data-map="'+asset.id+'">WORLD MAP</button>'
    : '<button type="button" data-pin="'+asset.id+'">PIN</button>';
  const thumb=isInteractiveMap(asset)
    ? '<div class="reveal-thumb interactive-map-thumb"><span>✦</span><b>INTERACTIVE ATLAS</b></div>'
    : '<div class="reveal-thumb" style="background-image:url(\''+esc(asset.image_url)+'\')"></div>';
  return '<article class="reveal-card" data-kind="'+esc(asset.kind)+'">'+thumb+
    '<strong>'+esc(asset.name)+'</strong><small>'+esc(asset.subtitle||asset.kind.replace('_',' '))+'</small>'+
    '<div class="card-actions"><button type="button" data-show="'+asset.id+'">SHOW</button>'+mapAction+'<button type="button" data-remove="'+asset.id+'">REMOVE</button><button type="button" class="danger" data-delete="'+asset.id+'">DELETE</button></div></article>';
}

function renderRevealGrid(){
  const visualAssets=assets.filter(a=>a.kind!=='scene'&&(filterKind==='all'||a.kind===filterKind));
  els.revealGrid.innerHTML=visualAssets.length?visualAssets.map(revealCard).join(''):'<p class="muted">No visuals in this category yet.</p>';
  els.revealGrid.querySelectorAll('[data-show]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.show)));
  els.revealGrid.querySelectorAll('[data-pin]').forEach(b=>b.addEventListener('click',()=>pinAsset(b.dataset.pin)));
  els.revealGrid.querySelectorAll('[data-map]').forEach(b=>b.addEventListener('click',()=>setWorldMap(b.dataset.map)));
  els.revealGrid.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>removeAssetFromDisplay(b.dataset.remove)));
  els.revealGrid.querySelectorAll('[data-delete]').forEach(b=>b.addEventListener('click',()=>deleteAsset(b.dataset.delete)));
}

function renderRecent(){
  const found=recent.map(byId).filter(Boolean).slice(0,8);
  els.recentList.innerHTML=found.length?found.map(a=>'<button class="recent-chip" type="button" data-recent="'+a.id+'">'+esc(a.name)+'</button>').join(''):'<p class="muted">Things you show will appear here.</p>';
  els.recentList.querySelectorAll('[data-recent]').forEach(b=>b.addEventListener('click',()=>showReveal(b.dataset.recent)));
}

function renderAll(){renderDisplay();renderScenes();renderRevealGrid();renderRecent()}

async function patchState(patch){
  if(!canGMControl())return;
  const payload={...patch,updated_by:user.id,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from('live_table_state').update(payload).eq('campaign_id',CAMPAIGN_ID).select().single();
  if(error){alert(error.message);return}
  state=data;
  renderAll();
}

async function activateScene(id){
  const asset=byId(id);if(!asset)return;
  await patchState({mode:'scene',active_scene_id:id,active_reveal_id:null,location_title:asset.name,location_subtitle:asset.subtitle||''});
}

async function showReveal(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  await patchState({mode:'reveal',active_reveal_id:id});
}

async function pinAsset(id){
  const left=state?.pinned_left_id;
  const right=state?.pinned_right_id;
  if(!left)await patchState({pinned_left_id:id});
  else if(!right)await patchState({pinned_right_id:id});
  else await patchState({pinned_left_id:id,pinned_right_id:null});
}

async function removeAssetFromDisplay(id){
  if(!state||!canGMControl())return;
  const patch={};
  if(state.active_scene_id===id){
    patch.active_scene_id=null;
    patch.location_title='';
    patch.location_subtitle='';
    if(state.mode==='scene')patch.mode='title';
  }
  if(state.active_reveal_id===id){
    patch.active_reveal_id=null;
    if(state.mode==='reveal')patch.mode=state.active_scene_id?'scene':'title';
  }
  if(state.map_asset_id===id){
    patch.map_asset_id=null;
    if(state.mode==='map')patch.mode=state.active_scene_id?'scene':'title';
  }
  if(state.pinned_left_id===id)patch.pinned_left_id=null;
  if(state.pinned_right_id===id)patch.pinned_right_id=null;
  if(Object.keys(patch).length)await patchState(patch);
}

async function deleteAsset(id){
  if(!canGMControl())return;
  const asset=byId(id);
  if(!asset)return;
  if(!confirm('Delete "'+asset.name+'" permanently? This removes it from the Live Table library and deletes its uploaded file.'))return;
  await removeAssetFromDisplay(id);
  const del=await supabase.from('live_table_assets').delete().eq('id',id);
  if(del.error){alert(del.error.message);return}
  if(asset.storage_path){
    const storageDelete=await supabase.storage.from('live-table').remove([asset.storage_path]);
    if(storageDelete.error)console.warn('Could not remove storage file',storageDelete.error);
  }
  assets=assets.filter(a=>a.id!==id);
  recent=recent.filter(x=>x!==id);
  renderAll();
}

async function setWorldMap(id){
  const asset=byId(id);if(!asset)return;
  recent=[id,...recent.filter(x=>x!==id)].slice(0,8);
  await patchState({mode:'map',map_asset_id:id,active_reveal_id:null});
}

function injectLiveMapPresentation(source){
  if(source.includes('id="aestra-live-table-map-bridge"'))return source;
  const style='<style id="aestra-live-table-map-style">#app.presentation #presentationExit{display:none!important}body.aestra-live-embedded{background:#05080b!important}</style>';
  const script='<script id="aestra-live-table-map-bridge">(function(){var role=new URLSearchParams(location.search).get("aestraRole");function apply(){if(role!=="player")return;document.body.classList.add("aestra-live-embedded");var app=document.getElementById("app");if(app)app.classList.add("presentation");var exit=document.getElementById("presentationExit");if(exit)exit.style.display="none";var toggle=document.getElementById("presentationToggle");if(toggle)toggle.style.display="none"}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",function(){setTimeout(apply,80)});else setTimeout(apply,80);})();<\/script>';
  let out=source;
  out=out.includes('</head>')?out.replace('</head>',style+'</head>'):style+out;
  out=out.includes('</body>')?out.replace('</body>',script+'</body>'):out+script;
  return out;
}

async function importInteractiveMap(){
  if(!canGMControl())return;
  const file=els.interactiveMapFile.files?.[0];
  if(!file)return;
  els.mapImportStatus.textContent='Preparing interactive map…';
  try{
    if(file.size>30*1024*1024)throw new Error('That map file is larger than 30 MB.');
    const source=await file.text();
    if(!/<html[\s>]/i.test(source)||!/<body[\s>]/i.test(source))throw new Error('Choose the Aestra interactive map HTML file.');
    const prepared=injectLiveMapPresentation(source);
    const payload=new Blob([prepared],{type:'text/html'});
    const storagePath=CAMPAIGN_ID+'/interactive-map-'+crypto.randomUUID()+'.html';
    els.mapImportStatus.textContent='Uploading interactive atlas…';
    const up=await supabase.storage.from('live-table').upload(storagePath,payload,{cacheControl:'3600',upsert:false,contentType:'text/html'});
    if(up.error)throw up.error;
    const publicUrl=supabase.storage.from('live-table').getPublicUrl(storagePath).data.publicUrl;
    const existing=assets.find(isInteractiveMap);
    const row={
      campaign_id:CAMPAIGN_ID,
      kind:'map',
      name:existing?.name||'Aestra Interactive World Map',
      subtitle:'Interactive atlas',
      image_url:publicUrl,
      storage_path:storagePath,
      metadata:{interactive:true,source_name:file.name,imported_at:new Date().toISOString()},
      created_by:user.id,
      updated_at:new Date().toISOString()
    };
    let saved;
    if(existing){
      const result=await supabase.from('live_table_assets').update(row).eq('id',existing.id).select().single();
      if(result.error){await supabase.storage.from('live-table').remove([storagePath]);throw result.error}
      saved=result.data;
      if(existing.storage_path&&existing.storage_path!==storagePath)await supabase.storage.from('live-table').remove([existing.storage_path]);
      assets=assets.map(a=>a.id===saved.id?saved:a);
    }else{
      const result=await supabase.from('live_table_assets').insert(row).select().single();
      if(result.error){await supabase.storage.from('live-table').remove([storagePath]);throw result.error}
      saved=result.data;
      assets=[saved,...assets];
    }
    interactiveMapCache.clear();
    els.mapImportStatus.textContent='Interactive Aestra map linked. World Map mode now uses it.';
    await setWorldMap(saved.id);
    renderAll();
  }catch(err){
    console.error(err);
    els.mapImportStatus.textContent=err?.message||'Could not import the interactive map.';
  }finally{
    els.interactiveMapFile.value='';
  }
}

async function openMapEditor(){
  const selected=byId(state?.map_asset_id);
  const map=isInteractiveMap(selected)?selected:assets.find(isInteractiveMap);
  if(!map){els.interactiveMapFile.click();return}
  const popup=window.open('about:blank','aestra-world-map-editor');
  if(!popup){alert('Your browser blocked the map editor window. Allow pop-ups for this site and try again.');return}
  try{
    popup.document.write('<!doctype html><title>Loading Aestra Map…</title><body style="margin:0;background:#05080b;color:#d8c58b;font-family:Georgia,serif;display:grid;place-items:center;height:100vh">Loading Aestra world map…</body>');
    popup.document.close();
    const source=await fetchInteractiveMapSource(map);
    const blob=new Blob([source],{type:'text/html'});
    const url=URL.createObjectURL(blob);
    popup.location.replace(url);
    setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(err){
    popup.document.open();
    popup.document.write('<!doctype html><body style="margin:0;background:#05080b;color:#eee;font-family:system-ui,sans-serif;padding:40px"><h2>Could not open map editor</h2><p>'+esc(err?.message||'Unknown error')+'</p></body>');
    popup.document.close();
  }
}

function openAssetDialog(kind='npc'){
  els.assetForm.reset();
  els.assetKind.value=kind;
  els.assetPreview.classList.add('hidden');
  els.assetPreview.removeAttribute('src');
  els.assetMessage.textContent='';
  els.dialogTitle.textContent=kind==='scene'?'Upload scene backdrop':'Upload artwork';
  els.assetDialog.showModal();
}

function previewSelectedFile(){
  const file=els.assetFile.files?.[0];
  if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=''}
  if(!file){els.assetPreview.classList.add('hidden');return}
  previewUrl=URL.createObjectURL(file);
  els.assetPreview.src=previewUrl;
  els.assetPreview.classList.remove('hidden');
}

async function uploadAsset(e){
  e.preventDefault();
  if(!canGMControl())return;
  const file=els.assetFile.files?.[0];
  if(!file){els.assetMessage.textContent='Choose an image first.';return}
  if(file.size>15*1024*1024){els.assetMessage.textContent='That image is larger than 15 MB.';return}
  const name=els.assetName.value.trim();
  if(!name){els.assetMessage.textContent='Give the visual a name.';return}
  const kind=els.assetKind.value;
  const subtitle=els.assetSubtitle.value.trim();
  els.saveAssetBtn.disabled=true;
  els.assetMessage.textContent='Uploading…';
  try{
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
    const storagePath=CAMPAIGN_ID+'/'+crypto.randomUUID()+'.'+ext;
    const up=await supabase.storage.from('live-table').upload(storagePath,file,{cacheControl:'3600',upsert:false,contentType:file.type});
    if(up.error)throw up.error;
    const pub=supabase.storage.from('live-table').getPublicUrl(storagePath);
    const imageUrl=pub.data.publicUrl;
    const ins=await supabase.from('live_table_assets').insert({campaign_id:CAMPAIGN_ID,kind,name,subtitle,image_url:imageUrl,storage_path:storagePath,created_by:user.id}).select().single();
    if(ins.error){
      await supabase.storage.from('live-table').remove([storagePath]);
      throw ins.error;
    }
    assets=[ins.data,...assets];
    els.assetDialog.close();
    if(kind==='scene')await activateScene(ins.data.id);
    else{renderAll();recent=[ins.data.id,...recent.filter(x=>x!==ins.data.id)];renderRecent()}
  }catch(err){
    console.error(err);
    els.assetMessage.textContent=err?.message||'Upload failed.';
  }finally{
    els.saveAssetBtn.disabled=false;
  }
}

async function generateAiBackdrop(){
  if(!canGMControl())return;
  const name=els.aiSceneName.value.trim();
  const subtitle=els.aiSceneSubtitle.value.trim();
  const prompt=els.aiPrompt.value.trim();
  const quality=els.aiQuality.value;
  if(!name){els.aiStatus.textContent='Give the scene a name first.';els.aiSceneName.focus();return}
  if(!prompt){els.aiStatus.textContent='Describe the backdrop you want first.';els.aiPrompt.focus();return}
  els.generateBackdropBtn.disabled=true;
  els.aiStatus.textContent='Generating Aestra backdrop…';
  try{
    const {data,error}=await supabase.functions.invoke('generate-live-table-backdrop',{
      body:{campaignId:CAMPAIGN_ID,name,subtitle,prompt,quality}
    });
    if(error){
      let message=error.message||'Generation failed.';
      try{
        if(error.context){
          const details=await error.context.json();
          if(details?.error)message=details.error;
        }
      }catch(_){}
      throw new Error(message);
    }
    if(data?.error)throw new Error(data.error);
    if(!data?.asset)throw new Error('No scene was returned.');
    assets=[data.asset,...assets.filter(a=>a.id!==data.asset.id)];
    els.aiStatus.textContent='Backdrop created and saved. Putting it live now…';
    await activateScene(data.asset.id);
    els.aiStatus.textContent='Backdrop created, saved, and live.';
    els.aiSceneName.value='';
    els.aiSceneSubtitle.value='';
    els.aiPrompt.value='';
    renderAll();
  }catch(err){
    console.error(err);
    const msg=err?.message||'Could not generate the backdrop.';
    els.aiStatus.textContent=msg.includes('OPENAI_API_KEY')
      ? 'AI generator is installed, but the OpenAI API key still needs to be added to the Supabase function secrets.'
      : msg;
  }finally{
    els.generateBackdropBtn.disabled=false;
  }
}

function addAiPromptChip(value){
  const current=els.aiPrompt.value.trim();
  els.aiPrompt.value=current?current.replace(/[,. ]*$/,'')+', '+value:value;
  els.aiPrompt.focus();
}

function startPlayerMapStatePolling(){
  clearInterval(playerMapStatePollTimer);
  if(!IS_PLAYER_DISPLAY)return;
  playerMapStatePollTimer=setInterval(async()=>{
    if(state?.mode!=='map'||!supabase)return;
    try{
      const {data,error}=await supabase
        .from('live_table_map_state')
        .select('state,updated_at')
        .eq('campaign_id',CAMPAIGN_ID)
        .maybeSingle();
      if(error||!data?.state)return;
      if(data.updated_at===lastPlayerMapStateUpdatedAt)return;
      lastPlayerMapStateUpdatedAt=data.updated_at||'';
      mapState={
        campaign_id:CAMPAIGN_ID,
        state:data.state,
        updated_at:data.updated_at
      };
      applyMapMirrorToPlayer(data.state);
      if(els.mapImportStatus)els.mapImportStatus.textContent='Player Display receiving live GM map.';
    }catch(err){
      console.warn('Player map poll failed',err);
    }
  },220);
}

function startMapMirrorPolling(){
  clearInterval(mapMirrorPollTimer);
  mapMirrorPollTimer=setInterval(()=>{
    if(!canGMControl()||state?.mode!=='map')return;
    const win=els.worldMapFrame?.contentWindow;
    if(!win)return;
    try{
      const bridge=win.AestraLiveBridge;
      if(!bridge?.collect||bridge.role!=='gm')return;
      const mirror=bridge.collect();
      if(!mirror)return;
      const signature=JSON.stringify(mirror);
      if(signature===lastPolledMapMirrorSignature)return;
      lastPolledMapMirrorSignature=signature;
      sendMapMirror(mirror);
    }catch(err){
      // iframe may be between srcdoc reloads; the next poll will retry.
    }
  },90);
}

async function subscribeRealtime(){
  if('BroadcastChannel' in window){
    try{
      browserMapMotionChannel=new BroadcastChannel('aestra-map-motion-'+CAMPAIGN_ID);
      browserMapMotionChannel.addEventListener('message',event=>{
        const p=event.data||{};
        if(p.kind==='mirror'&&p.mirror)applyMapMirrorToPlayer(p.mirror);
        else if(p.kind==='party-motion')applyPartyMotionToPlayer(p.x,p.y);
        else if(Number.isFinite(Number(p.x))&&Number.isFinite(Number(p.y)))applyPartyMotionToPlayer(p.x,p.y);
      });
    }catch(err){
      console.warn('Browser map mirror channel unavailable',err);
    }
  }

  await supabase.realtime.setAuth();
  mapMotionChannel=supabase.channel('aestra-map-motion:'+CAMPAIGN_ID,{config:{private:true}});
  mapMotionChannel
    .on('broadcast',{event:'party-motion'},payload=>{
      const p=payload?.payload||{};
      applyPartyMotionToPlayer(p.x,p.y);
    })
    .on('broadcast',{event:'map-mirror'},payload=>{
      const p=payload?.payload||{};
      if(p.mirror)applyMapMirrorToPlayer(p.mirror);
    })
    .subscribe((status,err)=>{
      mapMotionReady=status==='SUBSCRIBED';
      if(err)console.warn('Realtime map mirror channel error',err);
    });
  supabase.channel('aestra-live-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{if(payload.new){state=payload.new;renderAll()}})
    .subscribe();
  supabase.channel('aestra-live-assets')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_assets',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadAssets();renderAll()})
    .subscribe();
  supabase.channel('aestra-live-party')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_party',filter:'campaign_id=eq.'+CAMPAIGN_ID},async()=>{await loadParty();renderParty()})
    .subscribe();
  supabase.channel('aestra-live-map-state')
    .on('postgres_changes',{event:'*',schema:'public',table:'live_table_map_state',filter:'campaign_id=eq.'+CAMPAIGN_ID},payload=>{
      if(!payload.new)return;
      mapState=payload.new;
      ifshouldReceivePlayerMap()sendMapStateToFrame();
    })
    .subscribe();
  startMapMirrorPolling();
  startPlayerMapStatePolling();
}

function wire(){
  window.addEventListener('message',handleMapBridgeMessage);
  els.authForm.addEventListener('submit',async e=>{
    e.preventDefault();setAuthMessage('Signing in…');
    try{
      await ensureSupabase();
      const {data,error}=await supabase.auth.signInWithPassword({email:els.emailInput.value.trim(),password:els.passwordInput.value});
      if(error)throw error;
      user=data.user;
      await startApp();
    }catch(err){setAuthMessage(err?.message||'Sign in failed.')}
  });
  els.logoutBtn.addEventListener('click',async()=>{await supabase?.auth.signOut();location.reload()});
  els.openDisplayBtn.addEventListener('click',()=>window.open('live-table.html?display=1','aestra-player-display'));
  els.addSceneBtn.addEventListener('click',()=>openAssetDialog('scene'));
  els.addVisualBtn.addEventListener('click',()=>openAssetDialog('npc'));
  els.closeDialogBtn.addEventListener('click',()=>els.assetDialog.close());
  els.cancelAssetBtn.addEventListener('click',()=>els.assetDialog.close());
  els.assetFile.addEventListener('change',previewSelectedFile);
  els.assetForm.addEventListener('submit',uploadAsset);
  els.returnSceneBtn.addEventListener('click',()=>patchState({mode:'scene',active_reveal_id:null}));
  els.clearPinsBtn.addEventListener('click',()=>patchState({pinned_left_id:null,pinned_right_id:null}));
  els.hudToggle.addEventListener('change',()=>patchState({hud_visible:els.hudToggle.checked}));
  els.modeSwitch.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{
    const mode=b.dataset.mode;
    if(mode==='map'&&!state?.map_asset_id){els.setMapAssetBtn.click();return}
    patchState({mode,active_reveal_id:mode==='reveal'?state?.active_reveal_id:null});
  }));
  els.revealTabs.querySelectorAll('[data-kind]').forEach(b=>b.addEventListener('click',()=>{
    filterKind=b.dataset.kind;
    els.revealTabs.querySelectorAll('[data-kind]').forEach(x=>x.classList.toggle('active',x===b));
    renderRevealGrid();
  }));
  els.setMapAssetBtn.addEventListener('click',()=>{
    const maps=assets.filter(a=>a.kind==='map');
    if(!maps.length){openAssetDialog('map');return}
    const current=state?.map_asset_id;
    const index=Math.max(-1,maps.findIndex(m=>m.id===current));
    setWorldMap(maps[(index+1)%maps.length].id);
  });
  els.importInteractiveMapBtn.addEventListener('click',()=>els.interactiveMapFile.click());
  els.interactiveMapFile.addEventListener('change',importInteractiveMap);
  els.openMapEditorBtn.addEventListener('click',openMapEditor);
  els.generateBackdropBtn.addEventListener('click',generateAiBackdrop);
  document.querySelectorAll('[data-ai-chip]').forEach(b=>b.addEventListener('click',()=>addAiPromptChip(b.dataset.aiChip)));
}

async function startApp(){
  showApp();
  await checkRole();
  await Promise.all([loadState(),loadAssets(),loadParty(),loadMapState()]);
  renderAll();
  await subscribeRealtime();
}

async function boot(){
  try{
    wire();
    await ensureSupabase();
    const {data,error}=await supabase.auth.getSession();
    if(error)throw error;
    if(!data.session){showAuth();return}
    user=data.session.user;
    await startApp();
  }catch(err){
    console.error(err);
    showAuth();
    setAuthMessage(err?.message||'Could not start Aestra Live Table.');
  }
}
boot();