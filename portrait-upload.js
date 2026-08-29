// Compact character portrait + large viewer + authenticated Supabase uploads.
// Reuses the existing #portraitImg, #portraitFallback and #portraitUrl controls.

async function installPortraitUpload(){
  const card=document.querySelector('#sheetView .portrait-card');
  const img=document.getElementById('portraitImg');
  const fallback=document.getElementById('portraitFallback');
  const urlInput=document.getElementById('portraitUrl');
  const urlLabel=urlInput?.closest('label');
  if(!card||!img||!fallback||!urlInput||card.dataset.portraitReady==='1')return;
  card.dataset.portraitReady='1';
  card.classList.add('compact-portrait-card');
  card.tabIndex=0;
  card.setAttribute('role','button');
  card.setAttribute('aria-label','Open character portrait');

  const modal=document.createElement('div');
  modal.id='portraitModal';
  modal.className='portrait-modal';
  modal.setAttribute('aria-hidden','true');
  modal.innerHTML=`
    <div class="portrait-modal-backdrop" data-portrait-close></div>
    <section class="portrait-modal-card" role="dialog" aria-modal="true" aria-labelledby="portraitModalTitle">
      <button class="portrait-modal-close" type="button" aria-label="Close portrait" data-portrait-close>×</button>
      <p class="eyebrow">CHARACTER PORTRAIT</p>
      <h2 id="portraitModalTitle">Portrait</h2>
      <div class="portrait-large-frame">
        <img id="portraitLargeImage" alt="Character portrait enlarged" />
        <div id="portraitLargeFallback" class="portrait-large-fallback">?</div>
      </div>
      <div class="portrait-upload-actions">
        <input id="portraitFileInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden />
        <button id="portraitUploadBtn" class="primary" type="button">Upload image</button>
        <p id="portraitUploadStatus" class="portrait-upload-status" role="status" aria-live="polite"></p>
      </div>
      <details class="portrait-url-details">
        <summary>Use an image URL instead</summary>
        <div id="portraitUrlHome"></div>
      </details>
    </section>`;
  document.body.appendChild(modal);
  modal.querySelector('#portraitUrlHome')?.appendChild(urlLabel);

  const large=modal.querySelector('#portraitLargeImage');
  const largeFallback=modal.querySelector('#portraitLargeFallback');
  const uploadBtn=modal.querySelector('#portraitUploadBtn');
  const fileInput=modal.querySelector('#portraitFileInput');
  const status=modal.querySelector('#portraitUploadStatus');

  let supabaseClient=null;
  async function getClient(){
    if(supabaseClient)return supabaseClient;
    const cfg=window.AESTRA_CONFIG||{};
    if(!cfg.supabaseUrl||!cfg.supabaseAnonKey)throw new Error('Upload service is not configured.');
    const mod=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabaseClient=mod.createClient(cfg.supabaseUrl,cfg.supabaseAnonKey);
    return supabaseClient;
  }

  const syncLarge=()=>{
    const src=img.getAttribute('src')||urlInput.value||'';
    const has=Boolean(src&&!img.classList.contains('hidden'));
    if(has){large.src=src;large.classList.remove('hidden');largeFallback.classList.add('hidden')}
    else{large.removeAttribute('src');large.classList.add('hidden');largeFallback.classList.remove('hidden');largeFallback.textContent=(document.getElementById('charName')?.value||'?')[0]?.toUpperCase()||'?'}
  };
  const open=()=>{syncLarge();modal.classList.add('open');modal.setAttribute('aria-hidden','false');document.body.classList.add('portrait-modal-open')};
  const close=()=>{modal.classList.remove('open');modal.setAttribute('aria-hidden','true');document.body.classList.remove('portrait-modal-open');card.focus()};
  card.addEventListener('click',e=>{if(e.target.closest('input,button,label,a'))return;open()});
  card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();open()}});
  modal.querySelectorAll('[data-portrait-close]').forEach(x=>x.addEventListener('click',close));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&modal.classList.contains('open'))close()});
  img.addEventListener('load',syncLarge);
  img.addEventListener('error',syncLarge);

  uploadBtn.addEventListener('click',()=>fileInput.click());
  fileInput.addEventListener('change',async()=>{
    const file=fileInput.files?.[0];
    if(!file)return;
    status.classList.remove('error','success');
    if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){status.textContent='Choose a JPG, PNG, WEBP or GIF image.';status.classList.add('error');return}
    if(file.size>10*1024*1024){status.textContent='Image must be 10 MB or smaller.';status.classList.add('error');return}
    uploadBtn.disabled=true;status.textContent='Uploading…';
    try{
      const client=await getClient();
      const {data:{user},error:userError}=await client.auth.getUser();
      if(userError)throw userError;
      if(!user)throw new Error('Please sign in before uploading a portrait.');
      const ext=(file.name.split('.').pop()||file.type.split('/')[1]||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'')||'jpg';
      const path=`${user.id}/${crypto.randomUUID()}.${ext}`;
      const {error:uploadError}=await client.storage.from('character-portraits').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type});
      if(uploadError)throw uploadError;
      const {data:pub}=client.storage.from('character-portraits').getPublicUrl(path);
      const publicUrl=pub?.publicUrl;
      if(!publicUrl)throw new Error('Could not create portrait URL.');

      urlInput.value=publicUrl;
      urlInput.dispatchEvent(new Event('change',{bubbles:true}));
      urlInput.dispatchEvent(new Event('input',{bubbles:true}));
      img.src=publicUrl;
      img.classList.remove('hidden');
      fallback.classList.add('hidden');
      syncLarge();

      // Persist the portrait directly so the player does not need a second save action.
      const cfg=window.AESTRA_CONFIG||{};
      const {error:updateError}=await client.from('characters').update({portrait_url:publicUrl,updated_at:new Date().toISOString()}).eq('owner_id',user.id).eq('campaign_id',cfg.campaignId);
      if(updateError)throw updateError;
      status.textContent='Portrait uploaded';status.classList.add('success');
    }catch(err){
      console.error('Portrait upload failed',err);
      status.textContent=err?.message||'Upload failed';status.classList.add('error');
    }finally{
      uploadBtn.disabled=false;fileInput.value='';
    }
  });
}

function installPortraitStyles(){
  if(document.getElementById('portraitUploadStyles'))return;
  const s=document.createElement('style');
  s.id='portraitUploadStyles';
  s.textContent=`
  #sheetView .compact-portrait-card{position:relative!important;cursor:pointer!important;align-self:start!important;min-height:0!important;padding:8px!important;display:grid!important;place-items:center!important;overflow:hidden!important}
  #sheetView .compact-portrait-card .portrait,#sheetView .compact-portrait-card .portrait-fallback{width:100%!important;aspect-ratio:1/1!important;height:auto!important;max-height:none!important;border-radius:16px!important;object-fit:cover!important;margin:0!important}
  #sheetView .compact-portrait-card .portrait-fallback{display:grid!important;place-items:center!important;min-height:86px!important;font-size:2rem!important}
  #sheetView .compact-portrait-card .portrait-fallback.hidden{display:none!important}
  #sheetView .compact-portrait-card .small-label{display:none!important}
  #sheetView .compact-portrait-card:after{content:'VIEW';position:absolute;right:7px;bottom:7px;padding:3px 6px;border-radius:999px;font:700 .5rem/1 system-ui,sans-serif;letter-spacing:.12em;color:#f0d49a;background:rgba(8,9,13,.76);border:1px solid rgba(215,173,99,.3);pointer-events:none}
  body.portrait-modal-open{overflow:hidden}
  .portrait-modal{position:fixed;inset:0;z-index:15000;display:none;place-items:center;padding:14px}.portrait-modal.open{display:grid}
  .portrait-modal-backdrop{position:absolute;inset:0;background:rgba(2,3,7,.84);backdrop-filter:blur(8px)}
  .portrait-modal-card{position:relative;width:min(640px,95vw);max-height:90vh;overflow:auto;padding:24px 18px 18px;border:1px solid rgba(215,173,99,.5);border-radius:22px;background:linear-gradient(160deg,rgba(22,20,27,.99),rgba(9,10,15,.99));box-shadow:0 28px 90px rgba(0,0,0,.65);text-align:center}
  .portrait-modal-card h2{margin:3px 0 14px;font-family:Georgia,serif;color:#f0ddb2}
  .portrait-modal-close{position:absolute!important;right:11px;top:11px;width:42px;height:42px;padding:0!important;border-radius:50%!important;font-size:1.6rem!important;background:rgba(255,255,255,.035)!important;border:1px solid rgba(215,173,99,.24)!important;color:#e5d4aa!important}
  .portrait-large-frame{position:relative;width:min(420px,100%);aspect-ratio:4/5;margin:0 auto 14px;border:1px solid rgba(215,173,99,.28);border-radius:18px;overflow:hidden;background:radial-gradient(circle at 50% 30%,rgba(107,155,205,.08),rgba(6,8,12,.9) 62%);box-shadow:inset 0 0 30px rgba(255,255,255,.025)}
  .portrait-large-frame img{width:100%;height:100%;object-fit:contain;display:block;background:#07080b}.portrait-large-frame img.hidden{display:none!important}
  .portrait-large-fallback{width:100%;height:100%;display:grid;place-items:center;font:700 5rem/1 Georgia,serif;color:#d9b66c}.portrait-large-fallback.hidden{display:none!important}
  .portrait-upload-actions{display:grid;gap:8px;width:min(420px,100%);margin:0 auto}.portrait-upload-actions button{min-height:48px}.portrait-upload-status{min-height:1.1em;margin:0;font-size:.75rem;color:#aaa294}.portrait-upload-status.success{color:#9ed4af}.portrait-upload-status.error{color:#efa294}
  .portrait-url-details{width:min(420px,100%);margin:10px auto 0;text-align:left;border-top:1px solid rgba(215,173,99,.14);padding-top:10px}.portrait-url-details summary{cursor:pointer;color:#9e927c;font-size:.75rem}.portrait-url-details .small-label{display:grid!important;margin-top:8px;font-size:.72rem}.portrait-url-details input{width:100%;min-height:44px;font-size:16px}
  @media(max-width:700px){
    body.mobile-paged-sheet #sheetView .grand-character-header{grid-template-columns:92px minmax(0,1fr)!important;align-items:start!important}
    body.mobile-paged-sheet #sheetView .compact-portrait-card{width:92px!important;min-width:92px!important;padding:5px!important;border-radius:16px!important}
    body.mobile-paged-sheet #sheetView .compact-portrait-card .portrait,body.mobile-paged-sheet #sheetView .compact-portrait-card .portrait-fallback{border-radius:12px!important;min-height:80px!important}
    body.mobile-paged-sheet #sheetView .compact-portrait-card:after{font-size:.42rem;right:5px;bottom:5px}
    .portrait-modal-card{padding:21px 13px 15px}.portrait-large-frame{aspect-ratio:3/4}
  }
  `;
  document.head.appendChild(s);
}

installPortraitStyles();
installPortraitUpload();