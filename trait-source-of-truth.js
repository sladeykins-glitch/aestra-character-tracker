// Canonical Fabula Ultima traits: Identity, Theme and Origin.
// The old freeform traits array is legacy-only and is cleared from persistence after successful saves.
(function(){
  const CONFIG=window.AESTRA_CONFIG||{};
  let clientPromise=null;
  const $=id=>document.getElementById(id);

  function canonicalTraits(){
    return {
      identity:$('identity')?.value?.trim?.()||'',
      theme:$('theme')?.value?.trim?.()||'',
      origin:$('origin')?.value?.trim?.()||''
    };
  }
  window.AESTRA_TRAITS=canonicalTraits;

  function removeLegacyTraitUI(){
    const player=$('traitsEditor');
    if(player){
      player.closest('#inlineTraitsWrap')?.remove();
      const panel=player.closest('article.panel');
      if(panel)panel.remove();
      else player.remove();
    }
    const gm=$('gmTraitsEditor');
    if(gm){
      const panel=gm.closest('article.panel');
      if(panel&&panel.querySelectorAll(':scope > *').length===1)panel.remove();
      else gm.remove();
    }
  }

  function relabelCanonicalFields(){
    const labels={identity:'Identity',theme:'Theme',origin:'Origin'};
    for(const [id,name] of Object.entries(labels)){
      const el=$(id);if(!el)continue;
      const label=el.closest('label');
      if(label&&!label.dataset.canonicalTrait){label.dataset.canonicalTrait='true';label.setAttribute('title',`${name} is one of your three Fabula Ultima Traits.`)}
    }
  }

  async function client(){
    if(clientPromise)return clientPromise;
    clientPromise=(async()=>{const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');return mod.createClient(CONFIG.supabaseUrl,CONFIG.supabaseAnonKey)})();
    return clientPromise;
  }

  async function clearLegacyForCurrentUser(){
    try{
      if(!CONFIG.supabaseUrl||!CONFIG.supabaseAnonKey||!CONFIG.campaignId)return;
      const sb=await client();
      const {data}=await sb.auth.getSession();
      const uid=data?.session?.user?.id;if(!uid)return;
      await sb.from('characters').update({traits:null}).eq('owner_id',uid).eq('campaign_id',CONFIG.campaignId);
    }catch(err){console.warn('Legacy trait cleanup skipped',err)}
  }

  async function clearLegacyForCampaign(){
    try{
      if(!CONFIG.supabaseUrl||!CONFIG.supabaseAnonKey||!CONFIG.campaignId)return;
      const sb=await client();
      const {data}=await sb.auth.getSession();
      if(!data?.session)return;
      // RLS limits this to rows the signed-in account is allowed to update.
      await sb.from('characters').update({traits:null}).eq('campaign_id',CONFIG.campaignId);
    }catch(err){console.warn('GM legacy trait cleanup skipped',err)}
  }

  function watchSuccessfulSaves(){
    const saveStatus=$('saveStatus');
    if(saveStatus){
      let last='';
      new MutationObserver(()=>{const now=saveStatus.textContent||'';if(now!==last&&/^Saved(?: locally)?$/.test(now.trim())){last=now;clearLegacyForCurrentUser()}}).observe(saveStatus,{childList:true,characterData:true,subtree:true});
    }
    const gmStatus=$('gmSaveStatus');
    if(gmStatus){
      let last='';
      new MutationObserver(()=>{const now=gmStatus.textContent||'';if(now!==last&&/saved/i.test(now)){last=now;clearLegacyForCampaign()}}).observe(gmStatus,{childList:true,characterData:true,subtree:true});
    }
  }

  removeLegacyTraitUI();
  relabelCanonicalFields();
  watchSuccessfulSaves();
  // Clear any old duplicated values once on load; Identity/Theme/Origin remain untouched.
  setTimeout(clearLegacyForCurrentUser,900);
})();