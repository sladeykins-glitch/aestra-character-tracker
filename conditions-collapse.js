// Compact conditions control for player sheet. Reuses existing #statuses buttons/state.
function installConditionsCollapse(){
  const statuses=document.getElementById('statuses');
  if(!statuses||statuses.dataset.conditionsCollapse==='1')return;
  const panel=statuses.closest('article.panel');
  if(!panel)return;
  statuses.dataset.conditionsCollapse='1';
  panel.classList.add('conditions-panel');

  const oldHeading=panel.querySelector('h3');
  if(oldHeading)oldHeading.classList.add('conditions-old-heading');

  const button=document.createElement('button');
  button.type='button';
  button.className='conditions-toggle';
  button.setAttribute('aria-expanded','false');
  button.setAttribute('aria-controls','statuses');
  button.innerHTML='<span class="conditions-toggle-icon">!</span><span class="conditions-toggle-copy"><strong>Conditions</strong><small id="conditionsSummary">None active</small></span><span class="conditions-toggle-chevron">⌄</span>';
  panel.insertBefore(button,statuses);

  const updateSummary=()=>{
    const active=[...statuses.querySelectorAll('button')].filter(b=>b.classList.contains('active')||b.getAttribute('aria-pressed')==='true');
    const summary=button.querySelector('#conditionsSummary');
    if(!summary)return;
    summary.textContent=active.length?`${active.length} active`:'None active';
    button.classList.toggle('has-active-conditions',active.length>0);
  };
  const setOpen=open=>{
    panel.classList.toggle('conditions-open',open);
    button.setAttribute('aria-expanded',String(open));
  };
  button.addEventListener('click',()=>setOpen(!panel.classList.contains('conditions-open')));
  statuses.addEventListener('click',()=>requestAnimationFrame(updateSummary));
  statuses.addEventListener('change',()=>requestAnimationFrame(updateSummary));
  updateSummary();
}
function installConditionsStyles(){
  if(document.getElementById('conditionsCollapseStyles'))return;
  const s=document.createElement('style');s.id='conditionsCollapseStyles';s.textContent=`
  .conditions-panel{padding:0!important;overflow:hidden!important;background:linear-gradient(155deg,rgba(17,18,25,.94),rgba(10,11,16,.92))!important}
  .conditions-old-heading{display:none!important}
  .conditions-toggle{width:100%;min-height:62px;padding:10px 12px!important;display:grid!important;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:10px;text-align:left!important;background:transparent!important;border:0!important;color:inherit!important}
  .conditions-toggle-icon{width:34px;height:34px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(201,161,75,.46);background:rgba(35,29,21,.72);font-family:Georgia,serif;font-size:1.05rem;font-weight:800;color:#d6b76d}
  .conditions-toggle-copy{display:grid;min-width:0}.conditions-toggle-copy strong{font-family:Georgia,serif;font-size:.98rem;color:#eee0bd;letter-spacing:.03em}.conditions-toggle-copy small{font-size:.68rem;color:#8f897d;margin-top:2px}
  .conditions-toggle-chevron{font-size:1.05rem;color:#b59a61;transition:transform .16s ease}.conditions-panel.conditions-open .conditions-toggle-chevron{transform:rotate(180deg)}
  .conditions-panel #statuses{display:flex!important;flex-wrap:wrap!important;gap:8px!important;max-height:0;opacity:0;overflow:hidden;padding:0 12px!important;margin:0!important;transition:max-height .2s ease,opacity .15s ease,padding .2s ease}
  .conditions-panel.conditions-open #statuses{max-height:240px;opacity:1;padding:4px 12px 13px!important}
  .conditions-panel #statuses button{min-height:38px!important}
  .conditions-toggle.has-active-conditions .conditions-toggle-icon{border-color:rgba(221,148,67,.82);background:rgba(90,47,23,.72);color:#ffd18b;box-shadow:0 0 10px rgba(222,119,48,.13)}
  .conditions-toggle.has-active-conditions .conditions-toggle-copy small{color:#d7a96b}
  @media(prefers-reduced-motion:reduce){.conditions-panel #statuses,.conditions-toggle-chevron{transition:none!important}}
  `;document.head.appendChild(s);
}
installConditionsStyles();installConditionsCollapse();