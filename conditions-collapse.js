// Standalone Conditions dropdown for the player sheet.
// Reuses the existing #statuses buttons/state so all status rules remain unchanged.
function installConditionsCollapse(){
  const statuses=document.getElementById('statuses');
  const oldPanel=document.getElementById('combatStatusPanel')||statuses?.closest('article.panel');
  const attrs=document.querySelector('#sheetView .attribute-grid');
  if(!statuses||!oldPanel||!attrs||document.getElementById('conditionsControl'))return;

  const statusHome=document.getElementById('statusHome')||statuses.parentElement;
  const shell=document.createElement('section');
  shell.id='conditionsControl';
  shell.className='conditions-control';
  shell.innerHTML=`
    <button class="conditions-button" type="button" aria-expanded="false" aria-controls="conditionsList">
      <span class="conditions-button-icon">!</span>
      <span class="conditions-button-copy"><strong>Conditions</strong><small id="conditionsSummary">None active</small></span>
      <span class="conditions-button-chevron">⌄</span>
    </button>
    <div id="conditionsList" class="conditions-list" hidden></div>`;

  oldPanel.insertAdjacentElement('beforebegin',shell);
  const list=shell.querySelector('#conditionsList');
  list.appendChild(statusHome);
  oldPanel.style.display='none';

  const button=shell.querySelector('.conditions-button');
  const summary=shell.querySelector('#conditionsSummary');
  const updateSummary=()=>{
    const active=[...statuses.querySelectorAll('button')].filter(b=>b.classList.contains('active')||b.getAttribute('aria-pressed')==='true');
    summary.textContent=active.length?`${active.length} active`:'None active';
    button.classList.toggle('has-active-conditions',active.length>0);
  };
  const setOpen=open=>{
    button.setAttribute('aria-expanded',String(open));
    shell.classList.toggle('conditions-open',open);
    list.hidden=!open;
  };
  button.addEventListener('click',()=>setOpen(button.getAttribute('aria-expanded')!=='true'));
  statuses.addEventListener('click',()=>requestAnimationFrame(updateSummary));
  statuses.addEventListener('change',()=>requestAnimationFrame(updateSummary));
  updateSummary();
}
function installConditionsStyles(){
  if(document.getElementById('conditionsDropdownStyles'))return;
  const s=document.createElement('style');s.id='conditionsDropdownStyles';s.textContent=`
  .conditions-control{margin:10px 0 14px;border:1px solid rgba(198,159,73,.38);border-radius:14px;background:linear-gradient(155deg,rgba(17,18,25,.95),rgba(10,11,16,.94));overflow:hidden;box-shadow:inset 0 1px rgba(255,255,255,.025)}
  .conditions-button{width:100%;min-height:58px;padding:9px 12px!important;display:grid!important;grid-template-columns:36px minmax(0,1fr) auto;align-items:center;gap:10px;text-align:left!important;border:0!important;background:transparent!important;color:inherit!important;box-shadow:none!important}
  .conditions-button-icon{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;border:1px solid rgba(201,161,75,.5);background:rgba(35,29,21,.78);font-family:Georgia,serif;font-size:1rem;font-weight:800;color:#d6b76d}
  .conditions-button-copy{display:grid;min-width:0}.conditions-button-copy strong{font-family:Georgia,serif;font-size:1rem;color:#eee0bd;letter-spacing:.03em}.conditions-button-copy small{font-size:.7rem;color:#8f897d;margin-top:1px}
  .conditions-button-chevron{font-size:1.05rem;color:#b59a61;transition:transform .16s ease}.conditions-open .conditions-button-chevron{transform:rotate(180deg)}
  .conditions-button.has-active-conditions .conditions-button-icon{border-color:rgba(221,148,67,.82);background:rgba(90,47,23,.72);color:#ffd18b;box-shadow:0 0 10px rgba(222,119,48,.13)}
  .conditions-button.has-active-conditions .conditions-button-copy small{color:#d7a96b}
  .conditions-list{border-top:1px solid rgba(198,159,73,.2);padding:10px 11px 11px}.conditions-list[hidden]{display:none!important}
  .conditions-list #statusHome{display:block!important;margin:0!important;padding:0!important;max-height:none!important;opacity:1!important;overflow:visible!important}
  .conditions-list #statuses{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;margin:0!important;padding:0!important;max-height:none!important;opacity:1!important;overflow:visible!important}
  .conditions-list #statuses button{min-height:48px!important;padding:8px 9px!important}
  .conditions-list .status-rules-note{margin:9px 2px 0!important;font-size:.7rem!important;line-height:1.35!important;opacity:.68}
  @media(min-width:641px){.conditions-list #statuses{grid-template-columns:repeat(3,minmax(0,1fr))!important}}
  @media(prefers-reduced-motion:reduce){.conditions-button-chevron{transition:none!important}}
  `;document.head.appendChild(s);
}
installConditionsStyles();installConditionsCollapse();